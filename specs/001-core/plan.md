# Technical plan — 001 Core

**How** to build what [`spec.md`](./spec.md) describes, respecting
[`constitution.md`](../constitution.md). The stack proposals are the recommended
starting point, not dogma; open decisions are marked `[NEEDS DECISION]`.

---

## 1. Resolving the web vs desktop conflict

Decision of record: **agnostic core + web-first delivery; desktop as later
packaging.**

Reasons:

- The user wants "anyone to be able to access it on the network" → favors web.
- The **browser cannot open raw SSH/TCP connections**, so in the web model the SSH
  session must live in a **backend** (gateway). That forces, anyway, a core
  separable from the UI (Art. 5).
- Once the core is independent, the **desktop** is simply packaging that same core
  locally (e.g. Tauri/Electron starting the backend on `localhost`), with no logic
  rewrite.

Result: **a single logic base**, two delivery forms. We start with web. **Decision
confirmed (2026-06-25).**

```
┌────────────────────────────┐        ┌───────────────────────────────┐
│  Frontend (web / desktop)  │  WS/   │  Backend (DeskSSH gateway)    │
│  desktop shell + UI        │ <────> │  SSH sessions + API           │
│  React + TS                │  HTTP  │  uses the CORE                │
└────────────────────────────┘        │   ┌────────────────────────┐  │   SSH
                                       │   │  core (agnostic)       │  │ <─────> Remote
                                       │   │  adapters, parsers,    │  │  host
                                       │   │  apps, sessions        │  │ (POSIX)
                                       │   └────────────────────────┘  │
                                       └───────────────────────────────┘
```

## 2. Layered architecture

1. **`core`** (agnostic, no UI nor presentation network I/O):
   - *Session manager*: abstraction over an SSH connection (run command, open PTY,
     open SFTP).
   - *OS adapters*: detection + family-specific commands (Art. 6).
   - *Parsers*: turn command output into data structures; with fallback to raw
     output (Art. 7).
   - *Apps*: each app defines what data it requests and what commands it runs (file
     manager, processes, services, monitor, editor, logs).
   - *Transparency*: every executed command is logged/exposed (Art. 3).
2. **`server`** (web gateway): keeps SSH sessions alive, authenticates the user,
   exposes an API (HTTP for one-off actions, WebSocket for PTY and streams),
   isolates sessions between users.
3. **`web`** (frontend): desktop shell (windows, taskbar, launcher) and each app's
   views. Talks to `server`, never to SSH directly.
4. **`desktop`** (later): packages `server` + `web` into a local app.

## 3. Proposed stack (v1)

Core stack **confirmed (2026-06-26): TypeScript + Node + `ssh2` + React.** UI
details (styling framework, icon set) still open — see §8. Alternatives noted.

- **Language:** TypeScript across the stack → a single language lowers the
  contribution barrier (Art. 9).
- **Monorepo:** pnpm workspaces. Packages: `core`, `server`, `web` (and later
  `desktop`).
- **Backend (`server`):** Node.js + the `ssh2` SSH library (mature, supports exec,
  PTY and SFTP) + WebSocket (`ws`). *Alternative:* Rust (`russh`) for
  security/performance, at the cost of a higher entry barrier → discarded for v1.
- **Frontend (`web`):** React + TypeScript. Terminal with **`xterm.js`**.
  Movable/resizable windows with a lightweight library (e.g. `react-rnd` style) or
  custom components. `[NEEDS DECISION]` UI/styling framework.
  - *Icon set:* **Lucide** (`lucide-react`, **ISC** — AGPL-compatible, no
    attribution), chosen for its clean, uniform stroke style fitting the
    accessibility-first UI. (Considered: Tabler/Phosphor/Heroicons MIT, Material
    Symbols Apache-2.0, Font Awesome Free CC BY; FA Pro proprietary — avoided.)
- **Desktop (future):** **Tauri** preferred (lightweight, Rust) over Electron,
  unless reusing the `server`'s Node inside the binary is desired → then Electron.

