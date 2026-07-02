import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Cpu,
  Info,
  LayoutGrid,
  Languages,
  Monitor,
  Moon,
  PackagePlus,
  Palette,
  Sun,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Author } from '@deskssh/core';
import type { Locale, MessageKey, Translator } from '@/i18n';
import { LOCALE_INFO, SUPPORTED_LOCALES } from '@/i18n';
import {
  getAdapters,
  getVersions,
  importPlugin,
  importAppZip,
  listPlugins,
  setPluginEnabled as setPluginEnabledApi,
  uninstallPlugin,
  type PluginStatus,
} from '@/api/gateway';
import { APP_VERSION } from '@/version';
import type { AdapterInfo } from '@deskssh/core';
import { getApps } from '@/features/desktop/apps/index';
import type { AppDefinition, LibraryCredit } from '@/features/desktop/types';
import { getStoredTheme, setTheme, type Theme } from './theme';
import {
  ACCENTS,
  FONTS,
  getStoredAccent,
  getStoredFont,
  setAccent,
  setFont,
  type AccentId,
  type FontId,
} from './appearance';
import { getDisabledApps, setAppEnabled } from './apps';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

// The pre-login Settings panel (spec 002, FR-250 / E8). A sidebar layout: section nav
// on the left, a stable-height content panel on the right. Appearance (theme, accent,
// font), Adapters and Apps (inventory with author/version; apps open a detail view on
// click where they can be enabled/disabled), and Language. All preferences persist
// per-device (localStorage). Verified badges and the default-handler selector arrive
// with E11/E5.

type SectionId = 'appearance' | 'adapters' | 'apps' | 'import' | 'language' | 'about';

const SECTIONS: { id: SectionId; icon: LucideIcon; labelKey: MessageKey }[] = [
  { id: 'appearance', icon: Palette, labelKey: 'settings.tab.appearance' },
  { id: 'adapters', icon: Cpu, labelKey: 'settings.tab.adapters' },
  { id: 'apps', icon: LayoutGrid, labelKey: 'settings.tab.apps' },
  { id: 'import', icon: PackagePlus, labelKey: 'settings.tab.import' },
  { id: 'language', icon: Languages, labelKey: 'settings.tab.language' },
  { id: 'about', icon: Info, labelKey: 'settings.tab.about' },
];

const THEME_OPTIONS: { value: Theme; labelKey: MessageKey; icon: LucideIcon }[] = [
  { value: 'light', labelKey: 'settings.theme.light', icon: Sun },
  { value: 'dark', labelKey: 'settings.theme.dark', icon: Moon },
  { value: 'system', labelKey: 'settings.theme.system', icon: Monitor },
];

const ACCENT_LABEL: Record<AccentId, MessageKey> = {
  default: 'settings.accent.default',
  blue: 'settings.accent.blue',
  green: 'settings.accent.green',
  violet: 'settings.accent.violet',
  rose: 'settings.accent.rose',
  amber: 'settings.accent.amber',
};

const FONT_LABEL: Record<FontId, MessageKey> = {
  system: 'settings.font.system',
  sans: 'settings.font.sans',
  serif: 'settings.font.serif',
  mono: 'settings.font.mono',
};

