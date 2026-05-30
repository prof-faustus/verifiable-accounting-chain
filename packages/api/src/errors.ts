// Typed errors for the api package. Every handler returns a typed ApiError or a
// typed success; adversarial input never throws.

export type ApiError =
  | { kind: 'BadRequest'; message: string; field: string; reason: string }
  | { kind: 'Unauthorized'; message: string }
  | { kind: 'RateLimited'; message: string; retryAfterMs: number }
  | { kind: 'NotFound'; message: string; what: string }
  | { kind: 'Internal'; message: string; detail: string };

export const badRequest = (field: string, reason: string): ApiError => ({
  kind: 'BadRequest',
  message: `bad request: ${field} ${reason}`,
  field,
  reason,
});

export const unauthorized = (): ApiError => ({ kind: 'Unauthorized', message: 'unauthorized' });

export const rateLimited = (retryAfterMs: number): ApiError => ({
  kind: 'RateLimited',
  message: `rate limited; retry after ${retryAfterMs} ms`,
  retryAfterMs,
});

export const notFound = (what: string): ApiError => ({ kind: 'NotFound', message: `not found: ${what}`, what });

export const internal = (detail: string): ApiError => ({ kind: 'Internal', message: `internal error: ${detail}`, detail });

export function statusForError(e: ApiError): number {
  switch (e.kind) {
    case 'BadRequest':
      return 400;
    case 'Unauthorized':
      return 401;
    case 'NotFound':
      return 404;
    case 'RateLimited':
      return 429;
    case 'Internal':
      return 500;
  }
}
