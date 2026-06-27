// Small shared helpers for the desktop apps.

/** Join a POSIX directory and child name. */
export function joinPath(dir: string, name: string): string {
  if (dir === '/') return `/${name}`;
  return `${dir.replace(/\/+$/, '')}/${name}`;
}

/** Parent directory of a POSIX path (stays at '/'). */
export function parentPath(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  const idx = trimmed.lastIndexOf('/');
  return idx <= 0 ? '/' : trimmed.slice(0, idx);
}

/** Human-readable byte size. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

/** Human-readable uptime from seconds. */
export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

/** Decode a base64 string to raw bytes (browser-safe). */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Decode a base64 string to UTF-8 text (browser-safe). */
export function base64ToText(base64: string): string {
  return new TextDecoder().decode(base64ToBytes(base64));
}

/** Encode UTF-8 text to base64 (browser-safe). */
export function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Heuristic: does this byte sample look like text (i.e. contains no NUL byte)? */
export function looksLikeText(base64: string): boolean {
  const sample = atob(base64).slice(0, 4096);
  return !sample.includes(String.fromCharCode(0));
}

/** Final path segment of a POSIX path. */
export function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

// Browser-viewable image formats keyed by lowercase extension.
const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  ico: 'image/x-icon',
};

/** The image MIME type for a file name, or `null` if it is not a viewable image. */
export function imageMimeFor(name: string): string | null {
  const dot = name.lastIndexOf('.');
  if (dot < 0) return null;
  return IMAGE_MIME[name.slice(dot + 1).toLowerCase()] ?? null;
}

/** Does this file name look like a PDF? */
export function isPdf(name: string): boolean {
  return name.toLowerCase().endsWith('.pdf');
}

/** Single-quote a string for safe use as a shell argument (mirrors core `quote`). */
export function shellQuote(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

// Monaco language id keyed by lowercase file extension. Covers the languages
// called out in the feedback (C, C++, C#, Java, Python, JS, TS, SQL, HTML, XML,
// JSON, Markdown) plus a handful of common ones; anything unknown is plain text.
const MONACO_LANG: Record<string, string> = {
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  cs: 'csharp',
  java: 'java',
  py: 'python',
  pyw: 'python',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  sql: 'sql',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  svg: 'xml',
  json: 'json',
  md: 'markdown',
  markdown: 'markdown',
  css: 'css',
  scss: 'scss',
  less: 'less',
  sh: 'shell',
  bash: 'shell',
  yaml: 'yaml',
  yml: 'yaml',
  go: 'go',
  rs: 'rust',
  php: 'php',
  rb: 'ruby',
  ini: 'ini',
  conf: 'ini',
  toml: 'ini',
};

/** The Monaco language id for a file name (extension-based), or 'plaintext'. */
export function monacoLanguageFor(name: string): string {
  const seg = name.slice(name.lastIndexOf('/') + 1);
  if (seg === 'Dockerfile') return 'dockerfile';
  if (seg === 'Makefile') return 'makefile';
  const dot = seg.lastIndexOf('.');
  if (dot < 0) return 'plaintext';
  return MONACO_LANG[seg.slice(dot + 1).toLowerCase()] ?? 'plaintext';
}
