import {
  Folder,
  Info,
  TerminalSquare,
  Activity,
  FileText,
  PenLine,
  Image,
  FileType,
  Heart,
} from 'lucide-react';
import type { Translator } from '@/i18n';
import type { AppDefinition } from '../types';
import { FilesApp } from './FilesApp';
import { MonitorApp } from './MonitorApp';
import { SystemApp } from './SystemApp';
import { StallmanApp } from './StallmanApp';
import { DocumentsApp } from './DocumentsApp';
import { TerminalApp } from './TerminalApp';
import { ImageViewerApp } from './ImageViewerApp';
import { PdfViewerApp } from './PdfViewerApp';
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
      id: 'docs',
      title: t('apps.docs'),
      icon: PenLine,
      defaultSize: { w: 640, h: 520 },
      render: (ctx) => <DocumentsApp {...ctx} />,
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
      id: 'viewer',
      title: t('apps.viewer'),
      icon: Image,
      defaultSize: { w: 600, h: 480 },
      render: (ctx) => <ImageViewerApp {...ctx} />,
    },
    {
      id: 'pdf',
      title: t('apps.pdf'),
      icon: FileType,
      defaultSize: { w: 640, h: 560 },
      render: (ctx) => <PdfViewerApp {...ctx} />,
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
