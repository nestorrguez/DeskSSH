// A demonstration manifest that re-expresses a subset of the Debian adapter
// declaratively (spec 002, E2.3). Its purpose is to prove the manifest engine
// reaches parity with the reference code adapter, exercising both normalization
// paths:
//   • `listDir` — a fully declarative records spec (independent of parseListDir);
//   • `systemMetrics` — a first-party code hook (the multi-section /proc snapshot is
//     irregular enough to warrant the escape, FR-202).
//
// It reuses Debian's command constants and code hook so the emitted commands are
// byte-identical to `DebianAdapter`'s — the parity tests assert exactly that.
// `DebianAdapter` stays the production reference; a full migration is out of scope.

import { FIND_PRINTF, METRICS_COMMAND, parseSystemMetrics } from './debian.js';
import type { AdapterManifest } from './manifest.js';
import { quote } from './shell.js';

export const debianManifest: AdapterManifest = {
  listDir: {
    template: `find {path} -maxdepth 1 -mindepth 1 -printf ${quote(FIND_PRINTF)}`,
    normalize: {
      kind: 'records',
      columnDelimiter: '\t',
      columns: [
        {
          field: 'type',
          enum: { f: 'file', d: 'directory', l: 'symlink' },
          enumDefault: 'other',
        },
        { field: 'size', type: 'int' },
        { field: 'mode', type: 'octal' },
        { field: 'owner' },
        { field: 'group' },
        { field: 'mtime', type: 'epochSeconds' },
        { field: 'name', rest: true },
      ],
    },
  },
  systemMetrics: {
    template: METRICS_COMMAND,
    normalize: parseSystemMetrics,
  },
};
