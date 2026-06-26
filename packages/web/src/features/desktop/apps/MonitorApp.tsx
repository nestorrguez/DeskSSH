import { useEffect, useState } from 'react';
import type { SystemMetrics } from '@deskssh/core';
import { systemMetrics } from '@/api/gateway';
import type { AppContext } from '../types';
import { formatBytes, formatUptime } from './lib';

export function MonitorApp({ t, session }: AppContext) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    async function tick(): Promise<void> {
      const { result } = await systemMetrics(session.sessionId).catch(() => ({ result: null }));
      if (!active) return;
      if (result?.kind === 'ok') {
        setMetrics(result.value);
        setUnavailable(false);
      } else {
        setUnavailable(true);
      }
    }
    void tick();
    const id = setInterval(() => void tick(), 2000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [session.sessionId]);

  if (unavailable && !metrics) {
    return (
      <div className="grid h-full place-items-center p-6 text-sm text-muted-foreground">
        {t('monitor.unavailable')}
      </div>
    );
  }
  if (!metrics) return <div className="p-4 text-sm text-muted-foreground">…</div>;

  const usedPct = metrics.memory.totalBytes
    ? Math.round((metrics.memory.usedBytes / metrics.memory.totalBytes) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-4 p-4 text-sm">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{t('monitor.uptime')}</span>
        <span className="text-lg font-medium tabular-nums">
          {formatUptime(metrics.uptimeSeconds)}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{t('monitor.load')}</span>
        <span className="font-mono tabular-nums">{metrics.loadAverage.join('  ·  ')}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">{t('monitor.memory')}</span>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${usedPct}%` }} />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t('monitor.memoryUsage', {
            used: formatBytes(metrics.memory.usedBytes),
            total: formatBytes(metrics.memory.totalBytes),
            pct: usedPct,
          })}
        </span>
      </div>
    </div>
  );
}
