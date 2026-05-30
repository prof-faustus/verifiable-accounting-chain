// BSV-curve (secp256k1) group operations, wrapping the SDK so that no other
// package performs curve math directly. Scalars are bigint mod n; points are an
// opaque wrapper over the SDK curve point. Used by the PKI key hierarchy
// (@vaa/keys) and the ECDH-linked chain (@vaa/chain).
import { Curve, Point as SdkPoint, BigNumber } from '@bsv/sdk';
import type { Result } from './result.js';
import { ok, err } from './result.js';
import type { BsvError } from './errors.js';
import { curveBadPoint } from './errors.js';
import type { Hash } from './hash.js';
import { toInternalBytes } from './hash.js';
import { toHexLower, fromHex } from './bytes.js';

const curve = new Curve();

export type Scalar = bigint;

declare const PointBrand: unique symbol;
export type Point = { readonly [PointBrand]: 'Point' };

// The group order n of the BSV curve.
export const CURVE_N: bigint = BigInt(curve.n.toString());

function wrap(p: SdkPoint): Point {
  return p as unknown as Point;
}
function unwrap(p: Point): SdkPoint {
  return p as unknown as SdkPoint;
}
function toBn(s: bigint): BigNumber {
  return new BigNumber(scalarMod(s).toString());
}

// The generator G of the BSV curve.
export const CURVE_G: Point = wrap(curve.g);

export function scalarMod(x: bigint): Scalar {
  const r = x % CURVE_N;
  return r < 0n ? r + CURVE_N : r;
}

export function scalarAdd(a: Scalar, b: Scalar): Scalar {
  return scalarMod(a + b);
}

export function scalarIsZero(a: Scalar): boolean {
  return scalarMod(a) === 0n;
}

// Interpret 32 big-endian bytes as an integer and reduce mod n. The negligible
// modulo bias is acceptable here: the value is a derivation offset, not a nonce.
export function reduceScalar(bytes: Uint8Array): Scalar {
  return scalarMod(BigInt('0x' + (bytes.length === 0 ? '0' : toHexLower(bytes))));
}

export function reduceHash(h: Hash): Scalar {
  return reduceScalar(toInternalBytes(h));
}

export function pointMul(p: Point, k: Scalar): Point {
  return wrap(unwrap(p).mul(toBn(k)));
}

export function pointMulG(k: Scalar): Point {
  return wrap(curve.g.mul(toBn(k)));
}

export function pointAdd(a: Point, b: Point): Point {
  return wrap(unwrap(a).add(unwrap(b)));
}

export function pointEq(a: Point, b: Point): boolean {
  return unwrap(a).eq(unwrap(b));
}

// 33-byte compressed encoding (internal/wire order).
export function encodePoint(p: Point): Uint8Array {
  return Uint8Array.from(unwrap(p).encode(true) as number[]);
}

export function pointToHex(p: Point): string {
  return unwrap(p).encode(true, 'hex') as string;
}

export function decodePoint(bytes: Uint8Array): Result<Point, BsvError> {
  if (bytes.length !== 33) return err(curveBadPoint(`expected 33 compressed bytes, got ${bytes.length}`));
  try {
    return ok(wrap(SdkPoint.fromString(toHexLower(bytes))));
  } catch (e) {
    return err(curveBadPoint(e instanceof Error ? e.message : 'decode failed'));
  }
}

export function pointFromHex(hex: string): Result<Point, BsvError> {
  const bytes = fromHex(hex);
  if (!bytes.ok) return err(curveBadPoint('not hex'));
  return decodePoint(bytes.value);
}
