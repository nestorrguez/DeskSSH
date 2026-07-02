// Shared-runtime plugin (spec 002, FR-241 / E10.4d). For the Desk and its app plugins
// to share one React / UI / icon instance, both resolve a fixed set of bare specifiers
// through the page's **import map** to standalone ESM bundles served at `/runtime/*`.
//
// This plugin does two things:
//   1. Marks those specifiers **external** (dev + build) so Vite/Rollup leave the bare
//      import untouched and the browser import map resolves them.
//   2. On `buildStart` (dev server start and production build) bundles the `/runtime/*`
//      files with esbuild into `public/runtime/` (served statically in dev, copied to
//      `dist/` in build). React-dependent bundles keep `react` external so they, too,
//      use the one shared copy.

import { build, type Plugin as EsbuildPlugin } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

/** Bare specifier → served URL. The import map in index.html must mirror this exactly. */
export const SHARED_RUNTIME: Record<string, string> = {
  react: '/runtime/react.js',
  'react-dom': '/runtime/react-dom.js',
  'react-dom/client': '/runtime/react-dom.js',
  'react/jsx-runtime': '/runtime/jsx-runtime.js',
  'react/jsx-dev-runtime': '/runtime/jsx-dev-runtime.js',
  '@deskssh/app-runtime': '/runtime/app-runtime.js',
};

const REACT_EXTERNAL = [
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
];

interface Entry {
  readonly outfile: string;
  readonly stdin?: string;
  readonly entry?: string;
  readonly external: readonly string[];
  /**
   * How to externalize {@link external}. `'exact'` (default) uses the plugin below so a
   * bare `react` is external but its **subpaths still bundle** (needed by jsx-runtime,
   * which bundles `react/jsx-runtime`). `'builtin'` uses esbuild's native `external`, which
   * correctly rewrites a CJS lib's internal `require('react')` into an `import` — required
   * for `react-dom` (a CJS module whose `require('react')` otherwise becomes a runtime
   * "Dynamic require" throw). Only safe when the entry doesn't bundle a `react/*` subpath.
   */
  readonly mode?: 'exact' | 'builtin';
  /** Raw text prepended to the output (esbuild `banner.js`), e.g. a `require` shim. */
  readonly banner?: string;
}

// `react-dom` is CommonJS: bundled to ESM it can't turn its internal `require('react')`
// into an `import` (the require lives inside esbuild's CJS wrapper), so esbuild emits a
// shim that throws "Dynamic require of react". This banner imports the **shared** React
// (external → the import map's `/runtime/react.js`) and defines a module-scope `require`
// the shim resolves to it — so react-dom uses the one shared React instance, not a copy.
const REACT_DOM_REQUIRE_SHIM = [
  `import * as __sharedReact__ from 'react';`,
  `const require = (id) => {`,
  `  if (id === 'react') return __sharedReact__.default ?? __sharedReact__;`,
  `  throw new Error('shared-runtime: unexpected require(' + JSON.stringify(id) + ')');`,
  `};`,
].join('\n');

// React and its subpaths are **CommonJS**, so `export * from 'react'` re-exports **no named
// bindings** (a CJS module's exports aren't statically analyzable) — the bundle would ship
// only a `default`, and `import { jsx }`/`import { useState }` would fail at load, leaving the
// Desk blank. So each React bundle re-exports its names **explicitly** (from React 19.2's
// surface), plus `default`. `react.js` also re-exports the internals `react-dom` reaches for
// at runtime (`__CLIENT_INTERNALS_…`, `__COMPILER_RUNTIME`).
const REACT_EXPORTS = [
  'Activity',
  'Children',
  'Component',
  'Fragment',
  'Profiler',
  'PureComponent',
  'StrictMode',
  'Suspense',
  'act',
  'cache',
  'cacheSignal',
  'captureOwnerStack',
  'cloneElement',
  'createContext',
  'createElement',
  'createRef',
  'forwardRef',
  'isValidElement',
  'lazy',
  'memo',
  'startTransition',
  'unstable_useCacheRefresh',
  'use',
  'useActionState',
  'useCallback',
  'useContext',
  'useDebugValue',
  'useDeferredValue',
  'useEffect',
  'useEffectEvent',
  'useId',
  'useImperativeHandle',
  'useInsertionEffect',
  'useLayoutEffect',
  'useMemo',
  'useOptimistic',
  'useReducer',
  'useRef',
  'useState',
  'useSyncExternalStore',
  'useTransition',
  'version',
  '__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE',
  '__COMPILER_RUNTIME',
];

