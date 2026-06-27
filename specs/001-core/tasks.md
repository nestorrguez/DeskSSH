# Tasks — 001 Core

> Breakdown of the work, derived from [`spec.md`](./spec.md) and
> [`plan.md`](./plan.md). **No code is written for a task that doesn't exist here**
> (see `CLAUDE.md`). Each task references the `FR-`/Article it serves.
> Detailed since: 2026-06-26. M0–M1 are detailed; M2–M3 are outlined and broken
> down when tackled.

## Preconditions (definition phase) — DONE

- [x] **web-first + agnostic core** confirmed (plan §1).
- [x] **License** chosen — AGPL-3.0-or-later (spec §9.1).
- [x] **Stack** confirmed — TS + Node + ssh2 + React, Tailwind + Radix (shadcn/ui),
      Lucide, xterm.js (plan §3).
- [x] **v1 app set** agreed — connection, shell, files, editor, terminal, monitor
      (spec §9.7).
- [x] Credentials (no persistence), ssh-agent (post-v1), drag&drop (post-v1), i18n
      (EN+ES, ready day 1) resolved.

> ~~Only minor open item: browser behavior of "Open on the client" (FR-025).~~
> **Resolved (2026-06-27): plain download** (spec §9.8).

---

## M0 — Scaffolding

Goal: an empty but coherent monorepo that builds, lints, tests and publishes.

- [x] **M0.1** Initialize pnpm-workspace monorepo with packages `core`, `server`,
      `web`. → plan §2
- [x] **M0.2** Root TypeScript config (strict) shared across packages.
- [x] **M0.3** Linting/formatting (ESLint + Prettier) and a `test` runner
      (Vitest) wired at the root.
- [x] **M0.4** Basic CI (GitHub Actions): install, lint, typecheck, test, build on
      push/PR. → plan §6
- [x] **M0.5** Add `CONTRIBUTING.md` (SDD flow, English-only repo, how to propose
      via `specs/`). `LICENSE` already present. → Art. 9
- [x] **M0.6** Minimal i18n scaffolding decision/setup so strings are externalized
      from day 1 (EN + ES catalogs stub). → NFR-i18n
- [x] **M0.7** Publish `deskssh` to npm (name claimed; `AGPL-3.0-or-later`, public
      access). Shipped as an installable app (`npx deskssh`), now on the 0.1.x line.
      → distribution

**M0 done when:** `pnpm install && pnpm -r build && pnpm -r test` pass in CI and the
`deskssh` name is reserved on npm.

---

## M1 — Connection core

Goal: the agnostic `core` can open an SSH session to a Debian/Ubuntu host, run typed
capabilities through an adapter, and log every command. Demonstrable via tests +
a minimal CLI (no web UI yet).

### Session layer

