// Index-map population: derive the proofstore IndexKey from the BSV transaction
// context of an anchored accounting object.
import type { Txid, Script } from '@vaa/bsv';
import type { IndexKey, Direction } from '@vaa/proofstore';
import type { EvidenceObject } from './schema.js';

export interface BsvContext {
  txid: Txid;
  direction: Direction;
  position: number;
  blockPosition: number;
  lockingScript?: Script;
  unlockingScript?: Script;
  amountMinorUnits?: bigint;
}

export function indexKeyFor(_obj: EvidenceObject, bsv: BsvContext): IndexKey {
  const key: IndexKey = {
    txid: bsv.txid,
    direction: bsv.direction,
    position: bsv.position,
    blockPosition: bsv.blockPosition,
  };
  if (bsv.lockingScript !== undefined) key.lockingScript = bsv.lockingScript;
  if (bsv.unlockingScript !== undefined) key.unlockingScript = bsv.unlockingScript;
  if (bsv.amountMinorUnits !== undefined) key.amountMinorUnits = bsv.amountMinorUnits;
  return key;
}
