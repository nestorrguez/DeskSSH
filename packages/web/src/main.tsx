import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initTheme } from './features/settings/theme';
import { initAppearance } from './features/settings/appearance';
import { loadAppPlugins } from './features/desktop/apps/load-plugins';
import './index.css';

// Apply persisted appearance (theme, accent, font) before first paint to avoid a flash.
initTheme();
initAppearance();

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

// Load installed app plugins (E10.4e) into the shared registry before first render so
// the launcher already includes them, then mount. Failure-isolated: a plugin error
// never blocks the Desk (loadAppPlugins resolves regardless).
function mount(): void {
  createRoot(container!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
void loadAppPlugins().then(mount, mount);
