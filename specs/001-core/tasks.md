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

> Only minor open item: browser behavior of "Open on the client" (FR-025) — decided
> during M2 coding.

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
- [ ] **M0.7** Publish `deskssh` `0.0.1` placeholder to npm (claims the name;
      `AGPL-3.0-or-later`, public access). **Needs maintainer npm login.** → vision
      (distribution)

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

## M2 — Shell + Terminal + File manager _(outline)_

Desktop shell (windows, taskbar, launcher; FR-010/011/012), Terminal app
(`xterm.js`, FR-030/031), File manager (browse/CRUD/properties/upload-download,
FR-020..023), file-open routes + handler registry (FR-025), destructive-action
confirmations (FR-090). Broken down at the start of M2.

## M3 — Editor + System monitor + transparency UI _(outline)_ → completes v1

Text editor via `readFile`/`writeFile` with unsaved-changes guard (FR-070/071),
System monitor with periodic refresh (FR-050), transparency surfaced in the UI
(FR-013), in-flight latency/state indicators (FR-092). Broken down at the start of
M3. → **🚀 v1 release** after M3.

## Post-v1 _(pointer)_

Admin apps (Processes/Services/Logs/Packages), host tiers (Windows → rest of Linux →
macOS/FreeBSD → Alpine), encrypted credential store, ssh-agent, drag & drop, hosted
deployment. See `plan.md §6` and `vision.md`.
