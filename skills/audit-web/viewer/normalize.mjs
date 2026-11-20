// Turns raw Claude Code transcript records into the viewer's event contract.
// The renderer only ever sees these events, never transcript internals.
//
//   { t, kind: "spawn", agentId, label, lead? }
//   { t, kind: "tool",  agentId, tool, icon: "web"|"read"|"run"|"write", text, rule?, place? }
//   { t, kind: "think", agentId, ms }
//   { t, kind: "error", agentId, text }
//   { t, kind: "done",  agentId, summary? }        summary: { pass, partial, fail, check, na }
//
// `rule` comes from a description that starts with the rule number ("R228 · …").
// `place` is where in the office the action happens: "shelf" (reference docs), "window"
// (the live site), "printer" (writing results); none means the agent's own desk.

const MAX_TEXT = 60;
const MAX_ERROR_TEXT = 140;
const HANDBACK_TOOL = "SubagentHandback";
const STATUSES = ["pass", "partial", "fail", "check", "na"];

// Order matters: a redirect (`cat > f`) is a write even though it starts with a reader.
const BASH_ICONS = [
  // A plain `>`/`>>` redirect to a file; `2>/dev/null`, `>&2` and `>/dev/null` don't count.
  [/(^|\s)>{1,2}\s*(?!\/dev\/null|&)[\w./$~-]|\btee\b|\bmkdir\b|\bcp\b|\bmv\b/, "write"],
  [/\b(curl|wget|dig|nslookup|openssl|lighthouse|pa11y|playwright|httpie)\b/, "web"],
  [/\b(pnpm|npm|npx|node|python3?|vitest|astro)\b/, "run"],
  [/\b(cat|grep|rg|sed|head|tail|ls|find|jq|wc|awk|less)\b/, "read"],
];

const TOOL_ICONS = {
  Read: "read",
  Grep: "read",
  Glob: "read",
  WebFetch: "web",
  WebSearch: "web",
  Write: "write",
  Edit: "write",
  NotebookEdit: "write",
};

// The main session does much more than the audit (UI, planning…): only these tools show.
const LEAD_TOOLS = {
  Bash: null,
  Read: null,
  Write: null,
  Edit: null,
  Agent: { icon: "run", text: (input) => `Lance ${input.description ?? "un agent"}` },
  Artifact: { icon: "web", text: () => "Publie le rapport" },
  Skill: { icon: "run", text: () => "Démarre l'audit" },
};

// Fallback labels when a Bash call has no description (UI text is French).
const COMMAND_LABELS = {
  cat: "lit un fichier",
  sed: "lit un extrait",
  head: "lit un extrait",
  tail: "lit un extrait",
  less: "lit un fichier",
  grep: "cherche dans le code",
  rg: "cherche dans le code",
  find: "parcourt les dossiers",
  ls: "parcourt les dossiers",
  jq: "lit des données",
  wc: "compte",
  curl: "interroge le site",
  wget: "interroge le site",
  dig: "vérifie le DNS",
  openssl: "vérifie le certificat",
  python: "lance un script",
  python3: "lance un script",
  node: "lance un script",
  pnpm: "lance une commande",
  npx: "lance un outil",
};

const RULE_PREFIXES = [/^\s*R\s?(\d{1,3})\s*[·:–-]/i, /^\s*R?\s?(V4-\d{1,2})\s*[·:–-]/i];
const REFERENCE_FILES = /\/references\/|methode\.md|accessibilite\.md|rules-v5\.json/;

const clip = (s, max = MAX_TEXT) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
const baseName = (p = "") => p.split("/").filter(Boolean).pop() ?? p;

export const iconFor = (tool, input = {}) => {
  if (TOOL_ICONS[tool]) return TOOL_ICONS[tool];
  if (tool === "Bash") {
    const cmd = String(input.command ?? "");
    return BASH_ICONS.find(([re]) => re.test(cmd))?.[1] ?? "run";
  }
  return tool.startsWith("mcp__") ? "web" : "run";
};