interface Props {
  t: Translator;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

// The third-party libraries DeskSSH itself (Desk shell + backend) builds on. App-specific
// libraries live on each app's `credits` (shown in its detail view). Every entry ships
// under an AGPL-compatible license (MIT / ISC / Apache-2.0). License/author from each
// package's `package.json`.
const DESKSSH_CREDITS: readonly LibraryCredit[] = [
  { name: 'React', license: 'MIT', author: 'Meta', url: 'https://react.dev' },
  { name: 'Radix UI', license: 'MIT', author: 'WorkOS', url: 'https://www.radix-ui.com' },
  { name: 'shadcn/ui', license: 'MIT', author: 'shadcn', url: 'https://ui.shadcn.com' },
  { name: 'Tailwind CSS', license: 'MIT', author: 'Tailwind Labs', url: 'https://tailwindcss.com' },
  { name: 'Lucide', license: 'ISC', author: 'Lucide', url: 'https://lucide.dev' },
  {
    name: 'class-variance-authority',
    license: 'Apache-2.0',
    author: 'Joe Bell',
    url: 'https://cva.style',
  },
  { name: 'clsx', license: 'MIT', author: 'Luke Edwards', url: 'https://github.com/lukeed/clsx' },
  {
    name: 'tailwind-merge',
    license: 'MIT',
    author: 'Dany Castillo',
    url: 'https://github.com/dcastil/tailwind-merge',
  },
  { name: 'ssh2', license: 'MIT', author: 'Brian White', url: 'https://github.com/mscdex/ssh2' },
  {
    name: 'ws',
    license: 'MIT',
    author: 'Einar Otto Stangvik',
    url: 'https://github.com/websockets/ws',
  },
  {
    name: 'fflate',
    license: 'MIT',
    author: 'Arjun Barrett',
    url: 'https://github.com/101arrowz/fflate',
  },
];

/** A list of third-party library credits (name, role/author, license). */
function CreditList({ credits }: { credits: readonly LibraryCredit[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-md border">
      {credits.map((c) => {
        const meta = [c.use, c.author].filter(Boolean).join(' · ');
        return (
          <li key={c.name} className="flex items-center gap-3 px-3 py-2">
            {c.url ? (
              <a
                className="shrink-0 font-medium text-primary underline-offset-4 hover:underline"
                href={c.url}
                target="_blank"
                rel="noreferrer"
              >
                {c.name}
              </a>
            ) : (
              <span className="shrink-0 font-medium">{c.name}</span>
            )}
            <span className="flex-1 truncate text-xs text-muted-foreground">{meta}</span>
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              {c.license}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Heading shown at the top of each content section. */
function SectionHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-4 flex flex-col gap-0.5">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

/** The author's name, linking to their GitHub profile or email when present. */
function AuthorLink({ author }: { author: Author }) {
  const href = author.github
    ? author.github.startsWith('http')
      ? author.github
      : `https://github.com/${author.github.replace(/^@/, '')}`
    : author.email
      ? `mailto:${author.email}`
      : undefined;
  if (!href) return <span>{author.name}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-foreground underline-offset-2 hover:underline"
    >
      {author.name}
    </a>
  );
}

/** One label/value row in a detail view. */
function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2.5 last:border-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm">{children}</dd>
    </div>
  );
}

/** A small on/off switch. */
function Toggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        on ? 'bg-primary' : 'bg-muted-foreground/30',
      )}
    >
      <span
        className={cn(
          'inline-block size-5 rounded-full bg-background shadow transition-transform',
          on ? 'translate-x-[1.375rem]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

export function SettingsDialog({ t, locale, onLocaleChange }: Props) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<SectionId>('appearance');
  const [adapters, setAdapters] = useState<AdapterInfo[] | null>(null);
  const [error, setError] = useState(false);
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  const [accent, setAccentState] = useState<AccentId>(getStoredAccent);
  const [font, setFontState] = useState<FontId>(getStoredFont);
  const [selectedApp, setSelectedApp] = useState<AppDefinition | null>(null);
  const [disabledApps, setDisabledApps] = useState<Set<string>>(() => getDisabledApps());
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [installed, setInstalled] = useState<PluginStatus[] | null>(null);
  const [versions, setVersions] = useState<{ contract: string; appRuntime: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const apps = getApps(t);

  useEffect(() => {
    // Fetch adapters only when their section is first viewed, then cache.
    if (!open || section !== 'adapters' || adapters || error) return;
    getAdapters()
      .then((r) => setAdapters(r.adapters))
      .catch(() => setError(true));
  }, [open, section, adapters, error]);

  const refreshInstalled = (): void => {
    listPlugins()
      .then((r) => setInstalled(r.plugins))
      .catch(() => setInstalled([]));
  };

  useEffect(() => {
    // Fetch the installed-plugins inventory whenever the Import section is opened.
    if (open && section === 'import') refreshInstalled();
  }, [open, section]);

  useEffect(() => {
    // Fetch the Desk's Contract + app-runtime versions on first view of About, then cache.
    if (!open || section !== 'about' || versions) return;
    getVersions()
      .then(setVersions)
      .catch(() => setVersions(null));
  }, [open, section, versions]);

  async function toggleInstalled(p: PluginStatus, enabled: boolean): Promise<void> {
    await setPluginEnabledApi(p.kind, p.id, enabled);
    refreshInstalled();
  }
  async function removeInstalled(p: PluginStatus): Promise<void> {
    await uninstallPlugin(p.kind, p.id);
    refreshInstalled();
  }

  function chooseTheme(next: Theme): void {
    setTheme(next);
    setThemeState(next);
  }
  function chooseAccent(next: AccentId): void {
    setAccent(next);
    setAccentState(next);
  }
  function chooseFont(next: FontId): void {
    setFont(next);
    setFontState(next);
  }
  function goTo(next: SectionId): void {
    setSelectedApp(null);
    setSection(next);
  }
  function toggleApp(id: string, enabled: boolean): void {
    setAppEnabled(id, enabled);
    setDisabledApps((prev) => {
      const next = new Set(prev);
      if (enabled) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setImportMsg(null);
    const isZip = file.name.toLowerCase().endsWith('.zip');
    const isJson = file.name.toLowerCase().endsWith('.json');
    if (!isZip && !isJson) {
      setImportMsg({ ok: false, text: t('settings.import.invalidFile') });
      return;
    }
    try {
      let r;
      if (isZip) {
        // App plugin: ship the raw .zip to the gateway to extract + validate (E10.2b).
        r = await importAppZip(await file.arrayBuffer());
      } else {
        let parsed: unknown;
        try {
          parsed = JSON.parse(await file.text());
        } catch {
          setImportMsg({ ok: false, text: t('settings.import.invalidJson') });
          return;
        }
        r = await importPlugin(parsed);
      }
      setImportMsg({ ok: true, text: t('settings.import.success', { name: r.name }) });
      refreshInstalled();
    } catch (err) {
      setImportMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSelectedApp(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Palette className="size-4" aria-hidden /> {t('settings.button')}
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('settings.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="flex h-[28rem]">
          {/* Section nav */}
          <nav className="flex w-44 shrink-0 flex-col gap-1 border-r bg-muted/30 p-2">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const active = section === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-current={active}
                  onClick={() => goTo(s.id)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition',
                    active
                      ? 'bg-background font-medium text-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden /> {t(s.labelKey)}
                </button>
              );
            })}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {section === 'appearance' && (
              <div className="flex flex-col gap-6">
                {/* Theme */}
                <div>
                  <SectionHeader title={t('settings.theme')} hint={t('settings.themeHint')} />
                  <div className="grid grid-cols-3 gap-3">
                    {THEME_OPTIONS.map((o) => {
                      const Icon = o.icon;
                      const isActive = theme === o.value;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => chooseTheme(o.value)}
                          className={cn(
                            'relative flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition',
                            isActive
                              ? 'border-primary bg-primary/5 font-medium ring-2 ring-primary/20'
                              : 'text-muted-foreground hover:border-foreground/20 hover:bg-muted/50 hover:text-foreground',
                          )}
                        >
                          {isActive && (
                            <Check
                              className="absolute right-2 top-2 size-3.5 text-primary"
                              aria-hidden
                            />
                          )}
                          <Icon className="size-5" aria-hidden /> {t(o.labelKey)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Accent colour */}
                <div>
                  <h4 className="mb-2 text-sm font-medium">{t('settings.accent')}</h4>
                  <div className="flex flex-wrap gap-3">
                    {ACCENTS.map((a) => {
                      const isActive = accent === a.id;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          aria-label={t(ACCENT_LABEL[a.id])}
                          aria-pressed={isActive}
                          title={t(ACCENT_LABEL[a.id])}
                          onClick={() => chooseAccent(a.id)}
                          className={cn(
                            'flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition',
                            isActive && 'ring-2 ring-foreground/50',
                          )}
                          style={{ backgroundColor: a.swatch }}
                        >
                          {isActive && <Check className="size-4 text-white" aria-hidden />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Font */}
                <div>
                  <h4 className="mb-2 text-sm font-medium">{t('settings.font')}</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {FONTS.map((f) => {
                      const isActive = font === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => chooseFont(f.id)}
                          style={{ fontFamily: f.stack }}
                          className={cn(
                            'rounded-lg border px-2 py-3 text-sm transition',
                            isActive
                              ? 'border-primary bg-primary/5 font-medium ring-2 ring-primary/20'
                              : 'text-muted-foreground hover:border-foreground/20 hover:bg-muted/50 hover:text-foreground',
                          )}
                        >
                          {t(FONT_LABEL[f.id])}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {section === 'adapters' && (
              <div>
                <SectionHeader title={t('ext.adapters')} hint={t('ext.adaptersHint')} />
                {error ? (
                  <p className="text-sm text-destructive">{t('ext.error')}</p>
                ) : !adapters ? (
                  <p className="text-sm text-muted-foreground">{t('ext.loading')}</p>
                ) : adapters.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('ext.empty')}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {adapters.map((a) => (
                      <li key={a.id} className="rounded-lg border bg-muted/30 px-3.5 py-2.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium">{a.label}</span>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">
                            v{a.version}
                          </span>
                        </div>
                        {a.osSupport.length > 0 && (
                          <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                            {a.osSupport.join(' · ')}
                          </div>
                        )}
                        <div className="mt-1 text-xs text-muted-foreground">
                          {t('settings.author')}: <AuthorLink author={a.author} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {section === 'apps' &&
              (selectedApp ? (
                <AppDetail
                  t={t}
                  app={selectedApp}
                  enabled={!disabledApps.has(selectedApp.id)}
                  onToggle={(on) => toggleApp(selectedApp.id, on)}
                  onBack={() => setSelectedApp(null)}
                />
              ) : (
                <div>
                  <SectionHeader title={t('ext.apps')} hint={t('settings.appDetailHint')} />
                  <ul className="grid grid-cols-2 gap-2">
                    {apps.map((app) => {
                      const Icon = app.icon;
                      const enabled = !disabledApps.has(app.id);
                      return (
                        <li key={app.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedApp(app)}
                            className={cn(
                              'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition',
                              enabled
                                ? 'bg-muted/40 hover:border-foreground/20 hover:bg-muted/70'
                                : 'border-dashed bg-transparent text-muted-foreground opacity-50 hover:opacity-75',
                            )}
                          >
                            <Icon className="size-4 shrink-0" aria-hidden />
                            <span className="truncate">{app.title}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

            {section === 'import' && (
              <div>
                <SectionHeader
                  title={t('settings.import.title')}
                  hint={t('settings.import.hint')}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json,.zip,application/zip"
                  className="hidden"
                  onChange={onImportFile}
                />
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => fileRef.current?.click()}
                >
                  <PackagePlus className="size-4" aria-hidden /> {t('settings.import.pick')}
                </Button>
                {importMsg && (
                  <p
                    className={cn(
                      'mt-3 text-sm',
                      importMsg.ok ? 'text-foreground' : 'text-destructive',
                    )}
                  >
                    {importMsg.text}
                  </p>
                )}
                <p className="mt-4 text-xs text-muted-foreground">{t('settings.import.note')}</p>

                {/* Installed extensions: enable/disable + uninstall (E10.3b). */}
                <div className="mt-8">
                  <h4 className="mb-1 text-sm font-medium">{t('settings.manage.title')}</h4>
                  <p className="mb-3 text-xs text-muted-foreground">{t('settings.manage.hint')}</p>
                  {installed && installed.length > 0 ? (
                    <ul className="flex flex-col gap-2">
                      {installed.map((p) => (
                        <li
                          key={`${p.kind}:${p.id}`}
                          className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="truncate font-medium">{p.name}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {p.kind} · v{p.version}
                              </span>
                            </div>
                            {!p.compatible && (
                              <span className="text-xs text-destructive">
                                {t('settings.manage.incompatible')}
                                {p.reason ? `: ${p.reason}` : ''}
                              </span>
                            )}
                          </div>
                          <Toggle on={p.enabled} onChange={(on) => void toggleInstalled(p, on)} />
                          <button
                            type="button"
                            aria-label={t('settings.manage.uninstall')}
                            title={t('settings.manage.uninstall')}
                            onClick={() => void removeInstalled(p)}
                            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('settings.manage.empty')}</p>
                  )}
                  {installed && installed.length > 0 && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {t('settings.manage.reloadNote')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {section === 'language' && (
              <div>
                <SectionHeader title={t('settings.language')} hint={t('settings.languageHint')} />
                <div className="flex flex-col gap-2">
                  {SUPPORTED_LOCALES.map((l) => {
                    const info = LOCALE_INFO[l];
                    const isActive = locale === l;
                    return (
                      <button
                        key={l}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => onLocaleChange(l)}
                        className={cn(
                          'flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition',
                          isActive
                            ? 'border-primary bg-primary/5'
                            : 'hover:border-foreground/20 hover:bg-muted/50',
                        )}
                      >
                        <span className="flex flex-col">
                          <span className={cn(isActive && 'font-medium')}>{info.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {t('settings.distributedBy')}: {info.translator.name}
                          </span>
                        </span>
                        {isActive && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {section === 'about' && (
              <div className="flex flex-col gap-6">
                <div>
                  <SectionHeader title={t('settings.about')} hint={t('settings.aboutHint')} />
                  <dl className="rounded-lg border px-4">
                    <MetaRow label={t('settings.about.desk')}>
                      <span className="font-mono">v{APP_VERSION}</span>
                    </MetaRow>
                    <MetaRow label={t('settings.about.contract')}>
                      <span className="font-mono">
                        {versions ? `v${versions.contract}` : t('ext.loading')}
                      </span>
                    </MetaRow>
                    <MetaRow label={t('settings.about.appRuntime')}>
                      <span className="font-mono">
                        {versions ? `v${versions.appRuntime}` : t('ext.loading')}
                      </span>
                    </MetaRow>
                    <MetaRow label={t('settings.about.license')}>
                      <a
                        className="text-primary underline-offset-4 hover:underline"
                        href="https://www.gnu.org/licenses/agpl-3.0.html"
                        target="_blank"
                        rel="noreferrer"
                      >
                        AGPL-3.0-or-later
                      </a>
                    </MetaRow>
                  </dl>
                  <p className="mt-4 text-xs text-muted-foreground">{t('settings.about.note')}</p>
                </div>

                {/* DeskSSH's own third-party libraries (per-app libs live in each app's detail). */}
                <div>
                  <h4 className="mb-2 text-sm font-medium">{t('settings.libraries')}</h4>
                  <CreditList credits={DESKSSH_CREDITS} />
                  <p className="mt-3 text-xs text-muted-foreground">{t('credits.thanks')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Expanded metadata for a single app (reached by clicking it), with an on/off toggle. */
function AppDetail({
  t,
  app,
  enabled,
  onToggle,
  onBack,
}: {
  t: Translator;
  app: AppDefinition;
  enabled: boolean;
  onToggle: (on: boolean) => void;
  onBack: () => void;
}) {
  const Icon = app.icon;
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> {t('settings.back')}
      </button>

      <div className={cn('flex items-center gap-3', !enabled && 'opacity-60')}>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
          <Icon className="size-5 text-muted-foreground" aria-hidden />
        </span>
        <div>
          <h3 className="text-base font-semibold">{app.title}</h3>
          <p className="text-sm text-muted-foreground">{app.description}</p>
        </div>
      </div>

      <dl className="rounded-lg border px-4">
        <MetaRow label={t('settings.appStatus')}>
          <span className="flex items-center justify-end gap-2">
            <span className={cn('text-sm', enabled ? 'text-foreground' : 'text-muted-foreground')}>
              {enabled ? t('settings.appActive') : t('settings.appInactive')}
            </span>
            <Toggle on={enabled} onChange={onToggle} />
          </span>
        </MetaRow>
        <MetaRow label={t('settings.author')}>
          <AuthorLink author={app.author} />
        </MetaRow>
        <MetaRow label={t('settings.version')}>
          <span className="font-mono">v{app.version}</span>
        </MetaRow>
        <MetaRow label={t('settings.contract')}>
          <span className="font-mono">{app.contract}</span>
        </MetaRow>
      </dl>

      {app.credits && app.credits.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium">{t('settings.libraries')}</h4>
          <CreditList credits={app.credits} />
        </div>
      )}
    </div>
  );
}
