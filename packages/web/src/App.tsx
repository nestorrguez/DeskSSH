import { useMemo, useState } from 'react';
import { detectLocale, makeTranslator } from '@/i18n';
import { connect, disconnect, type ConnectInput, type SessionInfo } from '@/api/gateway';
import { LoginForm } from '@/features/login/LoginForm';
import { HostKeyDialog, type HostKeyPrompt } from '@/features/login/HostKeyDialog';
import { Desktop } from '@/features/desktop/Desktop';

export function App() {
  const t = useMemo(() => makeTranslator(detectLocale()), []);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hostKey, setHostKey] = useState<HostKeyPrompt | null>(null);
  // The pending connection details, kept so we can retry once the key is trusted.
  const [pending, setPending] = useState<ConnectInput | null>(null);

  function attempt(input: ConnectInput): void {
    setBusy(true);
    setError(null);
    connect(input)
      .then((result) => {
        if (result.status === 'verify-host-key') {
          setPending(input);
          setHostKey({ fingerprint: result.fingerprint, algorithm: result.algorithm });
          return;
        }
        setSession(result);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false));
  }

  function confirmHostKey(): void {
    if (!pending || !hostKey) return;
    const retry: ConnectInput = { ...pending, trustFingerprint: hostKey.fingerprint };
    setHostKey(null);
    setPending(null);
    attempt(retry);
  }

  function cancelHostKey(): void {
    setHostKey(null);
    setPending(null);
  }

  function handleDisconnect(): void {
    if (session) void disconnect(session.sessionId);
    setSession(null);
  }

  if (session) {
    return <Desktop t={t} session={session} onDisconnect={handleDisconnect} />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 px-4 py-10">
      <header className="text-sm font-bold tracking-wide text-muted-foreground">DeskSSH</header>
      <LoginForm t={t} busy={busy} error={error} onSubmit={attempt} />
      <HostKeyDialog t={t} prompt={hostKey} onConfirm={confirmHostKey} onCancel={cancelHostKey} />
    </main>
  );
}
