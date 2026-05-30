// Public surface of @vaa/api.
export type { ApiError } from './errors.js';
export { badRequest, unauthorized, rateLimited, notFound, internal, statusForError } from './errors.js';

export type { AppConfig, Env } from './config.js';
export { loadConfig } from './config.js';

export type { LogLevel, LogSink } from './logger.js';
export { Logger } from './logger.js';

export type { CallerId, ApiRequest } from './auth.js';
export { authenticate } from './auth.js';

export { RateLimiter } from './ratelimit.js';

export type { AuditEntry } from './auditlog.js';
export { AuditLog } from './auditlog.js';

export type {
  ParsedAnchor,
  ParsedProve,
  ParsedQuery,
  ParsedVerify,
} from './schemas.js';
export {
  parseAnchorRequest,
  parseProveRequest,
  parseQueryRequest,
  parseVerifyRequest,
  parseIndexKey,
} from './schemas.js';

export type { AppContext, VerifyOutcome, StoredProofJson } from './handlers.js';
export { anchor, prove, query, verify } from './handlers.js';

export type { App, HandledResponse } from './server.js';
export { createApp, startServer } from './server.js';
