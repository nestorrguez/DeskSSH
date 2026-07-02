// Appearance for the Settings panel (spec 002, FR-250 / E8.2). The theme system is
// the shadcn token set already defined in `index.css`: light tokens on `:root`, dark
// tokens under `.dark`. We switch by toggling the `dark` class on <html>. Three
// modes: light, dark, and system (follows the OS via `prefers-color-scheme`). The
// choice is a per-device UI preference, so it persists in localStorage — not in
// `~/.deskssh/` (server-side persistence is for enable/disable + default-handler,
// E10). Richer multi-accent theming is deferred (phase 2).

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'deskssh.theme';
const DEFAULT_THEME: Theme = 'system';

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

/** The persisted theme, or `system` when unset/unavailable. */
export function getStoredTheme(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (isTheme(value)) return value;
  } catch {
    // localStorage may be blocked (private mode); fall through to the default.
  }
  return DEFAULT_THEME;
}

function prefersDark(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Reflect a theme onto <html> by toggling the `dark` class. */
export function applyTheme(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'system' && prefersDark());
  document.documentElement.classList.toggle('dark', dark);
}

/** Persist and apply a theme choice. */
export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore persistence failures; the in-page change below still applies.
  }
  applyTheme(theme);
}

/**
 * Apply the stored theme once at startup and keep `system` in sync with OS changes.
 * Call before first paint (in `main.tsx`) to avoid a flash of the wrong theme.
 */
export function initTheme(): void {
  applyTheme(getStoredTheme());
  if (typeof matchMedia !== 'undefined') {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getStoredTheme() === 'system') applyTheme('system');
    });
  }
}
