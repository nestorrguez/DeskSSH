import { useEffect, useRef, useState } from 'react';
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
  Upload,
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
  writeFile,
  makeDir,
  createFile,
  movePath,
  copyPath,
  removePath,
  type Elevate,
} from '@/api/gateway';
import { useElevation, type ElevatableResult } from '../useElevation';
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
type Conflict = { name: string; onKeepBoth: () => void; onReplace: () => void };

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
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { run: runElevated, dialogs: elevationDialogs } = useElevation(session.sessionId, t);

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

  // Run a mutating op through the elevation runner: if it is denied for lack of
  // privilege, the elevation modals appear and it is retried with credentials.
  // Returns whether it ultimately succeeded (so callers can chain, e.g. replace).
  async function runVoid(make: (e?: Elevate) => Promise<ElevatableResult>): Promise<boolean> {
    setActionError(null);
    try {
      const { result } = await runElevated(make);
      if (result.kind !== 'ok') {
        setActionError(('reason' in result && result.reason) || t('files.actionError'));
        return false;
      }
      reload();
      return true;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t('files.actionError'));
      return false;
    }
  }

  /** If `name` collides in the current dir, ask Replace / Keep both / Cancel;
   *  otherwise run `onName(name)` directly. `onReplace` overwrites the existing one. */
  function withConflict(
    name: string,
    onName: (finalName: string) => void,
    onReplace: () => void,
  ): void {
    const existing = new Set(entries.map((e) => e.name));
    if (!existing.has(name)) {
      onName(name);
      return;
    }
    setConflict({
      name,
      onKeepBoth: () => {
        setConflict(null);
        onName(uniqueName(name, existing));
      },
      onReplace: () => {
        setConflict(null);
        onReplace();
      },
    });
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

  /** A move/copy of `from` into the current dir as `finalName`. */
  function bring(from: string, finalName: string, op: 'cut' | 'copy'): Promise<boolean> {
    const to = joinPath(path, finalName);
    return runVoid((e) =>
      op === 'cut'
        ? movePath(session.sessionId, from, to, e)
        : copyPath(session.sessionId, from, to, e),
    );
  }

  function paste(): void {
    if (!clipboard) return;
    const cb = clipboard;
    if (cb.op === 'cut') setClipboard(null);
    withConflict(
      cb.name,
      (finalName) => void bring(cb.from, finalName, cb.op),
      // Replace: the adapter's mv/cp refuse to clobber, so remove the target first.
      () =>
        void (async () => {
          if (await runVoid((e) => removePath(session.sessionId, joinPath(path, cb.name), e)))
            await bring(cb.from, cb.name, cb.op);
        })(),
    );
  }

  function submitDialog(): void {
    if (!dialog) return;
    const value = dialog.value.trim();
    if (!value || value.includes('/')) return;
    const d = dialog;
    const make = (name: string): Promise<boolean> => {
      const dest = joinPath(path, name);
      if (d.mode === 'newFolder') return runVoid((e) => makeDir(session.sessionId, dest, e));
      if (d.mode === 'newFile') return runVoid((e) => createFile(session.sessionId, dest, e));
      const from = joinPath(path, d.target?.name ?? '');
      return runVoid((e) => movePath(session.sessionId, from, dest, e));
    };
    setDialog(null);
    // Rename onto the same name is a no-op; otherwise resolve any collision.
    if (d.mode === 'rename' && d.target?.name === value) return;
    withConflict(
      value,
      (finalName) => void make(finalName),
      () =>
        void (async () => {
          if (await runVoid((e) => removePath(session.sessionId, joinPath(path, value), e)))
            await make(value);
        })(),
    );
  }

  async function uploadFile(file: File): Promise<void> {
    const base64 = await fileToBase64(file);
    const write = (name: string) =>
      runVoid((e) => writeFile(session.sessionId, joinPath(path, name), base64, e));
    // writeFile truncates, so Replace just writes to the original name.
    withConflict(
      file.name,
      (finalName) => void write(finalName),
      () => void write(file.name),
    );
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
          onClick={() => fileInputRef.current?.click()}
          aria-label={t('files.upload')}
        >
          <Upload className="size-4" aria-hidden />
        </Button>
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

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ''; // allow re-selecting the same file
          if (file) void uploadFile(file);
        }}
      />

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
            <ContextMenuItem onSelect={() => fileInputRef.current?.click()}>
              <Upload className="text-muted-foreground" /> {t('files.upload')}
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
                if (pendingDelete) {
                  const target = joinPath(path, pendingDelete.name);
                  void runVoid((e) => removePath(session.sessionId, target, e));
                }
                setPendingDelete(null);
              }}
            >
              {t('files.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Name-conflict resolution (FR-028). */}
      <AlertDialog open={conflict !== null} onOpenChange={(open) => !open && setConflict(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('files.conflictTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('files.conflictBody', { name: conflict?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('files.cancel')}</AlertDialogCancel>
            <Button variant="outline" onClick={() => conflict?.onKeepBoth()}>
              {t('files.keepBoth')}
            </Button>
            <Button variant="destructive" onClick={() => conflict?.onReplace()}>
              {t('files.replace')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Privilege-elevation modals (FR-029/093..095) for denied file operations. */}
      {elevationDialogs}
    </div>
  );
}

/** A name not already in `existing`, suffixing " (n)" before the extension. */
function uniqueName(name: string, existing: Set<string>): string {
  if (!existing.has(name)) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let n = 2;
  while (existing.has(`${base} (${n})${ext}`)) n += 1;
  return `${base} (${n})${ext}`;
}

/** Read a browser File as base64 (without the `data:…;base64,` prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}
