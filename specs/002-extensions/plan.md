# Technical plan — 002 Extensions

**How** to build what [`spec.md`](./spec.md) describes, respecting
[`../constitution.md`](../constitution.md). Builds directly on the seams described in
[`../001-core/plan.md`](../001-core/plan.md) §4 (the "adapter manifests + escape hatch"
and "file-type handler registry" already promised there).

---

## 1. OS-adapter registry (core)

Today `selectAdapter(os, executor)` is a hardcoded `if (os.family === 'debian')`
(`packages/core/src/adapters/registry.ts`). Replace with an **`AdapterRegistry`**:

```ts
interface AdapterProvider {
  readonly id: string; // e.g. "debian", "rhel"
  matches(os: OsInfo): number; // 0 = no match; higher = better
  create(executor: CommandExecutor): Capabilities;
}
```

- A module-level registry holds providers; `registerAdapter(p)` adds one.
- `selectAdapter(os, executor)` returns `create()` of the highest `matches()` score,
  or `createUnsupportedAdapter(reason)` when none match.
- Built-ins register on import (Debian). Curated adapter packages export a
  `register()` that the server calls at startup. The call site in
  `packages/server/src/opener.ts:97` is **unchanged**.
- Export `AdapterRegistry`, `AdapterProvider`, `registerAdapter` from
  `packages/core/src/index.ts`.

## 2. Manifest adapter + code hook (core)

A **`ManifestAdapter implements Capabilities`** driven by a manifest:

```ts
interface CapabilitySpec {
  template: string; // "stat -c '%n|%s|%a|...' {path}/*"
  normalize: NormalizeSpec | CodeHook;
}
type AdapterManifest = Partial<Record<keyof Capabilities, CapabilitySpec>>;
```

- **Interpolation** uses the existing `quote()` (`adapters/shell.ts`) for every
  parameter — never naive string concatenation (injection-safe).
- **Normalization** is a small declarative spec (delimiter + column → field map →
  contract type). It runs through the existing `runParsed`/`ok`/`degraded`
  (`contract/result.ts`) so a parse failure returns a **degraded** result carrying raw
  output (Art. 7), never throwing.
- **Code hook:** a capability whose `normalize` (or whole spec) is a function is run in
  TS — the 20% escape (busybox, PowerShell). Capabilities absent from the manifest
  return `unsupported` (FR-203).
- `DebianAdapter` stays as the reference code adapter; **E2** ports a subset of its
  capabilities to a manifest to prove parity (parity tests vs `debian.test.ts`).
- Decide in E2: manifest as a **TS object** (type-safe, simplest) vs JSON. Recommended:
  TS object first; a JSON loader can come with phase-2 third-party.

## 3. App registry + file-handler registry (web)

### App registry

- Replace the `getApps(t)` array (`apps/index.tsx`) with an **`AppRegistry`** that
  built-in apps register into; curated app packages register too. `Desktop.tsx`/
  `Taskbar.tsx` consume the registry (the alphabetical sort already lives in `Taskbar`).
- Extend `AppDefinition` (`features/desktop/types.ts`):

```ts
interface AppDefinition {
  id;
  title;
  icon;
  defaultSize?;
  render; // existing
  category?: string; // FR-211
  capabilities?: (keyof Capabilities)[]; // FR-211/220
  handlers?: FileHandler[]; // FR-211/212
}
interface FileHandler {
  matches(entry: FileEntry): boolean;
  label: string;
}
```

### File-handler registry (closes B.1, realizes FR-025)

- Collapse the five openers (`openEditor`/`openImage`/`openPdf`/`openDoc`/`openTerminal`)
  and their five `*Target` states in `Desktop.tsx` into:
  - one **`openFile(path, entry?)`** that resolves handlers from the registry (default =
    first/most-specific; "Open with" = pick among matches), then opens the chosen app
    with a **generic per-app param channel** (a single `{appId, payload, req}` instead of
    bespoke `editorTarget`/`imageTarget`/…).
  - the terminal keeps its existing cwd/req path (it is not a file handler).
