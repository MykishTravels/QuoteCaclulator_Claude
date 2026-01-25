/**
 * Reference Data Entities - Accommodation
 * 
 * RoomType, Season, and Rate entities for accommodation pricing.
 * 
 * Reference: Phase 5 - Section B.4, B.5, B.6
 */

import type {
  EntityId,
  DateString,
  CurrencyCode,
  MoneyAmount,
  DateRange,
} from '../types';

// ============================================================
// ROOM TYPE
// Reference: Phase 5 - Section B.4
// ============================================================

/**
 * Room category within a resort.
 */
export interface RoomType {
  readonly id: EntityId;
  readonly resort_id: EntityId;
  
  readonly name: string;
  /** Category (e.g., "villa", "bungalow", "overwater") */
  readonly category: string;
  readonly description?: string;
  
  // Physical Attributes (informational)
  readonly size_sqm?: number;
  readonly view_type?: string;
  readonly bed_configuration?: string;
  readonly amenities?: readonly string[];
  
  // Occupancy Rules
  /** Maximum number of adults */
  readonly max_occupancy_adults: number;
  /** Maximum number of children */
  readonly max_occupancy_children: number;
  /** Maximum total guests (may be less than adults + children) */
  readonly max_occupancy_total: number;
  /** Number of adults included in base rate */
  readonly base_occupancy_adults: number;
  /** Number of children included in base rate */
  readonly base_occupancy_children: number;
  
  readonly is_active: boolean;
}

/**
 * Validates occupancy configuration for a room type.
 */
export function validateRoomTypeOccupancy(room: RoomType): string[] {
  const errors: string[] = [];
  
  if (room.max_occupancy_adults < 1) {
    errors.push('max_occupancy_adults must be at least 1');
  }
  
  if (room.max_occupancy_children < 0) {
    errors.push('max_occupancy_children cannot be negative');
  }
  
  if (room.max_occupancy_total < 1) {
    errors.push('max_occupancy_total must be at least 1');
  }
  
  if (room.max_occupancy_total > room.max_occupancy_adults + room.max_occupancy_children) {
    errors.push('max_occupancy_total cannot exceed max_occupancy_adults + max_occupancy_children');
  }
  
  if (room.base_occupancy_adults < 0 || room.base_occupancy_adults > room.max_occupancy_adults) {
    errors.push('base_occupancy_adults must be between 0 and max_occupancy_adults');
  }
  
  if (room.base_occupancy_children < 0 || room.base_occupancy_children > room.max_occupancy_children) {
    errors.push('base_occupancy_children must be between 0 and max_occupancy_children');
  }
  
  return errors;
}

// ============================================================
// SEASON
// Reference: Phase 5 - Section B.5
// ============================================================

/**
 * Date-based pricing period.
 * Reference: A-005 - Each night belongs to exactly one season
 */
export interface Season {
  readonly id: EntityId;
  readonly resort_id: EntityId;
  
  readonly name: string;
  readonly description?: string;
  
  /**
   * Date ranges for this season.
   * A season may have multiple non-contiguous date ranges.
   * Example: Peak season might cover Dec 20-Jan 10 AND Jul 1-Aug 31
   */
  readonly date_ranges: readonly DateRange[];
}

/**
 * Checks if a date falls within a season.
 */
export function isDateInSeason(season: Season, date: DateString): boolean {
  const checkDate = date as string;
  
  for (const range of season.date_ranges) {
    if (checkDate >= (range.start_date as string) && checkDate <= (range.end_date as string)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Validates that seasons for a resort don't overlap.
 * This is a data integrity check.
 * Reference: Phase 3 - SEA-002
 */
export function validateSeasonNonOverlap(seasons: readonly Season[]): string[] {
  const errors: string[] = [];
  
  // Collect all date ranges with season info
  const ranges: Array<{ season: Season; range: DateRange }> = [];
  for (const season of seasons) {
    for (const range of season.date_ranges) {
      ranges.push({ season, range });
    }
  }
  
  // Check each pair for overlap
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const a = ranges[i];
      const b = ranges[j];
      
      // Check if ranges overlap
      const aStart = a.range.start_date as string;
      const aEnd = a.range.end_date as string;
      const bStart = b.range.start_date as string;
      const bEnd = b.range.end_date as string;
      
      if (aStart <= bEnd && bStart <= aEnd) {
        // Only report if different seasons
        if (a.season.id !== b.season.id) {
          errors.push(
            `Season overlap: "${a.season.name}" (${aStart} to ${aEnd}) ` +
            `overlaps with "${b.season.name}" (${bStart} to ${bEnd})`
          );
        }
      }
    }
  }
  
  return errors;
}

// ============================================================
// RATE
// Reference: Phase 5 - Section B.6
// ============================================================

/**
 * Room rate per night by season.
 * Reference: A-004 - Night count = check-out - check-in
 */
export interface Rate {
  readonly id: EntityId;
  readonly resort_id: EntityId;
  readonly room_type_id: EntityId;
  readonly season_id: EntityId;
  
  /** Cost amount (internal, not client-visible) */
  readonly cost_amount: MoneyAmount;
  readonly currency_code: CurrencyCode;
  
  /** Rate type - v1 only supports per_night */
  readonly rate_type: 'per_night';
  
  /** Validity period for this rate */
  readonly valid_from: DateString;
  readonly valid_to: DateString;
  
  readonly notes?: string;
}

/**
 * Finds the applicable rate for a room on a specific date.
 * @param rates All rates for the resort
 * @param roomTypeId The room type ID
 * @param seasonId The season ID for the date
 * @param date The date to find a rate for
 * @returns The matching rate or undefined
 */
export function findApplicableRate(
  rates: readonly Rate[],
  roomTypeId: EntityId,
  seasonId: EntityId,
  date: DateString
): Rate | undefined {
  const dateStr = date as string;
  
  return rates.find(rate => 
    rate.room_type_id === roomTypeId &&
    rate.season_id === seasonId &&
    (rate.valid_from as string) <= dateStr &&
    (rate.valid_to as string) >= dateStr
  );
}
