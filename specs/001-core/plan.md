# Technical plan — 001 Core

**How** to build what [`spec.md`](./spec.md) describes, respecting
[`constitution.md`](../constitution.md). The stack proposals are the recommended
starting point, not dogma; open decisions are marked `[NEEDS DECISION]`.

---

## 1. Delivery model (one web app, two distributions)

Decision of record: **agnostic core + web-first; a single web app delivered two
ways — hosted, or self-hosted via npm. No native desktop wrapper.**

Reasons:

- The user wants "anyone to be able to access it on the network" → favors web.
- The **browser cannot open raw SSH/TCP connections**, so the SSH session must live
  in a **backend** (gateway). That forces, anyway, a core separable from the UI
  (Art. 5).
- The offline/LAN need is met by **self-hosting the same web app via npm** (run it
  locally, open it in the browser), not by a native desktop build. Local users
  install from npm; there is **no Tauri/Electron app**.

Result: **a single logic base and one web UI**, distributed as **hosted** or
**self-hosted (npm)**. **Confirmed (2026-06-25; native desktop dropped 2026-06-26).**

```
┌────────────────────────────┐        ┌───────────────────────────────┐
│  Frontend (browser UI)     │  WS/   │  Backend (DeskSSH gateway)    │
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
   - _Session manager_: abstraction over an SSH connection (run command, open PTY,
     open SFTP).
   - _OS adapters_: detection + family-specific commands (Art. 6).
   - _Parsers_: turn command output into data structures; with fallback to raw
     output (Art. 7).
   - _Apps_: each app defines what data it requests and what commands it runs (file
     manager, processes, services, monitor, editor, logs).
   - _Transparency_: every executed command is logged/exposed (Art. 3).
2. **`server`** (web gateway): keeps SSH sessions alive, authenticates the user,
   exposes an API (HTTP for one-off actions, WebSocket for PTY and streams),
   isolates sessions between users.
3. **`web`** (frontend): desktop shell (windows, taskbar, launcher) and each app's
   views. Talks to `server`, never to SSH directly.
4. **Distribution**: the same `server` + `web` runs **hosted** or **self-hosted via
   npm** (local/LAN). No separate native app.

## 3. Proposed stack (v1)

Core stack **confirmed (2026-06-26): TypeScript + Node + `ssh2` + React.** UI
details (styling framework, icon set) still open — see §8. Alternatives noted.

- **Language:** TypeScript across the stack → a single language lowers the
  contribution barrier (Art. 9).
- **Monorepo:** pnpm workspaces. Packages: `core`, `server`, `web` (and later
  `desktop`).
- **Backend (`server`):** Node.js + the `ssh2` SSH library (mature, supports exec,
  PTY and SFTP) + WebSocket (`ws`). _Alternative:_ Rust (`russh`) for
  security/performance, at the cost of a higher entry barrier → discarded for v1.
- **Frontend (`web`):** React + TypeScript. Terminal with **`xterm.js`**.
  Movable/resizable windows with a lightweight library (e.g. `react-rnd` style) or
  custom components.
  - _Styling/components:_ **Tailwind CSS + Radix UI via shadcn/ui** (all **MIT** —
    AGPL-compatible). Tailwind for the custom desktop look; Radix primitives bring
    built-in accessibility (focus, keyboard, ARIA), key for the accessibility-first
    goal; shadcn/ui delivers them as in-repo, editable components.
  - _Icon set:_ **Lucide** (`lucide-react`, **ISC** — AGPL-compatible, no
    attribution), chosen for its clean, uniform stroke style fitting the
    accessibility-first UI. (Considered: Tabler/Phosphor/Heroicons MIT, Material
    Symbols Apache-2.0, Font Awesome Free CC BY; FA Pro proprietary — avoided.)
  - _Code editor (FR-072):_ **Monaco** (`monaco-editor` + `@monaco-editor/react`,
    **MIT**), the VS Code editor, with the locally bundled engine (offline /
    self-hosted) and its workers wired via Vite `?worker` imports. Lazy-loaded into
    its own async chunk so it stays out of the main bundle; the web build raises
    Node's heap because Monaco is large to bundle.
  - _Document editor (FR-073):_ **TipTap** (ProseMirror, **MIT**) for the Documents
    rich-text app; documents are stored as HTML.
  - _PDF viewer (FR-101):_ **pdf.js** (`pdfjs-dist`, **Apache-2.0**), rendered to a
    canvas in a web worker. _Image viewer (FR-100):_ no external library — the
    browser decodes the bytes natively via a `data:` URL.
  - Every integrated third-party library is **acknowledged in the in-app Credits
    panel** and must be **AGPL-compatible** (MIT/Apache-2.0/BSD/ISC).
- **Distribution:** published to **npm** so local/LAN users self-host the web app;
  a hosted deployment serves internet-open servers. No native desktop build.

## 4. Core design

### Capability contract (adapter IR)

The core defines a **capability contract**: a closed catalog of abstract, **typed**
operations that apps invoke **without knowing which OS they run on**. It is the
system's "intermediate language" (an _intermediate representation_, IR). Two pieces:

1. **Contract (typed interface).** Each capability declares inputs and, above all, a
   **normalized output**. Examples:
   - `listDir(path) → FileEntry[]` — not text, but an array of
     `{ name, type, size, mode, owner, mtime }`.
   - `listProcesses() → Process[]`
   - `readFile(path) → bytes` · `writeFile(path, bytes) → void`
   - **Filesystem mutations** (FR-021): `makeDir`, `createFile`, `move`, `copy`,
     `remove` — each `→ void` with the uniform ok/failed/unsupported result. The
     Debian adapter implements them with POSIX commands (`mkdir -p`, `touch`,
     `mv -n`, `cp -a -n`, `rm -rf`); `move`/`copy` use `-n` so they never clobber.
   - **Process & service control** (FR-051/052/053, graduated from the private
     roadmap 2026-06-27): `listProcesses() → Process[]` (`ps -eo …`),
     `signalProcess(pid, signal) → void` (`kill -SIGTERM|-SIGKILL|-SIGHUP`), and
     `serviceAction(name, action) → ServiceState` (`systemctl start|stop|restart`,
     `systemctl show` for state). The latter is what makes "restart" meaningful for
     a daemon; a generic process only gets signals. All destructive actions confirm
     (FR-090).

   The value is in the **output type**: if an app knows `listDir` returns a
   `FileEntry[]`, it no longer cares how it was obtained nor on which platform.

2. **Adapter manifests (declarative) + escape hatch.** Each platform implements the
   contract. 80% of cases **declaratively** (command template + output normalization
   spec); the hard 20% (busybox, PowerShell) with a **code hook**.

**Rules that hold it together:**

- Apps **never** parse raw output; they only consume contract types. Parsing and its
  _fallback_ live in the adapter (reinforces Art. 7).
- **Normalize at the source**: request structured output (`stat -c`, `ps -eo`,
  `ConvertTo-Json`…) instead of parsing human format.
- **Capability gaps**: if a platform doesn't support an operation (e.g. `chmod` on
  Windows), the adapter declares it _unsupported_ and the UI degrades gracefully
  instead of pretending.

#### Non-interactive primitives > driving TUIs

A corollary of the contract (and the answer to "how to emulate nano"): DeskSSH
**does not drive remote interactive tools** (nano, vim, top…) by sending keystrokes
over a PTY —it would be fragile and impossible to normalize—. It uses
**non-interactive, structured primitives** and **emulates the experience on the
client**:

- **Editors** = `readFile` + `writeFile` + a custom GUI editor (no remote nano is
  launched): **Stallman** (code, Monaco, syntax highlight by type, FR-072) and
  **Documents** (rich text, TipTap, stored as HTML, FR-073).
- **Viewers** (image FR-100 / PDF FR-101) = `readFile` + client-side rendering in
  the browser (no remote render).
- **Monitor** = `systemMetrics` + `listProcesses` by _polling_, not a live `top`;
  it also hosts process actions (`signalProcess`) and basic service control
  (`serviceAction`) — confirmed before running (FR-051/052/053).
- The **only** deliberate exception is the **terminal** app, which does expose the
  raw shell (there the user sees `bash`/`PowerShell`/`csh`); it can also start in a
  given directory (FR-032) by issuing `cd` as the first PTY input.

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

**v1 ships Tier 1 only: Debian / Ubuntu / Mint** (POSIX + GNU coreutils + systemd).
The multi-OS reach (Windows, other Linux, macOS/FreeBSD, Alpine), prioritized by
popularity rather than difficulty, is tracked in the **private roadmap**.

### File opening: handlers and routes (FR-025)

- **File-type handler registry:** each DeskSSH app declares which types it can open.
  It is the basis of "Open" (default handler) and "Open with" (choose handler), and
  the seed of extensibility for future apps.
  - _Current implementation note (2026-06-27):_ routing is done with **parallel
    openers** in the desktop context (`openEditor`/`openDoc`/`openImage`/`openPdf`/
    `openTerminal`) plus extension-based dispatch in the file manager. Folding these
    into a single `openFile(path)` backed by a real handler registry is the planned
    refactor (it removes the per-type duplication).
- **Two opening routes:**
  - **(A) Render in DeskSSH:** the contract's `readFile` → painted by a GUI handler
    (Stallman, Documents, image/PDF viewers). With a **size limit**/warning
    (Art. 8); no handler for the type → route B is offered.
  - **(B) _Handoff_ to the client:** **download** to the user's local machine
    (`readFile` → Blob → browser download). Streaming SFTP for large files is a
    later optimization.
- **Browser limitation — Resolved (2026-06-27):** DeskSSH always runs in a browser,
  so "Open on the client" resolves as a **plain download** in v1 (FR-025 / spec
  §9.8). It cannot force the OS's default app; type-aware inline opening on the
  client may be revisited post-v1.

### Shared clipboard: host ↔ client (FR-110..112)

Two clipboards, bridged, for both text and files — easing ad-hoc transfer beyond a
shared folder:

- **DeskSSH clipboard (server-side, session-scoped):** _Copy_/_Paste_ within
  DeskSSH. For files it is the file manager's cut/copy/paste over the move/copy
  capabilities (FR-021); for text it is a small per-session buffer in the gateway.
- **Client clipboard (the browser):** _Copy to my computer_ / _Paste from my
  computer_.
  - **Text** uses the Web **Clipboard API** (`navigator.clipboard.writeText` /
    `readText`). It needs a user gesture and may prompt for permission; over plain
    HTTP it is restricted to secure contexts (localhost counts as secure), so the
    self-hosted/LAN case works, a non-TLS remote host may not.
  - **Files** cannot be placed on / read from the OS clipboard by a web app, so
    "to/from my computer" is realised as **download / upload** (FR-023): copy-to =
    download the bytes; paste-from = upload a picked file (`writeFile`).
- The four actions surface in the file manager (and where text selection exists),
  presented as two _Copy_ and two _Paste_ entries.

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
- Secrets: never in plain text nor in logs. **v1 does not persist** (ask each
  session, in-memory only); an encrypted store (OS keychain / local encryption with
  a derived key) is post-v1 (FR-005).
- Destructive actions: mandatory confirmation at the app layer (FR-090).
- SSH host key verification (avoid MITM); `known_hosts` policy.
- Auditing: the transparency log also serves as an audit trail.

### Privilege elevation (sudo) — FR-093..095

When a capability fails for lack of privilege, DeskSSH can re-run it elevated.

- **Detecting a privilege failure:** a `failed` result whose stderr looks like a
  permission error (`Permission denied`, `must be root`, `Authentication is
