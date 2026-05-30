// Per-caller token-bucket rate limiter. The clock is injectable for testing.
import type { Result } from '@vaa/bsv';
import { ok, err } from '@vaa/bsv';
import type { ApiError } from './errors.js';
import { rateLimited } from './errors.js';

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

export class RateLimiter {
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private readonly now: () => number;
  private readonly buckets = new Map<string, Bucket>();

  constructor(perMinute: number, now: () => number = () => Date.now()) {
    this.capacity = perMinute;
    this.refillPerMs = perMinute / 60000;
    this.now = now;
  }

  check(callerId: string): Result<void, ApiError> {
    const t = this.now();
    let bucket = this.buckets.get(callerId);
    if (bucket === undefined) {
      bucket = { tokens: this.capacity, lastRefillMs: t };
      this.buckets.set(callerId, bucket);
    } else {
      const elapsed = t - bucket.lastRefillMs;
      bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.refillPerMs);
      bucket.lastRefillMs = t;
    }
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return ok(undefined);
    }
    const needed = 1 - bucket.tokens;
    const retryAfterMs = Math.ceil(needed / this.refillPerMs);
    return err(rateLimited(retryAfterMs));
  }
}
