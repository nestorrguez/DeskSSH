import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { AppContext } from '../types';

// Terminal app: a real interactive shell (PTY) bridged over a WebSocket to the
// gateway. The only app that exposes the raw remote shell on purpose (Art. 10).
export function TerminalApp({ session }: AppContext) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = hostRef.current;
    if (!container) return;

    const term = new Terminal({
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 13,
      theme: { background: '#18181b' },
      cursorBlink: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    fit.fit();

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(
      `${proto}://${window.location.host}/api/terminal?sessionId=${encodeURIComponent(session.sessionId)}`,
    );

    const send = (msg: unknown) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg));

    ws.onopen = () => send({ type: 'resize', cols: term.cols, rows: term.rows });
    ws.onmessage = (event: MessageEvent<string>) => {
      const msg = JSON.parse(event.data) as { type: string; data?: string };
      if (msg.type === 'output' && msg.data !== undefined) term.write(msg.data);
    };
    ws.onclose = () => term.write('\r\n\x1b[2m[disconnected]\x1b[0m\r\n');

    const onData = term.onData((data) => send({ type: 'input', data }));

    const resizeObserver = new ResizeObserver(() => {
      fit.fit();
      send({ type: 'resize', cols: term.cols, rows: term.rows });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      onData.dispose();
      ws.close();
      term.dispose();
    };
  }, [session.sessionId]);

  return <div ref={hostRef} className="h-full w-full bg-[#18181b] p-1" />;
}
