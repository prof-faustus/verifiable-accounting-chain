// Structured logging (JSON lines). No secret/record content, keys, or full
// proofs are logged. An audit channel (see auditlog.ts) records proof responses
// with metadata only.
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export interface LogSink {
  write(line: string): void;
}

export class Logger {
  private readonly threshold: number;
  private readonly sink: LogSink;

  constructor(level: string, sink: LogSink = { write: (l) => console.log(l) }) {
    this.threshold = ORDER[(level as LogLevel) in ORDER ? (level as LogLevel) : 'info'];
    this.sink = sink;
  }

  private emit(level: LogLevel, event: string, fields: Record<string, string | number | boolean>): void {
    if (ORDER[level] < this.threshold) return;
    this.sink.write(JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields }));
  }

  debug(event: string, fields: Record<string, string | number | boolean> = {}): void {
    this.emit('debug', event, fields);
  }
  info(event: string, fields: Record<string, string | number | boolean> = {}): void {
    this.emit('info', event, fields);
  }
  warn(event: string, fields: Record<string, string | number | boolean> = {}): void {
    this.emit('warn', event, fields);
  }
  error(event: string, fields: Record<string, string | number | boolean> = {}): void {
    this.emit('error', event, fields);
  }
}
