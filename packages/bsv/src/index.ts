// Public surface of @vaa/bsv.
//
// The branded value types Hash, Txid, and Script are exported as types for
// annotations; their operations are exported as namespaces HashOps, TxidOps, and
// ScriptOps (e.g. HashOps.equals, TxidOps.fromDisplayHex, ScriptOps.toHex). All
// other functions are exported directly.

export type { Result, VerifyResult } from './result.js';
export { ok, err, verifyOk, verifyFail } from './result.js';

export type { BsvError, BsvErrorKind } from './errors.js';
export {
  isBsvError,
  BsvException,
  throwBsv,
  hashBadLength,
  hashBadHex,
  txMalformed,
  txTruncated,
  headerBadLength,
  chainNotLinked,
  chainTargetNotMet,
  envelopeOversize,
  envelopeNotRecognised,
  nodeUnreachable,
  nodeNotFound,
  nodeBadResponse,
  bytesOutOfRange,
} from './errors.js';

export type { VarInt } from './bytes.js';
export {
  readU32LE,
  writeU32LE,
  readVarInt,
  writeVarInt,
  reverseBytes,
  concat,
  toHexLower,
  fromHex,
} from './bytes.js';

export { doubleSha256, hashLeaf, hashNode } from './hashing.js';

export * as HashOps from './hash.js';
export type { Hash } from './hash.js';
export { HASH_LEN } from './hash.js';

export * as TxidOps from './txid.js';
export type { Txid } from './txid.js';

export * as ScriptOps from './script.js';
export type { Script } from './script.js';

export type { Transaction, TxInput, TxOutput } from './transaction.js';
export { parseTransaction, txid, inputs, outputs, rawBytes } from './transaction.js';

export type { BlockHeader } from './header.js';
export {
  HEADER_LEN,
  parseHeader,
  serializeHeader,
  headerHash,
  targetFromBits,
  meetsTarget,
} from './header.js';

export { HeaderChain } from './headerchain.js';

export {
  MAX_ENVELOPE_PAYLOAD,
  buildScriptDataEnvelope,
  recognise,
  scriptOpcodes,
  containsOpReturn,
} from './scriptdataenvelope.js';

export type { NodeClient, Transport, TransportResult, OfflineDataset } from './nodeclient.js';
export { OfflineNodeClient, LiveNodeClient } from './nodeclient.js';
