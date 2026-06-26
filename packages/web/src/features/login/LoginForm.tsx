import { useState, type FormEvent } from 'react';
import { KeyRound, Lock, Server } from 'lucide-react';
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
  const [passphrase, setPassphrase] = useState('');

  async function onKeyFile(file: File | undefined): Promise<void> {
    if (file) setKeyText(await file.text());
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
              <div className="flex flex-col gap-2">
                <Label htmlFor="keyfile">{t('login.keyFile')}</Label>
                <Input
                  id="keyfile"
                  type="file"
                  onChange={(e) => void onKeyFile(e.target.files?.[0])}
                />
              </div>
              <Textarea
                value={keyText}
                onChange={(e) => setKeyText(e.target.value)}
                placeholder={t('login.keyHint')}
                rows={4}
                spellCheck={false}
                className="font-mono text-xs"
                required={method === 'key'}
              />
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

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? t('login.connecting') : t('login.submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
