/**
 * Core Module - Barrel Export
 * 
 * All types, entities, utilities, and calculation engine.
 * 
 * NOTE: Some symbols exist in multiple modules with different semantics:
 * - InterResortTransferInput: Entity form (user input) vs Calculation form (resolved input)
 * These are exported with aliases to make their purpose explicit.
 */

// Types (no conflicts)
export * from './types';

// Entities (no conflicts after InterResortTransferInput removed from barrel)
export * from './entities';

// Utils (canonical location for shared utilities)
export * from './utils';

// Calculation module
export * from './calculation';

// Logging module (observability only)
export * from './logging';

// Error categorization module (metadata only)
export * from './errors';

// ============================================================
// EXPLICIT ALIASED EXPORTS FOR DUAL-PURPOSE TYPES
// ============================================================

// InterResortTransferInput exists in two bounded contexts:
// 1. Entity layer: User/domain input for specifying a transfer request
// 2. Calculation layer: Normalized input for calculating transfer cost
//
// These are NOT duplicates - they represent different stages of processing.

/** Entity-layer transfer input (user-facing request) */
export type { InterResortTransferInput as EntityInterResortTransferInput } from './entities/quote/transfer';

/** Calculation-layer transfer input (resolved for calculation) */
export type { InterResortTransferInput as CalculationInterResortTransferInput } from './calculation/types';
