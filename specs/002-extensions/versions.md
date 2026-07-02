# Version ledger — DeskSSH (FR-241)

The internal source of truth for every **independently-versioned** part of DeskSSH. The
extension model (spec [`spec.md`](./spec.md), FR-241) versions five kinds separately: the
**Desk** (the product), the **Contract** (capability catalog), the **App-runtime** (the SDK
plugins compile against), **each App** and **each Adapter**. This file records their current
versions and history; the authoritative numbers live in code (see _Source of truth_ below),
and every bump is logged here.

## How versions move

- **patch** (`0.1.0 → 0.1.1`): backward-compatible additions/fixes.
- **minor** (`0.1.x → 0.2.0`): under 0.x this is treated as **potentially breaking** — a caret
  range `^0.1.0` (`>=0.1.0 <0.2.0`) does **not** admit `0.2.0`. Bump the ranges that target it.
- **major** (`→ 1.0.0`): breaking changes, post-1.0.

A **plugin** declares the ranges it needs: an **App/plugin** declares a `contract` range and a
`desk` (app-runtime) range; an **Adapter** declares the `contract` range it implements. The
Desk resolves the three joints at load (Desk↔App, Contract↔App, Adapter↔Contract).

## Current versions

| Entity                      | Kind     | Version | Source of truth (code)                                          | Declares          |
| --------------------------- | -------- | ------- | --------------------------------------------------------------- | ----------------- |
| **Desk**                    | product  | `0.2.0` | `packages/cli/package.json` + `packages/web/src/version.ts`     | —                 |
| **Contract**                | contract | `0.1.0` | `packages/core/src/contract/version.ts` (`CONTRACT_VERSION`)    | —                 |
| **App-runtime**             | SDK      | `0.2.0` | `packages/core/src/contract/version.ts` (`APP_RUNTIME_VERSION`) | —                 |
| **Adapter · debian**        | adapter  | `0.1.0` | `packages/core/src/adapters/registry.ts`                        | contract `^0.1.0` |
| **App · files**             | app      | `0.1.0` | `packages/web/src/features/desktop/apps/index.tsx`              | contract `^0.1.0` |
| **App · editor** (Stallman) | app      | `0.1.0` | ″                                                               | contract `^0.1.0` |
| **App · docs**              | app      | `0.1.0` | ″                                                               | contract `^0.1.0` |
| **App · monitor**           | app      | `0.1.0` | ″                                                               | contract `^0.1.0` |
| **App · system**            | app      | `0.1.0` | ″                                                               | contract `^0.1.0` |
| **App · history**           | app      | `0.1.0` | ″                                                               | contract `^0.1.0` |
| **App · terminal**          | app      | `0.1.0` | ″                                                               | contract `^0.1.0` |
| **App · viewer**            | app      | `0.1.0` | ″                                                               | contract `^0.1.0` |
| **App · pdf**               | app      | `0.1.0` | ″                                                               | contract `^0.1.0` |

> Third-party app plugins (`.zip`) target **contract `^0.1.0`** and **desk `^0.2.0`**.
> Built-in apps ship with the Desk (monolith decision) but carry their own version line for
> the model. New OS-family adapters and app plugins are appended here as they land.

## History

### Desk (product)

- **0.2.0** — Extension system (spec 002): adapter + app registries, declarative manifests,
  plugin import & lifecycle (`.zip`/`.json` into `~/.deskssh/plugins/`), the pre-login
  **Settings** panel (Appearance / Adapters / Apps / Import / Language / **About**), the
  independent-versioning model, shared-runtime fix (in-browser boot). The standalone Credits
  app was removed (folded into About + per-app credits).
- **0.1.9** — MVP (published to npm): system info (fastfetch), command-history app, launcher
  redesign. The base idea is complete.
- **0.1.8** — File-manager robustness (M7).
- **0.1.7** — Process/service control + privilege elevation.

### Contract

- **0.1.0** — Initial capability catalog (E9.1): `listDir`, `stat`, `readFile`, `writeFile`,
  `makeDir`, `createFile`, `move`, `copy`, `remove`, `systemMetrics`, `systemInfo`,
  `listProcesses`, `signalProcess`, `serviceAction`, `listServices`.

### App-runtime (`@deskssh/app-runtime` SDK)

- **0.2.0** — First shipped SDK, aligned with Desk 0.2.0 (the release that loads third-party
  apps). Surface: the app registry singleton (`registerApp` / `getApps`), UI/icon primitives,
  the gateway client, and types (`AppDefinition`, `AppContext`, `WindowState`, `LibraryCredit`);
  shared React/UI/icons via the page import map (E10.4). _(Prototyped as `0.1.0` during E10.4
  development; never published — set to `0.2.0` to ship with the extension system.)_

### Adapters

- **debian `0.1.0`** — Declarative-manifest + code-hook adapter for Debian/Ubuntu (E1/E2);
  implements Contract `^0.1.0`.

### Apps (built-in)

- **All at `0.1.0`** — `files`, `editor` (Monaco Editor), `docs` (TipTap), `monitor`, `system`,
  `history`, `terminal` (xterm.js), `viewer`, `pdf` (pdf.js). Each declares contract `^0.1.0`.
- **Removed in Desk 0.2.0** — `credits`: folded into Settings → About (DeskSSH's own libraries)
  and each app's detail view (its own libraries).
