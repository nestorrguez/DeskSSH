#!/usr/bin/env node
// DeskSSH launcher. Starts the gateway (which also serves the web UI) on
// 127.0.0.1 and opens the browser. DeskSSH runs on *your* machine and connects to
// *your* servers; it binds to localhost so it is never exposed by accident.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { startGateway } from '../dist/server.js';

const here = dirname(fileURLToPath(import.meta.url));
const staticDir = join(here, '..', 'dist', 'web');

const port = Number(process.env.PORT ?? 8717);
const host = process.env.HOST ?? '127.0.0.1';
const url = `http://${host}:${port}`;

startGateway({ port, host, staticDir });

console.log(`\n  DeskSSH is running at ${url}\n  Press Ctrl+C to stop.\n`);

if (process.env.DESKSSH_NO_OPEN !== '1') openBrowser(url);

function openBrowser(target) {
  const cmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try {
    spawn(cmd, [target], {
      stdio: 'ignore',
      detached: true,
      shell: process.platform === 'win32',
    }).unref();
  } catch {
    // Opening the browser is best-effort; the URL is printed above.
  }
}
