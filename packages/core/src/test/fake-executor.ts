// Test-only CommandExecutor. Lets us exercise adapters, parsers and the
// transparency log without a real SSH host: map a command (exact string or regex)
// to a canned ExecResult, and record every command seen.

import type { CommandExecutor, ExecResult } from '../exec/types.js';

type Responder = ExecResult | ((command: string) => ExecResult);

export class FakeExecutor implements CommandExecutor {
  readonly commands: string[] = [];
  private readonly rules: Array<{ match: (cmd: string) => boolean; respond: Responder }> = [];
  private fallback: Responder = { stdout: '', stderr: 'no rule matched', exitCode: 127 };

  /** Respond to commands matching a substring or regex. */
  on(match: string | RegExp, respond: Responder): this {
    const test =
      typeof match === 'string'
        ? (cmd: string) => cmd.includes(match)
        : (cmd: string) => match.test(cmd);
    this.rules.push({ match: test, respond });
    return this;
  }

  /** Set the response used when no rule matches. */
  otherwise(respond: Responder): this {
    this.fallback = respond;
    return this;
  }

  exec(command: string): Promise<ExecResult> {
    this.commands.push(command);
    const rule = this.rules.find((r) => r.match(command));
    const responder = rule ? rule.respond : this.fallback;
    return Promise.resolve(typeof responder === 'function' ? responder(command) : responder);
  }
}

/** Shorthand for a successful (exit 0) result. */
export function okResult(stdout: string): ExecResult {
  return { stdout, stderr: '', exitCode: 0 };
}
