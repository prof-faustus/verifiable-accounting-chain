// Typed CLI errors. Bad input yields a typed error and a non-zero exit, never a
// stack-only crash.
export type CliError =
  | { kind: 'BadArgs'; message: string }
  | { kind: 'FileError'; message: string }
  | { kind: 'BadJson'; message: string }
  | { kind: 'Failure'; message: string };

export const badArgs = (message: string): CliError => ({ kind: 'BadArgs', message });
export const fileError = (message: string): CliError => ({ kind: 'FileError', message });
export const badJson = (message: string): CliError => ({ kind: 'BadJson', message });
export const failure = (message: string): CliError => ({ kind: 'Failure', message });
