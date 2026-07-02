# Tasks — 002 Extensions

> Breakdown derived from [`spec.md`](./spec.md) and [`plan.md`](./plan.md). **No code
> for a task that doesn't exist here** (strict spec-first, see `CLAUDE.md`). Each task
> references the `FR-` it serves. Detailed since: 2026-06-29.

## E0 — Specification — DONE

- [x] **E0.1** Write `spec.md` (FR-200..240: adapter registry/manifest, app registry,
      handler registry, closed-contract policy, permissions, catalog, phase-2 future).
- [x] **E0.2** Write `plan.md` (registry shape, manifest+normalization, handler registry,
      capability-evolution recipe, milestones, risks).
- [x] **E0.3** Write this breakdown.

> Decisions of record (2026-06-29): curated/build-time now with seams for phase-2
> runtime; both seams (OS + apps) under this spec; hybrid manifest + code-hook adapters.

---

## E1 — Core adapter registry → FR-200 — DONE (2026-06-29)

- [x] **E1.1** `AdapterProvider` (`id`, `matches(os): number`, `create(executor)`) +
      module-level registry, `registerAdapter()` (idempotent by id), `listAdapters()`,
      and a built-in `debianProvider` in `packages/core/src/adapters/registry.ts`.
- [x] **E1.2** `selectAdapter()` resolves the highest-scoring provider, falling back to
      `createUnsupportedAdapter` (wording kept so existing tests pass).
- [x] **E1.3** Exported `AdapterProvider`/`registerAdapter`/`listAdapters`/
      `debianProvider` from `index.ts`.
- [x] **E1.4** Tests: Debian matches; unknown → unsupported; highest-score wins;
      idempotent registration. Behaviour-neutral — 62/62 tests, typecheck + lint green.

**E1 done:** the Debian connection resolves through the registry with no behaviour
change; registry unit-tested.

## E2 — Manifest adapter engine → FR-201/202/203 — DONE (2026-06-29)

- [x] **E2.1** `AdapterManifest` / `CapabilitySpec` / `NormalizeSpec` (declarative
      `records` kind: row/column delimiters + typed columns with enum maps + a `rest`
      column) and `ManifestAdapter implements Capabilities` in
      `packages/core/src/adapters/manifest.ts`. Params interpolate via `quote()`
      (injection-safe); normalization runs through `runParsed` (parse failure →
      `degraded` with raw, Art. 7).
- [x] **E2.2** Code-hook escape: a `CapabilitySpec.normalize` may be a function (the
      first-party 20% escape, FR-202); capabilities absent from the manifest return
      `unsupported`.
- [x] **E2.3** `debian.manifest.ts` ports `listDir` (fully declarative) and
      `systemMetrics` (code hook), reusing Debian's command constants. **Parity tests**
      (`manifest.test.ts`) assert identical typed output **and** identical emitted
      command vs `DebianAdapter`. 71/71 tests, typecheck + lint green.
- [x] **E2.4** **Decided:** manifest is a **TS object** (type-safe, no loader);
      JSON deferred to phase-2 third-party. **Debian migration extent:** demonstration
      subset only — `DebianAdapter` stays the production reference; binary
      (read/writeFile), void-only and multi-step (`serviceAction`) capabilities are
      not yet declaratively expressible and need a code hook.

## E3 — First curated OS family → FR-200/201/203

- [ ] **E3.0** **Prereq:** provision a RHEL/Fedora **or** Arch libvirt test VM (mirror the
      Debian VM setup; record creds in private notes).
- [ ] **E3.1** New package `@deskssh/adapter-rhel` (or `-arch`): a manifest implementing
      the v1-needed capabilities, registering via `registerAdapter()`.
- [ ] **E3.2** Wire its `register()` into the server startup (curated, build-time).
- [ ] **E3.3** Validate against the real VM: `listDir` + `systemMetrics` + `serviceAction`
      typed; every command logged; a forced parse failure shows raw output (Art. 7).

## E4 — Web app registry → FR-210/211 — DONE (2026-06-30)

- [x] **E4.1** `apps/registry.ts` — an `AppRegistry` of `AppFactory = (t) => AppDefinition`;
      built-ins `registerApp(...)` on import; `getApps(t)` builds them (de-duped by id).
      `Desktop`/`Taskbar`/Settings consume `getApps`. (Curated/plugin apps register here too,
      E10.4.)
