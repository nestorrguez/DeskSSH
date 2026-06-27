import { useEffect, useState } from 'react';
import { Folder, File as FileIcon, Link2, ChevronUp } from 'lucide-react';
import type { FileEntry } from '@deskssh/core';
import { listDir } from '@/api/gateway';
import { Button } from '@/components/ui/button';
import type { AppContext } from '../types';
import { formatBytes, imageMimeFor, isPdf, joinPath, parentPath } from './lib';

function EntryIcon({ type }: { type: FileEntry['type'] }) {
  const c = 'size-4 shrink-0 text-muted-foreground';
  if (type === 'directory') return <Folder className={c} aria-hidden />;
  if (type === 'symlink') return <Link2 className={c} aria-hidden />;
  return <FileIcon className={c} aria-hidden />;
}

export function FilesApp({ t, session, openEditor, openImage, openPdf }: AppContext) {
  const [path, setPath] = useState(session.home);
  const [entries, setEntries] = useState<readonly FileEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    listDir(session.sessionId, path)
      .then((res) => {
        if (!active) return;
        if (res.result.kind === 'ok') setEntries(res.result.value);
        else setError(t('files.error'));
      })
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
  }, [session.sessionId, path, t]);

  function activate(entry: FileEntry): void {
    const full = joinPath(path, entry.name);
    if (entry.type === 'directory') setPath(full);
    else if (entry.type === 'file')
      if (imageMimeFor(entry.name)) openImage(full);
      else if (isPdf(entry.name)) openPdf(full);
      else openEditor(full);
  }

  const sorted = [...entries].sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-2 py-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={path === '/'}
          onClick={() => setPath(parentPath(path))}
          aria-label={t('files.up')}
        >
          <ChevronUp className="size-4" aria-hidden />
        </Button>
        <code className="truncate font-mono text-xs text-muted-foreground">{path}</code>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {error && <p className="p-3 text-sm text-destructive">{error}</p>}
        {!error && sorted.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">{t('files.empty')}</p>
        )}
        <ul>
          {sorted.map((entry) => (
            <li key={entry.name}>
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                onDoubleClick={() => activate(entry)}
                onClick={(e) => e.detail === 0 && activate(entry)}
              >
                <EntryIcon type={entry.type} />
                <span className="flex-1 truncate">{entry.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {entry.type === 'file' ? formatBytes(entry.size) : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
