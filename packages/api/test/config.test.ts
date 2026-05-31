import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '@vaa/api';

const valid = {
  NODE_ENDPOINT: 'https://node.example/v1/bsv/main',
  NETWORK: 'mainnet',
  PREDETERMINED_LEVEL: '4',
  AUTH_SCHEME: 'apiKey',
  AUTH_CREDENTIALS: 'k1,k2',
  RATE_LIMIT_PER_MINUTE: '120',
  LOG_LEVEL: 'info',
};

test('E.2 T-cfg-1 valid env -> AppConfig', () => {
  const r = loadConfig(valid);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.network, 'mainnet');
    assert.equal(r.value.predeterminedLevel, 4);
    assert.deepEqual(r.value.auth.credentials, ['k1', 'k2']);
    assert.equal(r.value.rateLimit.perMinute, 120);
    assert.equal(r.value.pkiRoot.provider, 'external');
  }
});

test('E.2 T-cfg-1b the PKI root provider is configured', () => {
  const seeded = loadConfig({ ...valid, PKI_ROOT_PROVIDER: 'seed', PKI_ROOT_SEED: 'entity-seed' });
  assert.equal(seeded.ok, true);
  if (seeded.ok) {
    assert.equal(seeded.value.pkiRoot.provider, 'seed');
    assert.equal(seeded.value.pkiRoot.seed, 'entity-seed');
  }
  // provider 'seed' without a seed fails fast
  assert.equal(loadConfig({ ...valid, PKI_ROOT_PROVIDER: 'seed' }).ok, false);
  // an unknown provider fails
  assert.equal(loadConfig({ ...valid, PKI_ROOT_PROVIDER: 'magic' }).ok, false);
});

test('E.2 T-cfg-2 each missing/invalid field fails', () => {
  assert.equal(loadConfig({ ...valid, NODE_ENDPOINT: '' }).ok, false);
  assert.equal(loadConfig({ ...valid, NETWORK: 'mars' }).ok, false);
  assert.equal(loadConfig({ ...valid, PREDETERMINED_LEVEL: 'x' }).ok, false);
  assert.equal(loadConfig({ ...valid, PREDETERMINED_LEVEL: '0' }).ok, false);
  assert.equal(loadConfig({ ...valid, AUTH_SCHEME: 'none' }).ok, false);
  assert.equal(loadConfig({ ...valid, AUTH_CREDENTIALS: '' }).ok, false);
  assert.equal(loadConfig({ ...valid, RATE_LIMIT_PER_MINUTE: '-1' }).ok, false);
});
