/**
 * Reference Data Entities - Core
 * 
 * Currency, Resort, and ChildAgeBand entities.
 * These are foundational entities referenced by most other entities.
 * 
 * Reference: Phase 5 - Section B.1, B.2, B.3
 */

import type {
  EntityId,
  CurrencyCode,
  DateTimeString,
} from '../types';

// ============================================================
// CURRENCY
// Reference: Phase 5 - Section B.1
// ============================================================

/**
 * Supported currency configuration.
 */
export interface Currency {
  /** ISO 4217 currency code (e.g., USD, EUR, MVR) */
  readonly code: CurrencyCode;
  /** Full currency name */
  readonly name: string;
  /** Currency symbol (e.g., $, €, ރ) */
  readonly symbol: string;
  /** Decimal places - always 2 per A-001 */
  readonly decimal_places: 2;
}

// ============================================================
// RESORT
// Reference: Phase 5 - Section B.2
// ============================================================

/**
 * Resort property configuration.
 * Central entity linking all resort-specific reference data.
 */
export interface Resort {
  readonly id: EntityId;
  readonly name: string;
  
  /** Geographic destination (e.g., "Maldives", "Japan", "Lapland") */
  readonly destination: string;
  /** Sub-region (e.g., "North Malé Atoll") */
  readonly atoll?: string;
  readonly description?: string;
  readonly star_rating?: number;
  
  // Currency & Pricing
  /** Default currency for this resort's rates */
  readonly default_currency_code: CurrencyCode;
  /** Reference to default markup configuration */
  readonly default_markup_configuration_id: EntityId;
  
  // Transfer Configuration
  /**
   * If true, a transfer selection is BLOCKING required.
   * Reference: Phase 3 - PRC-022a
   */
  readonly transfer_required: boolean;
  /** Reason shown when transfer is required */
  readonly transfer_required_reason?: string;
  /** Informational: typical transfer time from main airport */
  readonly transfer_time_from_airport_minutes?: number;
  
  // Season Fallback
  /**
   * If true, missing season dates use default_season_id.
   * Reference: Phase 3 - SEA-003, SEA-004
   */
  readonly allow_default_season_fallback: boolean;
  /** Season to use when no explicit season covers a date */
  readonly default_season_id?: EntityId;
  
  // Adult Requirement
  /**
   * If true, at least one adult is required.
   * Reference: Phase 3 - OCC-001a (configurable per resort)
   */
  readonly require_adult_guest: boolean;
  
  // Metadata
  readonly contact_email?: string;
  readonly is_active: boolean;
  readonly created_at: DateTimeString;
  readonly updated_at: DateTimeString;
}

// ============================================================
// CHILD AGE BAND
// Reference: Phase 5 - Section B.3
// ============================================================

/**
 * Age band for child pricing.
 * Reference: A-014 - Max child age is 11; 12+ is adult
 */
export interface ChildAgeBand {
  readonly id: EntityId;
  readonly resort_id: EntityId;
  
  /** Display name (e.g., "Infant", "Toddler", "Child") */
  readonly name: string;
  /** Minimum age (inclusive) */
  readonly min_age: number;
  /** Maximum age (inclusive); must be <= 11 */
  readonly max_age: number;
  
  readonly description?: string;
}

/**
 * Validates that child age bands cover all ages 0-11 without gaps or overlaps.
 * This is a data integrity check, NOT runtime validation.
 * Reference: BRD v1.2 Section 5.4.1
 */
export function validateChildAgeBandCoverage(bands: readonly ChildAgeBand[]): string[] {
  const errors: string[] = [];
  
  if (bands.length === 0) {
    errors.push('At least one child age band must be defined');
    return errors;
  }
  
  // Sort by min_age
  const sorted = [...bands].sort((a, b) => a.min_age - b.min_age);
  
  // Check coverage starts at 0
  if (sorted[0].min_age !== 0) {
    errors.push(`Age band gap: no band covers age 0 (first band starts at ${sorted[0].min_age})`);
  }
  
  // Check for gaps and overlaps
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    
    if (current.max_age >= next.min_age) {
      errors.push(`Age band overlap: "${current.name}" (${current.min_age}-${current.max_age}) overlaps with "${next.name}" (${next.min_age}-${next.max_age})`);
    } else if (current.max_age + 1 < next.min_age) {
      errors.push(`Age band gap: no band covers ages ${current.max_age + 1} to ${next.min_age - 1}`);
    }
  }
  
  // Check coverage ends at 11
  const last = sorted[sorted.length - 1];
  if (last.max_age !== 11) {
    errors.push(`Age band gap: no band covers age 11 (last band ends at ${last.max_age})`);
  }
  
  // Check no band exceeds 11
  for (const band of bands) {
    if (band.max_age > 11) {
      errors.push(`Age band "${band.name}" has max_age ${band.max_age} which exceeds 11 (12+ must be adult)`);
    }
    if (band.min_age > band.max_age) {
      errors.push(`Age band "${band.name}" has min_age ${band.min_age} > max_age ${band.max_age}`);
    }
  }
  
  return errors;
}

/**
 * Finds the age band for a given child age.
 * @returns The matching age band or undefined if none found.
 */
export function findAgeBandForAge(
  bands: readonly ChildAgeBand[],
  age: number
): ChildAgeBand | undefined {
  return bands.find(band => age >= band.min_age && age <= band.max_age);
}