- [x] **E4.2** `AppDefinition` gains `category?` + `capabilities?` (`CapabilityName[]`);
      built-ins annotated (e.g. Files needs the FS capabilities; Monitor needs
      `systemMetrics`/`listProcesses`/`signalProcess`; Terminal/History/Credits none).
      `handlers` lands with E5.
- [x] **E4.3** Graceful-degrade (also realizes **E9.3**): the connected host's adapter
      capabilities ride on `SessionInfo.capabilities` (server `toSessionInfo` →
      core `selectProvider(os).capabilities`); the launcher shows an app whose required
      capability the host lacks **disabled, with the reason** (`desktop.unsupported`).
      92→94 tests, typecheck + lint green.

## E5 — File-handler registry → FR-212 (FR-025), backlog B.1

- [ ] **E5.1** Build a handler registry: resolve `handlers` from registered apps by file
      type; expose `openFile(path, entry?)` (default + "Open with").
- [ ] **E5.2** Collapse the five openers and `*Target` states in `Desktop.tsx`/
      `AppContext` into a single generic param channel; keep the terminal cwd/req path.
- [ ] **E5.3** Replace the file manager's extension dispatch (`apps/lib.ts`) with registry
      queries; no-handler types fall back to client download.
- [ ] **E5.4** Verify "Open" + "Open with" for a multi-handler type (e.g. a text file);
      Playwright smoke via `scratchpad/walkthrough.mjs`.

## E6 — First curated app plugin → FR-210/211/213/220

- [ ] **E6.1** New package `@deskssh/app-logs` (Log viewer) **or** `-services`: registers
      an app + declares `capabilities` (+ a handler if relevant).
- [ ] **E6.2** Add any new capability it needs to the closed contract per `plan.md` §4
      (contract → Debian adapter → gateway route → web client).
- [ ] **E6.3** It appears in the launcher and runs against a real VM, inheriting
      transparency + confirmation.

## E7 — Catalog & contributor docs → FR-230/231/240

> **Brought forward (2026-06-29):** a first slice of the Extensions view shipped early at
> the user's request — a config/admin button on the **connection/login screen** opening a
> read-only panel of installed **OS adapters** (sessionless `GET /api/adapters`, backed by
> core `adapterCatalog()` + `AdapterInfo` display metadata on `AdapterProvider`) and
> **apps** (web registry). Files: `core/src/adapters/registry.ts`,
> `server/src/gateway.ts`, `web/src/api/gateway.ts`,
> `web/src/features/login/ExtensionsDialog.tsx`, `App.tsx`, i18n. This panel is the **seed
> of the Settings panel (E8)**. The distribution model (`.zip` into
> `~/.deskssh/plugins/{adapters,apps,languages}/`, import wizard, restart-to-load),
> versioning, trust/signature and Desk i18n are recorded in `plan.md` §5b–5e.

- [ ] **E7.1** Plugin **manifest schema** (id, name, version, kind, author, signature?,
      license, contract/desk ranges, capabilities?, osSupport?, i18n{default,locales}, entry) + a `catalog.json` describing installed extensions.
- [~] **E7.2** Extensions listing. _(read-only login-screen panel shipped; superseded by the
  manageable Settings panel in E8.)_
- [ ] **E7.3** Plugin authoring guide (adapter manifest + app plugin), AGPL note.
- [ ] **E7.4** Document the **future** hardened/hosted seams (FR-240): runtime permission
      enforcement, sandboxing of third-party app JS, hosted catalog + auto-update — **not
      built**.

---

## Orchestrator layer (E8–E12)

> Turns DeskSSH into an orchestrator (thin Desk + pluggable adapters/apps/languages). Built
> after the core (E1–E3) and web (E4–E6) seams. **Spec-first gate applies** — these are
> outlined here; detail each before coding. Land incrementally on the 0.1.x line.

### E8 — Settings (pre-login) → FR-250

> **Slice landed (2026-06-29, decision 2):** the tabbed Settings shell + Appearance + the
> read-only Adapters/Apps inventory + Language. Enable/disable, Verified and default-handler
> need other epics (E10/E11/E5) and are deferred.

- [x] **E8.1** _(DONE 2026-06-29)_ Replaced the read-only `ExtensionsDialog` with
      `web/src/features/settings/SettingsDialog.tsx` — a shadcn **Tabs** panel
      (Appearance / Adapters / Apps / Language) opened from the connection screen. Named
      **Settings** (ES **Configuración**), not "control panel".
