/**
 * ID Generation Utilities
 * 
 * Deterministic and unique identifier generation.
 */

import type { EntityId } from '../types';
import { toEntityId } from '../types';

// ============================================================
// ID GENERATION
// ============================================================

/**
 * Entity type prefixes for readable IDs.
 */
export const ID_PREFIXES = {
  QUOTE: 'QT',
  QUOTE_VERSION: 'QV',
  QUOTE_LEG: 'QL',
  LINE_ITEM: 'LI',
  INTER_RESORT_TRANSFER: 'IRT',
  EMAIL: 'EM',
  PDF: 'PF',
  
  // Reference data (typically loaded, not generated)
  RESORT: 'RST',
  ROOM_TYPE: 'RT',
  SEASON: 'SEA',
  RATE: 'RAT',
  CHILD_AGE_BAND: 'CAB',
  MEAL_PLAN: 'MP',
  TRANSFER_TYPE: 'TT',
  ACTIVITY: 'ACT',
  TAX_CONFIG: 'TAX',
  DISCOUNT: 'DSC',
  MARKUP_CONFIG: 'MKP',
  FESTIVE_SUPPLEMENT: 'FS',
  BLACKOUT: 'BLK',
  MIN_STAY: 'MSR',
  HONEYMOON_PERK: 'HP',
} as const;

export type IdPrefix = typeof ID_PREFIXES[keyof typeof ID_PREFIXES];

/**
 * Simple counter-based ID generator for testing/development.
 * Production should use UUID or similar.
 */
let counter = 0;

/**
 * Generates a unique ID with prefix.
 * Format: PREFIX-TIMESTAMP-SEQUENCE
 */
export function generateId(prefix: IdPrefix): EntityId {
  counter++;
  const timestamp = Date.now().toString(36).toUpperCase();
  const sequence = counter.toString().padStart(4, '0');
  return toEntityId(`${prefix}-${timestamp}-${sequence}`);
}

/**
 * Generates a quote ID.
 * Format: QT-YYYY-NNNNN (e.g., QT-2025-00001)
 */
export function generateQuoteId(year: number, sequence: number): EntityId {
  const seq = sequence.toString().padStart(5, '0');
  return toEntityId(`${ID_PREFIXES.QUOTE}-${year}-${seq}`);
}

/**
 * Generates a quote version ID.
 * Format: QV-QUOTEID-VN (e.g., QV-QT-2025-00001-001)
 */
export function generateQuoteVersionId(
  quoteId: EntityId,
  versionNumber: number
): EntityId {
  const version = versionNumber.toString().padStart(3, '0');
  return toEntityId(`${ID_PREFIXES.QUOTE_VERSION}-${quoteId}-${version}`);
}

/**
 * Generates a leg ID.
 * Format: QL-VERSIONID-N (e.g., QL-QV-QT-2025-00001-001-1)
 */
export function generateLegId(
  versionId: EntityId,
  sequence: number
): EntityId {
  return toEntityId(`${ID_PREFIXES.QUOTE_LEG}-${versionId}-${sequence}`);
}

/**
 * Generates a line item ID.
 */
export function generateLineItemId(
  legId: EntityId,
  sequence: number
): EntityId {
  return toEntityId(`${ID_PREFIXES.LINE_ITEM}-${legId}-${sequence}`);
}

/**
 * Resets the counter (for testing only).
 */
export function resetIdCounter(): void {
  counter = 0;
}

// ============================================================
// ID PARSING
// ============================================================

/**
 * Extracts the prefix from an ID.
 */
export function getIdPrefix(id: EntityId): string {
  const parts = (id as string).split('-');
  return parts[0] || '';
}

/**
 * Checks if an ID has the expected prefix.
 */
export function hasPrefix(id: EntityId, prefix: IdPrefix): boolean {
  return getIdPrefix(id) === prefix;
}

/**
 * Validates an ID format.
 */
export function isValidId(id: string): boolean {
  // Must have at least prefix-something
  return /^[A-Z]{2,3}-\S+$/.test(id);
}
