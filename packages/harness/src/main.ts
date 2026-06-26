#!/usr/bin/env node
// M1 dev harness (FR demonstrable, plan §6). Connects to a real SSH host using
// @deskssh/core, detects the OS, picks an adapter and exercises a few
// capabilities, then prints the transparency log. Configured via env vars so it
// stays non-interactive:
//
//   DESKSSH_HOST       host to connect to (required)
//   DESKSSH_PORT       port (default 22)
//   DESKSSH_USER       username (required)
//   DESKSSH_PASSWORD   password auth, OR
//   DESKSSH_KEY        path to a private key file
//   DESKSSH_PASSPHRASE optional passphrase for the key
//   DESKSSH_PATH       directory to list (default "/")
//
// Usage: DESKSSH_HOST=... DESKSSH_USER=... DESKSSH_KEY=~/.ssh/id_ed25519 \
//        pnpm --filter @deskssh/harness start

import { readFileSync } from 'node:fs';
import {
  SshSession,
  TransparencyLog,
  withTransparency,
  detectOs,
  selectAdapter,
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

function describe<T>(label: string, result: CapabilityResult<T>): void {
  if (result.kind === 'ok') {
    console.log(`✓ ${label}: ok`);
  } else {
    console.log(`• ${label}: ${result.kind}${'reason' in result ? ` — ${result.reason}` : ''}`);
  }
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

  const listPath = process.env['DESKSSH_PATH'] ?? '/';
  console.log(`Connecting to ${options.username}@${options.host}:${options.port ?? 22}…`);

  const session = await SshSession.connect(options);
  const log = new TransparencyLog();
  const executor = withTransparency(session, log, session.host);

  try {
    const os = await detectOs(executor);
    console.log(`Detected OS: ${os.prettyName ?? os.family} (family: ${os.family})`);

    const adapter = selectAdapter(os, executor);

    const listing = await adapter.listDir(listPath);
    describe(`listDir(${listPath})`, listing);
    if (listing.kind === 'ok') {
      for (const entry of listing.value.slice(0, 10)) {
        console.log(`    ${entry.type.padEnd(9)} ${entry.name}`);
      }
    }

    const metrics = await adapter.systemMetrics();
    describe('systemMetrics()', metrics);
    if (metrics.kind === 'ok') {
      const m = metrics.value;
      const usedPct = m.memory.totalBytes
        ? Math.round((m.memory.usedBytes / m.memory.totalBytes) * 100)
        : 0;
      console.log(
        `    uptime ${m.uptimeSeconds}s · load ${m.loadAverage.join(' ')} · mem ${usedPct}% used`,
      );
    }
  } finally {
    session.close();
  }

  console.log('\nTransparency log (every command DeskSSH ran):');
  for (const record of log.list()) {
    console.log(
      `  #${record.id} [${record.exitCode ?? 'ERR'}] ${record.durationMs}ms  ${record.command}`,
    );
  }
}

main().catch((err: unknown) => {
  console.error(`Harness failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
