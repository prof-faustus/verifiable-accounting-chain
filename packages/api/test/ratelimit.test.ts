import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '@vaa/api';

test('E.4 T-rl-1 within limit passes', () => {
  const limiter = new RateLimiter(5, () => 0);
  for (let i = 0; i < 5; i++) assert.equal(limiter.check('caller').ok, true);
});

test('E.4 T-rl-2 over limit -> RateLimited', () => {
  const clock = { t: 0 };
  const limiter = new RateLimiter(5, () => clock.t);
  for (let i = 0; i < 5; i++) assert.equal(limiter.check('caller').ok, true);
  const r = limiter.check('caller');
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.kind, 'RateLimited');
    assert.ok(r.error.retryAfterMs > 0);
  }
  // a different caller has its own budget
  assert.equal(limiter.check('other').ok, true);
});
