import { useCallback, useState } from 'react';
import type { AppDefinition, WindowState } from './types';

let windowSeq = 0;

/** Window manager: open/focus/move/resize/minimize/close desktop windows.
 *  Apps are single-instance — launching an open app focuses its window. */
export function useWindows() {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [topZ, setTopZ] = useState(1);

  const focus = useCallback((id: string) => {
    setTopZ((z) => {
      const next = z + 1;
      setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, z: next, minimized: false } : w)));
      return next;
    });
  }, []);

  const openApp = useCallback(
    (app: AppDefinition) => {
      setWindows((ws) => {
        const existing = ws.find((w) => w.appId === app.id);
        if (existing) {
          const next = topZ + 1;
          setTopZ(next);
          return ws.map((w) => (w.id === existing.id ? { ...w, minimized: false, z: next } : w));
        }
        const next = topZ + 1;
        setTopZ(next);
        const w = app.defaultSize?.w ?? 560;
        const h = app.defaultSize?.h ?? 420;
        const offset = (windowSeq++ % 6) * 28;
        const win: WindowState = {
          id: `win-${windowSeq}`,
          appId: app.id,
          title: app.title,
          icon: app.icon,
          x: 80 + offset,
          y: 64 + offset,
          w,
          h,
          z: next,
          minimized: false,
          maximized: false,
        };
        return [...ws, win];
      });
    },
    [topZ],
  );

  const close = useCallback((id: string) => {
    setWindows((ws) => ws.filter((w) => w.id !== id));
  }, []);

  const minimize = useCallback((id: string) => {
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
  }, []);

  const toggleMaximize = useCallback((id: string) => {
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, maximized: !w.maximized } : w)));
  }, []);

  const move = useCallback((id: string, x: number, y: number) => {
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, x, y } : w)));
  }, []);

  const resize = useCallback((id: string, w: number, h: number) => {
    setWindows((ws) => ws.map((win) => (win.id === id ? { ...win, w, h } : win)));
  }, []);

  return { windows, openApp, close, focus, minimize, toggleMaximize, move, resize };
}

export type WindowManager = ReturnType<typeof useWindows>;