required`, `access denied`, `not in the sudoers file`…). The adapter/gateway tags
  it so the UI can offer elevation.
- **Can the user elevate?** Heuristic, cheap, no prompt: the user is in a
  sudo-capable group (`id -nG` ∋ `sudo`/`wheel`/`admin`) and `sudo` exists. **Is
  escalation possible at all?** `sudo` or `su` is present on the host.
- **Running elevated (the command never carries the password in `argv`):**
  - **Current user (Modal 1):** `sudo -S -p '' <cmd>` with the password written to
    **stdin** once. (`-S` reads the password from stdin, `-p ''` suppresses the
    prompt.)
  - **Another user / root (Modal 2):** `su - <user> -c '<cmd>'` driven over a **PTY**
    (su reads the password from a tty, not stdin), the password typed once.
- **Secrets (Art. 4 / FR-005):** the password lives only in memory for the single
  elevated run and is then discarded — never persisted. The **transparency log must
  redact it**: log the elevated command (e.g. `sudo systemctl restart nginx`) but
  **never** the password bytes fed on stdin/PTY.
- This is **cross-cutting**: any capability can be retried elevated; v1 wires it
  where it matters first (service control, signalling, root-owned file ops).

## 6. Phases / milestones

**v1 = focused cut, accessibility first.** v1 app set: connection/hosts, desktop
shell, file manager, **editors (Stallman code + Documents)**, terminal,
**image/PDF viewers** and **system monitor**. Processes, services, log viewer and
packages are **post-v1**.

- **M0 — Scaffolding:** monorepo, empty packages, basic CI, license, contributing.
  ✅
- **M1 — Connection core:** SSH session (exec/PTY/SFTP) + OS detection +
  Debian/Ubuntu adapter + capability-contract base. Demonstrable via tests/minimal
  CLI. ✅
- **M2 — Shell + Terminal + File manager:** first usable desktop. ✅
- **M3 — Text editor + System monitor + transparency in the UI:** **completes v1.**
  ✅ _(editors + monitor shipped)_
- **── 🚀 v1 line (published as `deskssh` 0.1.x on npm) ──**
- **Session-2 feedback (0.1.2–0.1.6, 2026-06-27):** window-button fix, PEM
  file/paste UI, Credits panel; image + PDF viewers; file-manager overhaul
  (mutations, own context menu, clipboard, open-in-terminal, download); Documents
  editor; Stallman → Monaco. All on the 0.1.x line (see `Observaciones/`).
- **Post-v1:** admin apps, multi-OS host tiers, hosted deployment and the
  credential store are tracked in the **private roadmap**.

## 7. Risks and mitigations

| Risk                                       | Impact                | Mitigation                                          |
| ------------------------------------------ | --------------------- | --------------------------------------------------- |
| Command output varies by OS/locale/version | Fragile parsing       | Adapters + machine output + raw fallback (Art. 6/7) |
| Latency from round trips                   | Slow UX               | Cache, batching, optimistic UI (Art. 8)             |
| Backend = exposed SSH gateway              | High security risk    | Auth, isolation, host keys, auditing (§5)           |
| App over-scope                             | v1 never ships        | Lock a minimal app subset per milestone             |
| Coupling logic to the UI                   | Breaks future desktop | Strict agnostic core (Art. 5)                       |

## 8. Decisions

**Closed (2026-06-25):**

- **Web-first** + agnostic core as the v1 architecture.
- **License AGPL-3.0-or-later** (see `constitution.md` and `LICENSE`).
- **User #1 = accessibility**; **focused v1** (app set in §6).

**Closed (2026-06-26):**

- **Core stack: TypeScript + Node + `ssh2` + React.**
- **UI: Tailwind CSS + Radix UI (via shadcn/ui)** — all MIT.
- **Icon set: Lucide** (ISC — AGPL-compatible, no attribution required).
- **No native desktop app:** local/LAN use = self-hosted **npm** web app.
- **v1 credentials: not persisted** — asked per session (FR-005).

**Closed (2026-06-27):**

- **FR-025 "Open on the client" = plain download** in v1 (spec §9.8).
- **Code editor: Monaco** (lazy-loaded, locally bundled, Vite workers; FR-072).
- **Document editor: TipTap**, documents stored as HTML (FR-073).
- **PDF viewer: pdf.js**; **image viewer: native browser decode**, no lib (FR-100/101).
- **Versioning: stay on the 0.1.x line** (patch bumps) for the session-2 feature
  work, not 0.2.0/0.3.0.

**Open:** product-level decisions tracked in spec §9 (`ssh-agent`, i18n scope).