## 4. Core design

### Capability contract (adapter IR)

The core defines a **capability contract**: a closed catalog of abstract, **typed**
operations that apps invoke **without knowing which OS they run on**. It is the
system's "intermediate language" (an *intermediate representation*, IR). Two pieces:

1. **Contract (typed interface).** Each capability declares inputs and, above all, a
   **normalized output**. Examples:
   - `listDir(path) → FileEntry[]` — not text, but an array of
     `{ name, type, size, mode, owner, mtime }`.
   - `listProcesses() → Process[]`
   - `readFile(path) → bytes` · `writeFile(path, bytes) → void`
   - `serviceAction(name, action) → ServiceState`

   The value is in the **output type**: if an app knows `listDir` returns a
   `FileEntry[]`, it no longer cares how it was obtained nor on which platform.

2. **Adapter manifests (declarative) + escape hatch.** Each platform implements the
   contract. 80% of cases **declaratively** (command template + output normalization
   spec); the hard 20% (busybox, PowerShell) with a **code hook**.

**Rules that hold it together:**
- Apps **never** parse raw output; they only consume contract types. Parsing and its
  *fallback* live in the adapter (reinforces Art. 7).
- **Normalize at the source**: request structured output (`stat -c`, `ps -eo`,
  `ConvertTo-Json`…) instead of parsing human format.
- **Capability gaps**: if a platform doesn't support an operation (e.g. `chmod` on
  Windows), the adapter declares it *unsupported* and the UI degrades gracefully
  instead of pretending.

#### Non-interactive primitives > driving TUIs

A corollary of the contract (and the answer to "how to emulate nano"): DeskSSH
**does not drive remote interactive tools** (nano, vim, top…) by sending keystrokes
over a PTY —it would be fragile and impossible to normalize—. It uses
**non-interactive, structured primitives** and **emulates the experience on the
client**:
- **Editor** = `readFile` + `writeFile` + a custom GUI editor (no remote nano is
  launched).
- **Monitor** = `listProcesses`/`systemMetrics` by *polling*, not a live `top`.
- The **only** deliberate exception is the **terminal** app, which does expose the
  raw shell (there the user sees `bash`/`PowerShell`/`csh`).

### OS adapters
- The contract above exposes a **uniform interface** (`listDir`, `stat`,
  `listProcesses`, `listServices`, `serviceAction`, `systemMetrics`, …).
- Each **OS family** is an adapter implementing that contract, declaratively when
  possible. **v1 covers only Debian/Ubuntu/Mint** (see host roadmap below).
- Detection on connect (`/etc/os-release`, `uname`), with a generic POSIX fallback
  adapter for not-yet-supported Unix-likes.
- Prefer machine-readable output (`stat -c '%n|%s|%a|...'`, `ps -eo ...`, `--json`
  flags where available) over parsing human format.

#### Supported-host roadmap

The tier number indicates **roadmap priority, NOT difficulty** (see the *Effort*
column). Windows is prioritized for popularity despite being the most costly.

| Tier | Hosts | Effort | Notes |
|------|-------|--------|-------|
| **1** (v1) | Debian / Ubuntu / Mint | base | POSIX + GNU coreutils + systemd |
| **2** | Windows | **high** | Non-POSIX: its own PowerShell adapter family. Still agentless (PowerShell ships with the OS). Prioritized for popularity, not ease. |
| **3** | Rest of mainstream Linux (RHEL/Fedora/Rocky, Arch, openSUSE) | low | Same paradigm as v1 (systemd + GNU); differ mainly in the package manager |
| **4** | macOS, FreeBSD | medium | BSD userland; init `launchd` (macOS) / `rc.d` (FreeBSD), not systemd |
| **5** | Alpine | medium | `busybox` (trimmed flags), OpenRC, musl |

