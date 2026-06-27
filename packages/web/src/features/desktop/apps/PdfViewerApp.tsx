import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ChevronLeft, ChevronRight, FileWarning, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { readFile } from '@/api/gateway';
import { Button } from '@/components/ui/button';
import type { AppContext } from '../types';
import { base64ToBytes, baseName } from './lib';

// Run pdf.js parsing/rendering off the main thread; Vite resolves the worker URL.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

type Status = 'idle' | 'loading' | 'ready' | 'error';

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

// PDF viewer — reads the file bytes via readFile and renders pages on a canvas with
// pdf.js (Apache-2.0). The document is parsed in the browser; nothing is rendered on
// the remote host (Art. 10 / the "GUI synthesised on the client" premise).
export function PdfViewerApp({ t, session, pdfTarget }: AppContext) {
  const [path, setPath] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.2);

  const docRef = useRef<PDFDocumentProxy | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  // Load the document whenever the requested target changes.
  useEffect(() => {
    if (!pdfTarget || pdfTarget === path) return;
    let active = true;
    setStatus('loading');
    readFile(session.sessionId, pdfTarget)
      .then(async ({ result }) => {
        if (!active) return;
        if (result.kind !== 'ok') {
          setPath(pdfTarget);
          setStatus('error');
          return;
        }
        const doc = await pdfjs.getDocument({ data: base64ToBytes(result.base64) }).promise;
        if (!active) {
          void doc.loadingTask.destroy();
          return;
        }
        void docRef.current?.loadingTask.destroy();
        docRef.current = doc;
        setPath(pdfTarget);
        setPageCount(doc.numPages);
        setPage(1);
        setStatus('ready');
      })
      .catch(() => {
        if (active) {
          setPath(pdfTarget);
          setStatus('error');
        }
      });
    return () => {
      active = false;
    };
  }, [pdfTarget, path, session.sessionId]);

  // Render the current page whenever it (or the zoom) changes.
  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (status !== 'ready' || !doc || !canvas) return;
    let cancelled = false;

    void (async () => {
      // A canvas can only host one render at a time — cancel any in-flight one.
      renderTaskRef.current?.cancel();
      try {
        const pdfPage = await doc.getPage(page);
        if (cancelled) return;
        const outputScale = window.devicePixelRatio || 1;
        const viewport = pdfPage.getViewport({ scale });
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const task = pdfPage.render({
          canvas,
          viewport,
          transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
        });
        renderTaskRef.current = task;
        await task.promise;
      } catch {
        // Expected when a render is cancelled by rapid navigation; ignore.
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [status, page, scale]);

  // Destroy the document on unmount to free the worker.
  useEffect(
    () => () => {
      renderTaskRef.current?.cancel();
      void docRef.current?.loadingTask.destroy();
    },
    [],
  );

  const canPrev = status === 'ready' && page > 1;
  const canNext = status === 'ready' && page < pageCount;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-2 py-1.5">
        <code className="flex-1 truncate font-mono text-xs text-muted-foreground">
          {path ? baseName(path) : t('pdf.empty')}
        </code>
        {status === 'ready' && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={!canPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label={t('pdf.prev')}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {t('pdf.page', { n: page, total: pageCount })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={!canNext}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              aria-label={t('pdf.next')}
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={scale <= MIN_SCALE}
              onClick={() => setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP))}
              aria-label={t('pdf.zoomOut')}
            >
              <ZoomOut className="size-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={scale >= MAX_SCALE}
              onClick={() => setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP))}
              aria-label={t('pdf.zoomIn')}
            >
              <ZoomIn className="size-4" aria-hidden />
            </Button>
          </>
        )}
      </div>

      <div
        className="min-h-0 flex-1 overflow-auto p-3"
        style={{ backgroundColor: 'oklch(0.14 0.006 285.8)' }}
      >
        {status === 'idle' && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">{t('pdf.openHint')}</p>
          </div>
        )}
        {status === 'loading' && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
          </div>
        )}
        {status === 'error' && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <FileWarning className="size-6" aria-hidden />
            <p className="text-sm">{t('pdf.error')}</p>
          </div>
        )}
        <div className={status === 'ready' ? 'flex justify-center' : 'hidden'}>
          <canvas ref={canvasRef} className="shadow-lg" />
        </div>
      </div>
    </div>
  );
}
