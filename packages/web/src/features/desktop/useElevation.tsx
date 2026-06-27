import { useCallback, useRef, useState } from 'react';
import { Lock, ShieldAlert } from 'lucide-react';
import type { CapabilityResult } from '@deskssh/core';
import type { Translator } from '@/i18n';
import { getPrivilege, type Elevate } from '@/api/gateway';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

/** What an elevatable action returns: the usual `{ result }` envelope. */
export type ElevatableResult = { result: CapabilityResult<unknown> };
type Stage = 'modal1' | 'noticeCan' | 'noticeCannot' | 'modal2' | null;

// Mirror of core's isPermissionDenied. Kept here so the web never imports runtime
// code from @deskssh/core (which would drag ssh2/Node into the browser bundle).
const PERMISSION_RE =
  /permission denied|operation not permitted|must be root|authentication is required|access denied|not in the sudoers|are not allowed to|you must have|insufficient privileg|not permitted/i;
function looksLikePermissionError(text: string): boolean {
  return PERMISSION_RE.test(text);
}

// Privilege-elevation flow (FR-093..095). `run(action)` runs the action; if it fails
// for lack of privilege it drives the right modal and retries elevated, resolving
// with the final result. The password is held only in component state for the single
// retry and cleared right after — never persisted.
export function useElevation(sessionId: string, t: Translator) {
  const [stage, setStage] = useState<Stage>(null);
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const actionRef = useRef<((e?: Elevate) => Promise<ElevatableResult>) | null>(null);
  const resolveRef = useRef<((r: ElevatableResult) => void) | null>(null);
  const lastRef = useRef<ElevatableResult | null>(null);
  const transitioningRef = useRef(false);

  const reset = useCallback(() => {
    setStage(null);
    setUser('');
    setPassword('');
    setErr(null);
    setBusy(false);
    actionRef.current = null;
    resolveRef.current = null;
    lastRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    // Ignore the close event fired while transitioning notice → Modal 2.
    if (transitioningRef.current) {
      transitioningRef.current = false;
      return;
    }
    resolveRef.current?.(
      lastRef.current ?? { result: { kind: 'failed', raw: '', exitCode: 1, reason: 'cancelled' } },
    );
    reset();
  }, [reset]);

  const run = useCallback(
    (action: (e?: Elevate) => Promise<ElevatableResult>): Promise<ElevatableResult> =>
      new Promise((resolve) => {
        void (async () => {
          const res = await action();
          if (res.result.kind === 'failed' && looksLikePermissionError(res.result.reason)) {
            const probe = await getPrivilege(sessionId).catch(() => null);
            if (!probe) return resolve(res);
            actionRef.current = action;
            resolveRef.current = resolve;
            lastRef.current = res;
            setPassword('');
            setUser('');
            setErr(null);
            const p = probe.privilege;
            if (p.canSudo && !p.isRoot) setStage('modal1');
            else if (p.escalationAvailable) setStage('noticeCan');
            else setStage('noticeCannot');
          } else resolve(res);
        })();
      }),
    [sessionId],
  );

  async function apply(elevate: Elevate): Promise<void> {
    if (!actionRef.current) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await actionRef.current(elevate);
      if (res.result.kind === 'ok') {
        resolveRef.current?.(res);
        reset();
      } else {
        setErr(res.result.kind === 'failed' ? res.result.reason : t('elev.failed'));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('elev.failed'));
    } finally {
      setBusy(false);
    }
  }

  const dialogs = (
    <>
      {/* Modal 1 — password only (current user), shown automatically (FR-094). */}
      <Dialog open={stage === 'modal1'} onOpenChange={(o) => !o && cancel()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="size-4" aria-hidden />
              {t('elev.modal1Title')}
            </DialogTitle>
            <DialogDescription>{t('elev.modal1Body')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="elev-p1">{t('elev.password')}</Label>
            <Input
              id="elev-p1"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && password) void apply({ kind: 'current', password });
              }}
            />
            {err && <p className="text-sm text-destructive">{err}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancel} disabled={busy}>
              {t('elev.cancel')}
            </Button>
            <Button
              disabled={!password || busy}
              onClick={() => void apply({ kind: 'current', password })}
            >
              {t('elev.authorize')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Insufficient privilege, escalation available → offer Modal 2 (FR-095). */}
      <AlertDialog open={stage === 'noticeCan'} onOpenChange={(o) => !o && cancel()}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('elev.noPermTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('elev.noPermBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancel}>{t('elev.cancel')}</AlertDialogCancel>
            <Button
              onClick={() => {
                transitioningRef.current = true;
                setErr(null);
                setStage('modal2');
              }}
            >
              {t('elev.haveAdmin')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Insufficient privilege, no escalation path → just acknowledge (FR-095). */}
      <AlertDialog open={stage === 'noticeCannot'} onOpenChange={(o) => !o && cancel()}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('elev.noPermTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('elev.noEscalation')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={cancel}>{t('elev.understood')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal 2 — username + password (another privileged user / root). */}
      <Dialog open={stage === 'modal2'} onOpenChange={(o) => !o && cancel()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="size-4" aria-hidden />
              {t('elev.modal2Title')}
            </DialogTitle>
            <DialogDescription>{t('elev.modal2Body')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="elev-u">{t('elev.username')}</Label>
            <Input
              id="elev-u"
              autoFocus
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="root"
            />
            <Label htmlFor="elev-p2">{t('elev.password')}</Label>
            <Input
              id="elev-p2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && user && password)
                  void apply({ kind: 'user', user, password });
              }}
            />
            {err && <p className="text-sm text-destructive">{err}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancel} disabled={busy}>
              {t('elev.cancel')}
            </Button>
            <Button
              disabled={!user || !password || busy}
              onClick={() => void apply({ kind: 'user', user, password })}
            >
              {t('elev.authorize')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return { run, dialogs };
}
