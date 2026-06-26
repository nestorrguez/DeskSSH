import { useState, type FormEvent } from 'react';
import { Check, ClipboardPaste, KeyRound, Lock, Server, Upload } from 'lucide-react';
import type { Translator } from '@/i18n';
import type { ConnectInput } from '@/api/gateway';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface LoginFormProps {
  t: Translator;
  busy: boolean;
  error: string | null;
  onSubmit: (input: ConnectInput) => void;
}

type AuthMethod = 'password' | 'key';

export function LoginForm({ t, busy, error, onSubmit }: LoginFormProps) {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [method, setMethod] = useState<AuthMethod>('password');
  const [password, setPassword] = useState('');
  const [keyText, setKeyText] = useState('');
  const [keyMode, setKeyMode] = useState<'file' | 'paste'>('file');
  const [keyFileName, setKeyFileName] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState('');

  async function onKeyFile(file: File | undefined): Promise<void> {
    if (!file) return;
    setKeyText(await file.text());
    setKeyFileName(file.name);
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    const auth: ConnectInput['auth'] =
      method === 'password'
        ? { kind: 'password', password }
        : { kind: 'privateKey', privateKey: keyText, ...(passphrase ? { passphrase } : {}) };
    onSubmit({ host: host.trim(), port: Number(port) || 22, username: username.trim(), auth });
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="size-5" aria-hidden /> {t('login.title')}
        </CardTitle>
        <CardDescription>{t('app.tagline')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="host">{t('login.host')}</Label>
              <Input
                id="host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.10"
                autoComplete="off"
                required
              />
            </div>
            <div className="flex w-24 flex-col gap-2">
              <Label htmlFor="port">{t('login.port')}</Label>
              <Input
                id="port"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                inputMode="numeric"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="username">{t('login.username')}</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              required
            />
          </div>

          <Tabs value={method} onValueChange={(v) => setMethod(v as AuthMethod)}>
            <TabsList className="w-full">
              <TabsTrigger value="password" className="flex-1">
                <Lock className="size-4" aria-hidden /> {t('login.auth.password')}
              </TabsTrigger>
              <TabsTrigger value="key" className="flex-1">
                <KeyRound className="size-4" aria-hidden /> {t('login.auth.key')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="password" className="mt-4 flex flex-col gap-2">
              <Label htmlFor="password">{t('login.password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                required={method === 'password'}
              />
            </TabsContent>

            <TabsContent value="key" className="mt-4 flex flex-col gap-3">
              {/* Two clear actions: load a key file, or paste the key. The key's
                  contents are never shown back; a loaded file shows a confirmation. */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={keyMode === 'file' ? 'secondary' : 'outline'}
                  className="gap-1.5"
                  onClick={() => setKeyMode('file')}
                >
                  <Upload className="size-4" aria-hidden /> {t('login.key.loadFile')}
                </Button>
                <Button
                  type="button"
                  variant={keyMode === 'paste' ? 'secondary' : 'outline'}
                  className="gap-1.5"
                  onClick={() => setKeyMode('paste')}
                >
                  <ClipboardPaste className="size-4" aria-hidden /> {t('login.key.paste')}
                </Button>
              </div>

              {keyMode === 'file' ? (
                <div className="flex flex-col gap-2">
                  <Input
                    id="keyfile"
                    type="file"
                    onChange={(e) => void onKeyFile(e.target.files?.[0])}
                  />
                  {keyText && (
                    <p className="flex items-center gap-1.5 text-sm text-emerald-500">
                      <Check className="size-4" aria-hidden />
                      {keyFileName
                        ? t('login.key.loaded', { name: keyFileName })
                        : t('login.key.loadedGeneric')}
                    </p>
                  )}
                </div>
              ) : (
                <Textarea
                  value={keyText}
                  onChange={(e) => {
                    setKeyText(e.target.value);
                    setKeyFileName(null);
                  }}
                  placeholder={t('login.keyHint')}
                  rows={4}
                  spellCheck={false}
                  className="font-mono text-xs"
                  required={method === 'key' && keyMode === 'paste'}
                />
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="passphrase">{t('login.passphrase')}</Label>
                <Input
                  id="passphrase"
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </TabsContent>
          </Tabs>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{`${t('login.error')}: ${error}`}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={busy || (method === 'key' && !keyText)}
            className="w-full"
          >
            {busy ? t('login.connecting') : t('login.submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
