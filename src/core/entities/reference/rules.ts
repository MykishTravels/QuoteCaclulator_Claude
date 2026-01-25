/**
 * Reference Data Entities - Operational Rules
 * 
 * FestiveSupplement, BlackoutDate, MinimumStayRule, HoneymoonPerk entities.
 * 
 * Reference: Phase 5 - Section B.12, B.14, B.15, B.16
 */

import type {
  EntityId,
  DateString,
  CurrencyCode,
  MoneyAmount,
  ChildCostsByBand,
} from '../types';

import { PricingMode } from '../types';

// ============================================================
// FESTIVE SUPPLEMENT
// Reference: Phase 5 - Section B.12
// ============================================================

/**
 * Holiday surcharge applied when stay includes trigger dates.
 */
export interface FestiveSupplement {
  readonly id: EntityId;
  readonly resort_id: EntityId;
  
  readonly name: string;
  readonly description?: string;
  
  /** Dates that trigger this supplement (e.g., Dec 25, Dec 31) */
  readonly trigger_dates: readonly DateString[];
  
  readonly pricing_mode: PricingMode.PER_PERSON | PricingMode.PER_ROOM_PER_NIGHT;
  
  readonly adult_cost: MoneyAmount;
  readonly child_costs_by_band?: ChildCostsByBand;
  readonly currency_code: CurrencyCode;
  
  /** If true, supplement is auto-applied and cannot be removed */
  readonly is_mandatory: boolean;
  
  readonly valid_from: DateString;
  readonly valid_to: DateString;
}

/**
 * Checks if a stay triggers a festive supplement.
 * @param supplement The supplement to check
 * @param checkIn Stay check-in date
 * @param checkOut Stay check-out date (exclusive)
 * @returns The trigger date if supplement applies, null otherwise
 */
export function findFestiveSupplementTrigger(
  supplement: FestiveSupplement,
  checkIn: DateString,
  checkOut: DateString
): DateString | null {
  const checkInStr = checkIn as string;
  const checkOutStr = checkOut as string;
  
  for (const triggerDate of supplement.trigger_dates) {
    const triggerStr = triggerDate as string;
    
    // Trigger date must be within stay (check-in inclusive, check-out exclusive)
    // Reference: A-004 - Night count = check-out - check-in
    if (triggerStr >= checkInStr && triggerStr < checkOutStr) {
      // Also check validity period
      if (triggerStr >= (supplement.valid_from as string) && 
          triggerStr <= (supplement.valid_to as string)) {
        return triggerDate;
      }
    }
  }
  
  return null;
}

/**
 * Gets the child cost for a festive supplement.
 */
export function getFestiveSupplementChildCost(
  supplement: FestiveSupplement,
  ageBandId: EntityId
): MoneyAmount | undefined {
  if (!supplement.child_costs_by_band) return undefined;
  return supplement.child_costs_by_band[ageBandId as string];
}

// ============================================================
// BLACKOUT DATE
// Reference: Phase 5 - Section B.14
// ============================================================

/**
 * Period during which bookings are blocked.
 */
export interface BlackoutDate {
  readonly id: EntityId;
  readonly resort_id: EntityId;
  
  /** If null, applies to all room types (resort-wide) */
  readonly room_type_id: EntityId | null;
  
  readonly start_date: DateString;
  readonly end_date: DateString;
  
  readonly reason: string;
  readonly is_active: boolean;
}

/**
 * Checks if a date falls within a blackout period.
 */
export function isDateBlackedOut(
  blackout: BlackoutDate,
  date: DateString
): boolean {
  if (!blackout.is_active) return false;
  
  const dateStr = date as string;
  return dateStr >= (blackout.start_date as string) && 
         dateStr <= (blackout.end_date as string);
}

/**
 * Finds blackout dates that overlap with a stay.
 * Reference: Phase 3 - DATE-020, DATE-021
 */
