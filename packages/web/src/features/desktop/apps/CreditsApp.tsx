import { Heart } from 'lucide-react';
import { APP_VERSION } from '@/version';
import type { AppContext } from '../types';

// Acknowledgements for the third-party libraries DeskSSH builds on. Every entry
// here ships under an AGPL-compatible license (MIT / ISC / Apache-2.0), as required
// before integrating any third-party project.
interface Credit {
  name: string;
  license: string;
  use: string;
  url: string;
}

const CREDITS: Credit[] = [
  { name: 'React', license: 'MIT', use: 'UI framework', url: 'https://react.dev' },
  {
    name: 'Radix UI',
    license: 'MIT',
    use: 'Accessible primitives',
    url: 'https://www.radix-ui.com',
  },
  { name: 'shadcn/ui', license: 'MIT', use: 'Component patterns', url: 'https://ui.shadcn.com' },
  { name: 'Tailwind CSS', license: 'MIT', use: 'Styling', url: 'https://tailwindcss.com' },
  { name: 'Lucide', license: 'ISC', use: 'Icons', url: 'https://lucide.dev' },
  { name: 'xterm.js', license: 'MIT', use: 'Terminal', url: 'https://xtermjs.org' },
  {
    name: 'pdf.js',
    license: 'Apache-2.0',
    use: 'PDF rendering',
    url: 'https://mozilla.github.io/pdf.js',
  },
  { name: 'ssh2', license: 'MIT', use: 'SSH transport', url: 'https://github.com/mscdex/ssh2' },
  { name: 'ws', license: 'MIT', use: 'WebSocket', url: 'https://github.com/websockets/ws' },
  {
    name: 'class-variance-authority',
    license: 'Apache-2.0',
    use: 'Variant styling',
    url: 'https://cva.style',
  },
  { name: 'clsx', license: 'MIT', use: 'Class names', url: 'https://github.com/lukeed/clsx' },
  {
    name: 'tailwind-merge',
    license: 'MIT',
    use: 'Class merging',
    url: 'https://github.com/dcastil/tailwind-merge',
  },
];

export function CreditsApp({ t }: AppContext) {
  return (
    <div className="flex flex-col gap-4 p-5 text-sm">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <Heart className="size-5" aria-hidden />
        </div>
        <div>
          <h2 className="text-base font-semibold">DeskSSH</h2>
          <p className="text-xs text-muted-foreground">v{APP_VERSION}</p>
        </div>
      </div>

      <p className="text-muted-foreground">
        {t('credits.license')}{' '}
        <a
          className="text-primary underline-offset-4 hover:underline"
          href="https://www.gnu.org/licenses/agpl-3.0.html"
          target="_blank"
          rel="noreferrer"
        >
          GNU AGPL-3.0-or-later
        </a>
        .
      </p>

      <div>
        <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t('credits.thirdParty')}
        </h3>
        <ul className="divide-y divide-border overflow-hidden rounded-md border">
          {CREDITS.map((c) => (
            <li key={c.name} className="flex items-center gap-3 px-3 py-2">
              <a
                className="font-medium text-primary underline-offset-4 hover:underline"
                href={c.url}
                target="_blank"
                rel="noreferrer"
              >
                {c.name}
              </a>
              <span className="flex-1 truncate text-xs text-muted-foreground">{c.use}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                {c.license}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground">{t('credits.thanks')}</p>
    </div>
  );
}
