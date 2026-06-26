import { useEffect, useState } from 'react';
import {
  Folder,
  File as FileIcon,
  Link2,
  Info,
  TerminalSquare,
  Activity,
  Construction,
} from 'lucide-react';
import type { FileEntry } from '@deskssh/core';
import type { Translator } from '@/i18n';
import { listDir, type ListDirResponse } from '@/api/gateway';
import type { AppContext, AppDefinition } from './types';

function EntryIcon({ type }: { type: FileEntry['type'] }) {
  const c = 'size-4 shrink-0 text-muted-foreground';
  if (type === 'directory') return <Folder className={c} aria-hidden />;
  if (type === 'symlink') return <Link2 className={c} aria-hidden />;
  return <FileIcon className={c} aria-hidden />;
}

/** Shared loader for the home listing (used by Files and System apps). */
function useListing(sessionId: string) {
  const [data, setData] = useState<ListDirResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    listDir(sessionId)
      .then((res) => active && setData(res))
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
  }, [sessionId]);
  return { data, error };
}

function FilesApp({ session }: AppContext) {
  const { data, error } = useListing(session.sessionId);
  const entries = data?.result.kind === 'ok' ? data.result.value : [];
  return (
    <div className="p-3 text-sm">
      <div className="mb-2 font-mono text-xs text-muted-foreground">
        {data?.path ?? session.home}
      </div>
      {error && <p className="text-destructive">{error}</p>}
      <ul className="divide-y divide-border overflow-hidden rounded-md border">
        {entries.map((e) => (
          <li key={e.name} className="flex items-center gap-2 px-3 py-1.5">
            <EntryIcon type={e.type} />
            <span className="flex-1 truncate">{e.name}</span>
            <span className="text-xs text-muted-foreground">
              {e.type === 'file' ? `${e.size} B` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SystemApp({ t, session }: AppContext) {
  const { data } = useListing(session.sessionId);
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

function ComingSoon({ t }: AppContext) {
  return (
    <div className="grid h-full place-items-center p-6 text-center text-muted-foreground">
      <div className="flex flex-col items-center gap-2">
        <Construction className="size-8" aria-hidden />
        <p className="text-sm">{t('desktop.comingSoon')}</p>
      </div>
    </div>
  );
}

/** The apps available in the launcher. Terminal/Monitor are placeholders for now. */
export function getApps(t: Translator): AppDefinition[] {
  return [
    {
      id: 'files',
      title: t('apps.files'),
      icon: Folder,
      defaultSize: { w: 520, h: 440 },
      render: (ctx) => <FilesApp {...ctx} />,
    },
    {
      id: 'system',
      title: t('apps.system'),
      icon: Info,
      defaultSize: { w: 560, h: 460 },
      render: (ctx) => <SystemApp {...ctx} />,
    },
    {
      id: 'terminal',
      title: t('apps.terminal'),
      icon: TerminalSquare,
      defaultSize: { w: 620, h: 400 },
      render: (ctx) => <ComingSoon {...ctx} />,
    },
    {
      id: 'monitor',
      title: t('apps.monitor'),
      icon: Activity,
      defaultSize: { w: 480, h: 360 },
      render: (ctx) => <ComingSoon {...ctx} />,
    },
  ];
}
