import { useRef, type PointerEvent, type ReactNode } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WindowState } from './types';

interface WindowProps {
  win: WindowState;
  active: boolean;
  children: ReactNode;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number) => void;
}

const MIN_W = 320;
const MIN_H = 200;

export function Window({
  win,
  active,
  children,
  onFocus,
  onClose,
  onMinimize,
  onToggleMaximize,
  onMove,
  onResize,
}: WindowProps) {
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const resize = useRef<{ px: number; py: number; ow: number; oh: number } | null>(null);

  function startDrag(e: PointerEvent): void {
    if (win.maximized) return;
    onFocus();
    drag.current = { px: e.clientX, py: e.clientY, ox: win.x, oy: win.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onDragMove(e: PointerEvent): void {
    if (!drag.current) return;
    onMove(
      Math.max(0, drag.current.ox + (e.clientX - drag.current.px)),
      Math.max(0, drag.current.oy + (e.clientY - drag.current.py)),
    );
  }
  function endDrag(e: PointerEvent): void {
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  function startResize(e: PointerEvent): void {
    e.stopPropagation();
    onFocus();
    resize.current = { px: e.clientX, py: e.clientY, ow: win.w, oh: win.h };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onResizeMove(e: PointerEvent): void {
    if (!resize.current) return;
    onResize(
      Math.max(MIN_W, resize.current.ow + (e.clientX - resize.current.px)),
      Math.max(MIN_H, resize.current.oh + (e.clientY - resize.current.py)),
    );
  }
  function endResize(e: PointerEvent): void {
    resize.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  const Icon = win.icon;
  const style = win.maximized
    ? { inset: '0 0 0 0', zIndex: win.z }
    : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z };

  return (
    <section
      className={cn(
        'absolute flex flex-col overflow-hidden rounded-lg border bg-card shadow-2xl',
        active ? 'border-ring/60' : 'border-border',
      )}
      style={style}
      onPointerDown={onFocus}
      aria-label={win.title}
    >
      <header
        className="flex h-9 shrink-0 cursor-grab items-center gap-2 border-b bg-muted/40 px-2 select-none active:cursor-grabbing"
        onPointerDown={startDrag}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onDoubleClick={onToggleMaximize}
      >
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        <span className="flex-1 truncate text-sm font-medium">{win.title}</span>
        <button
          className="grid size-6 place-items-center rounded hover:bg-accent"
          onClick={onMinimize}
          aria-label="Minimize"
        >
          <Minus className="size-3.5" aria-hidden />
        </button>
        <button
          className="grid size-6 place-items-center rounded hover:bg-accent"
          onClick={onToggleMaximize}
          aria-label="Maximize"
        >
          <Square className="size-3" aria-hidden />
        </button>
        <button
          className="grid size-6 place-items-center rounded hover:bg-destructive hover:text-white"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">{children}</div>

      {!win.maximized && (
        <div
          className="absolute right-0 bottom-0 size-4 cursor-se-resize"
          onPointerDown={startResize}
          onPointerMove={onResizeMove}
          onPointerUp={endResize}
        />
      )}
    </section>
  );
}
