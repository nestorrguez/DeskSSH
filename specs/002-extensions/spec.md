# Functional specification — 002 Extensions (adapters, apps, languages & the Settings panel)

Defines **what** DeskSSH's extension system does and **why**, without the
implementation (that's in [`plan.md`](./plan.md)). Open decisions are marked
`[NEEDS DECISION]` and listed at the end.

Related: [`../constitution.md`](../constitution.md) ·
[`../001-core/spec.md`](../001-core/spec.md) · [`../glossary.md`](../glossary.md)

---

## 1. Problem / need

The 0.1.9 MVP ships with two **hardcoded** extension points: OS support is a switch
(`selectAdapter`, only Debian wired) and apps are a fixed array (`getApps`). To grow
host coverage and the app set **without editing the core each time**, both must become
real **plugin seams**.

This turns DeskSSH from a monolithic program into an **orchestrator**: a thin Desk
(login + graphical environment) that loads and coordinates independently-versioned
**adapters** (how to talk to a host OS), **apps** (what you do on the desktop) and
**language packs** (how the Desk speaks). Users manage all of it from a **control
panel** before connecting, and can add more by **importing plugins**.

## 2. Goals

- Make **adapters**, **apps** and **Desk languages** pluggable through registries +
  manifests, installable as official or third-party packages.
- A **Settings panel** on the connection screen to choose **appearance**, manage
  **adapters** and **apps**, and pick **defaults** when several apps handle the same
  target.
- A clear **independent-versioning + backward-compatibility** model across the four
  moving parts (Desk, Contract, each App, each Adapter).
- A **plugin import** flow (manual placement or a wizard) using a **universal `.zip`**,
  with a **restart-to-load** notice and graceful failure isolation.
- A **trust model**: declarative-only third-party adapters, an **author** field, a
  third-party **risk warning**, and an **official signature** for first-party
  (`nestorrguez`) extensions.
- A **file-handler registry** so any app registers "Open / Open with" (realizes FR-025;
  closes backlog B.1).

## 3. Non-goals (now)

- **Sandboxing** third-party app JS and **enforced** per-capability permission checks at
  runtime (kept as a future hardening, FR-240). Mitigated for adapters by allowing
  **declarative manifests only** (no third-party code on the host path).
- A **hosted market / auto-update**: discovery, download and updates are **manual** for
  now (FR-240).
- A generic "run an arbitrary declared command" capability for apps; the contract stays
  closed and core-owned (FR-213).
- Non-POSIX families (Windows/PowerShell); the architecture must not preclude them.

## 4. Functional requirements

### OS-adapter extensibility

- **FR-200** **Adapter registry.** Adapter selection is driven by a registry of providers
  that declare how they **match** a detected host and **create** a capability adapter;
  the best match wins, else the host degrades to the "unsupported" adapter with a clear
  reason (Art. 6/7). The built-in Debian provider is registered by default.
- **FR-201** **Declarative adapter manifest.** A family may be described by a manifest:
  per-capability **command templates** (safe interpolation) + an **output-normalization
  spec** mapping machine-readable output to contract types. A normalization failure
  yields a **degraded** result with raw output, never a crash (Art. 7).
- **FR-202** **Code-hook escape — first-party only.** A capability that resists
  declarative expression may be implemented in code, **but only in official/curated
  adapters**. **Third-party adapters are declarative-manifest-only** (no host-side code),
  which is the core of the adapter trust model (see FR-242).
- **FR-203** **Universal contract; gaps mean restructure, not holes.** The **Contract is
  the single universal abstraction** DeskSSH speaks — it is designed at a level every
  supported OS can fulfill, and adapters only _translate_ it to per-OS commands. So a
  capability an OS **genuinely cannot express is a design smell**: the fix is to
  **restructure / re-abstract the Contract** (a Contract **version bump**, FR-241), not to
  leave a permanent per-OS hole. Consequently **`unsupported` is reserved for version
  skew** — an adapter older than a newly-added Contract capability — which the UI degrades
  gracefully (offers less, never guesses; the backward-compat layer, E9.3). It is **not**
  the way to model "this OS can't".
  - **Universality debt (to restructure as non-systemd / non-POSIX families arrive):**
    `serviceAction` assumes **systemd**; file `mode` assumes **POSIX octal**;
    `listServices` is a post-v1 stub. Each must be re-abstracted (or version-bumped) before
    a family that breaks the assumption is added.

### App extensibility

- **FR-210** **App registry.** Available apps come from a registry that built-in and
  plugin apps register into; the launcher and window manager consume it.
- **FR-211** **App metadata.** Each app declares: **category**, the **capabilities** it
  uses (drives graceful-degrade + permission display), the **file types it handles**, its
  **bundled languages + default** (FR-260), and its **version + required Contract range**
  (FR-241).
- **FR-212** **File-handler registry.** Opening a file resolves through a single
  `openFile(path)` that dispatches by file type to the registered handler ("Open" =
  default, "Open with" = choose). The **default** among apps sharing a target is set in
  the Settings panel (FR-250). Realizes FR-025; a type with no handler offers client
  download (spec §9.8).
- **FR-213** **Closed, universal capability contract.** New capabilities an app needs are
  added to the **core-owned, universal** contract (FR-203) and every current adapter is
  expected to implement them; only an out-of-date adapter returns `unsupported`. Apps never
  invent ad-hoc host commands.

### Versioning & compatibility

- **FR-241** **Independent versions + backward-compatibility layers.** Four parts are
  versioned **separately** with semver: the **Desk** (login + graphical environment incl.
  its app-runtime API), the **Contract** (the capability catalog), **each App** and
  **each Adapter**.
  - An **App** declares its required **Contract** range and **Desk** range; some apps may
    require a newer Contract.
  - An **Adapter** declares which **Contract** version it implements and which capabilities
    it provides.
  - The host resolves compatibility at three joints — Desk↔App (app-runtime API),
    Contract↔App (version + capabilities), Adapter↔Contract (implemented functions) — and
    **gates execution** accordingly: an app only exposes the actions whose capabilities the
    connected host's adapter actually implements ("backward-compatibility layer"). On a
    version mismatch the plugin is **refused or flagged** in the Settings panel, never run
    blindly.
  - **First-party apps ship as part of the Desk** (see the monolith decision under §7):
    they share the Desk's release version and are **not** individually versioned. Independent
    App semver applies only to **out-of-tree plugins** (third-party, and any first-party app
    distributed via the plugin path). The **Desk** version is the product release version
    (`packages/web` `APP_VERSION`); the compat-relevant surface an app declares its `desk`
    range against is the **app-runtime API** version (`APP_RUNTIME_VERSION`), which the Desk
    surfaces — with the Contract version — in the Settings **About** section.

### Trust, permissions & transparency

- **FR-220** **Declared permissions.** Every app/adapter declares the capabilities it
  uses; shown to the user and used for graceful-degrade. (Runtime enforcement = FR-240.)
- **FR-221** **Plugins inherit transparency & confirmation.** Every command a plugin runs
  flows through the transparency log (Art. 3); every destructive action confirms
  (FR-090) — by construction.
- **FR-242** **Provenance & signature.** Each plugin manifest carries an **author**.
  First-party extensions (`nestorrguez`) carry an **official signature** the Desk verifies
  and badges as **verified**. Unsigned/third-party plugins install only after a **risk
  warning** ("third-party code can run commands on your servers; install only if you trust
  the provider"). Combined with FR-202 (third-party adapters are declarative-only), this
  bounds what unverified code can do.

### Settings & lifecycle

- **FR-250** **Settings (pre-login).** A Settings panel on the connection screen,
  before entering SSH, lets the user: choose the **appearance** (themes); view and
  **enable/disable** installed **adapters** and **apps**; set the **default** app when
  several handle the same target (FR-212); and see each item's author/version/verified
  status. Replaces the read-only Extensions view (FR-230) with a manageable one.
  Named **Settings** (ES: **Configuración**) — deliberately _not_ "control panel", to
  avoid confusion with the remote OS's own administration.
- **FR-251** **Plugin import & lifecycle.** Plugins are added by placing a package in the
  plugins folder **manually**, or via an **import wizard** that takes a **`.zip`** and the
  Desk's gateway extracts it into the right subfolder. Distribution is `.zip` (universal,
  Windows + Linux). After import the user sees a **"restart the service to load"** notice
  (plugins are picked up on (re)start, not hot-swapped). A broken plugin (bad manifest,
  load error) is **skipped and reported** in the Settings panel, never crashing the Desk
  (Art. 7). Plugins can be **enabled/disabled** and **uninstalled**.

### Desk languages (i18n)

- **FR-260** **Desk language packs + app-local i18n.** The **Desk** environment is
  translated via installable **language packs** (a plugin kind, distributed as a single
  `.json`). **Apps carry their own translations** (declared in their manifest: locales +
  default, FR-211). The global language selector **forces** a locale onto everything; if an
  app lacks that locale it uses **its own default**, and the Desk uses the matching language
  pack or the built-in default. Locale identifiers follow **BCP 47** (e.g. `en-US`, `es-MX`,
  `pt-BR`, `zh-Hans`, `hi`, `ar`, `yua`, `nhn`) — widened from the earlier
  "two-letter language-country" rule so the committed set below can include ISO 639-3
  languages (Maya, Nahuatl), a script subtag (Mandarin) and a region-neutral one (Arabic).
- **FR-261** **First-party language commitment.** The **north-star target** is first-party
  **Desk** language packs for eight languages: English — United States (`en-US`), Spanish —
  Mexico (`es-MX`), Portuguese — Brazil (`pt-BR`), Mandarin Chinese — Simplified
  (`zh-Hans`), Hindi (`hi`), Modern Standard Arabic (`ar`), Yucatec Maya (`yua`) and
  Central Nahuatl — Mexico City (`nhn`) — accessibility & inclusion as a goal. **Real
  support for now is limited to `en-US`, `es-MX` and `pt-BR`**; the other five are the
  aspirational target, added incrementally with a per-language status. Constraints the full
  set implies:
  - **Arabic requires RTL/bidi** layout support (direction, logical CSS, mirroring) — a
    separate milestone, not just translated strings.
  - **CJK / Arabic / Devanagari** need glyph coverage (system fonts may not suffice →
    possibly bundled webfonts, weighed against the offline/bundle-size lean).
  - **Indigenous locales are authored with native speakers** to be genuine, not tokenistic;
    the exact ISO 639-3 variety for Maya/Nahuatl is confirmed with a speaker/linguist.

### Future (designed-for, not built now)

- **FR-240** **Hardened / hosted market.** Runtime per-capability **permission
  enforcement** and **sandboxing** of third-party app JS, a **hosted catalog** with
  **download + auto-update**, and signature-based curation. The manifests, versioning and
  registries above are shaped so this is additive.

## 5. Non-functional / constitution alignment

- **Orchestrator, still agentless (Art. 2):** adapters use only standard host utilities;
  no plugin may install anything on the remote.
- **Agnostic core (Art. 5):** adapter logic lives in `core`; apps are UI + declared
  capabilities; the Desk only orchestrates.
- **AGPL & contributor-friendly (Art. 9):** every extension declares a **license** and
  must be AGPL-compatible; the manifest keeps the barrier to authoring low.
- **Backward compatible:** introducing registries/panel must not change the existing
  Debian flow or the built-in apps.

## 6. Acceptance criteria (high level)

- The Debian flow works unchanged, resolved **through** the adapter registry.
- A **second OS family**, shipped as a declarative-manifest adapter, lists a directory and
  reads metrics with typed results against a real host of that family.
- A file opens via the **handler registry**; the **default handler** for a shared target is
  configurable in the Settings panel.
- An **app shipped as a separate plugin** appears in the launcher and runs, with its
  capabilities, version/Contract range and author/verified status shown.
- Importing a **`.zip`** places a plugin correctly and shows the **restart** notice; a
  broken plugin is reported, not fatal.
- Changing the language **forces** apps and the Desk; a missing app locale falls back to
  the app default; identifiers are `xx-yy`.

## 7. Open decisions `[NEEDS DECISION]`

- **Manifest schema form** (TS object vs JSON) and whether `DebianAdapter` is migrated to
  a manifest or kept as the code reference. — _E2._
- **First new family:** RHEL/Fedora (recommended) vs Arch; needs a test VM. — _E3._
- **Signature mechanism** for first-party verification (key/checksum scheme). — _E11._
- **Theme system** scope for "appearance" (token sets? full CSS?). — _E8._

**Decided (2026-06-30, E10.4):** the **shared-singleton strategy** is an **import map +
module externals**. The Desk publishes its `react`, `react-dom`, `react/jsx-runtime` and a
`@deskssh/app-runtime` SDK as standalone ESM at stable `/runtime/*` URLs; both the Desk's own
build **and** app plugins externalize those specifiers and resolve them through one import map
— a single React/UI/icon instance shared across host and plugins. App plugins compile against
the versioned **`@deskssh/app-runtime`** surface (`registerApp`, UI primitives, icons, the
`Translator` type, capability names); its semver is the **Desk app-runtime API** range a
plugin manifest declares in `desk`. **Note (2026-07-02, E10.4f):** the `/runtime/*` bundles
must use **explicit named re-exports** — `export * from 'react'` yields no named bindings from
React's CommonJS build, so the browser can't import `jsx`/hooks and the Desk never mounts. This
is only caught by loading the page in a real browser, not by unit tests or the HTTP smoke test.

**Decided (2026-07-01, E9.2 — monolith):** DeskSSH's **own apps stay a monolith with the
Desk** — one codebase, one version. The independent-versioning model (FR-241) is the seam
for **out-of-tree** extensions (third-party via the import wizard, and any first-party app
deliberately shipped through the plugin path to dogfood `@deskssh/app-runtime`), **not** a
mandate to split every built-in into its own package. Rationale: independent versions only
earn their overhead when release cadences decouple; built-ins are built, tested and released
together, so the Desk version already denotes "the official bundle, apps included". The
decision is reversible — a built-in can be extracted to a package later if it ever needs to
ship on its own cadence. The Desk exposes its **Contract** + **app-runtime API** versions in
the Settings **About** section so plugin authors can see the ranges to target.
