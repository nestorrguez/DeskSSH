import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Save, Circle } from 'lucide-react';
import { readFile, writeFile } from '@/api/gateway';
import { Button } from '@/components/ui/button';
import type { AppContext } from '../types';
import { base64ToText, looksLikeText, monacoLanguageFor, textToBase64 } from './lib';

const MonacoEditor = lazy(() => import('./MonacoEditor'));

type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

// Stallman — DeskSSH's code editor. Opens files via readFile, saves via writeFile;
// the GUI emulates the editor (Art. 10) with Monaco (the VS Code editor), syntax-
// highlighting by file type. Monaco is lazy-loaded so it stays out of the main
// bundle until the editor is first opened.
export function StallmanApp({ t, session, editorTarget }: AppContext) {
  const [path, setPath] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);

  // A ref so Monaco's Ctrl-S command always calls the current save closure.
  const saveRef = useRef<() => void>(() => {});

  // Load whenever the requested target changes.
  useEffect(() => {
    if (!editorTarget || editorTarget === path) return;
    let active = true;
    setStatus('loading');
    setMessage(null);
    readFile(session.sessionId, editorTarget)
      .then(({ result }) => {
        if (!active) return;
        if (result.kind !== 'ok') {
          setStatus('error');
          setMessage(t('editor.loadError'));
          return;
        }
        if (!looksLikeText(result.base64)) {
          setStatus('error');
          setMessage(t('editor.binary'));
          return;
        }
        setPath(editorTarget);
        setText(base64ToText(result.base64));
        setDirty(false);
        setStatus('idle');
      })
      .catch(() => {
        if (active) {
          setStatus('error');
          setMessage(t('editor.loadError'));
        }
      });
    return () => {
      active = false;
    };
  }, [editorTarget, path, session.sessionId, t]);

  function save(): void {
    if (!path) return;
    setStatus('saving');
    writeFile(session.sessionId, path, textToBase64(text))
      .then(({ result }) => {
        if (result.kind === 'ok') {
          setDirty(false);
          setStatus('saved');
          setMessage(null);
        } else {
          setStatus('error');
          setMessage(t('editor.saveError'));
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage(t('editor.saveError'));
      });
  }
  saveRef.current = save;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-2 py-1.5">
        {dirty && <Circle className="size-2 fill-primary text-primary" aria-hidden />}
        <code className="flex-1 truncate font-mono text-xs text-muted-foreground">
          {path ?? t('editor.untitled')}
        </code>
        <span className="text-xs text-muted-foreground">
          {status === 'saving'
            ? t('editor.saving')
            : status === 'saved'
              ? t('editor.saved')
              : dirty
                ? t('editor.unsaved')
                : ''}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5"
          disabled={!path || !dirty || status === 'saving'}
          onClick={save}
        >
          <Save className="size-3.5" aria-hidden /> {t('editor.save')}
        </Button>
      </div>

      {message && <p className="px-3 py-2 text-sm text-destructive">{message}</p>}

      <div className="min-h-0 flex-1">
        {path === null ? (
          <p className="p-3 text-sm text-muted-foreground">{t('editor.untitled')}</p>
        ) : (
          <Suspense
            fallback={<p className="p-3 text-xs text-muted-foreground">{t('editor.loading')}</p>}
          >
            <MonacoEditor
              language={monacoLanguageFor(path)}
              value={text}
              onChange={(v) => {
                setText(v);
                setDirty(true);
                if (status === 'saved') setStatus('idle');
              }}
              onSave={() => saveRef.current()}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