- [x] **E8.2** _(DONE 2026-06-29)_ **Appearance:** theme selector **Light / Dark / System**.
      **Theme system decided:** the existing shadcn token sets, switched by the `dark` class
      on `<html>`; `system` follows `prefers-color-scheme`; applied pre-paint in `main.tsx`
      (`features/settings/theme.ts`). Multi-accent theming deferred (phase 2).
- [~] **E8.3** **Adapters/Apps:** read-only list **with version** shipped (adapters show
  `v{version}` from `AdapterInfo`). **Author/Verified** badge needs E11; **enable/disable**
  toggle needs the plugin lifecycle (E10). _(deferred)_
- [ ] **E8.4** **Default handler per shared target** (wired to the handler registry, E5).
      _(blocked on E5)_
- [~] **E8.5** Persistence: **theme + language persist per-device** (localStorage) — they are
  browser UI prefs, not server state. Server-side `~/.deskssh/` persistence for
  **enabled/disabled + default-handler** (and showing reasons for incompatible items)
  lands with E10. _(partial)_
- [x] **E8.6 — About tab + per-app credits (FR-220 attribution).** _(DONE 2026-07-02)_ The
      **About** section (added with E9.2) also carries **DeskSSH's own credits**: the AGPL-3.0
      license + the core/shell + backend libraries it builds on (React, Radix, shadcn, Tailwind,
      Lucide, cva, clsx, tailwind-merge, ssh2, ws, fflate). **Per-app libraries move to each
      app's detail view**: `AppDefinition` gains an optional `credits?: LibraryCredit[]`
      (`{ name, use, license, url?, author? }`) — part of the `@deskssh/app-runtime` surface, so
      **plugins can declare their own** (additive/optional). See the version ledger
      ([`versions.md`](./versions.md)).
      Built-ins declare theirs (editor→Monaco, docs→TipTap, terminal→xterm.js, PDF→pdf.js).
      **The standalone Credits desktop app is removed** — its content now lives in About
      (DeskSSH) + each app's detail (its libraries). Licenses/authors read from each
      `package.json`.

### E9 — Independent versioning & compatibility → FR-241

> **Sequencing note (2026-06-29):** the owner chose to start the orchestrator with
> decision 1 (versioning). The **Contract** and **Adapter** sides are buildable now (they
> only depend on E1/E2, both done); the **App** and **Desk app-runtime** sides and the
> graceful-degrade _UI_ need E4 (app registry) / E10 (plugin manifests), so they trail.
> E9 is therefore landed in slices.

- [x] **E9.1a — Contract + Adapter versioning (core).** _(DONE 2026-06-29)_ A
      `CONTRACT_VERSION` (semver) + the canonical `CONTRACT_CAPABILITIES` set in
      `packages/core/src/contract/version.ts`. A minimal, dependency-free semver module
      (`semver.ts`: parse / compare / `satisfies` for exact, `^`, `~`, `*`, incl. correct
      0.x caret rules) with unit tests. `AdapterProvider` gains `version` (its own semver),
      `contract` (the Contract range it implements) and `capabilities` (the keys it
      provides); `debianProvider` declares them. `AdapterInfo`/`adapterCatalog()` expose
      them; `selectAdapter` is unchanged (behaviour-neutral). Exported from `index.ts`.
- [x] **E9.1b — Adapter↔Contract resolver (core).** _(DONE 2026-06-29)_
      `checkAdapterCompat(provider, contractVersion)` → compatible / incompatible (with a
      reason) using `satisfies(contractVersion, provider.contract)`. Unit-tested. Surfaced
      read-only in the login Extensions panel (each adapter shows `v{version}`).
- [x] **E9.2 — Desk + App ranges & full compat resolver.** _(DONE 2026-07-01)_ Most landed
      with **E10.4**: `APP_RUNTIME_VERSION` (the Desk app-runtime API semver), app manifests
      declare `version` + `contract` + `desk`, and `checkAppCompat` resolves both app joints
      (Desk↔App, Contract↔App) — wired into `loadAppPlugins` (skips incompatible) and
      `pluginsStatus` (flags with reason) and surfaced in Settings. This slice closed the
      rest: **(1) monolith decision** — first-party apps stay one unit with the Desk, so no
      per-built-in semver (see spec §7); the Desk version is `packages/web` `APP_VERSION`.
      **(2) Settings → About** section exposing Desk + Contract + app-runtime versions
      (`GET /api/versions`) so plugin authors see the ranges to target. **(3)** end-to-end
      tests of all three joints (Desk↔App + Contract↔App in `app-plugins.test.ts`,
      Adapter↔Contract already in `plugins.test.ts`). No core `DESK_VERSION` duplicate:
      `APP_VERSION` (web) is the single source for the Desk release version.
