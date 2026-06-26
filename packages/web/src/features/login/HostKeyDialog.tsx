import { ShieldQuestion } from 'lucide-react';
import type { Translator } from '@/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface HostKeyPrompt {
  fingerprint: string;
  algorithm: string;
}

interface HostKeyDialogProps {
  t: Translator;
  prompt: HostKeyPrompt | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function HostKeyDialog({ t, prompt, onConfirm, onCancel }: HostKeyDialogProps) {
  return (
    <AlertDialog open={prompt !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldQuestion className="size-5" aria-hidden /> {t('hostkey.title')}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('hostkey.body')}</AlertDialogDescription>
        </AlertDialogHeader>

        {prompt && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="text-xs text-muted-foreground">
              {t('hostkey.fingerprint')} · {prompt.algorithm}
            </div>
            <code className="font-mono break-all">{prompt.fingerprint}</code>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{t('hostkey.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{t('hostkey.confirm')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
