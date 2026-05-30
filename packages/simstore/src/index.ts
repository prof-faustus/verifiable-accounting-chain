// Public surface of @vaa/simstore.
export { SEED, deterministicLeaves, deterministicSample, keyForIndex } from './population.js';
export type { StorageMeasurement, TimingStat } from './measure.js';
export { chooseLevel, measureStorage, ciVector } from './measure.js';
