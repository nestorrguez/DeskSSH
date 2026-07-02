// Per-device on/off state for desktop apps (Settings → Apps). The user disables an
// app in its detail view; disabled apps are dimmed there and hidden from the desktop
// launcher. This is a UI preference (localStorage), distinct from the plugin
// lifecycle enable/disable that arrives with E10. Stored as the set of *disabled*
// ids, so unknown/new apps default to enabled.

const KEY = 'deskssh.disabledApps';

function read(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    // Blocked or malformed; treat as none disabled.
  }
  return new Set();
}

function write(ids: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    // Ignore persistence failures.
  }
}

/** The set of disabled app ids. */
export function getDisabledApps(): Set<string> {
  return read();
}

/** Is the app enabled (the default for any unseen app)? */
export function isAppEnabled(id: string): boolean {
  return !read().has(id);
}

/** Enable or disable an app, persisting the choice. */
export function setAppEnabled(id: string, enabled: boolean): void {
  const ids = read();
  if (enabled) ids.delete(id);
  else ids.add(id);
  write(ids);
}