- [x] **E9.3 — Backward-compat layer (UI).** _(DONE 2026-06-30, with E4.3)_ An app whose
      required capabilities the connected host's adapter doesn't declare is disabled in the
      launcher (graceful-degrade, FR-203). Host caps via `SessionInfo.capabilities`
      (`selectProvider(os)`); apps declare `capabilities` (E4.2).

### E10 — Plugin import & lifecycle → FR-251

> **Slice landed (2026-06-30, decision 3):** the plugins folder layout + the **adapter**
> kind end-to-end via **manual drop + startup scan** — the one kind fully unblocked (E2
> manifest engine + E9 compat done, and declarative-only by construction, FR-202). The
> `.zip` import wizard and app/language plugins trail (they need a zip dep / E4 / E12).

- [x] **E10.1 — Folder layout + adapter startup scan.** _(DONE 2026-06-30)_
      `$DESKSSH_PLUGINS` (default `~/.deskssh/plugins/`) with `adapters/ apps/ languages/`
      created on startup. `loadAdapterPlugins()` (`server/src/plugins.ts`) scans
      `adapters/` (a `*.json` file or a `*/manifest.json`), and for each: validates the
      manifest (core `validateAdapterPluginManifest`), checks **Adapter↔Contract** compat
      (E9), builds a provider (core `manifestToProvider` → `ManifestAdapter`) and
      `registerAdapter()`s it. Wired into `startGateway()`. Loaded plugins appear in
      `adapterCatalog()` → the Settings panel, with author/version.
- [x] **E10.3a — Failure isolation.** _(DONE 2026-06-30)_ Every plugin is loaded in its own
      try/catch; a bad/incompatible one is **skipped with a reason** and collected in the
      load report (logged), never aborting the scan or the gateway (Art. 7).
- [x] **E10.2a — Adapter import (`.json`).** _(DONE 2026-06-30)_ `POST /api/plugins/import`
      (sessionless, local-only) → core `validateAdapterPluginManifest` → write into
      `adapters/` named after the sanitized id; restart-to-load. Settings → **Import** picks a
      `.json`. **Format by kind:** adapters and language packs are `.json` (pure data); apps
      are `.zip`.
- [x] **E10.2b — `.zip` import wizard (apps).** _(DONE 2026-06-30)_ `importAppPlugin(zip)`
      (`server/src/plugins.ts`): unzip with **`fflate`** → read the inner `manifest.json`
      (root or one top-level folder) → core `validateAppPluginManifest` → **zip-slip-safe**
      write of every entry under `apps/<sanitized-id>/` (rejects paths escaping the folder,
      replaces a prior install). `POST /api/plugins/import` branches on content-type (zip vs
      JSON). Settings → Import accepts `.zip`. **HTTP smoke test: ALL PASS.**
- [ ] **E10.2c — Language-pack import (`.json`).** Same flow as adapters once the language
      manifest schema + Desk i18n loader exist. _(blocked on E12.)_
- [x] **E10.3b — Manage in Settings.** _(DONE 2026-06-30)_ `GET /api/plugins` →
      `pluginsStatus()` (adapters + apps, `enabled`/`compatible`/`reason`); enable/disable
      persisted to `~/.deskssh/plugins/state.json` (`setPluginEnabled`, honored by both
      loaders); `POST /api/plugins/{enable,uninstall}`. Settings → Import lists installed
      extensions with a toggle + uninstall + reload note.
