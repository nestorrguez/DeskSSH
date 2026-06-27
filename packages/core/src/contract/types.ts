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

/** A running process (System monitor, FR-051). */
export interface Process {
  readonly pid: number;
  readonly user: string;
  /** CPU usage percentage (0–100+, may exceed 100 on multicore). */
  readonly cpu: number;
  /** Resident memory usage percentage. */
  readonly mem: number;
  readonly command: string;
}

/** Signals DeskSSH can send to a process (FR-052): stop (TERM/KILL), reload (HUP). */
export type ProcessSignal = 'TERM' | 'KILL' | 'HUP';

/** Service lifecycle actions DeskSSH can request (FR-053). */
export type ServiceAction = 'start' | 'stop' | 'restart';

/** A managed service and its state (FR-053). */
export interface ServiceState {
  readonly name: string;
  readonly active: boolean;
  readonly enabled: boolean;
  /** Raw status word from the init system, e.g. "running", "exited". */
  readonly status: string;
}

/** A fastfetch-style snapshot of host facts (System info, FR-016). */
export interface SystemInfo {
  readonly hostname: string;
  /** Distro pretty name, e.g. "Debian GNU/Linux 13 (trixie)". */
  readonly prettyName: string;
  /** Kernel release (`uname -r`). */
  readonly kernel: string;
  readonly uptimeSeconds: number;
  /** Count of installed packages, or 0 if unknown. */
  readonly packages: number;
  /** Login shell name, e.g. "bash". */
  readonly shell: string;
  readonly cpuModel: string;
  readonly cpuCount: number;
  readonly memTotalBytes: number;
  readonly memUsedBytes: number;
  readonly diskTotalBytes: number;
  readonly diskUsedBytes: number;
  /** First non-loopback IPv4, or "" if unknown. */
  readonly localIp: string;
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
