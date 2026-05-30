// The common Result pattern. Untrusted-input paths return a Result and never
// throw; adversarial input yields an error value, not an exception.

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// The common verification-outcome pattern. The reason is a typed union supplied
// by each package; verification never throws on adversarial input.
export type VerifyResult<R = string> = { ok: true } | { ok: false; reason: R };

export function verifyOk(): VerifyResult<never> {
  return { ok: true };
}

export function verifyFail<R>(reason: R): VerifyResult<R> {
  return { ok: false, reason };
}