- [x] **E10.4 — App-plugin runtime wiring.** _(DONE 2026-06-30; in-browser verified +
      fixed 2026-07-02)_ **import map + module externals** (resolves the §7 open decision).
      **In-browser verification (2026-07-02) revealed the app never mounted** (dev + prod):
      the `/runtime/*` bundles used `export * from 'react'` / `'react/jsx-runtime'`, but those
      are **CommonJS**, and `export *` re-exports **no named bindings** from CJS — so
      `/runtime/jsx-runtime.js` exported nothing and `/runtime/react.js` only `default`,
      giving `does not provide an export named 'jsx'` at load. Green tests/build/HTTP-smoke
      missed it because none execute the ESM in a browser. **Fixed (E10.4f)** with explicit
      named re-exports. - [x] **E10.4a — Core/SDK surface.** `validateAppPluginManifest` + `AppPluginManifest`
      (entry path-guard) + `checkAppCompat` (Desk↔App + Contract↔App) + `APP_RUNTIME_VERSION`
      in core, with tests. - [x] **E10.4b — Serve.** `loadAppPlugins()` scans `apps/`; gateway serves entries at
      `GET /api/plugins/apps/<id>/<path>` (path-safe) + lists them at `GET /api/plugins/apps`. - [x] **E10.4c — `@deskssh/app-runtime` SDK** (`web/src/app-runtime/index.ts`): **owns the
      app registry singleton** + re-exports `registerApp`/`getApps`, UI primitives, Lucide
      icons, gateway client, types. `apps/registry.ts` re-exports it. - [x] **E10.4d — Import map + externals.** index.html import map for `react`, `react-dom`,
      `react/jsx-runtime`, `react/jsx-dev-runtime`, `@deskssh/app-runtime` → `/runtime/*`;
      `vite-shared-runtime.ts` externalizes the same (dev + build) and esbuild-emits the
      `/runtime/*` bundles into `public/runtime/` on `buildStart` (exact-match externals so
      jsx-runtime bundles its real impl, not a self-referential loop). - [x] **E10.4e — Boot loader.** `apps/load-plugins.ts` fetches `GET /api/plugins/apps` and
      `import()`s each entry before first render (self-registers via `registerApp`);
      failure-isolated; capability-gating (E4.3) applies unchanged.
- [x] **E10.4f — Shared-runtime named exports (fix, 2026-07-02).** `vite-shared-runtime.ts`
      no longer uses `export *` for the React bundles (silently empty from CJS). Instead:
      `react.js` re-exports React 19's full public API **plus the internals `react-dom`
      needs** (`__CLIENT_INTERNALS_…`, `__COMPILER_RUNTIME`) + `default`; `react-dom.js`
      enumerates its named exports (incl. `createPortal`, needed by Radix/shadcn portals) +
      `createRoot`/`hydrateRoot` + `default`; `jsx-runtime.js`/`jsx-dev-runtime.js` re-export
      `{ Fragment, jsx, jsxs }` / `{ Fragment, jsxDEV }`. Verified in a real browser: the Desk
      mounts and the Settings **About** tab renders. This closes E10.4's in-browser check.

### E7.1 — Plugin manifest schema (adapter kind) → FR-230/231

- [x] _(DONE 2026-06-30)_ `AdapterPluginManifest` defined + validated in
      `core/src/adapters/plugin.ts`: fields `schema`, `kind:'adapter'`, `id`, `name`,
      `version`, `author`, `license?`, `contract` (required range), `osSupport[]`, and
      `capabilities` (declarative `AdapterManifest`). App/language manifest kinds + a
      `catalog.json` come with E4/E12.

### E11 — Trust & signature → FR-242

- [ ] **E11.1** `author` on every manifest; enforce **adapters = declarative-only** (no
      third-party host code).
- [ ] **E11.2** **First-party signature** scheme (detached signature/checksum over the `.zip`) + gateway verification + **Verified** badge in the Settings panel.
- [ ] **E11.3** **Third-party risk warning** on import of unsigned packages.

### E12 — Desk language packs + BCP 47 → FR-260/261

- [ ] **E12.1** Migrate core i18n from bare `en`/`es` to **BCP 47** tags (`en-US`, `es-MX`,
      …), namespaced per-source catalogs (`detectLocale`/`makeTranslator`). Format widened
      from `xx-yy` to BCP 47 to fit the committed set (ISO 639-3 + script + region-neutral).
- [ ] **E12.2** **Language-pack** plugin kind translating the **Desk** — a single **`.json`**
      (manifest + key→string map, no code/assets, like adapters; distributed into
      `languages/`). Apps bundle their own locales (manifest `i18n{default,locales}`).
- [ ] **E12.3** Selector **forces** a locale; app-missing-locale → app default; Desk-missing →
      built-in default.
- [ ] **E12.4 — Committed first-party packs (FR-261).** Ship + maintain packs for `en-US`,
      `es-MX`, `pt-BR`, `zh-Hans`, `hi`, `ar`, `yua`, `nhn`, each with a per-language status.
      Indigenous locales authored with native speakers (confirm exact Maya/Nahuatl variety).
- [ ] **E12.5 — RTL/bidi support (for `ar`).** Direction switching, logical CSS properties,
      UI mirroring. A milestone of its own, independent of the Arabic strings.

## Next / future (FR-240)

Runtime permission enforcement, sandboxing of third-party app JS, a hosted catalog with
download/auto-update, and signature-based curation are tracked for a later phase.
