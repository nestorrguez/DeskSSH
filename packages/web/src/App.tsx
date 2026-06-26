import { useMemo } from 'react';
import { TerminalSquare } from 'lucide-react';
import { detectLocale, translate } from './i18n';

export function App() {
  const locale = useMemo(() => detectLocale(), []);

  return (
    <main>
      <h1>
        <TerminalSquare aria-hidden /> DeskSSH
      </h1>
      <p>{translate(locale, 'app.tagline')}</p>
      <small>{translate(locale, 'app.status.scaffolding')}</small>
    </main>
  );
}
