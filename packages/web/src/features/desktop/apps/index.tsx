import { Folder, Info, TerminalSquare, Activity, FileText, Heart } from 'lucide-react';
import type { Translator } from '@/i18n';
import type { AppDefinition } from '../types';
import { FilesApp } from './FilesApp';
import { MonitorApp } from './MonitorApp';
import { SystemApp } from './SystemApp';
import { StallmanApp } from './StallmanApp';
import { TerminalApp } from './TerminalApp';
import { CreditsApp } from './CreditsApp';

/** The apps available in the launcher. */
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
      defaultSize: { w: 640, h: 420 },
      render: (ctx) => <TerminalApp {...ctx} />,
    },
    {
      id: 'credits',
      title: t('apps.credits'),
      icon: Heart,
      defaultSize: { w: 480, h: 520 },
      render: (ctx) => <CreditsApp {...ctx} />,
    },
  ];
}
