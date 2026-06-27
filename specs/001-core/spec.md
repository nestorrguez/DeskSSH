# Functional specification — 001 Core (base experience)

Defines **what** DeskSSH does and **why**, without going into how it is implemented
(that's in `plan.md`). Open decisions are marked `[NEEDS DECISION]` and listed at
the end.

Related: [`../constitution.md`](../constitution.md) · [`../glossary.md`](../glossary.md)

---

## 1. Problem

Administering a Linux server with no graphical environment forces you to know the
command line. Existing graphical alternatives:

- **Remote desktop (VNC/RDP/X)**: requires an installed graphical environment and
  consumes bandwidth transmitting pixels; unviable on headless servers.
- **Web panels (Cockpit, Webmin)**: require installing and maintaining an agent on
  the server, and offer a "web form" UX, not a desktop one.

There is no tool that gives a **real desktop experience** over **any server with
just SSH**, installing nothing and transmitting no pixels.

## 2. Value proposition

DeskSSH presents a **familiar desktop** (windows, file manager, terminal, monitor,
editor, services) whose backend is **plain SSH**: every interaction is translated
into commands executed on the host. No agents, no streaming, and with
**transparency**: you can always see the command behind the click.

## 3. Goals (v1)

- G1. Connect to remote hosts over SSH (key or password) and manage them.
- G2. Offer a desktop shell with windows and basic multitasking.
- G3. Include an initial set of useful apps (see §6).
- G4. Work **agentless** on common Linux servers.
- G5. Make the equivalent command of each action visible (transparency).

## 4. Non-goals (v1)

- Desktop streaming or remote graphical applications (forbidden by the
  constitution).
- Windows, macOS, \*BSD and other Linux distros as remote host: **out of v1**.
- Multi-user / real-time collaboration over the same session.
- Fleet orchestration (managing many servers at once).
- Third-party app/plugin store (the architecture will allow it, but not in v1).

## 5. Personas and use cases

> **v1 primary persona: "User with low CLI fluency".** v1 prioritizes
> **accessibility**: safe, guided defaults, plain language, the terminal as a last
> resort and transparency (Art. 3) presented in an _educational, on-demand_ way,
> not as the protagonist. Other personas are served, but they do not steer the
> design.

- **⭐ User with a VPS but low CLI fluency (PRIMARY)** — manages their server with a
  GUI without having to master the terminal. _"I want to manage my server without
  the console intimidating me."_
- **Sysadmin / DevOps** — manages VPSs and servers; wants speed and to see what
  runs. _"I review services and logs without memorizing flags."_
- **Developer** — deploys to a VPS; wants to manage files and processes
  comfortably. _"I upload a build and restart the service without opening 3
  terminals."_
- **Person learning Linux** — command transparency teaches them. _"I see what
  command each thing I click does."_

### Main journey

1. The user adds a host (address, user, authentication method).
2. They connect; DeskSSH detects the OS and opens the **desktop**.
3. They open the **file manager**, browse, copy a file (seeing the confirmation
   and, optionally, the command).
4. They open the **system monitor** and check CPU/memory/disk at a glance.
5. They open a real **terminal** for something specific. They close the session.

## 6. Functional requirements

> **v1 app scope (focused cut):** Connection/hosts, Desktop shell, File manager,
> **Editors** (Stallman = code, Documents = rich text), Terminal, **Image/PDF
> viewers** and **System monitor** (now also process + service control). This
> document specifies **only what ships**
> or is committed-next; the remaining post-v1 apps (Log viewer, Packages, a full
> dedicated Services app) and their FRs live in the private roadmap and graduate
> back here when built.

### Connection and hosts

- **FR-001** Add, edit and remove hosts (name, address, port, user).
- **FR-002** Authentication via: (a) **SSH private key** —the user provides the key
  file (**PEM / OpenSSH / PKCS#8** formats), with **optional passphrase**—, and
  (b) **password**. (Key protection/storage is governed by FR-005 and constitution
  Art. 4.) `ssh-agent` support is **post-v1**.
- **FR-003** Connect/disconnect; show session state (connecting, alive, dropped,
  error).
- **FR-004** Detect the host's OS family to choose the adapter (Art. 6).
- **FR-005** Never persist secrets in plain text (Art. 4). **v1: do not persist
  credentials** — entered per session and kept only in memory while connected; an
  encrypted store (OS keychain / local encryption) may come post-v1.

### Desktop shell

- **FR-010** Show a desktop with movable/resizable windows and a taskbar. Pop-up
  surfaces (context menus, dialogs, the launcher) must always render **above** the
  windows.
- **FR-011** App launcher ("start menu") to open the available apps, laid out in a
  structured, **Windows-XP-style arrangement** (a header with the session identity,
  an app list, a places/session column and a footer with Disconnect) — the
  _arrangement_, not the visual styling (no bevels/gradients; keep DeskSSH's flat
  look).
- **FR-012** Support multiple windows/apps open simultaneously over one session.
- **FR-013** Command transparency: every command DeskSSH runs is inspectable
  (Art. 3). It lives in its **own app, "Command history"** (a chronological list of
  the commands run, with exit code), not buried inside System info.

### App: System info

- **FR-016** Show a **fastfetch-style** snapshot of the host — distro/pretty name,
  hostname, kernel, uptime, package count, shell, CPU, memory and disk usage, and
  local IP — gathered **agentlessly** from standard files/commands (`/etc/os-release`,
  `uname`, `/proc`, `dpkg`, `df`, …); no fastfetch/neofetch required on the host.

### App: File manager

- **FR-020** Browse the remote directory tree with icons and details.
- **FR-021** Create folder, rename, copy, move and delete (delete/overwrite require
  confirmation, Art. 4).
- **FR-022** View properties (size, permissions, owner, dates).
- **FR-023** Transfer files between the user's local machine ("the client") and the
  host: **Download to my computer** (`readFile` → browser download) and **Upload
  from my computer** (pick a local file → `writeFile` into the current directory).
  These honest, web-accurate labels replace the deferred "shared clipboard" framing
  (§9.9).
- **FR-024** Drag & drop in the file manager — **post-v1** (not in the focused v1
  cut).
- **FR-025** When opening a file, the user chooses between two **execution
  locations**:
  - **(A) In DeskSSH** — _Open_ (default DeskSSH app for that type) or _Open with_
    (choose among DeskSSH apps/viewers). The file is read via `readFile` and
    rendered in the GUI; **nothing runs on the remote** (Art. 10). Requires a
    DeskSSH _handler_ for that type; if none, option (B) is offered.
  - **(B) On the client** — _Open on the client_ (downloaded over SFTP, streaming,
    to the **user's local machine** and opened with their OS's default program) or
    _Download_ (just save locally).

  Vocabulary note: **"the client" = the user's local machine** (their browser/OS in
  the web model), not the DeskSSH server.
  Since DeskSSH always runs in a browser (hosted or self-hosted npm), it cannot
  force opening with the OS's default program. **Resolved (2026-06-27): "Open on
  the client" in v1 = plain download** (save to the user's machine via the
  browser); type-aware inline opening may come later. See §9.8.

