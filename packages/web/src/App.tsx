import { useMemo, useState } from 'react';
import { detectLocale, makeTranslator } from '@/i18n';
import { connect, disconnect, type ConnectInput, type SessionInfo } from '@/api/gateway';
import { LoginForm } from '@/features/login/LoginForm';
import { ConnectedView } from '@/features/connected/ConnectedView';

export function App() {
  const t = useMemo(() => makeTranslator(detectLocale()), []);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleConnect(input: ConnectInput): void {
    setBusy(true);
    setError(null);
    connect(input)
      .then(setSession)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false));
  }

  function handleDisconnect(): void {
    if (session) void disconnect(session.sessionId);
    setSession(null);
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 px-4 py-10">
      <header className="text-sm font-bold tracking-wide text-muted-foreground">DeskSSH</header>
      {session ? (
        <ConnectedView t={t} session={session} onDisconnect={handleDisconnect} />
      ) : (
        <LoginForm t={t} busy={busy} error={error} onSubmit={handleConnect} />
      )}
    </main>
  );
}
