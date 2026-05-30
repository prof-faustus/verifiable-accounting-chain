// Public surface of @vaa/chain (Pillar 2: the ECDH-linked transaction chain).
export type { ChainError, ChainVerifyReason } from './errors.js';
export { brokenLink, notRootedAtPki, linkOutOfOrder, badChainProof, schemaInvalid } from './errors.js';

export {
  u32be,
  linkMessage,
  genesisMessage,
  deriveHeadPub,
  deriveHeadPriv,
  deriveNextPub,
  deriveNextPriv,
  linkSignedMessage,
} from './link.js';

export type { Outpoint, Link, ChainLinkProof, SignLink } from './chain.js';
export { TransactionChain, verifyLinks, verifyLinkProof } from './chain.js';

export { commonSecret } from './ecdh.js';
