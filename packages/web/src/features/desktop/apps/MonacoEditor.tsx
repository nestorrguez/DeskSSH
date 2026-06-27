import { useRef } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// Use the locally bundled Monaco (offline / self-hosted) instead of the wrapper's
// default CDN loader, and wire its web workers through Vite's ?worker imports.
const globalScope = self as unknown as { MonacoEnvironment?: monaco.Environment };
globalScope.MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === 'json') return new jsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  },
};
loader.config({ monaco });

export interface MonacoEditorProps {
  language: string;
  value: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
  onSave?: () => void;
}

export default function MonacoEditor({
  language,
  value,
  readOnly,
  onChange,
  onSave,
}: MonacoEditorProps) {
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  return (
    <Editor
      language={language}
      value={value}
      theme="vs-dark"
      onChange={(v) => onChange(v ?? '')}
      onMount={(editor, m) => {
        editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyS, () => onSaveRef.current?.());
      }}
      options={{
        readOnly,
        fontSize: 13,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        renderWhitespace: 'selection',
      }}
    />
  );
}
