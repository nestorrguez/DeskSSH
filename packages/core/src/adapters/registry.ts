// Adapter selection (Art. 6) via a small registry (spec 002, FR-200). Providers
// declare how they match a detected host and how they build a capability adapter;
// selection picks the best match. Built-ins (Debian) are registered by default;
// curated adapter packages register more families. An unmatched host degrades to an
// `unsupported` adapter with a clear reason (Art. 7) rather than guessing wrong
// commands.

import type { CommandExecutor } from '../exec/types.js';
import type { Capabilities } from '../contract/capabilities.js';
import type { CapabilityName } from '../contract/version.js';
import { CONTRACT_VERSION } from '../contract/version.js';
import type { Author } from '../contract/author.js';
import { FIRST_PARTY_AUTHOR } from '../contract/author.js';
import { unsupported } from '../contract/result.js';
import { satisfies } from './semver.js';
import type { OsInfo } from './os.js';
import { DebianAdapter } from './debian.js';

/** A pluggable OS-family adapter (FR-200). */
export interface AdapterProvider {
  /** Stable id, e.g. "debian", "rhel". Used to de-duplicate registration. */
  readonly id: string;
  /** Human label for the catalog / Extensions view (FR-230). */
  readonly label?: string;
  /** os-release IDs this family covers, for display (FR-230). */
  readonly osSupport?: readonly string[];
  /** The adapter's own semver, versioned independently of the Desk (FR-241). */
  readonly version: string;
  /** The Contract range this adapter implements, e.g. `^0.1.0` (FR-241). */
  readonly contract: string;
  /** Who authored the adapter, for the Settings panel (FR-242). */
  readonly author: Author;
  /** Which contract capabilities this adapter actually provides (FR-203/241). */
  readonly capabilities: readonly CapabilityName[];
  /** Match score for a detected host: 0 = no match, higher = more specific. */
  matches(os: OsInfo): number;
  /** Build the capability adapter for this family over the given executor. */
  create(executor: CommandExecutor): Capabilities;
}

/** A serializable, display-only view of a registered adapter (FR-230/241/242). */
export interface AdapterInfo {
  readonly id: string;
  readonly label: string;
  readonly osSupport: readonly string[];
  readonly version: string;
  readonly contract: string;
  readonly author: Author;
  readonly capabilities: readonly CapabilityName[];
}

/** Built-in Debian-family provider (Tier 1). */
export const debianProvider: AdapterProvider = {
  id: 'debian',
  label: 'Debian base',
  osSupport: ['debian', 'ubuntu', 'linuxmint', 'mint', 'raspbian', 'pop'],
  version: '0.1.0',
  contract: '^0.1.0',
  author: FIRST_PARTY_AUTHOR,
  // Everything in the contract except listServices (a post-v1 capability).
  capabilities: [
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
  ],
  matches: (os) => (os.family === 'debian' ? 1 : 0),
  create: (executor) => new DebianAdapter(executor),
};

// The live registry. Built-ins are present from the start; curated packages append
// via registerAdapter(). ESM modules are singletons, so this is process-wide.
const providers: AdapterProvider[] = [debianProvider];

/** Register (or replace, by id) an adapter provider. Idempotent per id. */
export function registerAdapter(provider: AdapterProvider): void {
  const i = providers.findIndex((p) => p.id === provider.id);
  if (i >= 0) providers[i] = provider;
  else providers.push(provider);
}

/** The currently registered providers (read-only view; for the catalog/tests). */
export function listAdapters(): readonly AdapterProvider[] {
  return providers;
}

/** Serializable catalog of registered adapters for the Extensions view (FR-230/241). */
export function adapterCatalog(): AdapterInfo[] {
  return providers.map((p) => ({
    id: p.id,
    label: p.label ?? p.id,
    osSupport: p.osSupport ?? [],
    version: p.version,
    contract: p.contract,
    author: p.author,
    capabilities: p.capabilities,
  }));
}

/** The outcome of resolving an adapter against a Contract version (FR-241). */
export interface CompatResult {
  readonly compatible: boolean;
  /** Present when incompatible: why the adapter cannot serve this Contract. */
  readonly reason?: string;
}

/**
 * Resolve the Adapter↔Contract joint (FR-241): does the adapter's declared
 * Contract range admit the Desk's current Contract version? On a mismatch the
 * adapter is flagged (and, later, refused in the Settings panel) rather than run
 * against a Contract it never claimed to implement.
 */
export function checkAdapterCompat(
  provider: AdapterProvider,
  contractVersion: string = CONTRACT_VERSION,
): CompatResult {
  if (satisfies(contractVersion, provider.contract)) return { compatible: true };
  return {
    compatible: false,
    reason:
      `adapter "${provider.id}" implements Contract ${provider.contract}, ` +
      `which does not include the Desk's Contract ${contractVersion}`,
  };
}

/** A Capabilities implementation where every call is unsupported, for clarity. */
export function createUnsupportedAdapter(reason: string): Capabilities {
  const fail = () => Promise.resolve(unsupported<never>(reason));
  return {
    listDir: fail,
    stat: fail,
    readFile: fail,
    writeFile: fail,
    makeDir: fail,
    createFile: fail,
    move: fail,
    copy: fail,
    remove: fail,
    systemMetrics: fail,
    systemInfo: fail,
    listProcesses: fail,
    signalProcess: fail,
    serviceAction: fail,
    listServices: fail,
  };
}

/** The highest-scoring registered provider for a detected OS, or undefined. */
export function selectProvider(os: OsInfo): AdapterProvider | undefined {
  let best: AdapterProvider | undefined;
  let bestScore = 0;
  for (const provider of providers) {
    const score = provider.matches(os);
    if (score > bestScore) {
      bestScore = score;
      best = provider;
    }
  }
  return best;
}

/** Pick the capability adapter for a detected OS over the given executor: the
 *  highest-scoring registered provider, else a graceful `unsupported` adapter. */
export function selectAdapter(os: OsInfo, executor: CommandExecutor): Capabilities {
  const best = selectProvider(os);
  if (best) return best.create(executor);
  return createUnsupportedAdapter(
    `OS family "${os.family}" is not supported in v1 (Debian/Ubuntu/Mint only); ` +
      'see the host roadmap',
  );
}
