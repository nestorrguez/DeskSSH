// WebSocket ⇄ PTY bridge for the Terminal app (FR-030/031). Attaches to the
// gateway's HTTP server and, per connection, opens an interactive shell on the
// session and pipes bytes both ways. Messages are JSON-framed so input and resize
// are unambiguous.

import type { Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { SessionManager } from './session-manager.js';

const TERMINAL_PATH = '/api/terminal';

type ClientMessage =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number };

/** Attach the terminal WebSocket endpoint to an existing HTTP server. */
export function attachTerminal(server: Server, manager: SessionManager): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== TERMINAL_PATH) return; // leave other upgrades alone
    const sessionId = url.searchParams.get('sessionId') ?? '';
    const cwd = url.searchParams.get('cwd') ?? undefined;
    const entry = manager.get(sessionId);
    if (!entry?.openPty) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => bridge(ws, entry.openPty!, cwd));
  });

  return wss;
}

function bridge(
  ws: WebSocket,
  openPty: (
    cols: number,
    rows: number,
    cwd?: string,
  ) => Promise<import('@deskssh/core').PtySession>,
  cwd?: string,
): void {
  void openPty(80, 24, cwd)
    .then((pty) => {
      pty.onData((chunk) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'output', data: chunk }));
      });
      pty.onClose(() => ws.close());

      ws.on('message', (raw: Buffer) => {
        let msg: ClientMessage;
        try {
          msg = JSON.parse(raw.toString('utf8')) as ClientMessage;
        } catch {
          return;
        }
        if (msg.type === 'input') pty.write(msg.data);
        else if (msg.type === 'resize') pty.resize(msg.cols, msg.rows);
      });

      ws.on('close', () => pty.close());
    })
    .catch(() => ws.close());
}