// A short human label. Never the raw command: it holds paths and is unreadable in a bubble.
export const textFor = (tool, input = {}) => {
  if (input.description) return clip(String(input.description));
  if (tool === "Bash") {
    const cmd = String(input.command ?? "")
      .split(/[;&|\n]/)
      .map((part) => part.trim())
      .find((part) => part && !/^\w+=/.test(part) && !/^cd\s/.test(part));
    const verb = cmd ? baseName(cmd.split(/\s+/)[0]) : "";
    return clip(COMMAND_LABELS[verb] ?? "lance une commande");
  }
  if (input.file_path) return clip(baseName(input.file_path));
  if (input.url) {
    try {
      return clip(new URL(input.url).host);
    } catch {
      return clip(String(input.url));
    }
  }
  if (input.pattern) return clip(String(input.pattern));
  return tool;
};

export const ruleFor = (text = "") => {
  for (const re of RULE_PREFIXES) {
    const m = text.match(re);
    if (m) return m[1].toUpperCase();
  }
  return null;
};

export const placeFor = (tool, input = {}, icon) => {
  if (icon === "web") return "window";
  if (REFERENCE_FILES.test(`${input.command ?? ""} ${input.file_path ?? ""}`)) return "shelf";
  if (icon === "write") return "printer";
  return null;
};

// "pass 26, partial 3 …", "- pass : 5 (…)", "partial 13, pass 6": first count per status.
export const summaryFor = (message = "") => {
  const summary = {};
  for (const m of message.matchAll(/\b(pass|partial|fail|check|na)\b\s*[:：]?\s*(\d+)/gi)) {
    const key = m[1].toLowerCase();
    if (!(key in summary)) summary[key] = Number(m[2]);
  }
  return STATUSES.some((k) => k in summary) ? Object.fromEntries(STATUSES.map((k) => [k, summary[k] ?? 0])) : null;
};

const blocksOf = (rec) => {
  const content = rec.message?.content;
  return Array.isArray(content) ? content.filter((b) => b && typeof b === "object") : [];
};

// One normalizer per agent: it dedupes tool_use ids, which the transcript can log twice.
export const createNormalizer = (agentId, { lead = false } = {}) => {
  const seen = new Set();
  // Label of each action by tool_use id. An error names the action that failed rather than
  // quoting its output, which is noisy and full of paths.
  const actionText = new Map();
  let done = false;

  const toolEvent = (t, b) => {
    const input = b.input ?? {};
    if (lead) {
      if (!(b.name in LEAD_TOOLS)) return null;
      const special = LEAD_TOOLS[b.name];
      if (special) return { t, kind: "tool", agentId, tool: b.name, icon: special.icon, text: clip(special.text(input)) };
    }
    const icon = iconFor(b.name, input);
    const text = textFor(b.name, input);
    const ev = { t, kind: "tool", agentId, tool: b.name, icon, text };
    const rule = ruleFor(text);
    const place = placeFor(b.name, input, icon);
    if (rule) ev.rule = rule;
    if (place) ev.place = place;
    return ev;
  };

  return (rec) => {
    const t = Date.parse(rec.timestamp ?? "");
    if (Number.isNaN(t) || done) return [];
    const out = [];

    for (const b of blocksOf(rec)) {
      if (rec.type === "assistant" && b.type === "thinking") {
        out.push({ t, kind: "think", agentId, ms: rec.thinkingDurationMs ?? 0 });
      } else if (rec.type === "assistant" && b.type === "tool_use") {
        if (seen.has(b.id)) continue;
        seen.add(b.id);
        if (b.name === HANDBACK_TOOL && !lead) {
          done = true;
          const summary = summaryFor(String(b.input?.message ?? ""));
          out.push(summary ? { t, kind: "done", agentId, summary } : { t, kind: "done", agentId });
        } else {
          const ev = toolEvent(t, b);
          if (ev) {
            actionText.set(b.id, ev.text);
            out.push(ev);
          }
        }
      } else if (rec.type === "user" && b.type === "tool_result" && b.is_error) {
        const action = actionText.get(b.tool_use_id);
        out.push({ t, kind: "error", agentId, text: clip(action ? `Échec : ${action}` : "Une action a échoué", MAX_ERROR_TEXT) });
      }
    }
    return out;
  };
};
