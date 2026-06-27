import { useCallback, useMemo, useState } from 'react';
import type { Translator } from '@/i18n';
import type { SessionInfo } from '@/api/gateway';
import { useWindows } from './useWindows';
import { Window } from './Window';
import { Taskbar } from './Taskbar';
import { getApps } from './apps/index';
import type { AppContext } from './types';

interface DesktopProps {
  t: Translator;
  session: SessionInfo;
  onDisconnect: () => void;
}

/** The connected experience: a desktop with windows, a launcher and a taskbar. */
export function Desktop({ t, session, onDisconnect }: DesktopProps) {
  const apps = useMemo(() => getApps(t), [t]);
  const wm = useWindows();
  const [editorTarget, setEditorTarget] = useState<string | null>(null);
  const [imageTarget, setImageTarget] = useState<string | null>(null);
  const [pdfTarget, setPdfTarget] = useState<string | null>(null);
  const [docTarget, setDocTarget] = useState<string | null>(null);
  const [terminalCwd, setTerminalCwd] = useState<string | null>(null);
  const [terminalReq, setTerminalReq] = useState(0);

  // Let any app open a file in the editor (Stallman) and focus its window.
  const openEditor = useCallback(
    (path: string) => {
      setEditorTarget(path);
      const editor = apps.find((a) => a.id === 'editor');
      if (editor) wm.openApp(editor);
    },
    [apps, wm],
  );

  // Let any app open an image in the viewer and focus its window.
  const openImage = useCallback(
    (path: string) => {
      setImageTarget(path);
      const viewer = apps.find((a) => a.id === 'viewer');
      if (viewer) wm.openApp(viewer);
    },
    [apps, wm],
  );

  // Let any app open a PDF in the PDF viewer and focus its window.
  const openPdf = useCallback(
    (path: string) => {
      setPdfTarget(path);
      const viewer = apps.find((a) => a.id === 'pdf');
      if (viewer) wm.openApp(viewer);
    },
    [apps, wm],
  );

  // Let any app open a file in the Documents (rich-text) editor.
  const openDoc = useCallback(
    (path: string) => {
      setDocTarget(path);
      const docs = apps.find((a) => a.id === 'docs');
      if (docs) wm.openApp(docs);
    },
    [apps, wm],
  );

  // Open (or re-target) the terminal in a directory. The bumped request lets an
  // already-open terminal cd into the new directory instead of reconnecting.
  const openTerminal = useCallback(
    (path: string) => {
      setTerminalCwd(path);
      setTerminalReq((n) => n + 1);
      const terminal = apps.find((a) => a.id === 'terminal');
      if (terminal) wm.openApp(terminal);
    },
    [apps, wm],
  );

  const ctx: AppContext = {
    t,
    session,
    editorTarget,
    openEditor,
    imageTarget,
    openImage,
    pdfTarget,
    openPdf,
    docTarget,
    openDoc,
    terminalCwd,
    terminalReq,
    openTerminal,
  };

  // The window with the highest z is the active one.
  const visible = wm.windows.filter((w) => !w.minimized);
  const activeId = visible.length > 0 ? visible.reduce((a, b) => (a.z >= b.z ? a : b)).id : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Desktop surface */}
      <div
        className="relative min-h-0 flex-1"
        style={{
          backgroundColor: 'oklch(0.16 0.006 285.8)',
          backgroundImage:
            'radial-gradient(60% 60% at 25% 15%, rgba(99,102,241,0.16), transparent 70%),' +
            'radial-gradient(55% 55% at 85% 80%, rgba(56,189,248,0.10), transparent 70%)',
        }}
      >
        <div className="pointer-events-none absolute top-4 left-4 text-xs font-semibold tracking-widest text-muted-foreground/60 select-none">
          DeskSSH
        </div>

        {wm.windows.map((win) =>
          win.minimized ? null : (
            <Window
              key={win.id}
              win={win}
              active={win.id === activeId}
              onFocus={() => wm.focus(win.id)}
              onClose={() => wm.close(win.id)}
              onMinimize={() => wm.minimize(win.id)}
              onToggleMaximize={() => wm.toggleMaximize(win.id)}
              onMove={(x, y) => wm.move(win.id, x, y)}
              onResize={(w, h) => wm.resize(win.id, w, h)}
            >
              {apps.find((a) => a.id === win.appId)?.render(ctx)}
            </Window>
          ),
        )}
      </div>

      <Taskbar
        t={t}
        apps={apps}
        windows={wm.windows}
        activeId={activeId}
        host={session.host}
        onLaunch={wm.openApp}
        onSelectWindow={wm.focus}
        onDisconnect={onDisconnect}
      />
    </div>
  );
}
