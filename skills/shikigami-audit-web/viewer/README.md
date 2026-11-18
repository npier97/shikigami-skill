# Live agent viewer

A top-down pixel office where each sub-agent of the audit is a character at a desk. It runs
outside the model loop: **no tokens**, no hooks, no dependencies (Node ≥ 20).

```
server.mjs              SSE server + static files, picks live or replay mode
export-replay.mjs       saves a run as one offline HTML file
normalize.mjs           transcript record → viewer event (the contract)
sources/transcripts.mjs reads ~/.claude/projects/<cwd>/<session>/subagents/*.jsonl
web/index.html          canvas scene + accessible agent list (French UI)
web/sprites.js          character pixel grids, per-agent looks and accessories
```

## Editing the characters

Characters are 16 px pixel grids in `web/sprites.js`, one letter per pixel (legend at the top of
the file): front, back, side (mirrored for left), plus blink and happy faces. Legs, hands and
accessories are drawn in code because they animate. Keep every grid row exactly 16 characters
wide.

Each pair of audit themes (the skill's four-agent split) has its own character in `LOOKS`: a full
name (two Japanese words, one per theme), hair, eyes, clothes and an accessory. The viewer picks
the character from the theme words in the agent's description (`Opquast · Navigation &
présentation` → Michi Iro), so the same work keeps the same character across runs. An unknown
theme or a fifth agent gets a spare look (Hana, Sora, Hoshi, Taiyo).

| Name         | Meaning                    | Theme words                                     | Accessory  |
| ------------ | -------------------------- | ----------------------------------------------- | ---------- |
| Fumi Kaku    | 文 writing, 書く to write  | contenu, texte, donnée, formulaire, commerce    | glasses    |
| Tsuna Hikari | 綱 link, 光 light          | lien, identification, contact, image, média     | headphones |
| Michi Iro    | 道 path, 色 color          | navigation, présentation, couleur, contraste    | cat ears   |
| Mamo Kumo    | 守る to protect, 雲 cloud  | sécurité, serveur, perf, structure, code        | beanie     |

## Run

From the client repository root:

```bash
node <skill>/viewer/server.mjs                       # live: agents started from now on
node <skill>/viewer/server.mjs --replay --speed 12   # replay the last audit run
node <skill>/viewer/server.mjs --replay --session <id> --loop
```

To keep a run, export it as one self-contained HTML file that replays offline (open it by
double-click; add `?speed=10` to the URL to speed it up):

```bash
node <skill>/viewer/export-replay.mjs --out ~/Downloads/replay.html                  # last finished run
node <skill>/viewer/export-replay.mjs --session <id> --out ~/Downloads/replay.html
```

For previews, `demo/make-demo.mjs` writes a scripted run with no real data, and
`export-replay.mjs --events <file>` turns any event list into a replay. `?walk=1.5` in a
viewer URL speeds walking up (0.25 to 4), which suits short recordings:

```bash
node <skill>/viewer/demo/make-demo.mjs > demo-run.json
node <skill>/viewer/export-replay.mjs --events demo-run.json --out demo.html   # open demo.html?walk=1.5
```

The server prints `VIEWER_URL=http://localhost:<port>/`. Options: `--port` (default: free port),
`--port-file <path>`, `--skill` (default `shikigami-audit-web`), `--cwd`.

Live mode exits on its own 90 s after the last agent finishes.

## What the page shows

- **Office:** each sub-agent walks in to its desk. It goes to the shelf when reading the
  skill's references, to a window when testing the live site, to the printer when writing
  results, then back. Above ×5 replay speed, agents stay at their desks.
- **Lead (Kantoku):** the main session's skill work. It supervises from the whiteboard, then
  merges the copies at the table once every agent has handed in.
- **Progress:** "12/31 règles" per agent, on the desk and in the list. The total comes from
  the agent label (`… (31)`), the count from the `R<id> · …` prefix of its Bash descriptions.
- **Whiteboard scoreboard:** one bar per agent, filled with its pass / partial / fail / check /
  N/A counts once it hands back (parsed from `pass N, partial N…` in its final message).
- **Detail panel:** click a character, its desk or its list row (keyboard: Tab, Enter,
  Escape to close). It shows themes, status, progress, time, the result, errors (the action
  that failed, never its output) and the last 12 actions. Hovering shows the current action.
- **Reactions:** a lightbulb when a long think ends in an action, coffee after 12 s idle, a
  cheer from the agents already at the table when another one arrives.
- **End card:** durations and results per agent when the run ends.
- **Exported replays** add play/pause, speed (×1, ×5, ×20) and a timeline you can drag.

## Event contract

```ts
{ t, kind: "spawn", agentId, label, lead? }
{ t, kind: "tool",  agentId, tool, icon: "web"|"read"|"run"|"write", text, rule?, place? }
{ t, kind: "think", agentId, ms }
{ t, kind: "error", agentId, text }
{ t, kind: "done",  agentId, summary? }   // summary: { pass, partial, fail, check, na }
{ kind: "reset" | "end" }
```

`place` is `"shelf" | "window" | "printer"`; none means the agent's desk. The lead's
`agentId` is `"lead"`; it never sends `done`.

The page only knows these events. To feed it from hooks later (plugin version), add a
`sources/hooks.mjs` that emits the same shapes.

## Known limits

- The transcript layout is internal to Claude Code: if a version changes it, only
  `sources/transcripts.mjs` needs fixing.
- Bubbles are only as good as the agents' Bash `description` fields; without one, the label
  falls back to a generic verb ("lit un fichier").
- Not available in cloud sessions (claude.ai/code): the user can't reach localhost there.
- The lead only shows main-session records Claude Code attributes to the skill; work done
  after the skill turn ends (publishing, for example) may not appear.
- Exports hold the agents' action labels, error labels and result counts, never findings.
