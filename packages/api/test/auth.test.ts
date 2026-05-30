import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authenticate, loadConfig } from '@vaa/api';
import type { AppConfig, ApiRequest } from '@vaa/api';

function cfg(scheme: 'apiKey' | 'jwt'): AppConfig {
  const r = loadConfig({
    NODE_ENDPOINT: 'https://x',
    NETWORK: 'testnet',
    PREDETERMINED_LEVEL: '2',
    AUTH_SCHEME: scheme,
    AUTH_CREDENTIALS: 'tok1',
    RATE_LIMIT_PER_MINUTE: '10',
    LOG_LEVEL: 'error',
  });
  if (!r.ok) throw new Error('bad config');
  return r.value;
}

function req(headers: Record<string, string | undefined>): ApiRequest {
  return { method: 'POST', path: '/prove', headers, body: {} };
}

test('E.3 T-auth-1 valid credential -> CallerId', () => {
  assert.equal(authenticate(req({ 'x-api-key': 'tok1' }), cfg('apiKey')).ok, true);
  assert.equal(authenticate(req({ authorization: 'Bearer tok1' }), cfg('jwt')).ok, true);
});

test('E.3 T-auth-2 missing/invalid -> Unauthorized', () => {
  assert.equal(authenticate(req({}), cfg('apiKey')).ok, false);
  assert.equal(authenticate(req({ 'x-api-key': 'wrong' }), cfg('apiKey')).ok, false);
  const r = authenticate(req({ authorization: 'Bearer nope' }), cfg('jwt'));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.kind, 'Unauthorized');
});
