// Capability contract — normalized, typed outputs (plan §4). Apps consume these
// types and never parse raw command output; the adapter does the parsing. The
// value is precisely in the type: an app that gets a FileEntry[] doesn't care how
// it was obtained nor on which OS.

/** Kind of filesystem entry. "other" covers sockets, devices, fifos, etc. */
export type FileType = 'file' | 'directory' | 'symlink' | 'other';

/** A single entry in a directory listing. */
export interface FileEntry {
  /** Entry name (no path), e.g. "report.txt". */
  readonly name: string;
  readonly type: FileType;
  /** Size in bytes. */
  readonly size: number;
  /** POSIX permission bits as an octal number, e.g. 0o644 → 420. */
  readonly mode: number;
  /** Owner user name, or numeric uid as string if unresolved. */
  readonly owner: string;
  /** Owner group name, or numeric gid as string if unresolved. */
  readonly group: string;
  /** Last modification time (epoch milliseconds). */
  readonly mtime: number;
}

/** A running process (post-v1 capability; typed here for completeness). */
export interface Process {
  readonly pid: number;
  readonly user: string;
  /** CPU usage percentage (0–100+, may exceed 100 on multicore). */
  readonly cpu: number;
  /** Resident memory usage percentage. */
  readonly mem: number;
  readonly command: string;
}

/** A managed service and its state (post-v1 capability). */
export interface ServiceState {
  readonly name: string;
  readonly active: boolean;
  readonly enabled: boolean;
  /** Raw status word from the init system, e.g. "running", "exited". */
  readonly status: string;
}

/** A point-in-time snapshot of system resource usage. */
export interface SystemMetrics {
  /** System uptime in seconds. */
  readonly uptimeSeconds: number;
  /** Load averages over 1, 5 and 15 minutes. */
  readonly loadAverage: readonly [number, number, number];
  readonly memory: {
    readonly totalBytes: number;
    readonly usedBytes: number;
    readonly availableBytes: number;
  };
}
