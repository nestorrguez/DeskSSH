// Boot-time app-plugin loader (spec 002, FR-210/251 / E10.4e). The gateway advertises
// the installed, compatible app plugins; the Desk dynamically imports each entry, whose
// module self-registers via the shared `@deskssh/app-runtime` (registerApp). Run once
// before the first render so the launcher already includes plugins. Failure-isolated: a
// plugin that 404s or throws is logged and skipped — never blocks the Desk (Art. 7).

import { getAppPlugins } from '@/api/gateway';

export async function loadAppPlugins(): Promise<void> {
  let apps;
  try {
    apps = (await getAppPlugins()).apps;
  } catch {
    return; // No gateway / no plugins endpoint → boot with built-ins only.
  }
  await Promise.all(
    apps.map(async (app) => {
      try {
        // The entry is a gateway URL (/api/plugins/apps/<id>/…) resolved at runtime, not
        // a build-time module — keep Vite from trying to bundle it.
        await import(/* @vite-ignore */ app.entry);
      } catch (err) {
        console.error(`Failed to load app plugin "${app.id}" from ${app.entry}`, err);
      }
    }),
  );
}