- **FR-026** Provide DeskSSH's **own context menu** (right-click) on entries — not
  the browser's — with the relevant actions (open, open with, open in terminal,
  **download to my computer**, rename, cut, copy, delete) and a folder-level menu
  (new folder/file, paste, **upload from my computer**, open in terminal, refresh).
- **FR-027** **Open a directory in the Terminal**: launch (or re-target) the
  Terminal app already positioned in the selected folder, without manual `cd`.
- **FR-028** **Name-conflict resolution.** When an operation would land on an
  existing name (upload, paste, new file/folder, rename), don't silently overwrite:
  prompt with **Replace**, **Keep both** (the new item is auto-renamed, e.g.
  "name (2).ext") and **Cancel** (Art. 4).
- **FR-029** **Permission-aware file operations.** Mutating/destructive file ops
  (delete, rename, move/paste, create, upload) run with confirmation where
  destructive (FR-090); if one is denied for lack of privilege, the elevation flow
  (FR-093..095) is offered so it can be retried with the right credentials.

### App: Terminal

- **FR-030** Real interactive terminal (PTY over SSH) with resizing.
- **FR-031** Reuse the already-connected host's SSH session.
- **FR-032** Start the shell in a given directory when opened from elsewhere
  (e.g. the file manager's "Open in terminal", FR-027).

### App: System monitor

The monitor is also where running **processes** are inspected and acted on
(brought forward from the post-v1 "Processes" app per 2026-06-27 feedback) — no
separate Processes app.

- **FR-050** Show CPU, memory, disk and uptime, with periodic refresh.
- **FR-051** **List processes** with PID, user, %CPU, %memory and command, with
  periodic refresh and sort/filter; shown inside the System monitor.
- **FR-052** **Signal a process:** _Stop_ (SIGTERM, escalating to SIGKILL if it
  does not exit) and _Reload_ (SIGHUP). Every signal asks for confirmation (Art. 4).
- **FR-053** **Service control:** start, stop and **restart** a service via the
  init system (systemd first), with mandatory confirmation. This is what makes
  "restart" meaningful for a process that belongs to a service (a generic process
  has no well-defined restart). Resolved (2026-06-27): service control is included
  so restart works for daemons.

### App: Editors (code + documents)

DeskSSH ships two distinct editors: **Stallman**, the code editor, and
**Documents**, a rich-text/plain-text document editor.

- **FR-070** Open, edit and save remote text files.
- **FR-071** Warn about unsaved edits on close.
- **FR-072** **Code editor (Stallman):** syntax highlighting selected from the file
  type, covering at least C, C++, C#, Java, Python, JS, TS, SQL, HTML, XML, JSON,
  Markdown and plain text; unknown types fall back to plain text.
- **FR-073** **Document editor (Documents):** a separate app for **rich text and
  plain text**, with basic formatting (bold, italic, strikethrough, inline code,
  headings, bullet/numbered lists, blockquote, undo/redo). Documents are stored as
  HTML. Reachable from the launcher and from the file manager's "Open with".

### App: Image / PDF viewers

The GUI is synthesised on the client (Art. 10): viewers read the file bytes via
`readFile` and render them in the browser; nothing is rendered on the remote host.

- **FR-100** **Image viewer:** display PNG, JPEG, GIF (including animated) and WebP,
  with a fit / actual-size toggle.
- **FR-101** **PDF viewer:** display PDF files with page navigation and zoom.

### Shared clipboard (host ↔ client) — **deferred**

> **Deferred to a later version (2026-06-27, §9.9).** Bridging the host with the
> client's **OS clipboard** from a browser is awkward (a web app can't touch the OS
> file clipboard, and text clipboard access is gesture/permission-bound). Instead,
> v1 keeps the file manager's internal cut/copy/paste (FR-021) and the honest
> client transfers — **Download to my computer / Upload from my computer** (FR-023)
> — which already cover moving information in and out, more robustly than a shared
> folder. The full host↔client clipboard (incl. text) is parked in the private
> roadmap. ~~FR-110..112~~.

