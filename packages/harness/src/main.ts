#!/usr/bin/env node
// Dev harness (FR demonstrable, plan §6). Connects to a real SSH host using
// @deskssh/core, detects the OS, and exercises the FULL capability surface —
// listing, metrics, read/write round-trip, the filesystem mutations and an
// interactive PTY — reporting pass/fail and the transparency log. Configured via
// env vars so it stays non-interactive:
//
//   DESKSSH_HOST       host to connect to (required)
//   DESKSSH_PORT       port (default 22)
//   DESKSSH_USER       username (required)
//   DESKSSH_PASSWORD   password auth, OR
//   DESKSSH_KEY        path to a private key file
//   DESKSSH_PASSPHRASE optional passphrase for the key
//   DESKSSH_PATH       directory to list (default the login home, falls back to "/")
//
// Usage: DESKSSH_HOST=... DESKSSH_USER=... DESKSSH_PASSWORD=... \
//        pnpm --filter @deskssh/harness start

import { readFileSync } from 'node:fs';
import {
  SshSession,
  TransparencyLog,
  withTransparency,
  detectOs,
  selectAdapter,
  type Capabilities,
  type CapabilityResult,
  type ConnectOptions,
  type SshAuth,
} from '@deskssh/core';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

function resolveAuth(): SshAuth {
  const keyPath = process.env['DESKSSH_KEY'];
  if (keyPath) {
    const auth: SshAuth = { kind: 'privateKey', privateKey: readFileSync(keyPath) };
    const passphrase = process.env['DESKSSH_PASSPHRASE'];
    return passphrase ? { ...auth, passphrase } : auth;
  }
  const password = process.env['DESKSSH_PASSWORD'];
  if (password) return { kind: 'password', password };
  throw new Error('Provide DESKSSH_KEY or DESKSSH_PASSWORD');
}

// Tiny test recorder.
let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}
function isOk(r: CapabilityResult<unknown>): boolean {
  return r.kind === 'ok';
}
function why(r: CapabilityResult<unknown>): string {
  return r.kind === 'ok' ? 'ok' : `${r.kind}${'reason' in r ? `: ${r.reason}` : ''}`;
}

async function mutationSweep(adapter: Capabilities, home: string): Promise<void> {
  const dir = `${home.replace(/\/+$/, '')}/.deskssh-test-${Date.now()}`;
  const a = `${dir}/a.txt`;
  const b = `${dir}/b.txt`;
  const c = `${dir}/c.txt`;
  const payload = 'hello deskssh';

  console.log(`\nFilesystem mutation sweep in ${dir}`);
  try {
    check('makeDir', isOk(await adapter.makeDir(dir)));
    check('createFile', isOk(await adapter.createFile(a)));

    const wrote = await adapter.writeFile(a, new Uint8Array(Buffer.from(payload, 'utf8')));
    check('writeFile', isOk(wrote), why(wrote));

    const read = await adapter.readFile(a);
    const readText = read.kind === 'ok' ? Buffer.from(read.value).toString('utf8') : '';
    check('readFile round-trips bytes', read.kind === 'ok' && readText === payload, readText);

    const st = await adapter.stat(a);
    check(
      'stat reports a file of the right size',
      st.kind === 'ok' && st.value.type === 'file' && st.value.size === payload.length,
      st.kind === 'ok' ? `type=${st.value.type} size=${st.value.size}` : why(st),
    );

    check('copy', isOk(await adapter.copy(a, b)));
    check('move', isOk(await adapter.move(b, c)));

    const ls = await adapter.listDir(dir);
    const names = ls.kind === 'ok' ? ls.value.map((e) => e.name).sort() : [];
    check(
      'listDir shows a.txt + c.txt (b.txt was moved)',
      ls.kind === 'ok' &&
        names.includes('a.txt') &&
        names.includes('c.txt') &&
        !names.includes('b.txt'),
      names.join(', '),
    );

    check('remove (recursive)', isOk(await adapter.remove(dir)));

    const gone = await adapter.listDir(dir);
    check('listDir on a removed dir now fails (negative test)', gone.kind !== 'ok', why(gone));
  } catch (err) {
    check('mutation sweep completed without throwing', false, String(err));
    // Best-effort cleanup.
    await adapter.remove(dir).catch(() => undefined);
  }
}

async function ptySmoke(session: SshSession): Promise<void> {
  console.log('\nInteractive PTY (Terminal app path)');
  const marker = `DESKSSH_PTY_OK_${Date.now()}`;
  const ok = await new Promise<boolean>((resolve) => {
    let out = '';
    let done = false;
    const finish = (v: boolean) => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };
    void session
      .openPty(80, 24)
      .then((pty) => {
        pty.onData((chunk) => {
          out += chunk;
          // Match the echoed command output, not the typed command line itself.
          if (out.includes(`${marker}\r\n`) || out.includes(`${marker}\n`)) {
            pty.close();
            finish(true);
          }
        });
        pty.onClose(() => finish(out.includes(marker)));
        pty.write(`echo ${marker}\n`);
        setTimeout(() => {
          pty.close();
          finish(out.includes(marker));
        }, 8000);
      })
      .catch(() => finish(false));
  });
  check('PTY opens, runs a command and streams output back', ok);
}

async function main(): Promise<void> {
  const options: ConnectOptions = {
    host: required('DESKSSH_HOST'),
    port: process.env['DESKSSH_PORT'] ? Number(process.env['DESKSSH_PORT']) : 22,
    username: required('DESKSSH_USER'),
    auth: resolveAuth(),
    // Dev harness: trust on first use, printing the fingerprint for the operator.
    verifyHostKey: ({ fingerprint }) => {
      console.log(`Host key fingerprint: ${fingerprint} (trusted for this run)`);
      return true;
    },
  };

  console.log(`Connecting to ${options.username}@${options.host}:${options.port ?? 22}…`);
  const session = await SshSession.connect(options);
  const log = new TransparencyLog();
  const executor = withTransparency(session, log, session.host);

  try {
    const os = await detectOs(executor);
    console.log(`Detected OS: ${os.prettyName ?? os.family} (family: ${os.family})\n`);
    const adapter = selectAdapter(os, executor);

    const home = process.env['DESKSSH_PATH'] ?? (await executor.exec('echo "$HOME"')).stdout.trim();
    const base = home || '/';

    console.log('Read-only capabilities');
    const listing = await adapter.listDir(base);
    check(`listDir(${base})`, isOk(listing), why(listing));
    if (listing.kind === 'ok') {
      for (const entry of listing.value.slice(0, 8)) {
        console.log(`      ${entry.type.padEnd(9)} ${entry.name}`);
      }
    }
    const metrics = await adapter.systemMetrics();
    check('systemMetrics', isOk(metrics), why(metrics));
    if (metrics.kind === 'ok') {
      const m = metrics.value;
      const usedPct = m.memory.totalBytes
        ? Math.round((m.memory.usedBytes / m.memory.totalBytes) * 100)
        : 0;
      console.log(
        `      uptime ${m.uptimeSeconds}s · load ${m.loadAverage.join(' ')} · mem ${usedPct}% used`,
      );
    }

    await mutationSweep(adapter, base);
    await ptySmoke(session);
  } finally {
    session.close();
  }

  console.log(`\nTransparency log: ${log.list().length} commands run (every action is auditable).`);
  console.log(`\nRESULT: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(`Harness failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
