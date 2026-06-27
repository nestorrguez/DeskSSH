import { useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';
import type { CommandRecord } from '@deskssh/core';
import { getTransparency } from '@/api/gateway';
import { Button } from '@/components/ui/button';
import type { AppContext } from '../types';

// Command history — every command DeskSSH ran (the transparency log, Art. 3 /
// FR-013), in its own app instead of buried inside System info.
export function CommandHistoryApp({ t, session }: AppContext) {
  const [records, setRecords] = useState<readonly CommandRecord[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () =>
      getTransparency(session.sessionId)
        .then((r) => active && setRecords(r.transparency))
        .catch(() => {});
    void load();
    const id = setInterval(() => void load(), 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [session.sessionId, tick]);

  const ordered = [...records].reverse(); // newest first

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-2 py-1.5">
        <span className="text-xs font-medium">{t('history.title')}</span>
        <span className="text-xs text-muted-foreground">
          {t('history.count', { n: records.length })}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-7"
          onClick={() => setTick((n) => n + 1)}
          aria-label={t('history.refresh')}
        >
          <RotateCw className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {ordered.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">{t('history.empty')}</p>
        ) : (
          <ul className="divide-y divide-border/60 font-mono text-xs">
            {ordered.map((rec) => (
              <li key={rec.id} className="flex items-start gap-2 px-3 py-1.5">
                <span
                  className={rec.exitCode === 0 ? 'text-primary' : 'text-destructive'}
                  title={rec.error ?? ''}
                >
                  [{rec.exitCode ?? 'ERR'}]
                </span>
                <code className="min-w-0 flex-1 break-all">{rec.command}</code>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {rec.durationMs}ms
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
