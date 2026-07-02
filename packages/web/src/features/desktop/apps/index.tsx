import {
  Folder,
  Info,
  TerminalSquare,
  Activity,
  FileText,
  PenLine,
  Image,
  FileType,
  History,
} from 'lucide-react';
import { FIRST_PARTY_AUTHOR } from '@/lib/author';
import { registerApp, getApps } from './registry';
import { FilesApp } from './FilesApp';
import { MonitorApp } from './MonitorApp';
import { SystemApp } from './SystemApp';
import { StallmanApp } from './StallmanApp';
import { DocumentsApp } from './DocumentsApp';
import { TerminalApp } from './TerminalApp';
import { ImageViewerApp } from './ImageViewerApp';
import { PdfViewerApp } from './PdfViewerApp';
import { CommandHistoryApp } from './CommandHistoryApp';

// Shared metadata for the bundled (first-party) apps. Each carries its own version
// line (FR-241) but built-ins move together for now.
const builtIn = { author: FIRST_PARTY_AUTHOR, version: '0.1.0', contract: '^0.1.0' } as const;

// Built-in apps register into the registry on import. `capabilities` lists the
// contract methods each app needs, so the desktop can graceful-degrade against the
// connected host's adapter (FR-203/211, E4.3); an empty list means always available.
registerApp((t) => ({
  id: 'files',
  title: t('apps.files'),
  icon: Folder,
  description: t('apps.files.desc'),
  category: 'files',
  capabilities: [
    'listDir',
    'stat',
    'readFile',
    'writeFile',
    'makeDir',
    'createFile',
    'move',
    'copy',
    'remove',
  ],
  ...builtIn,
  defaultSize: { w: 520, h: 460 },
  render: (ctx) => <FilesApp {...ctx} />,
}));

registerApp((t) => ({
  id: 'editor',
  title: t('apps.editor'),
  icon: FileText,
  description: t('apps.editor.desc'),
  category: 'editors',
  capabilities: ['readFile', 'writeFile'],
  credits: [
    {
      name: 'Monaco Editor',
      license: 'MIT',
      author: 'Microsoft',
      url: 'https://microsoft.github.io/monaco-editor',
    },
  ],
  ...builtIn,
  defaultSize: { w: 600, h: 480 },
  render: (ctx) => <StallmanApp {...ctx} />,
}));

registerApp((t) => ({
  id: 'docs',
  title: t('apps.docs'),
  icon: PenLine,
  description: t('apps.docs.desc'),
  category: 'editors',
  capabilities: ['readFile', 'writeFile'],
  credits: [
    {
      name: 'TipTap',
      license: 'MIT',
      author: 'Tiptap GmbH',
      url: 'https://tiptap.dev',
    },
  ],
  ...builtIn,
  defaultSize: { w: 640, h: 520 },
  render: (ctx) => <DocumentsApp {...ctx} />,
}));

registerApp((t) => ({
  id: 'monitor',
  title: t('apps.monitor'),
  icon: Activity,
  description: t('apps.monitor.desc'),
  category: 'system',
  capabilities: ['systemMetrics', 'listProcesses', 'signalProcess'],
  ...builtIn,
  defaultSize: { w: 460, h: 360 },
  render: (ctx) => <MonitorApp {...ctx} />,
}));

registerApp((t) => ({
  id: 'system',
  title: t('apps.system'),
  icon: Info,
  description: t('apps.system.desc'),
  category: 'system',
  capabilities: ['systemInfo'],
  ...builtIn,
  defaultSize: { w: 520, h: 380 },
  render: (ctx) => <SystemApp {...ctx} />,
}));

registerApp((t) => ({
  id: 'history',
  title: t('apps.history'),
  icon: History,
  description: t('apps.history.desc'),
  category: 'system',
  capabilities: [],
  ...builtIn,
  defaultSize: { w: 600, h: 440 },
  render: (ctx) => <CommandHistoryApp {...ctx} />,
}));

registerApp((t) => ({
  id: 'terminal',
  title: t('apps.terminal'),
  icon: TerminalSquare,
  description: t('apps.terminal.desc'),
  category: 'system',
  capabilities: [],
  credits: [
    {
      name: 'xterm.js',
      license: 'MIT',
      author: 'The xterm.js authors',
      url: 'https://xtermjs.org',
    },
  ],
  ...builtIn,
  defaultSize: { w: 640, h: 420 },
  render: (ctx) => <TerminalApp {...ctx} />,
}));

registerApp((t) => ({
  id: 'viewer',
  title: t('apps.viewer'),
  icon: Image,
  description: t('apps.viewer.desc'),
  category: 'viewers',
  capabilities: ['readFile'],
  ...builtIn,
  defaultSize: { w: 600, h: 480 },
  render: (ctx) => <ImageViewerApp {...ctx} />,
}));

registerApp((t) => ({
  id: 'pdf',
  title: t('apps.pdf'),
  icon: FileType,
  description: t('apps.pdf.desc'),
  category: 'viewers',
  capabilities: ['readFile'],
  credits: [
    {
      name: 'pdf.js',
      license: 'Apache-2.0',
      author: 'Mozilla',
      url: 'https://mozilla.github.io/pdf.js',
    },
  ],
  ...builtIn,
  defaultSize: { w: 640, h: 560 },
  render: (ctx) => <PdfViewerApp {...ctx} />,
}));

export { getApps };
