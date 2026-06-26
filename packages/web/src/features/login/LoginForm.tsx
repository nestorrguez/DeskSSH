import { useState, type FormEvent } from 'react';
import { KeyRound, Lock, Server } from 'lucide-react';
import type { Translator } from '../../i18n';
import type { ConnectInput } from '../../api/gateway';

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
    <form className="card" onSubmit={handleSubmit}>
      <h1 className="card__title">
        <Server size={20} aria-hidden /> {t('login.title')}
      </h1>

      <div className="row">
        <label className="field field--grow">
          <span>{t('login.host')}</span>
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="192.168.1.10"
            autoComplete="off"
            required
          />
        </label>
        <label className="field field--port">
          <span>{t('login.port')}</span>
          <input
            value={port}
            onChange={(e) => setPort(e.target.value)}
            inputMode="numeric"
            required
          />
        </label>
      </div>

      <label className="field">
        <span>{t('login.username')}</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
          required
        />
      </label>

      <fieldset className="field">
        <legend>{t('login.authMethod')}</legend>
        <div className="toggle" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={method === 'password'}
            className={method === 'password' ? 'toggle__btn is-active' : 'toggle__btn'}
            onClick={() => setMethod('password')}
          >
            <Lock size={15} aria-hidden /> {t('login.auth.password')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={method === 'key'}
            className={method === 'key' ? 'toggle__btn is-active' : 'toggle__btn'}
            onClick={() => setMethod('key')}
          >
            <KeyRound size={15} aria-hidden /> {t('login.auth.key')}
          </button>
        </div>
      </fieldset>

      {method === 'password' ? (
        <label className="field">
          <span>{t('login.password')}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            required
          />
        </label>
      ) : (
        <>
          <label className="field">
            <span>{t('login.keyFile')}</span>
            <input type="file" onChange={(e) => void onKeyFile(e.target.files?.[0])} />
          </label>
          <label className="field">
            <textarea
              value={keyText}
              onChange={(e) => setKeyText(e.target.value)}
              placeholder={t('login.keyHint')}
              rows={4}
              spellCheck={false}
              required
            />
          </label>
          <label className="field">
            <span>{t('login.passphrase')}</span>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete="off"
            />
          </label>
        </>
      )}

      {error && <p className="error" role="alert">{`${t('login.error')}: ${error}`}</p>}

      <button className="btn btn--primary" type="submit" disabled={busy}>
        {busy ? t('login.connecting') : t('login.submit')}
      </button>
    </form>
  );
}
