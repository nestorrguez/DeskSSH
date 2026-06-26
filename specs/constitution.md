# DeskSSH Constitution

**Non-negotiable** principles. Every spec, plan, task or line of code must respect
them. If anything conflicts with the constitution, the constitution wins; changing
it requires an explicit amendment in this document (with date and reason).

Last revised: 2026-06-25.

---

## Article 1 — No remote desktop (the premise)

DeskSSH **does not transmit pixels** nor reuse the server's graphical environment.
It is not VNC, RDP, X-forwarding, SPICE or similar. The interface is
**synthesized on the client** from data obtained over SSH. Any proposal that
violates this is out of scope, however useful it may seem.

## Article 2 — Agentless

DeskSSH **installs no software, agents or daemons** on the remote host. It assumes
only:

- a running SSH server, and
- standard POSIX/Unix utilities already present (`sh`, `ls`, `stat`, `ps`, `df`, …).

If a feature needs something non-standard, it must **degrade gracefully** (offer
less, not fail) and never require changes on the server.

## Article 3 — Command transparency

The user can always **see the command** a GUI action is about to run (or has run).
DeskSSH is an administration tool, not a black box: showing the command builds
trust and, along the way, teaches the command line. Raw output must always be
accessible.

## Article 4 — Security is not optional

- Secrets (passwords, passphrases, private keys) are never stored in plain text nor
  appear in logs.
- **Least privilege**: DeskSSH acts with the SSH user's permissions; it never
  escalates privileges on its own.
- In the web model, the backend is an **SSH gateway**: treated as a critical
  component (authentication, session isolation, auditing).
- Every destructive operation (delete, overwrite, kill processes, stop services)
  requires **explicit user confirmation**.

## Article 5 — Frontend-agnostic core

The logic (SSH sessions, OS adapters, parsers, "app" definitions) lives in a **core
independent of presentation**. This allows serving a web app and, with the same
core, delivering it either hosted or self-hosted (npm). No business rule lives in
UI components.

## Article 6 — Portability through adapters

Servers differ (Debian/Ubuntu, RHEL/Fedora, Arch, BSD; `bash`/`sh`; GNU vs BSD
coreutils). The differences are isolated in an **adapter layer**. The rest of the
system talks to a uniform interface and assumes no specific distro. Machine-
readable output (`stat -c`, `ps -eo`, `--json` flags where available) is preferred
over parsing human-formatted text.

## Article 7 — Resilience and graceful degradation

Server diversity makes parsing fail sometimes. A parsing failure must **never**
crash the app: the raw output is shown and we move on. Every round trip may fail or
be slow; the UI reflects this without freezing.

## Article 8 — Latency-aware performance

Every GUI action is, potentially, a network round trip. The design must **minimize
round trips** (batching, listing caches, optimistic UI) and never assume zero
latency.

## Article 9 — 100% open source and contributor-friendly

DeskSSH is and will remain fully open source under **AGPL-3.0-or-later**. AGPL
(strong copyleft with a network clause) is chosen precisely because the project is
web-first: it guarantees that any improvement, even when offered only as a
network-accessible service, comes back to the community. A low barrier to entry for
contributors is also prioritized: mainstream stack, documentation in `specs/`,
explained and traceable decisions. No proprietary dependencies on the critical
path, nor licenses incompatible with AGPL-3.0.

## Article 10 — Non-interactive, structured primitives

DeskSSH **does not drive remote interactive tools** (nano, vim, top, etc.) by
sending them keystrokes over a PTY: it is fragile, version-dependent and impossible
to normalize across platforms. Instead, every feature is built on **non-interactive,
structured-output primitives** defined in the capability contract (e.g.
`readFile`/`writeFile` instead of launching a remote editor), and the experience is
**emulated on the client**. Asking for machine-readable output is always preferred
over parsing human-formatted text.

The **only deliberate exception** is the **terminal** app, which exposes the raw
shell on purpose (where the user does see `bash`/`PowerShell`/`csh`).

This article is the foundation that makes Article 6's portability viable: without
structured output, the capability contract could not normalize across OSes.

---

## Amendments

- _(none yet)_

## Closed decisions

- **License: AGPL-3.0-or-later** (decided 2026-06-25). Closes the GPL's "network
  loophole", consistent with the web-first model and the goal of keeping the
  project 100% open. See Article 9 and the `LICENSE` file.
