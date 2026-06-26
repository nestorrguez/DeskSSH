// SSH session configuration and state. The session is the only place that talks to
// ssh2; everything else depends on CommandExecutor. Secrets here live only in
// memory for the lifetime of the connection and are never logged (Art. 4).

/** Authentication material. A private key may carry an optional passphrase. */
export type SshAuth =
  | { readonly kind: 'password'; readonly password: string }
  | {
      readonly kind: 'privateKey';
      readonly privateKey: string | Buffer;
      readonly passphrase?: string;
    };

/** Info passed to the host-key verifier for a TOFU / known-hosts decision. */
export interface HostKeyInfo {
  /** Key algorithm, e.g. "ssh-ed25519". */
  readonly algorithm: string;
  /** "SHA256:..." fingerprint of the presented host key. */
  readonly fingerprint: string;
}

export interface ConnectOptions {
  readonly host: string;
  readonly port?: number;
  readonly username: string;
  readonly auth: SshAuth;
  /**
   * Decide whether to trust the host's key (anti-MITM, Art. 4). Called before the
   * connection completes. If omitted, the host key is **rejected** — callers must
   * opt into trust explicitly (no silent accept-all).
   */
  readonly verifyHostKey?: (info: HostKeyInfo) => boolean | Promise<boolean>;
  /** Connection timeout in milliseconds (default 20000). */
  readonly timeoutMs?: number;
}

/** Lifecycle of a session (FR-003). */
export type SessionState = 'idle' | 'connecting' | 'connected' | 'closed' | 'error';
