# Contributing to DeskSSH

Thanks for your interest in DeskSSH! This project is built with **Spec-Driven
Development (SDD)**: design decisions are made in `specs/` **before** they reach the
code. That keeps the project coherent and lets anyone understand _why_ things are
the way they are.

## Ground rules

- **English only** in the repository (code, comments, docs, commit messages, specs).
  The repo is public and international.
- **Read the specs first.** Start with [`specs/vision.md`](specs/vision.md) and
  [`specs/constitution.md`](specs/constitution.md). The constitution lists
  **non-negotiable** principles — if a change conflicts with one, it won't be
  accepted unless the constitution is explicitly amended.
- **Spec before code.** No behavior change lands without the spec being updated
  first. For a non-trivial change, open a discussion/PR on the relevant document in
  `specs/` before writing code.
- **Traceability.** Functional requirements have IDs (`FR-XXX`). Reference the
  `FR-`/Article a change serves in the spec, tasks and PR description.

## Project layout

```
specs/                  Source of truth (vision, constitution, glossary, 001-core/*)
packages/
  core/                 Frontend-agnostic core (SSH sessions, adapters, contract)
  server/               Web gateway (keeps SSH sessions, exposes the API)
  web/                  Browser UI (desktop shell + app views)
```

## Local development

Requirements: **Node.js >= 20** and **pnpm 9** (`corepack enable pnpm` or
`npm i -g pnpm@9`).

```bash
pnpm install        # install all workspaces
pnpm typecheck      # type-check core + server
pnpm lint           # ESLint
pnpm test           # Vitest
pnpm build          # build all packages
pnpm format         # apply Prettier
```

CI runs format-check, lint, typecheck, test and build on every push/PR — please make
sure they pass locally first.

## Commits & pull requests

- Keep commits focused; write clear messages in English.
- Describe **what** and **why**, and reference the `FR-`/Article involved.
- Be kind and constructive. DeskSSH aims to be a welcoming, accessibility-first
  project.

## License

By contributing, you agree that your contributions are licensed under
**AGPL-3.0-or-later**, the project's license.
