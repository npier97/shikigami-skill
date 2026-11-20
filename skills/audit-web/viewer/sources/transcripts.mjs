// Event source: tails the subagent transcripts Claude Code already writes to disk.
// Needs no hooks and costs no tokens. The layout is internal to Claude Code, so every
// path and field assumption about it lives in this file and nowhere else.
//
//   ~/.claude/projects/<encoded cwd>/<sessionId>.jsonl                  main session (the lead)
//   ~/.claude/projects/<encoded cwd>/<sessionId>/subagents/agent-<id>.jsonl
//                                                          agent-<id>.meta.json

import { open, readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { createNormalizer } from "../normalize.mjs";

const AGENT_FILE = /^agent-(.+)\.jsonl$/;
const LEAD_ID = "lead";
const LIVE_POLL_MS = 500;
// A file created slightly before the server started still belongs to this run.
const LIVE_GRACE_MS = 5_000;
const MAX_REPLAY_GAP_MS = 4_000;

// Names a run can be recorded under: the skill alone (copied into ~/.claude/skills), the plugin
// install ("shikigami:audit-web"), and the pre-rename names, so older runs still replay.
// Never match any "<plugin>:audit-web": another plugin may ship a skill with the same name.
const PLUGIN = "shikigami";
const LEGACY = { "audit-web": ["shikigami-audit-web", "shikigami:shikigami-audit-web"] };
const skillNames = (skill) => [skill, `${PLUGIN}:${skill}`, ...(LEGACY[skill] ?? [])];
const isSkill = (name, skill) => skillNames(skill).includes(name);
const LOOP_PAUSE_MS = 4_000;
// In a replay, the lead's work around the run: shared checks before, merge and publish after.
const LEAD_BEFORE_MS = 10 * 60_000;
const LEAD_AFTER_MS = 10 * 60_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const projectDirFor = (cwd) =>
  join(homedir(), ".claude", "projects", cwd.replace(/[^a-zA-Z0-9]/g, "-"));

const readMeta = async (file) => {
  try {
    return JSON.parse(await readFile(file.replace(/\.jsonl$/, ".meta.json"), "utf8"));
  } catch {
    return null;
  }
};

const agentFilesIn = async (sessionDir) => {
  const dir = join(sessionDir, "subagents");
  try {
    return (await readdir(dir)).filter((f) => AGENT_FILE.test(f)).map((f) => join(dir, f));
  } catch {
    return [];
  }
};

// Reads an agent transcript incrementally. Until a record names the skill, its events are
// held back, so agents from other skills never show up.
const createAgentReader = (file, { skill }) => {
  const agentId = basename(file).match(AGENT_FILE)[1];
  const normalize = createNormalizer(agentId);
  const decoder = new StringDecoder("utf8");
  let offset = 0;
  let partial = "";
  let spawned = false;
  let done = false;
  let lastT = 0;
  let skillOk = skill ? null : true;
  let pending = [];

  const read = async () => {
    const fh = await open(file, "r");
    try {
      const { size } = await fh.stat();
      if (size <= offset) return "";
      const buf = Buffer.alloc(size - offset);
      await fh.read(buf, 0, buf.length, offset);
      offset = size;
      return decoder.write(buf);
    } finally {
      await fh.close();
    }
  };

  const pull = async () => {
    const lines = (partial + (await read())).split("\n");
    partial = lines.pop();
    const out = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      let rec;
      try {
        rec = JSON.parse(line);
      } catch {
        continue;
      }
      if (skillOk === null && rec.attributionSkill) skillOk = isSkill(rec.attributionSkill, skill);
      const t = Date.parse(rec.timestamp ?? "");
      if (Number.isNaN(t)) continue;
      lastT = Math.max(lastT, t);
      if (!spawned) {
        const meta = await readMeta(file);
        out.push({ t, kind: "spawn", agentId, label: meta?.description ?? `Agent ${agentId.slice(0, 4)}` });
        spawned = true;
      }
      for (const ev of normalize(rec)) {
        if (ev.kind === "done") done = true;
        out.push(ev);
      }
    }

    // Fallback when the handback record is missing: meta.json flags the agent finished.
    if (spawned && !done && (await readMeta(file))?.finished) {
      done = true;
      out.push({ t: lastT, kind: "done", agentId });
    }

    if (skillOk === false) return [];
    if (skillOk === null) {
      pending.push(...out);
      return [];
    }
    const ready = [...pending, ...out];
    pending = [];
    return ready;
  };

  return { agentId, pull };
};