- The file manager's extension-based dispatch (`apps/lib.ts`) is replaced by querying the
  registry. A type with no handler falls back to client download (spec §9.8).

## 4. Capability evolution (core-owned, closed)

The contract is **universal** (Art. 6 / FR-203): a new capability is added at an
abstraction **every supported OS can implement**, and bumps the Contract version (FR-241).
When a curated app needs a new capability (e.g. a Log viewer's `tailLog`, or reusing the
already-declared `listServices`):

1. add the method to `Capabilities` (`contract/capabilities.ts`) + its types, **bumping
   `CONTRACT_VERSION`** (`contract/version.ts`) and `CONTRACT_CAPABILITIES`;
2. implement it in **every current adapter** (`DebianAdapter` + manifests); an adapter that
   predates the bump returns `unsupported` until it catches up (version skew, the only
   legitimate `unsupported`);
3. add a gateway route in `packages/server/src/gateway.ts` (the only place routes grow);
4. the web app calls it via `api/gateway`.

If a target OS **cannot** implement the new method, do **not** ship it as a per-OS hole —
**re-abstract** the contract so it can (or reconsider the capability). The transparency wrap
(`opener.ts:95`) and `runCap` elevation path apply automatically.

## 5. Trust, permissions & catalog

- **Permissions (FR-220):** `capabilities` on the app/adapter metadata. Phase 1 uses them
  for graceful-degrade (hide/disable actions the host adapter reports unsupported) and to
  render the Extensions view. Phase 2 turns them into an enforced allow-list.
- **Transparency/confirmation (FR-221):** inherited — no per-plugin work.
- **Settings & catalog (FR-250/230/231):** a pre-login **Settings panel** (§5e) lists
  and manages extensions; each is described by a manifest (id, kind, author, license,
  capabilities, osSupport, contract range). A first read-only slice — installed adapters via
  a **sessionless** `GET /api/adapters` (core `adapterCatalog()`) plus the app registry —
  shipped 2026-06-29 on the connection screen.

### 5b. Where extensions live & how they're distributed

Built-ins (the Debian adapter, the core apps, official extras) ship **bundled** with the
Desk (the `deskssh` npm package). **Additional / third-party** extensions live in a
**plugins folder**, one subfolder per kind:

```
$DESKSSH_PLUGINS   (default ~/.deskssh/plugins/)
├── adapters/      # declarative-manifest adapters (FR-202: no third-party code)
├── apps/          # pre-built app plugins (ESM + assets + locales)
└── languages/     # Desk language packs (FR-260)
```

- **Format follows what the kind carries.** **Adapters** and **language packs** are pure
  **data** (a declarative manifest / a key→string map) with no code or assets, so they ship
  as a single **`.json`** file. **Apps** carry built JS + assets, so they ship as a **`.zip`**
  (universal on Windows + Linux; chosen over `.tgz`) holding a **manifest** + already-built
  assets — we do **not** recompile. That a third-party adapter/language can only be `.json`
  reinforces FR-202 (no third-party host code). Manifest fields:
  `id, name, version, kind (adapter|app|language), author, signature?, license,
contract (required range), desk (required range), capabilities?, osSupport?,
i18n {default, locales}, entry`.
- **Install = manual or wizard.** Drop the package into the right subfolder, **or** use the
  **import wizard**: pick the file (`.json` for adapters/languages, `.zip` for apps); the
  gateway validates the manifest, verifies any signature, places/extracts it into the
  matching subfolder, and shows a **"restart the service to load"** notice. No hot-swap —
  loaded on next start.
- **Load = scan on startup.** The gateway scans the subfolders, reads each manifest, checks
  **compatibility** (§5c) and **trust** (§5d), then registers the enabled ones: adapters via
  `registerAdapter()`; languages into the Desk i18n; app plugins are **served** by the
  gateway and the web **dynamically imports** their entry at boot, **sharing the Desk's
  React/UI/icon singletons** (no plugin bundles its own React — via an import map / module
  externals). A plugin failing any check is **skipped and surfaced** in the Settings panel
  (Art. 7), never fatal.