### Cross-cutting

- **FR-090** Every destructive action asks for explicit confirmation (Art. 4).
- **FR-091** If parsing output fails, show the raw output without breaking the app
  (Art. 7).
- **FR-092** Show latency/state of in-flight network operations (Art. 8).

#### Privilege elevation (sudo) — FR-093..095

When a capability fails for lack of privilege (e.g. service control, signalling
another user's process, editing a root-owned file), DeskSSH can re-run it elevated.
A password entered here is used **once, in memory**, never persisted and never
written to the transparency log (Art. 4 / FR-005).

- **FR-093** **Elevation entry point.** A capability result that is a
  permission-style failure can be retried with elevation. DeskSSH decides the path
  from whether the **connected user can elevate** (is sudo-capable):
  - **can elevate →** FR-094 (password-only, automatic);
  - **cannot →** FR-095 (the insufficient-privilege flow).
- **FR-094** **Current-user elevation (Modal 1 — password only).** If the connected
  user is sudo-capable, DeskSSH shows a **password-only** modal — implicitly **the
  current user** — and retries the action with that password fed to `sudo` once.
  This is a confirmation, so it appears **automatically** when elevation is needed.
- **FR-095** **Insufficient-privilege flow (the "discreet" path).** Users often do
  not know their privilege level, so when the current user **cannot** elevate,
  DeskSSH first states plainly: **"your account does not have permission for this
  action."** Then, depending on whether the host **permits privilege escalation at
  all**:
  - **escalation available →** two actions: **"I have administrator credentials"**
    (opens **Modal 2**, a **username + password** dialog to authenticate as another
    privileged user / root) and **Cancel**;
  - **escalation unavailable →** a single **"Understood"** acknowledgement (no path
    forward).
- **Modal 2 (username + password)** runs the action as the supplied user (e.g. an
  admin or root), credentials used once and discarded. Resolved (2026-06-27): the
  trigger is **reactive/automatic** and the path is **auto-detected** from the
  host; see §9.11.

## 7. Non-functional requirements

- **NFR-Security** — Fully comply with Article 4 of the constitution.
- **NFR-Portability** — v1 covers **Debian/Ubuntu/Mint** as remote host; support for
  more OSes is added later via adapters (Art. 6), each implementing the same
  capability contract.
- **NFR-Performance** — Common operations (list a folder, refresh the monitor)
  perceptibly fluid at typical network latencies; minimize round trips.
- **NFR-Resilience** — No parsing/network failure crashes the app (Art. 7).
- **NFR-Accessibility / i18n** — Keyboard-navigable UI; **i18n-ready from day 1**
  (all strings externalized) and **v1 ships EN + ES**.
- **NFR-Openness** — Stack and dependencies 100% open source (Art. 9).

## 8. Acceptance criteria (v1, high level)

- A user can add a real Linux host, connect and open the desktop.
- They can browse files, open a working terminal, view system metrics and edit a
  file, all agentless.
- Every destructive action asks for confirmation; no secret is stored in plain text.
- A parsing failure on an "odd" host shows raw output without crashing.

## 9. Open decisions `[NEEDS DECISION]`

1. ~~Open source license~~ → **Resolved (2026-06-25): AGPL-3.0-or-later** (see
   `constitution.md` and `LICENSE`).
2. ~~Confirm web-first~~ → **Resolved: web-first** (2026-06-25), one web app
   delivered hosted or self-hosted via npm; **no native desktop** (2026-06-26). See
   `plan.md §1`.
3. ~~`ssh-agent`~~ → **Resolved (2026-06-26): post-v1** (v1 = key PEM/passphrase +
   password) (FR-002).
4. ~~Credential store~~ → **Resolved (2026-06-26): v1 does not persist** (ask each
   session); encrypted store post-v1 (FR-005).
5. ~~Drag & drop~~ → **Resolved (2026-06-26): post-v1** (FR-024).
6. ~~i18n scope~~ → **Resolved (2026-06-26): i18n-ready from day 1, v1 ships EN +
   ES** (NFR-Accessibility/i18n).
7. ~~v1 app set~~ → **Resolved (2026-06-25):** focused cut = Connection/hosts,
   Shell, File manager, Editor, Terminal and System monitor; the rest _(post-v1)_
   (see §6 and `plan.md §6`). _Extended (2026-06-27) with the Documents editor and
   the Image/PDF viewers from session-2 feedback._
8. ~~FR-025 "Open on the client"~~ → **Resolved (2026-06-27): plain download** in
   v1 (save to the user's machine via the browser). Type-aware inline opening on
   the client may be revisited post-v1.
9. ~~Shared clipboard scope~~ → **Deferred (2026-06-27)** to a later version
   (~~FR-110..112~~, moved to the private roadmap). A browser can't bridge the OS
   file clipboard; v1 instead robustifies the file manager with honest **Download
   to / Upload from my computer** (FR-023) plus name-conflict resolution (FR-028)
   and permission-aware ops (FR-029).
10. ~~Process "restart"~~ → **Resolved (2026-06-27): include service control**
    (FR-053): generic processes get signals (stop/reload, FR-052); true restart is
    done via the service manager (systemctl). Process list lives in the System
    monitor (FR-051), not a separate app.
11. ~~Privilege-elevation UX~~ → **Resolved (2026-06-27)** (FR-093..095): trigger is
    **reactive/automatic** (offered when an action fails for privilege); the path is
    **auto-detected** — sudo-capable user → password-only Modal 1 (current user);
    otherwise a "your account lacks permission" notice, then either "I have
    administrator credentials" → username+password Modal 2 (if the host allows
    escalation) or just "Understood" (if it does not). Passwords used once, never
    persisted or logged.
