// The command-execution boundary. Everything in the core that needs to run a
// command on a host depends on this interface, never on ssh2 directly. That keeps
// adapters and parsers testable with a fake executor (no real SSH host required)
// and confines transport concerns to the SSH session implementation.

/** Result of running a single command on a host. */
export interface ExecResult {
  /** Standard output, decoded as UTF-8. */
  readonly stdout: string;
  /** Standard error, decoded as UTF-8. */
  readonly stderr: string;
  /** Process exit code, or null if the command was killed by a signal. */
  readonly exitCode: number | null;
}

/** Runs commands on a host. Implemented by {@link SshSession} over ssh2. */
export interface CommandExecutor {
  /**
   * Run a command and resolve with its captured output and exit code. When
   * `input` is given it is written to the command's stdin and then closed — used
   * to feed a password to `sudo -S` without ever putting it in the command line
   * (so it never reaches the transparency log). Implementations must not record
   * `input`.
   */
  exec(command: string, input?: string): Promise<ExecResult>;
}
