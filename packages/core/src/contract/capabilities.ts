// The capability contract: the uniform interface every OS adapter implements.
// Apps call these without knowing the host OS. v1 needs listDir / stat / readFile
// / writeFile / systemMetrics; the rest are declared for the post-v1 admin apps so
// the type is stable. Each returns a CapabilityResult so callers handle
// degraded/unsupported uniformly (Art. 6/7).

import type { CapabilityResult } from './result.js';
import type {
  FileEntry,
  Process,
  ProcessSignal,
  ServiceAction,
  ServiceState,
  SystemInfo,
  SystemMetrics,
} from './types.js';

export interface Capabilities {
  /** List a directory's entries. */
  listDir(path: string): Promise<CapabilityResult<readonly FileEntry[]>>;

  /** Stat a single path. */
  stat(path: string): Promise<CapabilityResult<FileEntry>>;

  /** Read a file's bytes. */
  readFile(path: string): Promise<CapabilityResult<Uint8Array>>;

  /** Write bytes to a file (overwrites). */
  writeFile(path: string, contents: Uint8Array): Promise<CapabilityResult<void>>;

  /** Create a directory, including any missing parents. */
  makeDir(path: string): Promise<CapabilityResult<void>>;

  /** Create an empty file if it does not exist (touch semantics). */
  createFile(path: string): Promise<CapabilityResult<void>>;

  /** Move or rename a path (refuses to overwrite an existing destination). */
  move(from: string, to: string): Promise<CapabilityResult<void>>;

  /** Copy a file or directory recursively (refuses to overwrite). */
  copy(from: string, to: string): Promise<CapabilityResult<void>>;

  /** Remove a file or directory recursively. */
  remove(path: string): Promise<CapabilityResult<void>>;

  /** Snapshot CPU/memory/uptime. */
  systemMetrics(): Promise<CapabilityResult<SystemMetrics>>;

  /** Fastfetch-style host facts for the System info app (FR-016). */
  systemInfo(): Promise<CapabilityResult<SystemInfo>>;

  /** List running processes (System monitor, FR-051). */
  listProcesses(): Promise<CapabilityResult<readonly Process[]>>;

  /** Send a signal to a process: stop (TERM/KILL) or reload (HUP) (FR-052). */
  signalProcess(pid: number, signal: ProcessSignal): Promise<CapabilityResult<void>>;

  /** Start, stop or restart a service; returns its resulting state (FR-053). */
  serviceAction(name: string, action: ServiceAction): Promise<CapabilityResult<ServiceState>>;

  /** List services (post-v1, full dedicated Services app). */
  listServices(): Promise<CapabilityResult<readonly ServiceState[]>>;
}
