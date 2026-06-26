// Minimal static file server for the bundled web UI. When DeskSSH runs as the
// self-hosted npm package, the gateway serves the built frontend so the API and UI
// share one origin. Includes a path-traversal guard and SPA fallback to index.html.

import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import type { ServerResponse } from 'node:http';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/**
 * Serve `urlPath` from `dir`. Returns true if it handled the response. Unknown
 * paths fall back to index.html (single-page app routing).
 */
export function serveStatic(dir: string, urlPath: string, res: ServerResponse): boolean {
  // Resolve within `dir` and reject anything that escapes it.
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(dir, rel);
  if (!filePath.startsWith(dir)) return false;

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    const indexPath = join(dir, 'index.html');
    if (!existsSync(indexPath)) return false;
    filePath = indexPath;
  }

  res.writeHead(200, { 'content-type': MIME[extname(filePath)] ?? 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
  return true;
}
