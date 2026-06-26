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
- Windows, macOS, \*BSD and other Linux distros as remote host: **out of v1**,
  planned in the host roadmap (Tier 2+, see `plan.md §4`).
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
   (Service/process management arrives _post-v1_.)
5. They open a real **terminal** for something specific. They close the session.

## 6. Functional requirements

> **v1 app scope (focused cut):** Connection/hosts, Desktop shell, File manager,
> Text editor, Terminal and **System monitor**. The apps marked _(post-v1)_ below
> —Processes, Services, Log viewer, Packages— are specified here but implemented
> after v1 (see `plan.md §6`).

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

- **FR-010** Show a desktop with movable/resizable windows and a taskbar.
- **FR-011** App launcher ("start menu") to open the available apps.
- **FR-012** Support multiple windows/apps open simultaneously over one session.
- **FR-013** Visible indicator to inspect the command of the last action
  (transparency, Art. 3).

### App: File manager

- **FR-020** Browse the remote directory tree with icons and details.
- **FR-021** Create folder, rename, copy, move and delete (delete/overwrite require
  confirmation, Art. 4).
- **FR-022** View properties (size, permissions, owner, dates).
- **FR-023** Upload and download files between the user's machine and the host.
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
  force opening with the OS's default program. `[NEEDS DECISION]` does "Open on the
  client" resolve as a **plain download**, as **inline opening** depending on type,
  or both?

### App: Terminal

- **FR-030** Real interactive terminal (PTY over SSH) with resizing.
- **FR-031** Reuse the already-connected host's SSH session.

### App: Processes / Task manager _(post-v1)_

- **FR-040** List processes (CPU/mem usage, PID, user, command).
- **FR-041** Terminate a process (mandatory confirmation).

### App: System monitor

- **FR-050** Show CPU, memory, disk and uptime, with periodic refresh.

### App: Service manager _(post-v1)_

- **FR-060** List services (systemd first) and their state.
- **FR-061** Start, stop and restart services (mandatory confirmation).
- **FR-062** View a service's recent state/log.

### App: Text editor

- **FR-070** Open, edit and save remote text files.
- **FR-071** Warn about unsaved edits on close.

### App: Log viewer _(post-v1)_

- **FR-080** View and follow (`tail -f`/`journalctl -f`) logs in streaming.

### Cross-cutting

- **FR-090** Every destructive action asks for explicit confirmation (Art. 4).
- **FR-091** If parsing output fails, show the raw output without breaking the app
  (Art. 7).
- **FR-092** Show latency/state of in-flight network operations (Art. 8).

## 7. Non-functional requirements

- **NFR-Security** — Fully comply with Article 4 of the constitution.
- **NFR-Portability** — v1 covers **Debian/Ubuntu/Mint** as remote host; support for
  more OSes is added via adapters (Art. 6) following the **host roadmap**
  (`plan.md §4`).
- **NFR-Performance** — Common operations (list a folder, refresh the monitor)
  perceptibly fluid at typical network latencies; minimize round trips.
- **NFR-Resilience** — No parsing/network failure crashes the app (Art. 7).
- **NFR-Accessibility / i18n** — Keyboard-navigable UI; **i18n-ready from day 1**
  (all strings externalized) and **v1 ships EN + ES**.
- **NFR-Openness** — Stack and dependencies 100% open source (Art. 9).

## 8. Acceptance criteria (v1, high level)

- A user can add a real Linux host, connect and open the desktop.
- They can browse files, open a working terminal, view processes/services and edit a
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
   (see §6 and `plan.md §6`).