export function findOverlappingBlackouts(
  blackouts: readonly BlackoutDate[],
  resortId: EntityId,
  roomTypeId: EntityId | null,
  checkIn: DateString,
  checkOut: DateString
): BlackoutDate[] {
  const overlapping: BlackoutDate[] = [];
  const checkInStr = checkIn as string;
  const checkOutStr = checkOut as string;
  
  for (const blackout of blackouts) {
    if (!blackout.is_active) continue;
    if (blackout.resort_id !== resortId) continue;
    
    // Check if blackout applies to this room or is resort-wide
    if (blackout.room_type_id !== null && blackout.room_type_id !== roomTypeId) {
      continue;
    }
    
    // Check for overlap
    // Blackout overlaps stay if blackout.start <= checkOut-1 AND blackout.end >= checkIn
    // (checkOut is exclusive, so last night is checkOut - 1)
    const blackoutStart = blackout.start_date as string;
    const blackoutEnd = blackout.end_date as string;
    
    if (blackoutStart < checkOutStr && blackoutEnd >= checkInStr) {
      overlapping.push(blackout);
    }
  }
  
  return overlapping;
}

// ============================================================
// MINIMUM STAY RULE
// Reference: Phase 5 - Section B.15
// ============================================================

/**
 * Minimum stay requirement.
 * Reference: Phase 3 - MIN-001, MIN-002, MIN-003
 */
export interface MinimumStayRule {
  readonly id: EntityId;
  readonly resort_id: EntityId;
  
  /** If null, applies to all room types */
  readonly room_type_id: EntityId | null;
  /** If null, applies to all seasons */
  readonly season_id: EntityId | null;
  
  readonly minimum_nights: number;
  
  /**
   * Date-specific override (higher priority than season).
   * If set, this rule applies only during this period.
   */
  readonly valid_from?: DateString;
  readonly valid_to?: DateString;
  
  readonly notes?: string;
}

/**
 * Priority levels for minimum stay rules.
 * Higher number = higher priority.
 * Reference: Phase 3 - Section C.1 Minimum Stay Hierarchy
 */
export function getMinimumStayRulePriority(rule: MinimumStayRule): number {
  const hasDateRange = rule.valid_from !== undefined;
  const hasRoomType = rule.room_type_id !== null;
  const hasSeason = rule.season_id !== null;
  
  if (hasDateRange && hasRoomType) return 6;  // Date range + Room type
  if (hasDateRange && !hasRoomType) return 5; // Date range + Resort
  if (hasSeason && hasRoomType) return 4;     // Season + Room type
  if (hasSeason && !hasRoomType) return 3;    // Season + Resort
  if (!hasSeason && hasRoomType) return 2;    // Room type (year-round)
  return 1;                                    // Resort (year-round)
}

/**
 * Finds the applicable minimum stay for a booking.
 * Returns the most restrictive (highest minimum) that applies.
 */
export function findApplicableMinimumStay(
  rules: readonly MinimumStayRule[],
  resortId: EntityId,
  roomTypeId: EntityId,
  seasonId: EntityId,
  checkIn: DateString,
  checkOut: DateString
): number {
  const checkInStr = checkIn as string;
  const checkOutStr = checkOut as string;
  
  let maxMinimum = 1; // Default minimum stay
  
  for (const rule of rules) {
    if (rule.resort_id !== resortId) continue;
    
    // Check room type match
    if (rule.room_type_id !== null && rule.room_type_id !== roomTypeId) {
      continue;
    }
    
    // Check season match
    if (rule.season_id !== null && rule.season_id !== seasonId) {
      continue;
    }
    
    // Check date range if specified
    if (rule.valid_from !== undefined && rule.valid_to !== undefined) {
      if (checkInStr < (rule.valid_from as string) || 
          checkOutStr > (rule.valid_to as string)) {
        continue;
      }
    }
    
    // Rule applies - take the maximum
    if (rule.minimum_nights > maxMinimum) {
      maxMinimum = rule.minimum_nights;
    }
  }
  
  return maxMinimum;
}

// ============================================================
// HONEYMOON PERK
// Reference: Phase 5 - Section B.16
// ============================================================

/**
 * Complimentary benefit for honeymoon couples.
 * Informational only - no pricing impact.
 */
export interface HoneymoonPerk {
  readonly id: EntityId;
  readonly resort_id: EntityId;
  
  readonly name: string;
  readonly description: string;
}
