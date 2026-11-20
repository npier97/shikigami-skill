#!/usr/bin/env node
// Saves a run as one self-contained HTML file that replays offline: no server, no Claude Code.
// The page, the sprites and the run's events are inlined; a stand-in EventSource plays them.
//
//   node viewer/export-replay.mjs --out ~/Downloads/replay.html            # last finished run
//   node viewer/export-replay.mjs --session <id> --out replay.html
//   node viewer/export-replay.mjs --dir <folder with subagents/> --out replay.html
//
// The file has play/pause, speed and seek controls, and accepts ?speed=N in its URL.
// With --dir, the main session transcript (the lead) is read from <dir>.jsonl if present.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { latestSessionFor, projectDirFor, replaySession } from "./sources/transcripts.mjs";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "web");

const { values: opt } = parseArgs({
  options: {
    cwd: { type: "string", default: process.cwd() },
    session: { type: "string" },
    dir: { type: "string" },
    skill: { type: "string", default: "audit-web" },
    // A ready-made event list (JSON array) instead of transcripts, e.g. the scripted demo run.
    events: { type: "string" },
    out: { type: "string" },
  },
});
if (!opt.out) throw new Error("--out <file.html> is required");

const fromTranscripts = async () => {
  const projectDir = projectDirFor(opt.cwd);
  const sessionDir = opt.dir
    ? resolve(opt.dir)
    : opt.session
      ? join(projectDir, opt.session)
      : await latestSessionFor(projectDir, opt.skill);
  if (!sessionDir) throw new Error(`No finished ${opt.skill} run in ${projectDir}`);
  // Same events the live server would stream, collected without waiting.
  const list = [];
  await replaySession({
    sessionDir, skill: opt.skill, speed: Infinity, loop: false,
    emit: (ev) => ev.kind !== "reset" && ev.kind !== "end" && list.push(ev),
  });
  return { list, source: sessionDir };
};

const { list: events, source: sessionDir } = opt.events
  ? { list: JSON.parse(await readFile(resolve(opt.events), "utf8")), source: resolve(opt.events) }
  : await fromTranscripts();

// A timeline player behind a stand-in EventSource. It exposes window.ReplayControl, which
// the page turns into play/pause, speed and seek controls. Quiet gaps are capped like the
// server's replay, so the timeline length is the capped one.
const player = `
(() => {
  const EVENTS = ${JSON.stringify(events).replace(/</g, "\\u003c")};
  const MAX_GAP_MS = 4000, TICK_MS = 50;
  const offsets = [];
  EVENTS.forEach((e, i) => offsets.push(i ? offsets[i - 1] + Math.min(e.t - EVENTS[i - 1].t, MAX_GAP_MS) : 0));
  const DURATION = offsets.at(-1) ?? 0;
  let speed = Number(new URLSearchParams(location.search).get("speed")) || 1;
  let pos = 0, next = 0, playing = true, ended = false, source = null, last = performance.now();

  const send = (ev) => source?.onmessage?.({ data: JSON.stringify(ev) });
  const seek = (ms) => {
    pos = Math.max(0, Math.min(ms, DURATION));
    next = offsets.findIndex((o) => o > pos);
    if (next < 0) next = EVENTS.length;
    ended = false;
    const history = [{ kind: "reset", mode: "replay", speed }, ...EVENTS.slice(0, next)];
    for (const f of source?.listeners.history ?? []) f({ data: JSON.stringify(history) });
  };
  setInterval(() => {
    const now = performance.now();
    if (playing && source) {
      pos = Math.min(DURATION, pos + (now - last) * speed);
      while (next < EVENTS.length && offsets[next] <= pos) send(EVENTS[next++]);
      if (next >= EVENTS.length && !ended) { ended = true; playing = false; send({ t: EVENTS.at(-1).t, kind: "end" }); }
    }
    last = now;
  }, TICK_MS);

  window.ReplayControl = {
    get duration() { return DURATION; }, get position() { return pos; },
    get playing() { return playing; }, get speed() { return speed; },
    play() { if (ended || pos >= DURATION) seek(0); playing = true; },
    pause() { playing = false; },
    setSpeed(s) { speed = s; },
    seek,
  };

  window.EventSource = class {
    statusLabel = "Rejeu enregistré";
    listeners = {};
    constructor() { source = this; setTimeout(() => { this.onopen?.(); seek(0); }, 0); }
    addEventListener(type, f) { (this.listeners[type] ??= []).push(f); }
    close() { playing = false; }
  };
})();`;

const page = await readFile(join(WEB_ROOT, "index.html"), "utf8");
const sprites = await readFile(join(WEB_ROOT, "sprites.js"), "utf8");
const tag = '<script src="sprites.js"></script>';
if (!page.includes(tag)) throw new Error("index.html no longer loads sprites.js as expected");

const html = page.replace(tag, () => `<script>${sprites}</script>\n<script>${player}</script>`);
await writeFile(resolve(opt.out), html);
console.log(`Saved ${events.length} events from ${sessionDir} to ${resolve(opt.out)}`);
