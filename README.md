<h1 align="center">DeskSSH</h1>

<p align="center">
  <strong>A graphical desktop over plain SSH.</strong><br>
  The GUI is synthesized on the client; every action is translated into commands
  executed on the remote host. <em>It is not remote desktop.</em>
</p>

---

## What is it?

You connect via SSH to a server **with no graphical environment** and DeskSSH
shows you a familiar desktop —file manager, terminal, system monitor, editor,
service manager…—. Behind the scenes, every click runs the equivalent command
(`ls`, `stat`, `mv`, `systemctl`, `ps`…) and the interface is built from its
output.

### What makes it different

- **Not VNC/RDP/X.** No pixels travel: the GUI is generated locally.
- **Agentless.** Installs nothing on the server; only needs SSH and standard POSIX
  utilities.
- **Transparent.** You can always see the command behind each action.
- **100% open source.**

## Origin and motivation

DeskSSH started as a project in **ASP.NET with .NET 8**. As it grew, I felt
overwhelmed by the sheer number of commands and cases the tool could end up
covering. I began reviewing and improving the code with the help of AI, but ended
up making a more radical decision: **restart the project from scratch**, also with
AI, in order to:

- use languages and technologies **more widely accepted by the community**, and
- leverage **npm's ease of distribution** for simple adoption.

This rewrite is developed with **Spec-Driven Development**: decisions are
documented in `specs/` before any code is written.

The reason for making it **open source** is simple: I want DeskSSH to become a
**genuinely useful and popular** tool, built and improved by the community.

## Run it

DeskSSH runs on **your** machine and connects to **your** servers:

```bash
npx deskssh
# or: npm install -g deskssh && deskssh
```

It starts on `http://127.0.0.1:8717` and opens your browser. Enter a server's
host, port, user and a password or private key (PEM) to get a familiar desktop —
file manager, terminal, text editor (Stallman) and system monitor — all over plain
SSH. Requires **Node.js >= 20**; remote host: Linux with SSH (Debian/Ubuntu/Mint in
v1).

## Status

🚧 **Early MVP (v0.1.0).** The project is developed with **Spec-Driven
Development**: the specification lives in `specs/`. Start with:

- [`specs/vision.md`](specs/vision.md) — the why and the where-to (the vision).
- [`specs/constitution.md`](specs/constitution.md) — the project's principles.
- [`specs/001-core/spec.md`](specs/001-core/spec.md) — what DeskSSH does.
- [`specs/001-core/plan.md`](specs/001-core/plan.md) — how it will be built.
- [`specs/glossary.md`](specs/glossary.md) — the domain vocabulary.

## How to contribute

This project follows SDD: design discussions happen in `specs/` **before** they
reach the code. To propose something, open the conversation on the relevant
document. (Detailed contribution guide: pending — `M0`.)

## License

[**GNU AGPL-3.0-or-later**](LICENSE). Strong copyleft with a network clause: if you
modify DeskSSH and offer it as a network-accessible service, you must publish your
changes. Chosen so the project and all its improvements stay free. See
[`specs/constitution.md`](specs/constitution.md), Article 9.
