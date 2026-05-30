import { rootFromSeed } from '@vaa/keys';

export const enc = (s) => new TextEncoder().encode(s);

export function sampleStructure() {
  return {
    version: 1,
    root: {
      path: [],
      label: 'ACME',
      children: [
        {
          path: ['GL'],
          label: 'General Ledger',
          children: [
            { path: ['GL', '1000-Cash'], label: 'Cash', accountType: 'asset', children: [], fieldTags: ['balance', 'movement'] },
            { path: ['GL', '4000-Sales'], label: 'Sales', accountType: 'income', children: [], fieldTags: ['net', 'tax'] },
          ],
        },
      ],
    },
  };
}

export function sampleMap() {
  const { rootPriv, rootPub } = rootFromSeed(enc('ledger-entity'));
  return { map: { structure: sampleStructure(), rootPub }, rootPriv, rootPub };
}

export function bigStructure(fieldCount) {
  const fieldTags = [];
  for (let i = 0; i < fieldCount; i++) fieldTags.push('f' + i);
  return {
    version: 1,
    root: {
      path: [],
      label: 'BIG',
      children: [{ path: ['GL'], label: 'GL', children: [{ path: ['GL', 'A'], label: 'A', accountType: 'asset', children: [], fieldTags }] }],
    },
  };
}
