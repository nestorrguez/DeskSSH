import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Translator } from '@/i18n';
import type { SessionInfo } from '@/api/gateway';

/** Context handed to an app when it renders inside a window. */
export interface AppContext {
  t: Translator;
  session: SessionInfo;
  /** The file the editor (Stallman) should open, set via {@link openEditor}. */
  editorTarget: string | null;
  /** Open a file in the editor app from anywhere (e.g. the file manager). */
  openEditor: (path: string) => void;
  /** The image the viewer should open, set via {@link openImage}. */
  imageTarget: string | null;
  /** Open an image in the viewer app from anywhere (e.g. the file manager). */
  openImage: (path: string) => void;
}

/** A launchable desktop app (file manager, terminal, …). */
export interface AppDefinition {
  readonly id: string;
  readonly title: string;
  readonly icon: LucideIcon;
  /** Initial window size in pixels. */
  readonly defaultSize?: { readonly w: number; readonly h: number };
  readonly render: (ctx: AppContext) => ReactNode;
}

/** A live window instance on the desktop. */
export interface WindowState {
  readonly id: string;
  readonly appId: string;
  readonly title: string;
  readonly icon: LucideIcon;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
}
