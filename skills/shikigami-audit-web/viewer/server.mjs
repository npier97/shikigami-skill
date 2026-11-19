#!/usr/bin/env node
// Live agent viewer: streams normalized events over SSE to web/index.html.
// No dependencies. Runs outside the model loop, so it costs no tokens.
//
//   node viewer/server.mjs                         # live: follow agents started from now
//   node viewer/server.mjs --replay --speed 10     # replay the last run of the skill
//   node viewer/server.mjs --replay --session <id> --loop

import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import http from "node:http";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { latestSessionFor, projectDirFor, replaySession, watchProject } from "./sources/transcripts.mjs";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "web");
const HEARTBEAT_MS = 15_000;
// Live mode stops itself once every agent is done and nothing new spawned for this long.
const LIVE_IDLE_EXIT_MS = 90_000;
const LIVE_MAX_MS = 3 * 60 * 60_000;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json",
};

const { values: opt } = parseArgs({
  options: {
    cwd: { type: "string", default: process.cwd() },
    session: { type: "string" },
    skill: { type: "string", default: "shikigami-audit-web" },
    replay: { type: "boolean", default: false },
    speed: { type: "string", default: "10" },
    loop: { type: "boolean", default: false },
    port: { type: "string", default: "0" },
    "port-file": { type: "string" },
  },
});

const projectDir = projectDirFor(opt.cwd);
const clients = new Set();
let history = [];

const send = (res, ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`);

const emit = (ev) => {
  if (ev.kind === "reset") history = [];
  history.push(ev);
  for (const res of clients) send(res, ev);
};

const serveStatic = (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  const file = normalize(join(WEB_ROOT, path === "/" ? "index.html" : path));
  if (!file.startsWith(WEB_ROOT + sep)) {
    res.writeHead(403).end();
    return;
  }
  const stream = createReadStream(file);
  stream.on("open", () => {
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    stream.pipe(res);
  });
  stream.on("error", () => res.writeHead(404).end());
};

// Binding to 127.0.0.1 is not enough on its own: with DNS rebinding, a web page can point its
// own domain at 127.0.0.1 and read this server. Its requests then carry that domain in Host,
// so anything not addressed to the loopback names is refused.
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const isLoopbackHost = (host = "") => LOOPBACK_HOSTS.has(host.toLowerCase().replace(/:\d+$/, ""));

const server = http.createServer((req, res) => {
  if (!isLoopbackHost(req.headers.host)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" }).end("Forbidden host\n");
    return;
  }
  if (req.url === "/events") {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    // A late client gets the run so far in one batch and fast-forwards through it.
    res.write(`event: history\ndata: ${JSON.stringify(history)}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }
  serveStatic(req, res);
});

setInterval(() => {
  for (const res of clients) res.write(": ping\n\n");
}, HEARTBEAT_MS).unref();

const startLive = () => {
  const spawned = new Set();
  const finished = new Set();
  let lastChange = Date.now();

  // Open with the lead at the whiteboard before the audit launches anyone; agents walk in as they start.
  emit({ t: Date.now(), kind: "spawn", agentId: "lead", label: "Coordination", lead: true });

  const stop = watchProject({
    projectDir,
    skill: opt.skill,
    since: Date.now(),
    emit: (ev) => {
      // The lead never hands back: only sub-agents decide when the run is over.
      if (ev.kind === "spawn" && !ev.lead) spawned.add(ev.agentId);
      if (ev.kind === "done") finished.add(ev.agentId);
      if (ev.kind === "spawn" || ev.kind === "done") lastChange = Date.now();
      emit(ev);
    },
  });

  const startedAt = Date.now();
  setInterval(() => {
    const allDone = spawned.size > 0 && finished.size === spawned.size;
    const idle = Date.now() - lastChange > LIVE_IDLE_EXIT_MS;
    if ((allDone && idle) || Date.now() - startedAt > LIVE_MAX_MS) {
      stop();
      emit({ t: Date.now(), kind: "end" });
      setTimeout(() => process.exit(0), 2_000);
    }
  }, 5_000).unref();
};

const startReplay = async () => {
  const sessionDir = opt.session ? join(projectDir, opt.session) : await latestSessionFor(projectDir, opt.skill);
  if (!sessionDir) throw new Error(`No session with ${opt.skill} subagents in ${projectDir}`);
  console.log(`Replaying ${sessionDir} at x${opt.speed}`);
  await replaySession({ sessionDir, skill: opt.skill, speed: Number(opt.speed), loop: opt.loop, emit });
};

server.listen(Number(opt.port), "127.0.0.1", async () => {
  const url = `http://localhost:${server.address().port}/`;
  console.log(`VIEWER_URL=${url}`);
  if (opt["port-file"]) await writeFile(opt["port-file"], String(server.address().port));
  try {
    if (opt.replay) await startReplay();
    else startLive();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
});
