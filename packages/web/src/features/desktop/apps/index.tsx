import { Folder, Info, TerminalSquare, Activity, FileText, Construction } from 'lucide-react';
import type { Translator } from '@/i18n';
import type { AppContext, AppDefinition } from '../types';
import { FilesApp } from './FilesApp';
import { MonitorApp } from './MonitorApp';
import { SystemApp } from './SystemApp';
import { StallmanApp } from './StallmanApp';

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

/** The apps available in the launcher. Terminal is a placeholder pending its slice. */
export function getApps(t: Translator): AppDefinition[] {
  return [
    {
      id: 'files',
      title: t('apps.files'),
      icon: Folder,
      defaultSize: { w: 520, h: 460 },
      render: (ctx) => <FilesApp {...ctx} />,
    },
    {
      id: 'editor',
      title: t('apps.editor'),
      icon: FileText,
      defaultSize: { w: 600, h: 480 },
      render: (ctx) => <StallmanApp {...ctx} />,
    },
    {
      id: 'monitor',
      title: t('apps.monitor'),
      icon: Activity,
      defaultSize: { w: 460, h: 360 },
      render: (ctx) => <MonitorApp {...ctx} />,
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
  ];
}
