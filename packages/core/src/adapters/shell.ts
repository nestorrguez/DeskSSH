// Safe shell quoting for arguments (paths, names) embedded in commands. Wraps the
// argument in single quotes and escapes any embedded single quote, so user-provided
// paths cannot break out of the intended argument (security, Art. 4).

export function quote(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}