- [x] **M1.1** `SshSession` over `ssh2`: connect with **private key (PEM/OpenSSH/
      PKCS#8, optional passphrase)** and **password**; never persist secrets. → FR-002,
      FR-005, Art. 4
- [x] **M1.2** Session lifecycle + state (connecting / alive / dropped / error) with
      events. → FR-003
- [x] **M1.3** Channels: `exec` (run command), **PTY** (interactive shell), **SFTP**
      (`shell()`/`sftp()` exposed). v1 file capabilities use exec+base64; wiring SFTP
      into the file manager is M2. → FR-030/031, Art. 7
- [x] **M1.4** SSH host key verification via `verifyHostKey` hook (secure default:
      reject if absent). Persisted `known_hosts` policy deferred to M2. → plan §5, Art. 4

### Capability contract (IR)

- [x] **M1.5** Define the typed contract + core types (`FileEntry`, `Process`,
      `ServiceState`, `SystemMetrics`, capability-unsupported result). → plan §4
- [x] **M1.6** Single **execution point**: every command flows through it and is
      logged `{command, host, timestamp, exitCode}` (transparency + audit). → FR-013,
      Art. 3
- [x] **M1.7** Parser harness: parse → typed result, with **raw-output fallback**
      that never throws. → FR-091, Art. 7

### Adapter layer

- [x] **M1.8** OS detection on connect (`/etc/os-release`, `uname`) + adapter
      selection, with generic POSIX fallback. → FR-004, Art. 6
- [x] **M1.9** **Debian/Ubuntu adapter** (Tier 1) implementing the v1-needed
      capabilities (`listDir`, `stat`, `readFile`, `writeFile`, `systemMetrics`),
      preferring machine-readable output. → plan §4, Art. 6/10
- [x] **M1.10** Minimal CLI/harness to exercise the core against a real host
      (`packages/harness`; 25 automated tests + manual run). → plan §6 ("demonstrable")

**M1 done when:** connecting to a real Debian/Ubuntu host, listing a directory and
reading system metrics return typed results, every command is in the transparency
log, and a forced parse failure shows raw output without crashing.

---

## M2 — Shell + Terminal + File manager — DONE

- [x] **M2.1** Desktop shell: movable/resizable windows, taskbar, app launcher. →
      FR-010/011/012
- [x] **M2.2** Terminal app (`xterm.js`) over the PTY WebSocket bridge. → FR-030/031
- [x] **M2.3** File manager: browse the tree with icons/details. → FR-020
- [x] **M2.4** SSH host-key verification surfaced in the UI (explicit TOFU +
      `known_hosts`). → plan §5, Art. 4

## M3 — Editor + System monitor + transparency UI — DONE → v1 line

- [x] **M3.1** Text editor (Stallman) via `readFile`/`writeFile`. → FR-070/071
- [x] **M3.2** System monitor with periodic refresh. → FR-050
- [x] **M3.3** Transparency surfaced in the UI (commands run). → FR-013
- [x] **── 🚀 v1 line published as `deskssh` 0.1.x on npm ──**

## M4 — Session-2 usability feedback (0.1.2–0.1.6) — DONE

From the `Observaciones/` usage diary. **Strict spec-first applies from now on**
(this milestone was reconciled into the specs on 2026-06-27, after the fact).

- [x] **M4.1** Window-button fix; PEM file/paste UI (load file vs paste, hide key);
      in-app **Credits** panel acknowledging third-party libs. → FR-002, Art. 9 — `0.1.2`
- [x] **M4.2** **Image viewer** (PNG/JPEG/GIF-animated/WebP), native browser decode.
      → FR-100 — `0.1.3`
- [x] **M4.3** **PDF viewer** (pdf.js, canvas in a worker; page nav + zoom). →
      FR-101 — `0.1.3`
- [x] **M4.4** Core **filesystem mutations** (`makeDir`/`createFile`/`move`/`copy`/
      `remove`) + gateway endpoints + tests. → FR-021
- [x] **M4.5** **PTY initial directory** (`openPty(cwd)`), gateway/terminal wiring.
      → FR-032
- [x] **M4.6** **File manager overhaul**: own context menu (entry + folder-level),
      create folder/file, rename, cut/copy/paste, delete with confirmation, download
      ("open on the client"), "open with", "open in terminal". → FR-021/023/025/026/
      027/090 — `0.1.4`
- [x] **M4.7** **Documents** editor (TipTap, rich text + plain text, saved as HTML).
      → FR-073 — `0.1.5`
- [x] **M4.8** **Stallman → Monaco** code editor with syntax highlighting by file
      type (lazy-loaded). → FR-072 — `0.1.6`

## M5 — Process/service control in Monitor + shared clipboard — TODO

From 2026-06-27 feedback; specs written first (spec §6 FR-051..053, FR-110..112;
`plan.md §4`). Brings process management forward into the System monitor (no
separate Processes app) and adds a host↔client clipboard for text + files.

### Core (capability contract)

- [ ] **M5.1** Implement `listProcesses()` in the Debian adapter via machine-readable
      `ps -eo pid,user,pcpu,pmem,comm,args` → `Process[]`, with raw-output fallback.
      → FR-051, Art. 6/7
- [ ] **M5.2** Add `signalProcess(pid, signal)` to the contract + Debian adapter
      (`kill -SIGTERM|-SIGKILL|-SIGHUP`). → FR-052
- [ ] **M5.3** Add `serviceAction(name, action)` (start/stop/restart via
      `systemctl`, state via `systemctl show`) → `ServiceState`. → FR-053

### Server (gateway)

- [ ] **M5.4** Endpoints for `listProcesses`, `signalProcess`, `serviceAction`
      (session-scoped, confirmation enforced client-side) + tests. → FR-051/052/053
- [ ] **M5.5** Session-scoped **text clipboard** buffer in the gateway for the
      DeskSSH-clipboard text path. → FR-110

### Web (UI)

- [ ] **M5.6** **System monitor**: process table (PID/user/%CPU/%MEM/command, sort + filter, periodic refresh) with Stop (SIGTERM→SIGKILL) / Reload (SIGHUP) and,
      for service-backed processes, Restart — all behind confirmation. →
      FR-051/052/053/090
- [ ] **M5.7** **Shared clipboard**: two Copy (Copy / Copy to my computer) and two
      Paste (Paste / Paste from my computer). Text via `navigator.clipboard`; files
      via download/upload (FR-023). Surfaced in the file manager + text selections. →
      FR-110/111/112

**M5 done when:** processes can be listed, signalled and (for services) restarted
from the monitor with confirmations, against a real Debian 13 host; and text/files
move both ways through the shared clipboard. Validate via the harness + the test VMs.

## Next / post-v1

The near-term technical backlog (handler-registry unification, FR-071 close-guard,
standalone file upload) and the post-v1 roadmap (Log viewer, Packages, a full
dedicated Services app, host tiers, credential store, hosted deployment) are tracked
in the **private roadmap**, not here. This file lists only shipped/in-progress work.
