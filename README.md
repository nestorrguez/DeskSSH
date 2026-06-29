<h1 align="center">DeskSSH</h1>

<p align="center">
  <strong>One Desk, Any Machine. Just SSH.</strong><br>
  A graphical desktop over plain SSH — the GUI is synthesized on the client and
  every action is translated into commands run on the remote host.
  <em>It is not remote desktop.</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/deskssh"><img alt="npm" src="https://img.shields.io/npm/v/deskssh?color=cb3837&logo=npm"></a>
  <a href="LICENSE"><img alt="License: AGPL-3.0-or-later" src="https://img.shields.io/badge/license-AGPL--3.0--or--later-blue"></a>
  <img alt="Node >= 20" src="https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white">
  <img alt="Agentless" src="https://img.shields.io/badge/server-agentless-success">
</p>

<p align="center">
  <img src="docs/demo.gif" alt="DeskSSH in action: connect over SSH, install and manage nginx from a familiar desktop" width="100%">
</p>

<p align="center">
  <em>Connect over SSH → install nginx from the terminal → manage the service in the monitor → see every command run. No agent. No pixels streamed.</em>
</p>

---

## Try it in 10 seconds

DeskSSH runs on **your** machine and connects to **your** servers. Nothing to install on the remote.

```bash
npx deskssh
```

…or install it globally:

```bash
npm install -g deskssh
deskssh
```

It starts on `http://127.0.0.1:8717` and opens your browser. Enter a server's
**host, port, user** and a **password or private key (PEM)** — and you get a
familiar desktop, all over plain SSH.

**Requirements:** Node.js **>= 20** locally; remote host: Linux with SSH
(Debian / Ubuntu / Mint in v1). Nothing else — no agent, no daemon.

> DeskSSH binds to `127.0.0.1` by default (it is an SSH gateway and must not be
> exposed by accident). Override with `HOST` / `PORT` if you know what you're doing.

## What is it?

You connect via SSH to a server **with no graphical environment** and DeskSSH
shows you a familiar desktop. Behind the scenes, every click runs the equivalent
command (`ls`, `stat`, `mv`, `systemctl`, `ps`…) and the interface is built from
its output.

### What makes it different

- **Not VNC / RDP / X.** No pixels travel — the GUI is generated locally.
- **Agentless.** Installs nothing on the server; only needs SSH and standard POSIX utilities.
- **Transparent.** You can always see the command behind each action (there's a Command history for it).
- **100% open source.**

## What's inside (v1 — the MVP)

The **0.1.9 MVP** ships the full base idea:

| App | What it does |
|-----|--------------|
| 🔌 **Connection** | SSH with password or private key (PEM/OpenSSH/PKCS#8), host-key verification (TOFU + `known_hosts`). |
| ⌨️ **Terminal** | A real interactive shell (PTY) via `xterm.js`. |
| 📁 **File manager** | Browse, create / rename / move / copy / delete, upload / download, name-conflict resolution, "open with". |
| 📝 **Editors & viewers** | Code editor (Monaco), rich-text documents, image and PDF viewers. |
| 📊 **System monitor** | Live metrics, process control (stop / reload / force-stop) and service control (start / stop / restart). |
| 🔐 **Privilege elevation** | Retry a denied action with `sudo`; passwords used once, never persisted or logged. |
| ℹ️ **System info** | A fastfetch-style host snapshot, gathered agentlessly. |
| 🕘 **Command history** | Every command DeskSSH runs, inspectable — full transparency. |

## Origin and motivation

DeskSSH started as a project in **ASP.NET with .NET 8**. As it grew, the sheer
number of commands and cases it could cover felt overwhelming. After improving the
code with the help of AI, I made a more radical decision: **restart from scratch**,
also with AI, in order to:

- use languages and technologies **more widely accepted by the community**, and
- leverage **npm's ease of distribution** for simple adoption.

This rewrite is developed with **Spec-Driven Development**: decisions are
documented in `specs/` before any code is written. It's open source because I want
DeskSSH to become a **genuinely useful and popular** tool, built and improved by
the community.

## Status

✅ **MVP shipped — `deskssh@0.1.9`.** The base idea is complete and on npm. From
here, work is refinement and reach (more host families, more admin apps). The
project follows **Spec-Driven Development**; start with:

- [`specs/constitution.md`](specs/constitution.md) — the project's principles.
- [`specs/001-core/spec.md`](specs/001-core/spec.md) — what DeskSSH does.
- [`specs/001-core/plan.md`](specs/001-core/plan.md) — how it's built.
- [`specs/glossary.md`](specs/glossary.md) — the domain vocabulary.

## How to contribute

This project follows SDD: design discussions happen in `specs/` **before** they
reach the code. To propose something, open the conversation on the relevant
document.

## License

[**GNU AGPL-3.0-or-later**](LICENSE). Strong copyleft with a network clause: if you
modify DeskSSH and offer it as a network-accessible service, you must publish your
changes. Chosen so the project and all its improvements stay free. See
[`specs/constitution.md`](specs/constitution.md), Article 9.
