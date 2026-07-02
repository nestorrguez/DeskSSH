// Accent colour and font for the Settings → Appearance section (spec 002, FR-250).
// Both are per-device UI preferences (localStorage), applied by overriding CSS:
//   • accent → inline `--primary`/`--ring`/`--primary-foreground` on <html> (wins over
//     the light/dark token sets, so it tints buttons, rings and selected states);
//   • font  → `font-family` on <body> (overrides the base stylesheet rule).
// All stacks are system/generic families — nothing is downloaded (offline-friendly).

export type AccentId = 'default' | 'blue' | 'green' | 'violet' | 'rose' | 'amber';
export type FontId = 'system' | 'sans' | 'serif' | 'mono';

const ACCENT_KEY = 'deskssh.accent';
const FONT_KEY = 'deskssh.font';

/** `color` null = keep the built-in zinc tokens; `swatch` is the preview colour. */
export const ACCENTS: { id: AccentId; color: string | null; swatch: string }[] = [
  { id: 'default', color: null, swatch: 'oklch(0.55 0.01 286)' },
  { id: 'blue', color: 'oklch(0.55 0.2 255)', swatch: 'oklch(0.55 0.2 255)' },
  { id: 'green', color: 'oklch(0.6 0.15 155)', swatch: 'oklch(0.6 0.15 155)' },
  { id: 'violet', color: 'oklch(0.55 0.22 290)', swatch: 'oklch(0.55 0.22 290)' },
  { id: 'rose', color: 'oklch(0.6 0.22 12)', swatch: 'oklch(0.6 0.22 12)' },
  { id: 'amber', color: 'oklch(0.7 0.16 65)', swatch: 'oklch(0.7 0.16 65)' },
];

export const FONTS: { id: FontId; stack: string }[] = [
  { id: 'system', stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { id: 'sans', stack: "Arial, Helvetica, 'Helvetica Neue', sans-serif" },
  { id: 'serif', stack: "Georgia, Cambria, 'Times New Roman', Times, serif" },
  { id: 'mono', stack: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
];

const isAccent = (v: unknown): v is AccentId => ACCENTS.some((a) => a.id === v);
const isFont = (v: unknown): v is FontId => FONTS.some((f) => f.id === v);

export function getStoredAccent(): AccentId {
  try {
    const v = localStorage.getItem(ACCENT_KEY);
    if (isAccent(v)) return v;
  } catch {
    // localStorage blocked; fall through.
  }
  return 'default';
}

export function getStoredFont(): FontId {
  try {
    const v = localStorage.getItem(FONT_KEY);
    if (isFont(v)) return v;
  } catch {
    // localStorage blocked; fall through.
  }
  return 'system';
}

export function applyAccent(id: AccentId): void {
  const root = document.documentElement;
  const color = ACCENTS.find((a) => a.id === id)?.color ?? null;
  if (color) {
    root.style.setProperty('--primary', color);
    root.style.setProperty('--ring', color);
    root.style.setProperty('--primary-foreground', 'oklch(0.985 0 0)');
  } else {
    root.style.removeProperty('--primary');
    root.style.removeProperty('--ring');
    root.style.removeProperty('--primary-foreground');
  }
}

export function applyFont(id: FontId): void {
  const stack = FONTS.find((f) => f.id === id)?.stack;
  if (stack) document.body.style.fontFamily = stack;
}

export function setAccent(id: AccentId): void {
  try {
    localStorage.setItem(ACCENT_KEY, id);
  } catch {
    // Ignore persistence failures.
  }
  applyAccent(id);
}

export function setFont(id: FontId): void {
  try {
    localStorage.setItem(FONT_KEY, id);
  } catch {
    // Ignore persistence failures.
  }
  applyFont(id);
}

/** Apply stored accent + font once at startup (call from `main.tsx`). */
export function initAppearance(): void {
  applyAccent(getStoredAccent());
  applyFont(getStoredFont());
}
