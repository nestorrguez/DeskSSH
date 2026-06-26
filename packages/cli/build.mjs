// Builds the distributable `deskssh` package:
//   1. bundle the gateway (server + core) into dist/server.js
//   2. copy the built web UI into dist/web
//
// ssh2 and ws stay external (ssh2 ships native bindings; both are listed as real
// dependencies of this package, so npm installs them on the user's machine).

import { build } from 'esbuild';
import { cpSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const dist = join(here, 'dist');

const serverEntry = join(repo, 'packages', 'server', 'dist', 'index.js');
const webDist = join(repo, 'packages', 'web', 'dist');

if (!existsSync(serverEntry)) {
  throw new Error(`Missing ${serverEntry}. Run the workspace build first (pnpm build).`);
}
if (!existsSync(webDist)) {
  throw new Error(
    `Missing ${webDist}. Build the web app first (pnpm --filter @deskssh/web build).`,
  );
}

rmSync(dist, { recursive: true, force: true });

await build({
  entryPoints: [serverEntry],
  outfile: join(dist, 'server.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: ['ssh2', 'ws'],
  banner: {
    // Allow CommonJS deps (ssh2) to use require() from this ESM bundle.
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});

cpSync(webDist, join(dist, 'web'), { recursive: true });

console.log('Built deskssh: dist/server.js + dist/web');
