// Adapter selection (Art. 6). v1 ships the Debian/Ubuntu/Mint adapter only; any
// other family gets a fallback whose capabilities report `unsupported` with a clear
// reason (graceful degradation, Art. 7) rather than guessing wrong commands. More
// families arrive per the host roadmap (plan §4).

import type { CommandExecutor } from '../exec/types.js';
import type { Capabilities } from '../contract/capabilities.js';
import { unsupported } from '../contract/result.js';
import type { OsInfo } from './os.js';
import { DebianAdapter } from './debian.js';

/** A Capabilities implementation where every call is unsupported, for clarity. */
export function createUnsupportedAdapter(reason: string): Capabilities {
  const fail = () => Promise.resolve(unsupported<never>(reason));
  return {
    listDir: fail,
    stat: fail,
    readFile: fail,
    writeFile: fail,
    systemMetrics: fail,
    listProcesses: fail,
    listServices: fail,
  };
}

/** Pick the capability adapter for a detected OS over the given executor. */
export function selectAdapter(os: OsInfo, executor: CommandExecutor): Capabilities {
  if (os.family === 'debian') return new DebianAdapter(executor);
  return createUnsupportedAdapter(
    `OS family "${os.family}" is not supported in v1 (Debian/Ubuntu/Mint only); ` +
      'see the host roadmap',
  );
}
