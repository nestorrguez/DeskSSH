import { useEffect, useMemo, useState } from 'react';
import { Search, RotateCw } from 'lucide-react';
import type { Process, ProcessSignal, ServiceAction, SystemMetrics } from '@deskssh/core';
import { listProcesses, serviceAction, signalProcess, systemMetrics } from '@/api/gateway';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import type { AppContext } from '../types';
import { formatBytes, formatUptime } from './lib';

type Pending =
  | { kind: 'signal'; pid: number; command: string; signal: ProcessSignal; destructive: boolean }
  | { kind: 'service'; name: string; action: ServiceAction };

export function MonitorApp({ t, session }: AppContext) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [procs, setProcs] = useState<readonly Process[] | null>(null);
  const [filter, setFilter] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    async function poll(): Promise<void> {
      const [m, p] = await Promise.all([
        systemMetrics(session.sessionId).catch(() => ({ result: null })),
        listProcesses(session.sessionId).catch(() => ({ result: null })),
      ]);
      if (!active) return;
      if (m.result?.kind === 'ok') {
        setMetrics(m.result.value);
        setUnavailable(false);
      } else {
        setUnavailable(true);
      }
      if (p.result?.kind === 'ok') setProcs(p.result.value);
    }
    void poll();
    const id = setInterval(() => void poll(), 2500);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [session.sessionId, tick]);

  const reload = () => setTick((n) => n + 1);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = procs ? [...procs] : [];
    const filtered = q
      ? list.filter(
          (p) =>
            p.command.toLowerCase().includes(q) ||
            p.user.toLowerCase().includes(q) ||
            String(p.pid) === q,
        )
      : list;
    return filtered.sort((a, b) => b.cpu - a.cpu);
  }, [procs, filter]);

  async function confirmPending(): Promise<void> {
    if (!pending) return;
    setActionMsg(null);
    const run =
      pending.kind === 'signal'
        ? signalProcess(session.sessionId, pending.pid, pending.signal)
        : serviceAction(session.sessionId, pending.name, pending.action);
    setPending(null);
    try {
      const { result } = await run;
      if (result.kind !== 'ok')
        setActionMsg('reason' in result ? result.reason : t('monitor.actionFailed'));
      else reload();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : t('monitor.actionFailed'));
    }
  }

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

  const svcLabel: Record<ServiceAction, string> = {
    start: t('monitor.svcStart'),
    stop: t('monitor.svcStop'),
    restart: t('monitor.svcRestart'),
  };

  return (
    <div className="flex h-full flex-col">
      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 border-b p-3 text-sm">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{t('monitor.uptime')}</span>
          <span className="font-medium tabular-nums">{formatUptime(metrics.uptimeSeconds)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{t('monitor.load')}</span>
          <span className="font-mono text-xs tabular-nums">{metrics.loadAverage.join(' · ')}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{t('monitor.memory')}</span>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${usedPct}%` }} />
          </div>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {t('monitor.memoryUsage', {
              used: formatBytes(metrics.memory.usedBytes),
              total: formatBytes(metrics.memory.totalBytes),
              pct: usedPct,
            })}
          </span>
        </div>
      </div>

      {/* Process toolbar */}
      <div className="flex items-center gap-2 border-b bg-muted/30 px-2 py-1.5">
        <span className="text-xs font-medium">{t('monitor.processes')}</span>
        <div className="relative ml-auto">
          <Search
            className="pointer-events-none absolute top-1.5 left-2 size-3.5 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('monitor.filter')}
            className="h-7 w-44 pl-7 text-xs"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={reload}
          aria-label={t('monitor.refresh')}
        >
          <RotateCw className="size-4" aria-hidden />
        </Button>
      </div>

      {actionMsg && <p className="px-3 py-1.5 text-xs text-destructive">{actionMsg}</p>}

      {/* Process table */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-background text-muted-foreground">
            <tr className="border-b">
              <th className="px-2 py-1 text-right font-medium">{t('monitor.pid')}</th>
              <th className="px-2 py-1 text-left font-medium">{t('monitor.user')}</th>
              <th className="px-2 py-1 text-right font-medium">CPU%</th>
              <th className="px-2 py-1 text-right font-medium">MEM%</th>
              <th className="px-2 py-1 text-left font-medium">{t('monitor.command')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <ContextMenu key={p.pid}>
                <ContextMenuTrigger asChild>
                  <tr className="border-b border-border/50 hover:bg-accent data-[state=open]:bg-accent">
                    <td className="px-2 py-1 text-right tabular-nums">{p.pid}</td>
                    <td className="px-2 py-1 text-muted-foreground">{p.user}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{p.cpu.toFixed(1)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{p.mem.toFixed(1)}</td>
                    <td className="max-w-0 truncate px-2 py-1 font-mono">{p.command}</td>
                  </tr>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-48">
                  <ContextMenuItem
                    onSelect={() =>
                      setPending({
                        kind: 'signal',
                        pid: p.pid,
                        command: p.command,
                        signal: 'TERM',
                        destructive: false,
                      })
                    }
                  >
                    {t('monitor.stop')}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={() =>
                      setPending({
                        kind: 'signal',
                        pid: p.pid,
                        command: p.command,
                        signal: 'HUP',
                        destructive: false,
                      })
                    }
                  >
                    {t('monitor.reload')}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    variant="destructive"
                    onSelect={() =>
                      setPending({
                        kind: 'signal',
                        pid: p.pid,
                        command: p.command,
                        signal: 'KILL',
                        destructive: true,
                      })
                    }
                  >
                    {t('monitor.forceStop')}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
            {procs && visible.length === 0 && (
              <tr>
                <td colSpan={5} className="p-3 text-center text-muted-foreground">
                  {t('monitor.noProcesses')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Service control */}
      <form
        className="flex items-center gap-2 border-t bg-muted/30 px-2 py-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const name = serviceName.trim();
          if (name) setPending({ kind: 'service', name, action: 'restart' });
        }}
      >
        <span className="text-xs text-muted-foreground">{t('monitor.service')}</span>
        <Input
          value={serviceName}
          onChange={(e) => setServiceName(e.target.value)}
          placeholder={t('monitor.serviceName')}
          className="h-7 w-40 text-xs"
        />
        {(['start', 'stop', 'restart'] as const).map((a) => (
          <Button
            key={a}
            type={a === 'restart' ? 'submit' : 'button'}
            size="sm"
            variant="outline"
            className="h-7"
            disabled={!serviceName.trim()}
            onClick={() => {
              const name = serviceName.trim();
              if (a !== 'restart' && name) setPending({ kind: 'service', name, action: a });
            }}
          >
            {svcLabel[a]}
          </Button>
        ))}
      </form>

      {/* Confirmation (FR-090) */}
      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === 'service'
                ? t('monitor.confirmServiceTitle')
                : t('monitor.confirmSignalTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === 'service'
                ? t('monitor.confirmServiceBody', { action: pending.action, name: pending.name })
                : pending
                  ? t('monitor.confirmSignalBody', {
                      signal: pending.signal,
                      pid: pending.pid,
                      command: pending.command.slice(0, 60),
                    })
                  : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('monitor.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant={
                pending?.kind === 'signal' && pending.destructive ? 'destructive' : 'default'
              }
              onClick={() => void confirmPending()}
            >
              {t('monitor.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