const REACT_DOM_EXPORTS = [
  'createPortal',
  'flushSync',
  'preconnect',
  'prefetchDNS',
  'preinit',
  'preinitModule',
  'preload',
  'preloadModule',
  'requestFormReset',
  'unstable_batchedUpdates',
  'useFormState',
  'useFormStatus',
  'version',
];

const ENTRIES: Entry[] = [
  {
    outfile: 'react.js',
    stdin: `export { ${REACT_EXPORTS.join(', ')} } from 'react';\nexport { default } from 'react';`,
    external: [],
  },
  {
    outfile: 'react-dom.js',
    // One bundle covers both `react-dom` and `react-dom/client`; `react` stays shared.
    // Native external so react-dom's internal `require('react')` becomes an `import`.
    stdin: `export { ${REACT_DOM_EXPORTS.join(', ')} } from 'react-dom';\nexport { default } from 'react-dom';\nexport { createRoot, hydrateRoot } from 'react-dom/client';`,
    external: ['react'],
    mode: 'builtin',
    banner: REACT_DOM_REQUIRE_SHIM,
  },
  {
    outfile: 'jsx-runtime.js',
    stdin: `export { Fragment, jsx, jsxs } from 'react/jsx-runtime';`,
    external: ['react'],
  },
  {
    outfile: 'jsx-dev-runtime.js',
    stdin: `export { Fragment, jsxDEV } from 'react/jsx-dev-runtime';`,
    external: ['react'],
  },
  {
    outfile: 'app-runtime.js',
    entry: resolve(root, 'src/app-runtime/index.ts'),
    external: REACT_EXTERNAL,
  },
];

/**
 * Mark **only exact** specifiers external. esbuild's built-in `external: ['react']` also
 * externalizes subpaths (`react/jsx-runtime`), which would turn the jsx-runtime bundle
 * into a self-referential `export * from 'react/jsx-runtime'` (an import-map loop). This
 * plugin externalizes the bare import alone, so subpaths still bundle their real code.
 */
function externalExact(specifiers: readonly string[]): EsbuildPlugin {
  const set = new Set(specifiers);
  return {
    name: 'external-exact',
    setup(b) {
      b.onResolve({ filter: /^[^.]/ }, (args) =>
        set.has(args.path) ? { path: args.path, external: true } : null,
      );
    },
  };
}

/** Bundle every `/runtime/*` file into `<root>/public/runtime/`. */
export async function buildSharedRuntime(): Promise<void> {
  const outDir = resolve(root, 'public/runtime');
  mkdirSync(outDir, { recursive: true });
  await Promise.all(
    ENTRIES.map((e) =>
      build({
        outfile: resolve(outDir, e.outfile),
        bundle: true,
        format: 'esm',
        platform: 'browser',
        target: 'es2022',
        jsx: 'automatic',
        minify: true,
        legalComments: 'none',
        // 'builtin' → esbuild's native external (rewrites CJS `require` to `import`);
        // 'exact' (default) → the plugin that externalizes only the bare specifier.
        ...(e.mode === 'builtin'
          ? { external: [...e.external] }
          : { plugins: [externalExact(e.external)] }),
        ...(e.banner ? { banner: { js: e.banner } } : {}),
        define: { 'process.env.NODE_ENV': '"production"' },
        alias: { '@': resolve(root, 'src') },
        ...(e.stdin
          ? { stdin: { contents: e.stdin, resolveDir: root, loader: 'ts' as const } }
          : { entryPoints: [e.entry!] }),
      }),
    ),
  );
}

/** The Vite plugin: externalize the shared specifiers + emit the `/runtime/*` bundles. */
export function sharedRuntime(): Plugin {
  return {
    name: 'deskssh:shared-runtime',
    enforce: 'pre',
    resolveId(id) {
      if (id in SHARED_RUNTIME) return { id, external: true };
      return null;
    },
    async buildStart() {
      await buildSharedRuntime();
    },
  };
}
