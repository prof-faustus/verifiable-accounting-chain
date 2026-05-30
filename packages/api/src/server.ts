// Wire config -> auth -> rate limit -> schema validation -> handler -> audit log,
// with health and readiness endpoints and structured logging. The request
// pipeline is exposed as `handle` for testing; `startServer` binds it to HTTP.
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { ApiRequest } from './auth.js';
import { authenticate } from './auth.js';
import { RateLimiter } from './ratelimit.js';
import { statusForError, badRequest, internal } from './errors.js';
import type { ApiError } from './errors.js';
import { parseAnchorRequest, parseProveRequest, parseQueryRequest, parseVerifyRequest } from './schemas.js';
import { anchor, prove, query, verify } from './handlers.js';
import type { AppContext } from './handlers.js';

export interface HandledResponse {
  status: number;
  json: unknown;
}

function errBody(e: ApiError): HandledResponse {
  return { status: statusForError(e), json: { error: e } };
}

export interface App {
  handle(req: ApiRequest): HandledResponse;
  context: AppContext;
}

export function createApp(ctx: AppContext): App {
  const limiter = new RateLimiter(ctx.config.rateLimit.perMinute, ctx.now);

  function handle(req: ApiRequest): HandledResponse {
    if (req.method === 'GET' && req.path === '/healthz') return { status: 200, json: { status: 'ok' } };
    if (req.method === 'GET' && req.path === '/readyz') return { status: 200, json: { ready: true } };
    if (req.method !== 'POST') return errBody({ kind: 'NotFound', message: 'no such route', what: `${req.method} ${req.path}` });

    const authed = authenticate(req, ctx.config);
    if (!authed.ok) {
      ctx.logger.warn('auth_failed', { path: req.path });
      return errBody(authed.error);
    }
    const callerId = authed.value;

    const limited = limiter.check(callerId);
    if (!limited.ok) {
      ctx.logger.warn('rate_limited', { caller: callerId });
      return errBody(limited.error);
    }

    switch (req.path) {
      case '/anchor': {
        const parsed = parseAnchorRequest(req.body);
        if (!parsed.ok) return errBody(parsed.error);
        const r = anchor(parsed.value, ctx);
        return r.ok ? { status: 200, json: r.value } : errBody(r.error);
      }
      case '/prove': {
        const parsed = parseProveRequest(req.body);
        if (!parsed.ok) return errBody(parsed.error);
        const r = prove(parsed.value, ctx);
        return r.ok ? { status: 200, json: r.value } : errBody(r.error);
      }
      case '/query': {
        const parsed = parseQueryRequest(req.body);
        if (!parsed.ok) return errBody(parsed.error);
        const r = query(parsed.value, ctx, callerId);
        return r.ok ? { status: 200, json: r.value } : errBody(r.error);
      }
      case '/verify': {
        const parsed = parseVerifyRequest(req.body);
        if (!parsed.ok) return errBody(parsed.error);
        const r = verify(parsed.value, ctx);
        return r.ok ? { status: 200, json: r.value } : errBody(r.error);
      }
      default:
        return errBody({ kind: 'NotFound', message: 'no such route', what: req.path });
    }
  }

  return { handle, context: ctx };
}

export function startServer(app: App, port: number): Server {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      let body: unknown = undefined;
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.length > 0) {
        try {
          body = JSON.parse(raw);
        } catch {
          const e = badRequest('body', 'is not valid JSON');
          res.writeHead(statusForError(e), { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: e }));
          return;
        }
      }
      const url = new URL(req.url ?? '/', 'http://localhost');
      const headers: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(req.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(',') : v;
      try {
        const response = app.handle({ method: req.method ?? 'GET', path: url.pathname, headers, body });
        res.writeHead(response.status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(response.json));
      } catch (e) {
        const ie = internal(e instanceof Error ? e.message : 'unknown');
        res.writeHead(statusForError(ie), { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: ie }));
      }
    });
  });
  server.listen(port);
  return server;
}
