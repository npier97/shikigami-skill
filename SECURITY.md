# Security policy

## Reporting a vulnerability

Please report security problems **privately**, not in a public issue:

- use GitHub's private reporting form:
  [Report a vulnerability](https://github.com/npier97/shikigami-skill/security/advisories/new)
  (Security tab → "Report a vulnerability").

Include what you found, how to reproduce it, and the impact you expect. Reports are handled on a
best-effort basis; you will get an answer in the advisory thread, and credit in the fix if you
want it.

## Supported versions

Only the latest commit on `main` is supported. There are no released versions yet.

## What runs, and where

This repository holds Claude Code skills and a local viewer. Nothing in it is a hosted service.

- **The audit skill** (`skills/audit-web`) runs inside your Claude Code session, with
  that session's permissions. It reads the audited repository, queries the audited site with
  `curl`, `dig` and `openssl`, and writes its data to `.audit-web/` in that repository. It
  publishes the report as a Claude Artifact, private by default, and sends tickets to Jira only
  after you approve them explicitly.
- **`scripts/build.py`** uses the Python standard library only and makes no network calls.
- **`scripts/live_checks.py`** uses the Python standard library and calls `curl`, `dig` and
  `openssl` with GET/HEAD requests only, against the site in `.audit-web/config.json`. It writes
  only to the output folder you pass it.
- **The viewer** (`viewer/`) is a Node.js server with no dependencies. It:
  - listens on `127.0.0.1` only, on a free port by default, and refuses any request not
    addressed to `localhost`, `127.0.0.1` or `[::1]` (protection against DNS rebinding);
  - reads the transcripts Claude Code writes under `~/.claude/projects/`, keeping only the
    records of the skill it watches;
  - serves its own page and an event stream, and refuses file paths outside `viewer/web/`;
  - sends nothing to the network.
- **Exported replays** are static HTML files. They contain the agents' short action labels,
  error labels and result counts, never audit findings or file contents. Review a replay before
  sharing it if your agents' descriptions may mention client names.

## In scope

- A way for another local process or web page to read the viewer's event stream or files.
- Path traversal or arbitrary file reads through the viewer server.
- Script injection through transcript content rendered by the viewer or a replay.
- The skill instructions causing data to leave the machine without the user's approval.

## Out of scope

- Findings that require an already compromised machine or Claude Code installation.
- The behaviour of Claude Code itself, the Claude models, or third-party services (GitHub,
  Jira, the audited site). Report those to their vendors.
