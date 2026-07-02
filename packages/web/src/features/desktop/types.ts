import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Author, CapabilityName } from '@deskssh/core';
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
  /** The PDF the viewer should open, set via {@link openPdf}. */
  pdfTarget: string | null;
  /** Open a PDF in the viewer app from anywhere (e.g. the file manager). */
  openPdf: (path: string) => void;
  /** The document the Documents editor should open, set via {@link openDoc}. */
  docTarget: string | null;
  /** Open a file in the Documents (rich-text) editor from anywhere. */
  openDoc: (path: string) => void;
  /** Directory the terminal should start in, set via {@link openTerminal}. */
  terminalCwd: string | null;
  /** Bumped on each {@link openTerminal} call so an open terminal can re-target. */
  terminalReq: number;
  /** Open the terminal in a directory from anywhere (e.g. the file manager). */
  openTerminal: (path: string) => void;
}

/** A third-party library an app (or the Desk) builds on, shown for attribution (FR-220). */
export interface LibraryCredit {
  /** Library name, e.g. `Monaco Editor`. */
  readonly name: string;
  /** Optional short role, e.g. `Code editor`. Shown only if the caller provides it. */
  readonly use?: string;
  /** SPDX license id, e.g. `MIT`. Must be AGPL-compatible. */
  readonly license: string;
  /** Project URL. */
  readonly url?: string;
  /** Author/maintainer, when known. */
  readonly author?: string;
}

/** A launchable desktop app (file manager, terminal, …). */
export interface AppDefinition {
  readonly id: string;
  readonly title: string;
  readonly icon: LucideIcon;
  /** What the app does, shown in the Settings panel detail (i18n'd). */
  readonly description: string;
  /** The app's own semver, versioned independently of the Desk (FR-241). */
  readonly version: string;
  /** The Contract range the app requires, e.g. `^0.1.0` (FR-241). */
  readonly contract: string;
  /** Who authored the app, for the Settings panel (FR-242). */
  readonly author: Author;
  /** Grouping for the launcher/Settings (FR-211); UI grouping is future. */
  readonly category?: string;
  /** Contract capabilities the app needs; used to graceful-degrade against the
   *  connected host's adapter (FR-203/211/220). Empty = always available. */
  readonly capabilities?: readonly CapabilityName[];
  /** Third-party libraries the app builds on, shown in the Settings detail view (FR-220).
   *  Plugins may declare their own. Shared Desk/shell libraries live in the About section. */
  readonly credits?: readonly LibraryCredit[];
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
