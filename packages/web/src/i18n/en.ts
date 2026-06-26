// English catalog (source of truth). Every user-facing string lives here so the
// UI is i18n-ready from day 1 (constitution-aligned: EN + ES ship in v1).
export const en = {
  'app.tagline': 'A graphical desktop over plain SSH',
  'login.title': 'Connect to a server',
  'login.host': 'Host / IP',
  'login.port': 'Port',
  'login.username': 'Username',
  'login.authMethod': 'Authentication',
  'login.auth.password': 'Password',
  'login.auth.key': 'Private key (PEM)',
  'login.password': 'Password',
  'login.keyFile': 'Key file',
  'login.keyHint': 'Paste your private key or choose a file',
  'login.passphrase': 'Passphrase (optional)',
  'login.submit': 'Connect',
  'login.connecting': 'Connecting…',
  'login.error': 'Could not connect',
  'connected.title': 'Connected',
  'connected.os': 'Operating system',
  'connected.home': 'Home',
  'connected.listing': 'Home directory',
  'connected.transparency': 'Commands run (transparency)',
  'connected.disconnect': 'Disconnect',
  'connected.empty': 'Empty directory',
} as const;

export type MessageKey = keyof typeof en;
