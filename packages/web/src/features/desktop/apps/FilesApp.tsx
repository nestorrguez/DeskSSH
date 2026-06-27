import { useEffect, useState } from 'react';
import {
  Folder,
  File as FileIcon,
  Link2,
  ChevronUp,
  RefreshCw,
  FolderPlus,
  FilePlus,
  TerminalSquare,
  Download,
  Pencil,
  Scissors,
  Copy,
  ClipboardPaste,
  Trash2,
  FileText,
  PenLine,
  Image,
  FileType,
} from 'lucide-react';
import type { FileEntry } from '@deskssh/core';
import {
  listDir,
  readFile,
  makeDir,
  createFile,
  movePath,
  copyPath,
  removePath,
} from '@/api/gateway';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { base64ToBytes, formatBytes, imageMimeFor, isPdf, joinPath, parentPath } from './lib';

function EntryIcon({ type }: { type: FileEntry['type'] }) {
  const c = 'size-4 shrink-0 text-muted-foreground';
  if (type === 'directory') return <Folder className={c} aria-hidden />;
  if (type === 'symlink') return <Link2 className={c} aria-hidden />;
  return <FileIcon className={c} aria-hidden />;
}

type Clipboard = { from: string; name: string; op: 'cut' | 'copy' };
type NameDialog = { mode: 'newFolder' | 'newFile' | 'rename'; value: string; target?: FileEntry };

