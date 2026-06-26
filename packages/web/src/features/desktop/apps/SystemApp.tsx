import { useEffect, useState } from 'react';
import { listDir, type ListDirResponse } from '@/api/gateway';
import type { AppContext } from '../types';

export function SystemApp({ t, session }: AppContext) {
  const [data, setData] = useState<ListDirResponse | null>(null);
  useEffect(() => {
    let active = true;
    listDir(session.sessionId)
      .then((res) => active && setData(res))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [session.sessionId]);

  return (
    <div className="flex flex-col gap-4 p-4 text-sm">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">{t('system.os')}</dt>
        <dd>{session.os.prettyName ?? session.os.family}</dd>
        <dt className="text-muted-foreground">{t('system.host')}</dt>
        <dd>{session.host}</dd>
        <dt className="text-muted-foreground">{t('system.home')}</dt>
        <dd className="font-mono text-xs">{session.home}</dd>
      </dl>
      <div>
        <h3 className="mb-1 text-xs font-medium text-muted-foreground">
          {t('system.transparency')}
        </h3>
        <ul className="divide-y divide-border overflow-hidden rounded-md border font-mono text-xs">
          {(data?.transparency ?? []).map((rec) => (
            <li key={rec.id} className="flex items-center gap-2 px-3 py-1.5">
              <span className="text-primary">[{rec.exitCode ?? 'ERR'}]</span>
              <code className="break-all">{rec.command}</code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
