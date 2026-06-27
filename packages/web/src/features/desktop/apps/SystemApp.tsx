import { useEffect, useState } from 'react';
import { Server } from 'lucide-react';
import type { SystemInfo } from '@deskssh/core';
import { getSystemInfo } from '@/api/gateway';
import type { AppContext } from '../types';
import { formatBytes, formatUptime } from './lib';

// System info — a fastfetch-style host snapshot (FR-016), gathered agentlessly.
export function SystemApp({ t, session }: AppContext) {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    getSystemInfo(session.sessionId)
      .then(({ result }) => {
        if (!active) return;
        if (result.kind === 'ok') setInfo(result.value);
        else setError(true);
      })
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [session.sessionId]);

  const rows: Array<[string, string]> = info
    ? [
        [t('system.os'), info.prettyName || session.os.family],
        [t('system.kernel'), info.kernel],
        [t('system.uptime'), formatUptime(info.uptimeSeconds)],
        [t('system.packages'), `${info.packages} (dpkg)`],
        [t('system.shell'), info.shell],
        [t('system.cpu'), `${info.cpuModel}${info.cpuCount ? ` (${info.cpuCount})` : ''}`],
        [
          t('system.memory'),
          `${formatBytes(info.memUsedBytes)} / ${formatBytes(info.memTotalBytes)}`,
        ],
        [
          t('system.disk'),
          `${formatBytes(info.diskUsedBytes)} / ${formatBytes(info.diskTotalBytes)}`,
        ],
        [t('system.ip'), info.localIp || '—'],
        [t('system.home'), session.home],
      ]
    : [];

  return (
    <div className="flex h-full items-start gap-5 overflow-auto p-5 font-mono text-sm">
      {/* "Logo" panel (no ASCII art dependency). */}
      <div className="grid size-28 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Server className="size-14" aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        <div className="font-semibold text-primary">{session.host}</div>
        <div className="mb-2 text-muted-foreground">
          {'─'.repeat(Math.max(8, session.host.length))}
        </div>

        {error && <p className="text-sm text-destructive">{t('system.unavailable')}</p>}
        {!error && !info && <p className="text-muted-foreground">…</p>}

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-semibold text-primary">{k}</dt>
              <dd className="break-all text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