- **Discovery by convention, not folder-targeting:** npm cannot install one package _inside
  another's_ folder, so there is no "install into app X". Plugins are recognized by their
  manifest in the subfolders; built-ins by being bundled deps.

### 5c. Independent versioning & compatibility (FR-241)

Four parts carry their **own** semver: **Desk** (login + graphical env + the app-runtime API
it exposes), **Contract** (the capability catalog), **each App**, **each Adapter**.

- The Desk advertises the **Contract** version it bundles and its **app-runtime API** version;
  a plugin manifest declares the ranges it needs (`contract`, `desk`).
- On load the Desk resolves three joints and **gates** accordingly:
  - **Desk ↔ App** — app-runtime API range; mismatch → app refused/flagged.
  - **Contract ↔ App** — an app needing a newer Contract than the Desk bundles is flagged.
  - **Adapter ↔ Contract** — an adapter declares the Contract it implements + the
    capabilities it provides; an app only shows actions whose capabilities the **connected
    host's adapter actually implements** (the backward-compatibility layer).
- Apps/adapters thus evolve on their own cadence; the Contract is bumped only when a
  capability is added/changed, and old plugins keep working within their declared range.

### 5d. Trust & signature (FR-242)

- **Third-party adapters are declarative-only** (FR-202): no host-side code; an untrusted
  adapter can only run **inspectable** command templates (still transparent, Art. 3).
