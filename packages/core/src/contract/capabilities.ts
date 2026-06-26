// The capability contract: the uniform interface every OS adapter implements.
// Apps call these without knowing the host OS. v1 needs listDir / stat / readFile
// / writeFile / systemMetrics; the rest are declared for the post-v1 admin apps so
// the type is stable. Each returns a CapabilityResult so callers handle
// degraded/unsupported uniformly (Art. 6/7).

import type { CapabilityResult } from './result.js';
import type { FileEntry, Process, ServiceState, SystemMetrics } from './types.js';

export interface Capabilities {
  /** List a directory's entries. */
  listDir(path: string): Promise<CapabilityResult<readonly FileEntry[]>>;

  /** Stat a single path. */
  stat(path: string): Promise<CapabilityResult<FileEntry>>;

  /** Read a file's bytes. */
  readFile(path: string): Promise<CapabilityResult<Uint8Array>>;

  /** Write bytes to a file (overwrites). */
  writeFile(path: string, contents: Uint8Array): Promise<CapabilityResult<void>>;

  /** Snapshot CPU/memory/uptime. */
  systemMetrics(): Promise<CapabilityResult<SystemMetrics>>;

  /** List processes (post-v1). */
  listProcesses(): Promise<CapabilityResult<readonly Process[]>>;

  /** List services (post-v1). */
  listServices(): Promise<CapabilityResult<readonly ServiceState[]>>;
}