export function FilesApp({
  t,
  session,
  openEditor,
  openImage,
  openPdf,
  openDoc,
  openTerminal,
}: AppContext) {
  const [path, setPath] = useState(session.home);
  const [entries, setEntries] = useState<readonly FileEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);
  const [dialog, setDialog] = useState<NameDialog | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FileEntry | null>(null);

  const reload = () => setTick((n) => n + 1);

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
  }, [session.sessionId, path, tick, t]);

  function activate(entry: FileEntry): void {
    const full = joinPath(path, entry.name);
    if (entry.type === 'directory') setPath(full);
    else if (entry.type === 'file')
      if (imageMimeFor(entry.name)) openImage(full);
      else if (isPdf(entry.name)) openPdf(full);
      else openEditor(full);
  }

  async function runVoid(p: Promise<{ result: { kind: string; reason?: string } }>): Promise<void> {
    setActionError(null);
    try {
      const { result } = await p;
      if (result.kind !== 'ok') setActionError(result.reason || t('files.actionError'));
      else reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t('files.actionError'));
    }
  }

  async function download(entry: FileEntry): Promise<void> {
    setActionError(null);
    try {
      const { result } = await readFile(session.sessionId, joinPath(path, entry.name));
      if (result.kind !== 'ok') {
        setActionError(t('files.downloadError'));
        return;
      }
      // Cast: the bytes are ArrayBuffer-backed, but TS widens to ArrayBufferLike.
      const blob = new Blob([base64ToBytes(result.base64) as BlobPart]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = entry.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setActionError(t('files.downloadError'));
    }
  }

  function paste(): void {
    if (!clipboard) return;
    const existing = new Set(entries.map((e) => e.name));
    let name = clipboard.name;
    if (clipboard.op === 'copy') while (existing.has(name)) name = bumpCopy(name);
    const to = joinPath(path, name);
    const op =
      clipboard.op === 'cut'
        ? movePath(session.sessionId, clipboard.from, to)
        : copyPath(session.sessionId, clipboard.from, to);
    if (clipboard.op === 'cut') setClipboard(null);
    void runVoid(op);
  }

  function submitDialog(): void {
    if (!dialog) return;
    const value = dialog.value.trim();
    if (!value || value.includes('/')) return;
    const dest = joinPath(path, value);
    if (dialog.mode === 'newFolder') void runVoid(makeDir(session.sessionId, dest));
    else if (dialog.mode === 'newFile') void runVoid(createFile(session.sessionId, dest));
    else if (dialog.target)
      void runVoid(movePath(session.sessionId, joinPath(path, dialog.target.name), dest));
    setDialog(null);
  }

  const sorted = [...entries].sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });

  const dialogValid = !!dialog && dialog.value.trim() !== '' && !dialog.value.includes('/');

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b bg-muted/30 px-2 py-1.5">
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
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={reload}
          aria-label={t('files.refresh')}
        >
          <RefreshCw className="size-4" aria-hidden />
        </Button>
        <code className="flex-1 truncate px-1 font-mono text-xs text-muted-foreground">{path}</code>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => setDialog({ mode: 'newFolder', value: '' })}
          aria-label={t('files.newFolder')}
        >
          <FolderPlus className="size-4" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => setDialog({ mode: 'newFile', value: '' })}
          aria-label={t('files.newFile')}
        >
          <FilePlus className="size-4" aria-hidden />
        </Button>
        {clipboard && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={paste}
            aria-label={t('files.paste')}
          >
            <ClipboardPaste className="size-4" aria-hidden />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => openTerminal(path)}
          aria-label={t('files.openInTerminal')}
        >
          <TerminalSquare className="size-4" aria-hidden />
        </Button>
      </div>

      {(error || actionError) && (
        <p className="px-3 py-1.5 text-xs text-destructive">{error ?? actionError}</p>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        {!error && sorted.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">{t('files.empty')}</p>
        )}
        <ul>
          {sorted.map((entry) => (
            <li key={entry.name}>
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <button
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent data-[state=open]:bg-accent"
                    onDoubleClick={() => activate(entry)}
                    onClick={(e) => e.detail === 0 && activate(entry)}
                  >
                    <EntryIcon type={entry.type} />
                    <span className="flex-1 truncate">{entry.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {entry.type === 'file' ? formatBytes(entry.size) : ''}
                    </span>
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-52">
                  <ContextMenuItem onSelect={() => activate(entry)}>
                    <Folder className="text-muted-foreground" /> {t('files.open')}
                  </ContextMenuItem>
                  {entry.type === 'file' && (
                    <ContextMenuSub>
                      <ContextMenuSubTrigger>{t('files.openWith')}</ContextMenuSubTrigger>
                      <ContextMenuSubContent>
                        <ContextMenuItem onSelect={() => openEditor(joinPath(path, entry.name))}>
                          <FileText className="text-muted-foreground" /> {t('apps.editor')}
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => openDoc(joinPath(path, entry.name))}>
                          <PenLine className="text-muted-foreground" /> {t('apps.docs')}
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => openImage(joinPath(path, entry.name))}>
                          <Image className="text-muted-foreground" /> {t('apps.viewer')}
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => openPdf(joinPath(path, entry.name))}>
                          <FileType className="text-muted-foreground" /> {t('apps.pdf')}
                        </ContextMenuItem>
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                  )}
                  {entry.type === 'directory' && (
                    <ContextMenuItem onSelect={() => openTerminal(joinPath(path, entry.name))}>
                      <TerminalSquare className="text-muted-foreground" />{' '}
                      {t('files.openInTerminal')}
                    </ContextMenuItem>
                  )}
                  {entry.type === 'file' && (
                    <ContextMenuItem onSelect={() => void download(entry)}>
                      <Download className="text-muted-foreground" /> {t('files.download')}
                    </ContextMenuItem>
                  )}
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onSelect={() => setDialog({ mode: 'rename', value: entry.name, target: entry })}
                  >
                    <Pencil className="text-muted-foreground" /> {t('files.rename')}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={() =>
                      setClipboard({
                        from: joinPath(path, entry.name),
                        name: entry.name,
                        op: 'cut',
                      })
                    }
                  >
                    <Scissors className="text-muted-foreground" /> {t('files.cut')}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={() =>
                      setClipboard({
                        from: joinPath(path, entry.name),
                        name: entry.name,
                        op: 'copy',
                      })
                    }
                  >
                    <Copy className="text-muted-foreground" /> {t('files.copy')}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem variant="destructive" onSelect={() => setPendingDelete(entry)}>
                    <Trash2 /> {t('files.delete')}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </li>
          ))}
        </ul>

        {/* Empty area below the list: folder-level context menu. */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="min-h-8 flex-1" />
          </ContextMenuTrigger>
          <ContextMenuContent className="w-52">
            <ContextMenuItem onSelect={() => setDialog({ mode: 'newFolder', value: '' })}>
              <FolderPlus className="text-muted-foreground" /> {t('files.newFolder')}
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => setDialog({ mode: 'newFile', value: '' })}>
              <FilePlus className="text-muted-foreground" /> {t('files.newFile')}
            </ContextMenuItem>
            {clipboard && (
              <ContextMenuItem onSelect={paste}>
                <ClipboardPaste className="text-muted-foreground" /> {t('files.paste')}
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => openTerminal(path)}>
              <TerminalSquare className="text-muted-foreground" /> {t('files.openInTerminal')}
            </ContextMenuItem>
            <ContextMenuItem onSelect={reload}>
              <RefreshCw className="text-muted-foreground" /> {t('files.refresh')}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      {/* New folder / new file / rename dialog. */}
      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === 'newFolder'
                ? t('files.newFolder')
                : dialog?.mode === 'newFile'
                  ? t('files.newFile')
                  : t('files.rename')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="files-name">{t('files.name')}</Label>
            <Input
              id="files-name"
              autoFocus
              value={dialog?.value ?? ''}
              onChange={(e) => setDialog((d) => (d ? { ...d, value: e.target.value } : d))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && dialogValid) submitDialog();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              {t('files.cancel')}
            </Button>
            <Button disabled={!dialogValid} onClick={submitDialog}>
              {dialog?.mode === 'rename' ? t('files.save') : t('files.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation (FR-090). */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('files.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('files.deleteBody', { name: pendingDelete?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('files.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingDelete)
                  void runVoid(removePath(session.sessionId, joinPath(path, pendingDelete.name)));
                setPendingDelete(null);
              }}
            >
              {t('files.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Insert " copy" before the extension to dodge a name collision on paste. */
function bumpCopy(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return `${name} copy`;
  return `${name.slice(0, dot)} copy${name.slice(dot)}`;
}
