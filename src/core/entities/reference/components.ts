/**
 * Reference Data Entities - Pricing Components
 * 
 * ExtraPersonCharge, MealPlan, TransferType, and Activity entities.
 * 
 * Reference: Phase 5 - Section B.7, B.8, B.9, B.10
 */

import type {
  EntityId,
  DateString,
  CurrencyCode,
  MoneyAmount,
  ChildCostsByBand,
} from '../types';

import {
  PricingMode,
  TransferDirection,
  GuestType,
} from '../types';

// ============================================================
// EXTRA PERSON CHARGE
// Reference: Phase 5 - Section B.7
// ============================================================

/**
 * Charges for guests exceeding base occupancy.
 */
export interface ExtraPersonCharge {
  readonly id: EntityId;
  readonly resort_id: EntityId;
  readonly room_type_id: EntityId;
  
  /** Specific season, or null for all seasons */
  readonly season_id: EntityId | null;
  
  /** Whether this applies to adults or children */
  readonly applies_to: GuestType;
  /** Required if applies_to = 'child' */
  readonly child_age_band_id?: EntityId;
  
  /** PER_PERSON_PER_NIGHT or PER_STAY */
  readonly pricing_mode: PricingMode.PER_PERSON_PER_NIGHT | PricingMode.PER_STAY;
  readonly cost_amount: MoneyAmount;
  readonly currency_code: CurrencyCode;
  
  readonly valid_from: DateString;
  readonly valid_to: DateString;
  
  readonly notes?: string;
}

/**
 * Finds the applicable extra person charge for a guest type.
 */
export function findExtraPersonCharge(
  charges: readonly ExtraPersonCharge[],
  roomTypeId: EntityId,
  seasonId: EntityId | null,
  guestType: GuestType,
  ageBandId?: EntityId,
  date?: DateString
): ExtraPersonCharge | undefined {
  const dateStr = date ? (date as string) : undefined;
  
  return charges.find(charge => {
    // Must match room type
    if (charge.room_type_id !== roomTypeId) return false;
    
    // Must match guest type
    if (charge.applies_to !== guestType) return false;
    
    // For children, must match age band
    if (guestType === GuestType.CHILD) {
      if (charge.child_age_band_id !== ageBandId) return false;
    }
    
    // Season must match or be null (applies to all)
    if (charge.season_id !== null && charge.season_id !== seasonId) return false;
    
    // Check date validity if provided
    if (dateStr) {
      if ((charge.valid_from as string) > dateStr) return false;
      if ((charge.valid_to as string) < dateStr) return false;
    }
    
    return true;
  });
}

// ============================================================
// MEAL PLAN
// Reference: Phase 5 - Section B.8
// ============================================================

/**
 * Dining package configuration.
 */
export interface MealPlan {
  readonly id: EntityId;
  readonly resort_id: EntityId;
  
  readonly name: string;
  /** Code (e.g., "BB", "HB", "FB", "AI") */
  readonly code: string;
  readonly description?: string;
  
  readonly pricing_mode: PricingMode;
  
  /** Cost for adults */
  readonly adult_cost: MoneyAmount;
  /** Cost by child age band */
  readonly child_costs_by_band: ChildCostsByBand;
  readonly currency_code: CurrencyCode;
  
  readonly valid_from: DateString;
  readonly valid_to: DateString;
  
  /** Whether this is the default meal plan for the resort */
  readonly is_default: boolean;
}

/**
 * Gets the child cost for a specific age band.
 * @returns The cost or undefined if no rate defined for that band.
 */
export function getMealPlanChildCost(
  mealPlan: MealPlan,
  ageBandId: EntityId
): MoneyAmount | undefined {
  return mealPlan.child_costs_by_band[ageBandId as string];
}

// ============================================================
// TRANSFER TYPE
// Reference: Phase 5 - Section B.9
// ============================================================

/**
 * Transportation option for arrivals/departures.
 */
export interface TransferType {
  readonly id: EntityId;
  readonly resort_id: EntityId;
  
  readonly name: string;
  /** Code (e.g., "SPEEDBOAT", "SEAPLANE") */
  readonly code: string;
  readonly description?: string;
  
  readonly direction: TransferDirection;
  readonly pricing_mode: PricingMode;
  
  /** For PER_PERSON pricing */
  readonly adult_cost?: MoneyAmount;
  readonly child_costs_by_band?: ChildCostsByBand;
  
  /** For PER_BOOKING or PER_TRIP pricing */
  readonly cost_amount?: MoneyAmount;
  
  readonly currency_code: CurrencyCode;
  
  readonly valid_from: DateString;
  readonly valid_to: DateString;
  
  /** Whether this is the default transfer for the resort */
  readonly is_default: boolean;
  
  readonly notes?: string;
}

/**
 * Gets the child cost for a transfer.
 */
export function getTransferChildCost(
  transfer: TransferType,
  ageBandId: EntityId
): MoneyAmount | undefined {
  if (!transfer.child_costs_by_band) return undefined;
  return transfer.child_costs_by_band[ageBandId as string];
}

/**
 * Validates transfer pricing configuration.
 */
export function validateTransferPricing(transfer: TransferType): string[] {
  const errors: string[] = [];
  
  if (transfer.pricing_mode === PricingMode.PER_PERSON) {
    if (transfer.adult_cost === undefined) {
      errors.push('adult_cost is required for PER_PERSON pricing');
    }
    // child_costs_by_band is optional but recommended
  } else if (
    transfer.pricing_mode === PricingMode.PER_BOOKING ||
    transfer.pricing_mode === PricingMode.PER_TRIP
  ) {
    if (transfer.cost_amount === undefined) {
      errors.push('cost_amount is required for PER_BOOKING/PER_TRIP pricing');
    }
  }
  
  return errors;
}

// ============================================================
// ACTIVITY
// Reference: Phase 5 - Section B.10
// ============================================================

/**
 * Bookable experience or excursion.
 */
export interface Activity {
  readonly id: EntityId;
  readonly resort_id: EntityId;
  
  readonly name: string;
  readonly description?: string;
  
  readonly pricing_mode: PricingMode.PER_PERSON | PricingMode.PER_BOOKING;
  
  /** For PER_PERSON pricing */
  readonly adult_cost?: MoneyAmount;
  readonly child_costs_by_band?: ChildCostsByBand;
  
  /** For PER_BOOKING pricing */
  readonly cost_amount?: MoneyAmount;
  
  readonly currency_code: CurrencyCode;
  
  /** If true, activity only available on specific dates */
  readonly is_date_specific: boolean;
  /** Available dates (if is_date_specific = true) */
  readonly available_dates?: readonly DateString[];
  
  readonly valid_from: DateString;
  readonly valid_to: DateString;
  
  readonly is_active: boolean;
}

/**
 * Checks if an activity is available on a specific date.
 */
export function isActivityAvailableOnDate(
  activity: Activity,
  date: DateString
): boolean {
  const dateStr = date as string;
  
  // Check validity period
  if (dateStr < (activity.valid_from as string)) return false;
  if (dateStr > (activity.valid_to as string)) return false;
  
  // If not date-specific, available any day in validity period
  if (!activity.is_date_specific) return true;
  
  // Check specific dates
  if (!activity.available_dates) return false;
  return activity.available_dates.some(d => (d as string) === dateStr);
}

/**
 * Gets the child cost for an activity.
 */
export function getActivityChildCost(
  activity: Activity,
  ageBandId: EntityId
): MoneyAmount | undefined {
  if (!activity.child_costs_by_band) return undefined;
  return activity.child_costs_by_band[ageBandId as string];
}
