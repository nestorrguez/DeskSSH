// @deskssh/core — frontend-agnostic core: SSH sessions, the capability contract,
// OS adapters and command transparency. This is the package's public surface.

export const CORE_PACKAGE = '@deskssh/core';

// Execution boundary
export type { CommandExecutor, ExecResult } from './exec/types.js';

// Transparency (Art. 3)
export {
  TransparencyLog,
  withTransparency,
  type CommandRecord,
  type TransparencyListener,
} from './transparency/log.js';

// Capability contract (plan §4)
export type { Capabilities } from './contract/capabilities.js';
export type {
  FileEntry,
  FileType,
  Process,
  ProcessSignal,
  ServiceAction,
  ServiceState,
  SystemInfo,
  SystemMetrics,
} from './contract/types.js';
export { ok, degraded, unsupported, runParsed, type CapabilityResult } from './contract/result.js';
export {
  CONTRACT_VERSION,
  CONTRACT_CAPABILITIES,
  APP_RUNTIME_VERSION,
  type CapabilityName,
} from './contract/version.js';
export { FIRST_PARTY_AUTHOR, type Author } from './contract/author.js';

// Privilege elevation (Art. 4, FR-093..095)
export {
  withElevation,
  detectPrivilege,
  isPermissionDenied,
  type PrivilegeInfo,
} from './privilege/elevation.js';

// Adapters (Art. 6)
export { detectOs, parseOsRelease, familyFor, type OsFamily, type OsInfo } from './adapters/os.js';
export {
  selectAdapter,
  selectProvider,
  createUnsupportedAdapter,
  registerAdapter,
  listAdapters,
  adapterCatalog,
  checkAdapterCompat,
  debianProvider,
  type AdapterProvider,
  type AdapterInfo,
  type CompatResult,
} from './adapters/registry.js';
export { parseSemVer, compareSemVer, satisfies, type SemVer } from './adapters/semver.js';
export {
  validateAdapterPluginManifest,
  manifestToProvider,
  type AdapterPluginManifest,
  type ManifestValidation,
} from './adapters/plugin.js';
export {
  validateAppPluginManifest,
  checkAppCompat,
  type AppPluginManifest,
  type AppManifestValidation,
} from './adapters/app-plugin.js';
export { DebianAdapter } from './adapters/debian.js';
export {
  ManifestAdapter,
  normalizeRecords,
  type AdapterManifest,
  type CapabilitySpec,
  type NormalizeSpec,
  type RecordsNormalizeSpec,
  type ColumnSpec,
  type FieldType,
  type CodeHook,
} from './adapters/manifest.js';
export { quote } from './adapters/shell.js';

// Session (transport)
export { SshSession } from './session/ssh-session.js';
export type {
  ConnectOptions,
  SshAuth,
  HostKeyInfo,
  SessionState,
  PtySession,
} from './session/types.js';
