// The Contract's identity for the independent-versioning model (spec 002, FR-241).
// The "Contract" is the capability catalog every adapter implements and every app
// calls. It carries its **own** semver, bumped only when a capability is
// added/changed/removed — independently of the Desk, apps and adapters. Adapters
// declare the Contract range they implement; apps declare the range they require.

import type { Capabilities } from './capabilities.js';

/** A capability name in the closed contract. */
export type CapabilityName = keyof Capabilities;

/**
 * The current Contract version. Bump on any change to {@link Capabilities}:
 * - patch: clarifications, no signature change;
 * - minor: a capability added (older adapters/apps stay compatible);
 * - major: a capability removed or its signature changed (breaking).
 */
export const CONTRACT_VERSION = '0.1.0';

/**
 * The Desk **app-runtime API** version (spec 002, FR-241 / E10.4) — the semver of the
 * `@deskssh/app-runtime` SDK surface (registerApp, UI primitives, icons, Translator)
 * that app plugins compile against. An app manifest declares the range it needs in its
 * `desk` field; the gateway/web gate loading against this. Bump on any change to that
 * surface — independently of the Contract, the Desk binary and individual plugins.
 */
export const APP_RUNTIME_VERSION = '0.2.0';

/**
 * The canonical set of capability names in the current Contract. Adapters declare
 * which of these they provide; the Settings panel and the backward-compat layer
 * (FR-241/FR-203) compare against this. Kept in lockstep with {@link Capabilities}
 * via the `satisfies` check below.
 */
export const CONTRACT_CAPABILITIES = [
  'listDir',
  'stat',
  'readFile',
  'writeFile',
  'makeDir',
  'createFile',
  'move',
  'copy',
  'remove',
  'systemMetrics',
  'systemInfo',
  'listProcesses',
  'signalProcess',
  'serviceAction',
  'listServices',
] as const satisfies readonly CapabilityName[];
