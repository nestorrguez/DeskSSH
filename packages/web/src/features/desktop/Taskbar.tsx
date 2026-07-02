import { useEffect, useState } from 'react';
import { LayoutGrid, LogOut, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Translator } from '@/i18n';
import type { SessionInfo } from '@/api/gateway';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { AppDefinition, WindowState } from './types';

interface TaskbarProps {
  t: Translator;
  apps: AppDefinition[];
  /** appId → reason, for apps the connected host can't support (E4.3). */
  unsupported?: Record<string, string>;
  windows: WindowState[];
  activeId: string | null;
  session: SessionInfo;
  onLaunch: (app: AppDefinition) => void;
  onSelectWindow: (id: string) => void;
  onDisconnect: () => void;
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="text-xs tabular-nums text-muted-foreground">
      {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </span>
  );
}

export function Taskbar({
  t,
  apps,
  unsupported,
  windows,
  activeId,
  session,
  onLaunch,
  onSelectWindow,
  onDisconnect,
}: TaskbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const host = session.host;
  const os = session.os.prettyName ?? session.os.family;

  return (
    <footer className="flex h-12 shrink-0 items-center gap-2 border-t bg-card/80 px-2 backdrop-blur">
      {/* Start menu — Windows-XP-style arrangement (header / alphabetical app list /
          footer), DeskSSH's flat visual style (FR-011). */}
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <LayoutGrid className="size-4" aria-hidden /> {t('desktop.start')}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" side="top" className="w-72 overflow-hidden p-0">
          {/* Header: session identity */}
          <div className="flex items-center gap-3 bg-primary/10 px-4 py-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/20 text-primary">
              <Server className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{host}</div>
              <div className="truncate text-xs text-muted-foreground">{os}</div>
            </div>
          </div>

          {/* App list — the single column (identity lives only in the header above) */}
          <div className="p-2">
            <div className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {t('desktop.apps')}
            </div>
            <div className="max-h-80 overflow-auto">
              {[...apps]
                .sort((a, b) => a.title.localeCompare(b.title))
                .map((app) => {
                  const Icon = app.icon;
                  const reason = unsupported?.[app.id];
                  if (reason) {
                    return (
                      <div
                        key={app.id}
                        title={reason}
                        aria-disabled
                        className="flex w-full cursor-not-allowed items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm opacity-40"
                      >
                        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate">{app.title}</span>
                      </div>
                    );
                  }
                  return (
                    <button
                      key={app.id}
                      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        onLaunch(app);
                        setMenuOpen(false);
                      }}
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate">{app.title}</span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Footer: disconnect */}
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-destructive hover:text-destructive"
              onClick={() => {
                setMenuOpen(false);
                onDisconnect();
              }}
            >
              <LogOut className="size-4" aria-hidden /> {t('desktop.disconnect')}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="h-6" />

      <div className="flex flex-1 items-center gap-1 overflow-x-auto">
        {windows.map((win) => {
          const Icon = win.icon;
          return (
            <button
              key={win.id}
              onClick={() => onSelectWindow(win.id)}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-xs',
                win.id === activeId && !win.minimized
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/60',
              )}
            >
              <Icon className="size-4" aria-hidden />
              <span className="max-w-32 truncate">{win.title}</span>
            </button>
          );
        })}
      </div>

      <Separator orientation="vertical" className="h-6" />
      <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
        <Server className="size-3.5" aria-hidden /> {host}
      </span>
      <Clock />
      <Button variant="ghost" size="sm" className="gap-2" onClick={onDisconnect}>
        <LogOut className="size-4" aria-hidden /> {t('desktop.disconnect')}
      </Button>
    </footer>
  );
}