> Constitution note: when Tier 2 arrives, the **"POSIX utilities" wording of Art. 2
> will need generalizing** (still agentless, but no longer POSIX).

### File opening: handlers and routes (FR-025)

- **File-type handler registry:** each DeskSSH app declares which types it can open.
  It is the basis of "Open" (default handler) and "Open with" (choose handler), and
  the seed of extensibility for future apps.
- **Two opening routes:**
  - **(A) Render in DeskSSH:** the contract's `readFile` → painted by a GUI handler.
    With a **size limit**/warning (Art. 8); no handler for the type → route B is
    offered.
  - **(B) *Handoff* to the client:** download over **streaming SFTP** (don't load
    into memory) to the user's local machine.
- **Web vs desktop limitation (`[NEEDS DECISION]`):** on **desktop**
  (Tauri/Electron) it downloads and invokes the OS to open with the default program;
  on **web**, the browser can only download (and inline depending on type), not force
  the OS's default app.

### Parsers and resilience
- Each parser receives output + exit code; on unexpected format it returns a
  "degraded" result with the raw output (Art. 7), never throwing and breaking.

### Transparency
- Every execution goes through a single point that logs `{command, host, timestamp,
  exitCode}` and makes it queryable from the UI (FR-013, Art. 3).

### Performance (Art. 8)
- VFS listing cache with per-action invalidation.
- Batching related commands into a single invocation when possible.
- Optimistic UI on file operations, with reconciliation.

## 5. Security (Art. 4)

- The backend is the critical surface: gateway user authentication, strict per-user
  session isolation, rate limiting.
- Secrets: never in plain text nor in logs. `[NEEDS DECISION]` store (OS keychain /
  local encryption with a derived key / no persistence, ask each time).
- Destructive actions: mandatory confirmation at the app layer (FR-090).
- SSH host key verification (avoid MITM); `known_hosts` policy.
- Auditing: the transparency log also serves as an audit trail.

## 6. Phases / milestones

**v1 = focused cut, accessibility first.** v1 app set: connection/hosts, desktop
shell, file manager, text editor, terminal and **system monitor**. Processes,
services, log viewer and packages are **post-v1**.

- **M0 — Scaffolding:** monorepo, empty packages, basic CI, license, contributing.
- **M1 — Connection core:** SSH session (exec/PTY/SFTP) + OS detection +
  Debian/Ubuntu adapter + capability-contract base. Demonstrable via tests/minimal
  CLI.
- **M2 — Shell + Terminal + File manager:** first usable desktop.
- **M3 — Text editor + System monitor + transparency in the UI:** **completes v1.**
- **── 🚀 v1 release ──**
- **Post-v1 (admin apps):** Processes + Services + Log viewer + Packages.
- **Post-v1 (hosts):** go down the tier roadmap (Windows → rest of Linux → …).
- **Post-v1 (desktop):** Tauri/Electron packaging of the same core.

## 7. Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Command output varies by OS/locale/version | Fragile parsing | Adapters + machine output + raw fallback (Art. 6/7) |
| Latency from round trips | Slow UX | Cache, batching, optimistic UI (Art. 8) |
| Backend = exposed SSH gateway | High security risk | Auth, isolation, host keys, auditing (§5) |
| App over-scope | v1 never ships | Lock a minimal app subset per milestone |
| Coupling logic to the UI | Breaks future desktop | Strict agnostic core (Art. 5) |

## 8. Decisions

**Closed (2026-06-25):**
- **Web-first** + agnostic core as the v1 architecture.
- **License AGPL-3.0-or-later** (see `constitution.md` and `LICENSE`).
- **User #1 = accessibility**; **focused v1** (app set in §6).

**Closed (2026-06-26):**
- **Core stack: TypeScript + Node + `ssh2` + React.**
- **Icon set: Lucide** (ISC — AGPL-compatible, no attribution required).

**Open:**
1. UI styling framework.
2. Credential store.
3. Tauri vs Electron for desktop packaging (post-v1).
