import { useEffect, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import { readFile } from '@/api/gateway';
import { Button } from '@/components/ui/button';
import type { AppContext } from '../types';
import { baseName, imageMimeFor } from './lib';

type Status = 'idle' | 'loading' | 'ready' | 'error';

// Image viewer — reads the file bytes via readFile and renders them as a data URL.
// No remote rendering and no external decoder: the browser decodes PNG/JPEG/GIF
// (animated)/WebP natively, matching the "GUI synthesised on the client" premise.
export function ImageViewerApp({ t, session, imageTarget }: AppContext) {
  const [path, setPath] = useState<string | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [actualSize, setActualSize] = useState(false);

  useEffect(() => {
    if (!imageTarget || imageTarget === path) return;
    const mime = imageMimeFor(imageTarget);
    if (!mime) {
      setPath(imageTarget);
      setSrc(null);
      setStatus('error');
      return;
    }
    let active = true;
    setStatus('loading');
    readFile(session.sessionId, imageTarget)
      .then(({ result }) => {
        if (!active) return;
        if (result.kind !== 'ok') {
          setPath(imageTarget);
          setSrc(null);
          setStatus('error');
          return;
        }
        setPath(imageTarget);
        setSrc(`data:${mime};base64,${result.base64}`);
        setActualSize(false);
        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setPath(imageTarget);
        setSrc(null);
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [imageTarget, path, session.sessionId]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-2 py-1.5">
        <code className="flex-1 truncate font-mono text-xs text-muted-foreground">
          {path ? baseName(path) : t('viewer.empty')}
        </code>
        {status === 'ready' && (
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => setActualSize((v) => !v)}
          >
            {actualSize ? t('viewer.fit') : t('viewer.actualSize')}
          </Button>
        )}
      </div>

      <div
        className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3"
        style={{ backgroundColor: 'oklch(0.14 0.006 285.8)' }}
      >
        {status === 'idle' && (
          <p className="text-sm text-muted-foreground">{t('viewer.openHint')}</p>
        )}
        {status === 'loading' && (
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
        )}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImageOff className="size-6" aria-hidden />
            <p className="text-sm">{t('viewer.error')}</p>
          </div>
        )}
        {status === 'ready' && src && (
          <img
            src={src}
            alt={path ? baseName(path) : ''}
            className={actualSize ? 'max-w-none' : 'max-h-full max-w-full object-contain'}
          />
        )}
      </div>
    </div>
  );
}
