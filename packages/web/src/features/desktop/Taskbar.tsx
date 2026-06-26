import { useEffect, useState } from 'react';
import { LayoutGrid, LogOut, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Translator } from '@/i18n';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { AppDefinition, WindowState } from './types';

interface TaskbarProps {
  t: Translator;
  apps: AppDefinition[];
  windows: WindowState[];
  activeId: string | null;
  host: string;
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
  windows,
  activeId,
  host,
  onLaunch,
  onSelectWindow,
  onDisconnect,
}: TaskbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <footer className="flex h-12 shrink-0 items-center gap-2 border-t bg-card/80 px-2 backdrop-blur">
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <LayoutGrid className="size-4" aria-hidden /> {t('desktop.start')}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" side="top" className="w-56 p-2">
          <div className="grid grid-cols-2 gap-1">
            {apps.map((app) => {
              const Icon = app.icon;
              return (
                <button
                  key={app.id}
                  className="flex flex-col items-center gap-2 rounded-md p-3 text-center text-xs hover:bg-accent"
                  onClick={() => {
                    onLaunch(app);
                    setMenuOpen(false);
                  }}
                >
                  <Icon className="size-6 text-muted-foreground" aria-hidden />
                  {app.title}
                </button>
              );
            })}
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