- **App plugins are JS.** Each manifest carries an **`author`**. First-party (`nestorrguez`)
  packages carry an **official signature** the gateway verifies (a detached signature /
  checksum over the package — scheme TBD in E11) and the Settings panel badges **Verified**.
  Unsigned/third-party packages import only after an explicit **risk warning** ("this runs
  code that can execute commands on your servers; install only if you trust the provider").
  Runtime sandboxing/enforcement stays in FR-240.

### 5e. Settings & Desk i18n

- **Settings (FR-250)** replaces the read-only Extensions view: a pre-login panel with
  **Appearance** (themes), **Adapters** and **Apps** (list, enable/disable, author/version/
  Verified, and the **default** app per shared target — wired to the handler registry §3),
  and **Languages**. Enabled/disabled + default-handler state persists in `~/.deskssh/`;
  incompatible/disabled plugins show the reason.
- **Desk languages (FR-260/261):** language packs translate the **Desk** (a single `.json`);
  **apps bundle their own** locales (manifest `i18n`). The selector forces a locale; an app
  missing it falls back to its **own default**, the Desk to its built-in default. Identifiers
  follow **BCP 47** (`en-US`, `es-MX`, `pt-BR`, `zh-Hans`, `hi`, `ar`, `yua`, `nhn`). The core
  today uses bare `en`/`es` (`detectLocale`/`makeTranslator`); E12 migrates to BCP 47 with
  namespaced, per-source catalogs. **First-party commitment (FR-261):** the eight languages
  above, shipped incrementally; Arabic also needs **RTL** layout; indigenous packs authored
  with native speakers.

## 6. Milestones

- **E1** Core `AdapterRegistry` (refactor, register Debian, export, tests). No behaviour
  change. → FR-200
- **E2** Manifest engine + parity port of Debian subset. → FR-201/202/203
- **E3** First curated family `@deskssh/adapter-rhel` (or `-arch`) as a manifest;
  validate against a real VM. → FR-200/201/203
- **E4** Web `AppRegistry` + `AppDefinition` metadata; built-ins register. → FR-210/211
- **E5** File-handler registry: `openFile` + per-type handlers; collapse openers. →
  FR-212 (FR-025), backlog B.1
- **E6** First curated app package `@deskssh/app-logs` (or `-services`): registers an app,
  declares capabilities + a handler; adds any new capability per §4. → FR-210/211/213/220
- **E7** Catalog manifest + plugin authoring guide; document the FR-240 future seams. →
  FR-230/231
- **E8** **Settings** (pre-login): Appearance/themes + Adapters + Apps (enable/disable,
  default handler per target) + Languages; persisted in `~/.deskssh/`. Supersedes the
  read-only Extensions view. → FR-250
- **E9** **Versioning & compatibility**: assign independent semver to Desk / Contract / each
  App / each Adapter; manifest `contract`/`desk` ranges; load-time compat resolution + the
  capability-gating backward-compat layer. → FR-241
- **E10** **Plugin import & lifecycle**: the `~/.deskssh/plugins/{adapters,apps,languages}/`
  layout, startup scan, `.zip` import wizard (gateway-side extract + validate), restart
  notice, enable/disable, failure isolation, uninstall; app plugins served + dynamically
  imported with shared singletons. → FR-251
- **E11** **Trust & signature**: author field everywhere; first-party signature scheme +
  Verified badge; third-party risk warning; enforce adapters-are-declarative-only. → FR-242
- **E12** **Desk language packs + BCP 47**: migrate core i18n to BCP 47, namespaced
  per-source catalogs; language-pack plugin kind; selector forces locale with app-default
  fallback; the eight committed first-party packs + RTL for Arabic. → FR-260/261

> Sequencing: core seams **E1–E3**, web seams **E4–E6**, then the orchestrator layer
> **E8–E12** (Settings panel first, since it frames lifecycle/versioning/i18n). E7 docs trail
> the relevant milestones.

## 7. Risks & mitigations

| Risk                                                   | Mitigation                                                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Registry refactor changes Debian behaviour             | E1 is behaviour-neutral; full `pnpm test` + the Debian flow as regression.                                 |
| Manifest can't express a capability                    | First-party code-hook (FR-202); keep `DebianAdapter` as reference.                                         |
| No test host for the new family (blocks E3)            | Provision a RHEL/Fedora or Arch libvirt VM mirroring the Debian setup **before** E3.                       |
| Handler-registry refactor regresses "Open with"        | Port FilesApp dispatch behind the registry with existing types as fixtures.                                |
| Runtime-loaded app JS bundles its own React → breakage | Shared singletons via import map / externals; a versioned, documented app-runtime API (E10).               |
| Third-party app code runs on the user's servers        | Adapters declarative-only (FR-202); risk warning + Verified signature (FR-242); sandbox deferred (FR-240). |
| Contract evolves and breaks plugins                    | Independent versioning + declared ranges + capability-gating (FR-241).                                     |

## 8. Decisions

**Taken (2026-06-29):**

- DeskSSH as an **orchestrator**: thin Desk + pluggable adapters/apps/languages.
- **Independent semver** for Desk, Contract, each App, each Adapter; compatibility resolved
  by declared ranges + capability-gating (FR-241).
- **Distribution** into `~/.deskssh/plugins/{adapters,apps,languages}/`; manual drop or import
  wizard; **restart-to-load**; built-ins stay bundled. **Format by kind:** adapters and
  language packs are a single **`.json`** (pure data, no code/assets); apps are **`.zip`**
  (bundled JS + assets).
- **Third-party adapters are declarative-only**; **apps** are JS with a risk warning;
  **first-party signature** + Verified badge (FR-242).
- **Pre-login Settings panel** for appearance, adapters, apps (+ default handlers) and
  languages (FR-250).
- **Desk languages via packs**; apps self-contained; locale format **BCP 47** (FR-260). DeskSSH
  **commits to eight first-party languages** incl. Maya (`yua`) and Nahuatl (`nhn`); Arabic
  needs RTL (FR-261).

**Open:** manifest schema form (TS vs JSON) + Debian migration extent (E2); first new family
RHEL vs Arch (E3); signature scheme (E11); app-runtime API surface/version + shared-singleton
strategy (E5/E10); theme system scope (E8).
