import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Save,
  Circle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { readFile, writeFile } from '@/api/gateway';
import { Button } from '@/components/ui/button';
import type { AppContext } from '../types';
import { base64ToText, looksLikeText, textToBase64 } from './lib';

type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

// Documents — DeskSSH's rich-text + plain-text editor (distinct from Stallman, the
// code editor). Built on TipTap (ProseMirror); documents are stored as HTML. The
// GUI emulates the editor (Art. 10) and saves via writeFile.
export function DocumentsApp({ t, session, docTarget }: AppContext) {
  const [path, setPath] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    immediatelyRender: false,
    onUpdate: () => {
      if (loadedRef.current) {
        setDirty(true);
        setStatus((s) => (s === 'saved' ? 'idle' : s));
      }
    },
  });

  // Load whenever the requested target changes.
  useEffect(() => {
    if (!editor || !docTarget || docTarget === path) return;
    let active = true;
    setStatus('loading');
    setMessage(null);
    loadedRef.current = false;
    readFile(session.sessionId, docTarget)
      .then(({ result }) => {
        if (!active) return;
        if (result.kind !== 'ok') {
          setStatus('error');
          setMessage(t('docs.loadError'));
          return;
        }
        if (!looksLikeText(result.base64)) {
          setStatus('error');
          setMessage(t('docs.binary'));
          return;
        }
        editor.commands.setContent(base64ToText(result.base64), { emitUpdate: false });
        setPath(docTarget);
        setDirty(false);
        setStatus('idle');
        loadedRef.current = true;
      })
      .catch(() => {
        if (active) {
          setStatus('error');
          setMessage(t('docs.loadError'));
        }
      });
    return () => {
      active = false;
    };
  }, [editor, docTarget, path, session.sessionId, t]);

  function save(): void {
    if (!path || !editor) return;
    setStatus('saving');
    writeFile(session.sessionId, path, textToBase64(editor.getHTML()))
      .then(({ result }) => {
        if (result.kind === 'ok') {
          setDirty(false);
          setStatus('saved');
          setMessage(null);
        } else {
          setStatus('error');
          setMessage(t('docs.saveError'));
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage(t('docs.saveError'));
      });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-2 py-1.5">
        <Tool
          icon={Bold}
          label={t('docs.bold')}
          active={editor?.isActive('bold')}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <Tool
          icon={Italic}
          label={t('docs.italic')}
          active={editor?.isActive('italic')}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <Tool
          icon={Strikethrough}
          label={t('docs.strike')}
          active={editor?.isActive('strike')}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        />
        <Tool
          icon={Code}
          label={t('docs.code')}
          active={editor?.isActive('code')}
          onClick={() => editor?.chain().focus().toggleCode().run()}
        />
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <Tool
          icon={Heading1}
          label={t('docs.h1')}
          active={editor?.isActive('heading', { level: 1 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        />
        <Tool
          icon={Heading2}
          label={t('docs.h2')}
          active={editor?.isActive('heading', { level: 2 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <Tool
          icon={List}
          label={t('docs.bullet')}
          active={editor?.isActive('bulletList')}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        />
        <Tool
          icon={ListOrdered}
          label={t('docs.ordered')}
          active={editor?.isActive('orderedList')}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        />
        <Tool
          icon={Quote}
          label={t('docs.quote')}
          active={editor?.isActive('blockquote')}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        />
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <Tool
          icon={Undo}
          label={t('docs.undo')}
          onClick={() => editor?.chain().focus().undo().run()}
        />
        <Tool
          icon={Redo}
          label={t('docs.redo')}
          onClick={() => editor?.chain().focus().redo().run()}
        />

        <div className="ml-auto flex items-center gap-2">
          {dirty && <Circle className="size-2 fill-primary text-primary" aria-hidden />}
          <span className="text-xs text-muted-foreground">
            {status === 'saving'
              ? t('docs.saving')
              : status === 'saved'
                ? t('docs.saved')
                : dirty
                  ? t('docs.unsaved')
                  : ''}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5"
            disabled={!path || !dirty || status === 'saving'}
            onClick={save}
          >
            <Save className="size-3.5" aria-hidden /> {t('docs.save')}
          </Button>
        </div>
      </div>

      {message && <p className="px-3 py-2 text-sm text-destructive">{message}</p>}

      <div className="deskssh-doc min-h-0 flex-1 overflow-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Tool({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7 data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
      data-active={active ? 'true' : 'false'}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      <Icon className="size-4" aria-hidden />
    </Button>
  );
}
