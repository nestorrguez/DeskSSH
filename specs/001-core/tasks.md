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

## M5 — Process/service control in Monitor + shared clipboard — IN PROGRESS

From 2026-06-27 feedback; specs written first (spec §6 FR-051..053, FR-110..112;
`plan.md §4`). Brings process management forward into the System monitor (no
separate Processes app) and adds a host↔client clipboard for text + files.

### Core (capability contract)

- [x] **M5.1** `listProcesses()` in the Debian adapter via machine-readable
      `ps -eo pid,user,pcpu,pmem,args` → `Process[]`, with raw-output fallback.
      → FR-051, Art. 6/7
- [x] **M5.2** `signalProcess(pid, signal)` on the contract + Debian adapter
      (`kill -s TERM|KILL|HUP`). → FR-052
- [x] **M5.3** `serviceAction(name, action)` (start/stop/restart via `systemctl`,
      state via `systemctl show`) → `ServiceState`. → FR-053

### Server (gateway)

- [x] **M5.4** Endpoints `/api/processes`, `/api/signal`, `/api/service` (validated
      input, session-scoped) + tests. → FR-051/052/053

### Web (UI)

- [x] **M5.6** **System monitor**: process table (PID/user/%CPU/%MEM/command, filter + CPU sort, periodic refresh) with Stop (SIGTERM) / Reload (SIGHUP) / Force stop
      (SIGKILL) and a service control row (start/stop/restart) — all confirmed. →
      FR-051/052/053/090

> ~~M5.5/M5.7 shared clipboard~~ → **deferred** (2026-06-27). The host↔client
> clipboard moved to the private roadmap; the file-manager robustness work that
> replaces it for v1 is **M7**. M5's shipped scope (process/service control) is done.

Core/gateway/monitor validated against a real Debian 13 host (test VMs): listProcesses
(127 procs), signalProcess kills a spawned process, and as root serviceAction restarts
ssh → active/running.

## M6 — Privilege elevation (sudo) — DONE (`0.1.7`)

From 2026-06-27 feedback; specced first (spec §6 FR-093..095, `plan.md §5`). Lets a
failed-for-privilege action be retried elevated. Passwords used once, never persisted
or logged.

### Core / server

- [x] **M6.1** `isPermissionDenied(text)` heuristic + `detectPrivilege(exec)` probe
      (`id -u`/`id -nG`, presence of `sudo`/`su`) → canSudo/escalationAvailable.
      → FR-093
- [x] **M6.2** Elevated execution: `withElevation(exec, pw)` runs the command under
      `sudo -S` (subshell) with the password on **stdin** (CommandExecutor gained an
      `input` arg); the transparency log forwards but never records it. Other-user
      path = a transient SSH session (below), not su-over-PTY. → FR-094/095, Art. 4
- [x] **M6.3** Gateway: `/api/privilege` probe; `/api/signal` and `/api/service`
      accept a one-shot `elevate` ({current}|{user}); `server/elevate.ts` builds the
      elevated adapter (current-user sudo, or a transient session as another user) and
      tears it down after. → FR-093/094/095

### Web (UI)

- [x] **M6.4** **Modal 1** (password-only, current user) shown automatically when an
      action is denied and the user is sudo-capable. → FR-094
- [x] **M6.5** **Insufficient-privilege flow**: "your account lacks permission" →
      if escalation available, "I have administrator credentials" (→ **Modal 2**,
      username+password) + Cancel; else a single "Understood". `useElevation` hook
      drives it from the action result. → FR-095

Core/gateway validated on a real Debian 13 host: a non-root sudoer's denied service
restart succeeds when elevated, and the password never reaches the transparency log.
Full UI flow + the transient other-user path: verify manually against the test VMs.

**M6 done when:** a non-root user can restart a service from the monitor by entering
admin credentials in Modal 2, an unprivileged-but-sudo user via Modal 1, and a user
on a host without escalation sees the "Understood" notice — no password ever logged
or persisted. Validate against the test VMs.

## M7 — File manager robustness — TODO

From 2026-06-27 feedback (replaces the deferred shared clipboard). Specced first
(spec §6 FR-023/028/029, `plan.md §4`). No new web/server architecture — uses the
existing capabilities + the M6 elevation runner.

- [x] **M7.1** Client-transfer labels: **Download to my computer** + new **Upload
      from my computer** — hidden `<input type=file>` → base64 → `writeFile` into the
      current directory (toolbar + folder menu). → FR-023 — `0.1.8`
- [x] **M7.2** **Name-conflict modal** (Replace / Keep both / Cancel) before upload,
      paste, new file/folder and rename land on an existing name. _Keep both_ adds a
      ` (n)` suffix; _Replace_ removes-then-writes. → FR-028, Art. 4 — `0.1.8`
- [x] **M7.3** File manager's mutating ops (delete, rename, move/paste, create,
      upload) route through the `useElevation` runner; the file-op gateway endpoints
      gained an optional `elevate` via a shared `runCap`. Delete keeps confirmation.
      → FR-029/090/093..095 — `0.1.8`
- [x] **M7.4** Verified against the `deskssh-xfce` VM (Debian 13) through the gateway:
      a `/etc` write denied unelevated then succeeding with current-user elevation
      (+ elevated remove), `listDir` reporting the existing name that drives the
      conflict modal (Keep both = suffixed write, Replace = remove+rewrite), and an
      upload round-trip (writeFile base64 → readFile, bytes match). Confirmed the
      elevation password never reaches the transparency log (`sudo -S` via stdin).

## M8 — Desktop polish: stacking fix, System info, Command history, launcher — TODO

From 2026-06-27 in-app testing. Specced first (spec §6 FR-010/011/013/016).

- [x] **M8.1** Fix pop-up stacking: context menus / dialogs / launcher render above
      windows (`isolate` on the windows container caps their growing z-index). → FR-010
- [x] **M8.2** `systemInfo()` capability (Debian adapter, one round trip via marker
      sections) + `/api/systeminfo` + client; **System info** revamped to a
      fastfetch-style snapshot. Validated against the xfce VM. → FR-016 — `0.1.9`
- [x] **M8.3** New **Command history** app showing the transparency log
      (`/api/transparency`, polled); removed the command list from System info.
      → FR-013, Art. 3 — `0.1.9`
- [x] **M8.4** **Launcher** redesigned to a Windows-XP-style arrangement (header
      with session identity, scrollable app list, session/places column, Disconnect
      footer) — arrangement only, flat visual style kept. → FR-011 — `0.1.9`
  - **M8.4b** (2026-06-29 feedback) De-duplicated the menu: the session identity
    (host + OS) now lives **only** in the header (was repeated in a right
    session/places column, since removed → single column), and the app list is
    **sorted alphabetically**. Spec FR-011 updated first. → FR-011 — `0.1.9`
- [x] **M8.5** Verified against the `deskssh-xfce` VM: `systemInfo()` returns a
      13-field fastfetch snapshot (os/kernel/host/packages/cpu/mem/disk/IP), and the
      Command-history source (`/api/transparency`) returns a chronological log with
      `command` + `exitCode` per entry. Launcher arrangement reworked per M8.4b.

## Next / post-v1

The near-term technical backlog (handler-registry unification, FR-071 close-guard)
and the post-v1 roadmap (**shared clipboard host↔client**, Log viewer, Packages, a
full dedicated Services app, host tiers, credential store, hosted deployment) are
tracked in the **private roadmap**, not here. This file lists only shipped/in-progress
work.
