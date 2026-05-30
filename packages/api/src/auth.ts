// Caller authentication. The scheme is configured, not hard-coded; the credential
// set comes from config.
import type { Result } from '@vaa/bsv';
import { ok, err } from '@vaa/bsv';
import type { AppConfig } from './config.js';
import type { ApiError } from './errors.js';
import { unauthorized } from './errors.js';

export type CallerId = string;

export interface ApiRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  body: unknown;
}

export function authenticate(req: ApiRequest, cfg: AppConfig): Result<CallerId, ApiError> {
  if (cfg.auth.scheme === 'apiKey') {
    const key = req.headers['x-api-key'];
    if (key !== undefined && cfg.auth.credentials.includes(key)) return ok(`apiKey:${key}`);
    return err(unauthorized());
  }
  // jwt scheme (pluggable): a configured bearer token.
  const authz = req.headers['authorization'];
  if (authz !== undefined && authz.startsWith('Bearer ')) {
    const token = authz.slice('Bearer '.length);
    if (cfg.auth.credentials.includes(token)) return ok(`jwt:${token}`);
  }
  return err(unauthorized());
}
