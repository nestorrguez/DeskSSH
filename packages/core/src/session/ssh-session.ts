// SshSession — the transport. Wraps an ssh2 Client and exposes a CommandExecutor
// (exec), an interactive PTY (shell) and SFTP. This is the only module aware of
// ssh2; the rest of the core stays transport-agnostic (Art. 5).

import { createHash } from 'node:crypto';
import { Client } from 'ssh2';
import type { ClientChannel, ConnectConfig, PseudoTtyOptions, SFTPWrapper } from 'ssh2';
import type { CommandExecutor, ExecResult } from '../exec/types.js';
import type { ConnectOptions, SessionState } from './types.js';

function fingerprint(key: Buffer): string {
  return `SHA256:${createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`;
}

/**
 * Read the algorithm name from an SSH host key blob. The blob starts with an
 * SSH "string": a uint32 big-endian length followed by the ASCII name (e.g.
 * "ssh-ed25519", "ecdsa-sha2-nistp256"). Returns '' if the buffer is malformed.
 */
export function keyAlgorithm(key: Buffer): string {
  if (key.length < 4) return '';
  const len = key.readUInt32BE(0);
  if (len <= 0 || key.length < 4 + len) return '';
  return key.subarray(4, 4 + len).toString('ascii');
}

export class SshSession implements CommandExecutor {
  private readonly client = new Client();
  private currentState: SessionState = 'idle';
  private readonly label: string;

  private constructor(private readonly options: ConnectOptions) {
    this.label = `${options.username}@${options.host}`;
  }

  /** Human-readable host label, e.g. "user@host", for the transparency log. */
  get host(): string {
    return this.label;
  }

  get state(): SessionState {
    return this.currentState;
  }

  /** Open and authenticate a session. Rejects on auth, host-key or network error. */
  static connect(options: ConnectOptions): Promise<SshSession> {
    const session = new SshSession(options);
    return session.open().then(() => session);
  }

  private open(): Promise<void> {
    this.currentState = 'connecting';
    const { host, port = 22, username, auth, verifyHostKey, timeoutMs = 20000 } = this.options;

    const config: ConnectConfig = {
      host,
      port,
      username,
      readyTimeout: timeoutMs,
      hostVerifier: (key: Buffer, verify: (ok: boolean) => void) => {
        const decide = verifyHostKey
          ? verifyHostKey({ algorithm: keyAlgorithm(key), fingerprint: fingerprint(key) })
          : false;
        Promise.resolve(decide)
          .then(verify)
          .catch(() => verify(false));
      },
    };
    if (auth.kind === 'password') {
      config.password = auth.password;
    } else {
      config.privateKey = auth.privateKey;
      if (auth.passphrase !== undefined) config.passphrase = auth.passphrase;
    }

    return new Promise<void>((resolve, reject) => {
      this.client
        .on('ready', () => {
          this.currentState = 'connected';
          resolve();
        })
        .on('error', (err) => {
          this.currentState = 'error';
          reject(err);
        })
        .on('close', () => {
          if (this.currentState !== 'error') this.currentState = 'closed';
        })
        .connect(config);
    });
  }

  /** Run a command, capturing stdout/stderr and the exit code (FR-030 building block). */
  exec(command: string): Promise<ExecResult> {
    return new Promise<ExecResult>((resolve, reject) => {
      this.client.exec(command, (err, stream: ClientChannel) => {
        if (err) return reject(err);
        let stdout = '';
        let stderr = '';
        let exitCode: number | null = null;
        stream
          .on('data', (chunk: Buffer) => {
            stdout += chunk.toString('utf8');
          })
          .on('close', (code: number | null) => {
            exitCode = typeof code === 'number' ? code : null;
            resolve({ stdout, stderr, exitCode });
          });
        stream.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString('utf8');
        });
      });
    });
  }

  /** Open an interactive PTY/shell channel (Terminal app, FR-030/031). */
  shell(window?: PseudoTtyOptions): Promise<ClientChannel> {
    return new Promise<ClientChannel>((resolve, reject) => {
      this.client.shell(window ?? {}, (err, stream) => {
        if (err) return reject(err);
        resolve(stream);
      });
    });
  }

  /** Open an SFTP channel (file manager / read-write capabilities). */
  sftp(): Promise<SFTPWrapper> {
    return new Promise<SFTPWrapper>((resolve, reject) => {
      this.client.sftp((err, sftp) => {
        if (err) return reject(err);
        resolve(sftp);
      });
    });
  }

  /** Close the session and release the connection. */
  close(): void {
    this.client.end();
    this.currentState = 'closed';
  }
}