// The main session, seen as the "lead": only its records attributed to the skill, within
// [from, to]. Its transcript holds the whole conversation, so nothing else is shown.
const createLeadReader = (file, { skill, from = 0, to = Infinity }) => {
  const normalize = createNormalizer(LEAD_ID, { lead: true });
  const decoder = new StringDecoder("utf8");
  let offset = 0;
  let partial = "";
  let spawned = false;

  const pull = async () => {
    let chunk = "";
    const fh = await open(file, "r").catch(() => null);
    if (!fh) return [];
    try {
      const { size } = await fh.stat();
      if (size > offset) {
        const buf = Buffer.alloc(size - offset);
        await fh.read(buf, 0, buf.length, offset);
        offset = size;
        chunk = decoder.write(buf);
      }
    } finally {
      await fh.close();
    }
    const lines = (partial + chunk).split("\n");
    partial = lines.pop();
    const out = [];
    for (const line of lines) {
      if (!line.includes(skill)) continue; // cheap pre-filter: the file is large
      let rec;
      try {
        rec = JSON.parse(line);
      } catch {
        continue;
      }
      if (!isSkill(rec.attributionSkill, skill) || rec.isSidechain) continue;
      const t = Date.parse(rec.timestamp ?? "");
      if (Number.isNaN(t) || t < from || t > to) continue;
      if (!spawned) {
        out.push({ t, kind: "spawn", agentId: LEAD_ID, label: "Coordination", lead: true });
        spawned = true;
      }
      out.push(...normalize(rec));
    }
    return out;
  };

  return { pull };
};

const mainFileOf = (sessionDir) => `${sessionDir.replace(/\/+$/, "")}.jsonl`;

const sessionDirs = async (projectDir) => {
  const names = await readdir(projectDir).catch(() => []);
  const dirs = await Promise.all(
    names.map(async (name) => {
      const dir = join(projectDir, name);
      const st = await stat(join(dir, "subagents")).catch(() => null);
      return st ? { dir, mtimeMs: st.mtimeMs } : null;
    }),
  );
  return dirs.filter(Boolean).sort((a, b) => b.mtimeMs - a.mtimeMs);
};

// Most recent session whose `skill` subagents all finished: an interrupted run would
// replay agents that never leave their desks.
export const latestSessionFor = async (projectDir, skill) => {
  const markers = skillNames(skill).map((name) => `"attributionSkill":"${name}"`);
  for (const { dir } of await sessionDirs(projectDir)) {
    let found = 0;
    let complete = true;
    for (const file of await agentFilesIn(dir)) {
      const text = await readFile(file, "utf8");
      if (!markers.some((m) => text.includes(m))) continue;
      found++;
      if (!(await readMeta(file))?.finished) complete = false;
    }
    if (found && complete) return dir;
  }
  return null;
};

export const replaySession = async ({ sessionDir, skill, speed, loop, emit }) => {
  const events = [];
  for (const file of await agentFilesIn(sessionDir)) {
    events.push(...(await createAgentReader(file, { skill }).pull()));
  }
  if (!events.length) throw new Error(`No ${skill} subagent events in ${sessionDir}`);
  const times = events.map((e) => e.t);
  const lead = createLeadReader(mainFileOf(sessionDir), {
    skill,
    from: Math.min(...times) - LEAD_BEFORE_MS,
    to: Math.max(...times) + LEAD_AFTER_MS,
  });
  events.push(...(await lead.pull()));
  events.sort((a, b) => a.t - b.t);

  do {
    emit({ kind: "reset", mode: "replay", speed });
    let prev = events[0].t;
    for (const ev of events) {
      await sleep(Math.min((ev.t - prev) / speed, MAX_REPLAY_GAP_MS));
      prev = ev.t;
      emit(ev);
    }
    emit({ t: prev, kind: "end" });
    if (loop) await sleep(LOOP_PAUSE_MS);
  } while (loop);
};

// Watches every session of the project and follows agent files created after `since`.
export const watchProject = ({ projectDir, skill, since, emit }) => {
  const readers = new Map();
  const ignored = new Set();
  let busy = false;

  // Main sessions active since `since` may be running the skill: follow them as the lead.
  const watchMainFiles = async () => {
    for (const name of await readdir(projectDir).catch(() => [])) {
      if (!name.endsWith(".jsonl")) continue;
      const file = join(projectDir, name);
      if (readers.has(file) || ignored.has(file)) continue;
      const { mtimeMs } = await stat(file);
      if (mtimeMs >= since - LIVE_GRACE_MS) readers.set(file, createLeadReader(file, { skill, from: since - LIVE_GRACE_MS }));
    }
  };

  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await watchMainFiles();
      for (const { dir, mtimeMs } of await sessionDirs(projectDir)) {
        if (mtimeMs < since - LIVE_GRACE_MS) break;
        for (const file of await agentFilesIn(dir)) {
          if (readers.has(file) || ignored.has(file)) continue;
          const { birthtimeMs } = await stat(file);
          if (birthtimeMs < since - LIVE_GRACE_MS) ignored.add(file);
          else readers.set(file, createAgentReader(file, { skill }));
        }
      }
      for (const reader of readers.values()) {
        for (const ev of await reader.pull()) emit(ev);
      }
    } finally {
      busy = false;
    }
  };

  const run = () => tick().catch((err) => console.error(err));
  run(); // don't wait a poll interval for agents that already started
  const timer = setInterval(run, LIVE_POLL_MS);
  return () => clearInterval(timer);
};
