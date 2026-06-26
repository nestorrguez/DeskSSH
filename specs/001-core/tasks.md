# Tasks — 001 Core

> **Status: pending.** This breakdown is completed **at the start of the coding
> session**, once the open decisions in [`spec.md`](./spec.md) §9 and
> [`plan.md`](./plan.md) §8 are closed. No code is written for a task that doesn't
> exist here (see `CLAUDE.md`).

## Preconditions before generating tasks

- [x] **web-first + agnostic core** direction confirmed (plan §1).
- [x] Open source **license** chosen — AGPL-3.0-or-later (spec §9.1).
- [x] **Stack** confirmed — TS + Node + ssh2 + React, Tailwind + Radix (shadcn/ui),
  Lucide, xterm.js (plan §3).
- [x] **App subset** of the first coded milestone agreed (spec §9.7).

## Task skeleton (to be filled per milestone)

### M0 — Scaffolding
- [ ] Initialize monorepo (workspaces) and `core`, `server`, `web` packages.
- [ ] Add `LICENSE` and `CONTRIBUTING.md`.
- [ ] Basic CI (lint + test + build).

### M1 — Connection core
- [ ] (to break down) SSH session: exec / PTY / SFTP. → FR-030, FR-031
- [ ] (pending) OS detection + Debian/Ubuntu adapter. → FR-004, Art. 6
- [ ] (pending) Single execution point with transparency logging. → FR-013

> The remaining milestones (M2–M3 and post-v1) are broken down when tackled,
> following `plan.md §6`.
