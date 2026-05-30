// Typed configuration, validated at startup. The service fails fast on invalid
// config.
import type { Result } from '@vaa/bsv';
import { ok, err } from '@vaa/bsv';
import type { ApiError } from './errors.js';
import { internal } from './errors.js';

export interface AppConfig {
  nodeEndpoint: string;
  network: 'mainnet' | 'testnet';
  predeterminedLevel: number;
  auth: { scheme: 'apiKey' | 'jwt'; credentials: string[] };
  rateLimit: { perMinute: number };
  logLevel: string;
}

export type Env = Record<string, string | undefined>;

function intField(env: Env, key: string, min: number): Result<number, ApiError> {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return err(internal(`missing ${key}`));
  if (!/^-?\d+$/.test(raw.trim())) return err(internal(`${key} is not an integer`));
  const n = Number(raw.trim());
  if (n < min) return err(internal(`${key} must be >= ${min}`));
  return ok(n);
}

export function loadConfig(env: Env): Result<AppConfig, ApiError> {
  const nodeEndpoint = env['NODE_ENDPOINT'];
  if (nodeEndpoint === undefined || nodeEndpoint.trim() === '') return err(internal('missing NODE_ENDPOINT'));

  const network = env['NETWORK'];
  if (network !== 'mainnet' && network !== 'testnet') return err(internal('NETWORK must be mainnet or testnet'));

  const level = intField(env, 'PREDETERMINED_LEVEL', 1);
  if (!level.ok) return err(level.error);

  const scheme = env['AUTH_SCHEME'];
  if (scheme !== 'apiKey' && scheme !== 'jwt') return err(internal('AUTH_SCHEME must be apiKey or jwt'));

  const credsRaw = env['AUTH_CREDENTIALS'];
  if (credsRaw === undefined || credsRaw.trim() === '') return err(internal('missing AUTH_CREDENTIALS'));
  const credentials = credsRaw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  if (credentials.length === 0) return err(internal('AUTH_CREDENTIALS is empty'));

  const perMinute = intField(env, 'RATE_LIMIT_PER_MINUTE', 1);
  if (!perMinute.ok) return err(perMinute.error);

  const logLevel = env['LOG_LEVEL'] ?? 'info';

  return ok({
    nodeEndpoint: nodeEndpoint.trim(),
    network,
    predeterminedLevel: level.value,
    auth: { scheme, credentials },
    rateLimit: { perMinute: perMinute.value },
    logLevel,
  });
}
