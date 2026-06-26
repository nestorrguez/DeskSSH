import { useEffect, useState } from 'react';
import { Folder, File as FileIcon, Link2, LogOut, Terminal } from 'lucide-react';
import type { FileEntry } from '@deskssh/core';
import type { Translator } from '../../i18n';
import { listDir, type ListDirResponse, type SessionInfo } from '../../api/gateway';

interface ConnectedViewProps {
  t: Translator;
  session: SessionInfo;
  onDisconnect: () => void;
}

function EntryIcon({ type }: { type: FileEntry['type'] }) {
  if (type === 'directory') return <Folder size={15} aria-hidden />;
  if (type === 'symlink') return <Link2 size={15} aria-hidden />;
  return <FileIcon size={15} aria-hidden />;
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
    <div className="card card--wide">
      <div className="card__header">
        <h1 className="card__title">{t('connected.title')}</h1>
        <button className="btn" type="button" onClick={onDisconnect}>
          <LogOut size={15} aria-hidden /> {t('connected.disconnect')}
        </button>
      </div>

      <dl className="meta">
        <dt>{t('connected.os')}</dt>
        <dd>{session.os.prettyName ?? session.os.family}</dd>
        <dt>{t('connected.home')}</dt>
        <dd>
          <code>{session.home}</code>
        </dd>
      </dl>

      <section>
        <h2 className="section__title">
          {t('connected.listing')} <code>{data?.path ?? session.home}</code>
        </h2>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {data && entries.length === 0 && <p className="muted">{t('connected.empty')}</p>}
        <ul className="listing">
          {entries.map((entry) => (
            <li key={entry.name} className="listing__row">
              <EntryIcon type={entry.type} />
              <span className="listing__name">{entry.name}</span>
              <span className="listing__size">
                {entry.type === 'file' ? `${entry.size} B` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="section__title">
          <Terminal size={16} aria-hidden /> {t('connected.transparency')}
        </h2>
        <ul className="log">
          {(data?.transparency ?? []).map((rec) => (
            <li key={rec.id} className="log__row">
              <span className="log__code">[{rec.exitCode ?? 'ERR'}]</span>
              <code className="log__cmd">{rec.command}</code>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
