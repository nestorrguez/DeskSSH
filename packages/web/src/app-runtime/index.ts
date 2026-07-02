// `@deskssh/app-runtime` — the versioned SDK app plugins compile against (spec 002,
// FR-210/241 / E10.4c). It is the **single shared instance** loaded once in the browser
// via the import map (`/runtime/app-runtime.js`): both the Desk and every dynamically
// imported app plugin resolve `@deskssh/app-runtime` to this module, so they share one
// app registry, one React (re-resolved through the same import map), one UI/icon set.
//
// Its semver is APP_RUNTIME_VERSION (core); a plugin manifest's `desk` range is checked
// against it. Keep this surface deliberate — every export here is public API that costs
// a version bump to change.

import type { Translator } from '@/i18n';
import type { AppDefinition } from '@/features/desktop/types';

/** Build an app's definition for a given locale (the translator resolves its strings). */
export type AppFactory = (t: Translator) => AppDefinition;

// The one registry. Lives here (not in the host bundle) so host built-ins and plugins
// register into the *same* array — the whole point of sharing this module (E10.4c).
const factories: AppFactory[] = [];

/** Register an app. Built-ins register on import; plugins on dynamic import. */
export function registerApp(factory: AppFactory): void {
  factories.push(factory);
}

/** Build every registered app for the given locale, de-duplicated by id. */
export function getApps(t: Translator): AppDefinition[] {
  const seen = new Set<string>();
  const apps: AppDefinition[] = [];
  for (const factory of factories) {
    const app = factory(t);
    if (seen.has(app.id)) continue; // first registration of an id wins
    seen.add(app.id);
    apps.push(app);
  }
  return apps;
}

// ── Re-exports for plugin authors (the "amplio" surface) ──────────────────────────

// Types the render contract is built from.
export type {
  AppDefinition,
  AppContext,
  WindowState,
  LibraryCredit,
} from '@/features/desktop/types';
export type { Translator, Locale, MessageKey } from '@/i18n';

// Icons: the full Lucide set, the Desk's icon vocabulary.
export * as icons from 'lucide-react';
export type { LucideIcon } from 'lucide-react';

// UI primitives (shadcn/Radix) so plugins look native without bundling their own.
export { Button } from '@/components/ui/button';
export {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
export { Input } from '@/components/ui/input';
export { Label } from '@/components/ui/label';
export { Separator } from '@/components/ui/separator';
export { ScrollArea } from '@/components/ui/scroll-area';
export { cn } from '@/lib/utils';

// Gateway client helpers: the capability calls plugins invoke against the host.
export * from '@/api/gateway';
