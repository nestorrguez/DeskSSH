# DeskSSH

**A graphical desktop over plain SSH.** The GUI is synthesized on the client and
every action is translated into commands executed on the remote host. _Not remote
desktop. Agentless._

## Run it

DeskSSH runs on **your** machine and connects to **your** servers. No install:

```bash
npx deskssh
```

…or install it globally:

```bash
npm install -g deskssh
deskssh
```

This starts DeskSSH on `http://127.0.0.1:8717` and opens your browser. Enter a
server's host, port, user and a password or private key, and you get a familiar
desktop — file manager, terminal, text editor (Stallman), system monitor — all
over plain SSH.

> It binds to `127.0.0.1` by default (it is an SSH gateway and should not be
> exposed by accident). Override with `HOST` / `PORT` env vars if you know what
> you're doing.

Requirements: **Node.js >= 20**. Remote host: a Linux server with SSH
(Debian/Ubuntu/Mint in v1).

## Links

- Repository & docs: https://github.com/nestorrguez/DeskSSH
- License: **AGPL-3.0-or-later**
