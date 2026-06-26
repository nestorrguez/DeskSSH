// English catalog (source of truth). Every user-facing string lives here so the
// UI is i18n-ready from day 1 (constitution-aligned: EN + ES ship in v1).
export const en = {
  'app.tagline': 'A graphical desktop over plain SSH',
  'app.status.scaffolding': 'Scaffolding — no functionality yet',
} as const;

export type MessageKey = keyof typeof en;
