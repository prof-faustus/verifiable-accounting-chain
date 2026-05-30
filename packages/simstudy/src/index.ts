// Public surface of @vaa/simstudy.
export { SEED, buildPopulation, rollForwardArrays } from './population.js';
export type { ArPopulation } from './population.js';
export { FAULT_CLASSES, detectFault } from './faults.js';
export type { FaultClass, StudyContext } from './faults.js';
export { measureAssurance, ciVector, CI_M, REPORT_POINTS } from './measure.js';
export type { AssuranceMeasurement, FaultSummary } from './measure.js';
