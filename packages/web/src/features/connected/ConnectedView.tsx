import { useEffect, useState } from 'react';
import { Folder, File as FileIcon, Link2, LogOut, Terminal } from 'lucide-react';
import type { FileEntry } from '@deskssh/core';
import type { Translator } from '@/i18n';
import { listDir, type ListDirResponse, type SessionInfo } from '@/api/gateway';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';

interface ConnectedViewProps {
  t: Translator;
  session: SessionInfo;
  onDisconnect: () => void;
}

function EntryIcon({ type }: { type: FileEntry['type'] }) {
  const className = 'size-4 shrink-0 text-muted-foreground';
  if (type === 'directory') return <Folder className={className} aria-hidden />;
  if (type === 'symlink') return <Link2 className={className} aria-hidden />;
  return <FileIcon className={className} aria-hidden />;
}

export function ConnectedView({ t, session, onDisconnect }: ConnectedViewProps) {
  const [data, setData] = useState<ListDirResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listDir(session.sessionId)
      .then((res) => active && setData(res))
      .catch(
        (err: unknown) => active && setError(err instanceof Error ? err.message : String(err)),
      );
    return () => {
      active = false;
    };
  }, [session.sessionId]);

  const entries = data?.result.kind === 'ok' ? data.result.value : [];

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>{t('connected.title')}</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" onClick={onDisconnect}>
            <LogOut className="size-4" aria-hidden /> {t('connected.disconnect')}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t('connected.os')}</dt>
          <dd>{session.os.prettyName ?? session.os.family}</dd>
          <dt className="text-muted-foreground">{t('connected.home')}</dt>
          <dd>
            <code className="font-mono text-xs">{session.home}</code>
          </dd>
        </dl>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            {t('connected.listing')}{' '}
            <code className="font-mono text-xs">{data?.path ?? session.home}</code>
          </h2>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {data && entries.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('connected.empty')}</p>
          )}
          <ul className="divide-y divide-border overflow-hidden rounded-md border">
            {entries.map((entry) => (
              <li key={entry.name} className="flex items-center gap-2 px-3 py-2 text-sm">
                <EntryIcon type={entry.type} />
                <span className="flex-1 truncate">{entry.name}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.type === 'file' ? `${entry.size} B` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Terminal className="size-4" aria-hidden /> {t('connected.transparency')}
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-md border font-mono text-xs">
            {(data?.transparency ?? []).map((rec) => (
              <li key={rec.id} className="flex items-center gap-2 px-3 py-2">
                <span className="text-primary">[{rec.exitCode ?? 'ERR'}]</span>
                <code className="break-all">{rec.command}</code>
              </li>
            ))}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
