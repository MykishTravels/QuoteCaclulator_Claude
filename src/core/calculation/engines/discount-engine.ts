/**
 * Discount Engine
 * 
 * Handles discount eligibility checking, stacking resolution, and application.
 * 
 * CRITICAL CONSTRAINTS (Phase 4 Locked):
 * - Discounts NEVER apply to tax line items
 * - base_type explicitly determines applicable items
 * - Non-compounding: multiple stackable discounts apply sequentially
 * - Over-discount capped at base, generates WARNING (not error)
 * 
 * Reference:
 * - Phase 4: Locked Refinement #2 (Discount Audit & Tax Exclusion)
 * - Phase 6: HR-4 (Over-discount handling)
 * - A-009: Stacked discounts are non-compounding
 * - A-010: Discount base_amount calculated BEFORE any discount applied
 */

import type {
  EntityId,
  DateString,
  MoneyAmount,
  Percentage,
  ValidationItem,
} from '../../types';

import type {
  Discount,
  Season,
} from '../../entities';

import { DiscountType, DiscountBaseType, LineItemType, AuditStepType, ValidationSeverity } from '../../types';

import type {
  CalculationContext,
  DiscountResult,
  CalculationAuditBuilder,
} from '../types';

import { daysBetween } from '../../utils';

// ============================================================
// LINE ITEM CATEGORIES
// ============================================================

/**
 * Line items included in ROOM_ONLY discount base.
 */
const ROOM_ONLY_ITEMS: LineItemType[] = [
  LineItemType.ROOM,
];

/**
 * Line items included in PRE_TAX_TOTAL discount base.
 */
const PRE_TAX_ITEMS: LineItemType[] = [
  LineItemType.ROOM,
  LineItemType.EXTRA_PERSON,
  LineItemType.MEAL_PLAN,
  LineItemType.TRANSFER,
  LineItemType.ACTIVITY,
  LineItemType.FESTIVE_SUPPLEMENT,
];

/**
 * Tax line items - NEVER included in any discount base.
 */
const TAX_ITEMS: LineItemType[] = [
  LineItemType.GREEN_TAX,
  LineItemType.SERVICE_CHARGE,
  LineItemType.GST,
  LineItemType.VAT,
];

// ============================================================
// ELIGIBILITY CHECKING
// ============================================================

/**
 * Result of eligibility check.
 */
export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  code?: string;
}

/**
 * Check if a discount is eligible for application.
 */
export function checkDiscountEligibility(
  discount: Discount,
  nights: number,
  checkIn: DateString,
  bookingDate: DateString,
  seasons: Season[]
): EligibilityResult {
  // Check validity period
  if (checkIn < discount.valid_from || checkIn > discount.valid_to) {
    return {
      eligible: false,
      reason: `Discount "${discount.name}" not valid for check-in date ${checkIn}`,
      code: 'DISCOUNT_DATE_INVALID',
    };
  }
  
  // Check minimum nights
  if (discount.minimum_nights && nights < discount.minimum_nights) {
    return {
      eligible: false,
      reason: `Discount "${discount.name}" requires minimum ${discount.minimum_nights} nights (stay is ${nights} nights)`,
      code: 'DISCOUNT_MIN_NIGHTS_NOT_MET',
    };
  }
  
  // Check maximum nights
  if (discount.maximum_nights && nights > discount.maximum_nights) {
    return {
      eligible: false,
      reason: `Discount "${discount.name}" only valid for up to ${discount.maximum_nights} nights (stay is ${nights} nights)`,
      code: 'DISCOUNT_MAX_NIGHTS_EXCEEDED',
    };
  }
  
  // Check booking window (early bird)
  if (discount.booking_window_days) {
    const daysUntilCheckIn = daysBetween(bookingDate, checkIn);
    if (daysUntilCheckIn < discount.booking_window_days) {
      return {
        eligible: false,
        reason: `Discount "${discount.name}" requires booking ${discount.booking_window_days}+ days in advance (booking is ${daysUntilCheckIn} days before)`,
        code: 'DISCOUNT_BOOKING_WINDOW_NOT_MET',
      };
    }
  }
  
  // Check blackout seasons
  if (discount.blackout_season_ids && discount.blackout_season_ids.length > 0) {
    for (const season of seasons) {
      if (discount.blackout_season_ids.includes(season.id)) {
        return {
          eligible: false,
          reason: `Discount "${discount.name}" not valid during ${season.name}`,
          code: 'DISCOUNT_BLACKOUT_SEASON',
        };
      }
    }
  }
  
  return { eligible: true };
}

// ============================================================
// STACKING RESOLUTION
// ============================================================

/**
 * Resolve which discounts can be stacked together.
 * Returns the optimal set of discounts to apply.
 */
export function resolveDiscountStacking(
  eligibleDiscounts: Discount[],
  audit: CalculationAuditBuilder
): Discount[] {
  if (eligibleDiscounts.length === 0) {
    return [];
  }
  
  if (eligibleDiscounts.length === 1) {
    return eligibleDiscounts;
  }
  
  // Separate stackable and non-stackable discounts
  const stackable = eligibleDiscounts.filter(d => d.is_stackable);
  const nonStackable = eligibleDiscounts.filter(d => !d.is_stackable);
  
  // If we have non-stackable discounts, pick the best one
  // "Best" = highest potential discount value (simplified heuristic)
  if (nonStackable.length > 0) {
    // Pick highest value non-stackable
    const best = nonStackable.reduce((a, b) => {
      // For percentage, compare percentages
      // For fixed, compare amounts
      const aValue = a.discount_type === DiscountType.PERCENTAGE 
        ? (a.discount_value as Percentage) 
        : 0;
      const bValue = b.discount_type === DiscountType.PERCENTAGE 
        ? (b.discount_value as Percentage) 
        : 0;
      return aValue >= bValue ? a : b;
    });
    
    // Remove discounts that weren't selected
    for (const d of nonStackable) {
      if (d.id !== best.id) {
        audit.addStep(
          AuditStepType.DISCOUNT_REMOVED,
          `Discount "${d.name}" removed: not stackable with "${best.name}"`,
          { discount_id: d.id, reason: 'non_stackable_conflict' },
          { removed: true },
          0
        );
        audit.addWarning(
          'DISCOUNT_NOT_STACKABLE',
          `Discount "${d.name}" not applied: conflicts with "${best.name}"`
        );
      }
    }
    
    // Check if any stackable discounts can stack with the best
    const compatibleStackable = stackable.filter(s => 
      s.stackable_with?.includes(best.id)
    );
    
    if (compatibleStackable.length > 0) {
      audit.addStep(
        AuditStepType.DISCOUNT_STACKING_RESOLVED,
        `Stacking resolved: ${best.name} + ${compatibleStackable.map(d => d.name).join(', ')}`,
        { primary: best.id, stacked: compatibleStackable.map(d => d.id) },
        { total_discounts: 1 + compatibleStackable.length },
        0
      );
      return [best, ...compatibleStackable];
    }
    
    return [best];
  }
  
  // All stackable - check mutual compatibility
  const compatible: Discount[] = [];
  for (const discount of stackable) {
    // Check if this discount can stack with all already-selected discounts
    const canStack = compatible.every(existing =>
      discount.stackable_with?.includes(existing.id) &&
      existing.stackable_with?.includes(discount.id)
    );
    
    if (canStack || compatible.length === 0) {
      compatible.push(discount);
    } else {
      audit.addStep(
        AuditStepType.DISCOUNT_REMOVED,
        `Discount "${discount.name}" removed: incompatible with selected discounts`,
        { discount_id: discount.id, reason: 'stacking_incompatible' },
        { removed: true },
        0
      );
      audit.addWarning(
        'DISCOUNT_STACKING_CONFLICT',
        `Discount "${discount.name}" not applied: incompatible with other selected discounts`
      );
    }
  }
  
  if (compatible.length > 1) {
    audit.addStep(
      AuditStepType.DISCOUNT_STACKING_RESOLVED,
      `Stacking resolved: ${compatible.map(d => d.name).join(' + ')}`,
      { stacked: compatible.map(d => d.id) },
      { total_discounts: compatible.length },
      0
    );
  }
  
  return compatible;
}

// ============================================================
// DISCOUNT APPLICATION
// ============================================================

/**
 * Cost breakdown by line item type for discount calculation.
 */
export interface CostBreakdown {
  room: MoneyAmount;
  extra_person: MoneyAmount;
  meal_plan: MoneyAmount;
  transfer: MoneyAmount;
  activity: MoneyAmount;
  festive_supplement: MoneyAmount;
}

/**
 * Calculate discount base amount based on base_type.
 */
export function calculateDiscountBase(
  baseType: DiscountBaseType,
  costs: CostBreakdown
): { base_amount: MoneyAmount; base_composition: LineItemType[]; excluded: LineItemType[] } {
  switch (baseType) {
    case DiscountBaseType.ROOM_ONLY:
      return {
        base_amount: costs.room,
        base_composition: ROOM_ONLY_ITEMS,
        excluded: [
          LineItemType.EXTRA_PERSON,
          LineItemType.MEAL_PLAN,
          LineItemType.TRANSFER,
          LineItemType.ACTIVITY,
          LineItemType.FESTIVE_SUPPLEMENT,
          ...TAX_ITEMS,
        ],
      };
    
    case DiscountBaseType.PRE_TAX_TOTAL:
      return {
        base_amount: 
          costs.room +
          costs.extra_person +
          costs.meal_plan +
          costs.transfer +
          costs.activity +
          costs.festive_supplement,
        base_composition: PRE_TAX_ITEMS,
        excluded: TAX_ITEMS,
      };
    
    default:
      // Default to room only for safety
      return {
        base_amount: costs.room,
        base_composition: ROOM_ONLY_ITEMS,
        excluded: [...PRE_TAX_ITEMS.filter(t => t !== LineItemType.ROOM), ...TAX_ITEMS],
      };
  }
}

/**
 * Apply a single discount to a base amount.
 * Returns the discount amount (capped at base if over-discount).
 */
export function applyDiscount(
  discount: Discount,
  baseAmount: MoneyAmount,
  audit: CalculationAuditBuilder
): { discount_amount: MoneyAmount; warnings: ValidationItem[] } {
  const warnings: ValidationItem[] = [];
  let discountAmount: MoneyAmount;
  
  if (discount.discount_type === DiscountType.PERCENTAGE) {
    discountAmount = baseAmount * (discount.discount_value as Percentage) / 100;
  } else {
    // Fixed discount - may need currency conversion
    // For now, assume same currency (v1 constraint)
    discountAmount = discount.discount_value as MoneyAmount;
  }
  
  // Cap discount at base amount (Phase 6 HR-4)
  if (discountAmount > baseAmount) {
    warnings.push({
      code: 'DISCOUNT_EXCEEDS_BASE',
      severity: ValidationSeverity.WARNING,
      scope: `discount.${discount.id}`,
      message: `Discount "${discount.name}" (${discountAmount.toFixed(2)}) exceeds base (${baseAmount.toFixed(2)}). Capped at base.`,
      resolution_hint: 'Review discount configuration or stay parameters.',
    });
    
    audit.addWarning(
      'DISCOUNT_EXCEEDS_BASE',
      `Discount "${discount.name}" capped at base amount ${baseAmount.toFixed(2)}`
    );
    
    discountAmount = baseAmount;
  }
  
  return { discount_amount: discountAmount, warnings };
}

// ============================================================
// MAIN DISCOUNT CALCULATION
// ============================================================

/**
 * Calculate all applicable discounts for a leg.
 * 
 * Flow:
 * 1. Look up discounts by code
 * 2. Check eligibility for each
 * 3. Resolve stacking conflicts
 * 4. Calculate discount amounts sequentially (non-compounding)
 * 5. Return total discount with full audit trail
 */
export function calculateDiscounts(
  ctx: CalculationContext,
  resortId: EntityId,
  discountCodes: string[],
  costs: CostBreakdown,
  nights: number,
  checkIn: DateString,
  seasons: Season[],
  audit: CalculationAuditBuilder
): { discounts: DiscountResult[]; total_discount: MoneyAmount; warnings: ValidationItem[] } {
  if (discountCodes.length === 0) {
    return { discounts: [], total_discount: 0, warnings: [] };
  }
  
  const warnings: ValidationItem[] = [];
  
  // Step 1: Look up discounts
  const foundDiscounts: Discount[] = [];
  for (const code of discountCodes) {
    const discount = ctx.data.getDiscountByCode(resortId, code);
    if (discount) {
      foundDiscounts.push(discount);
    } else {
      audit.addWarning('DISCOUNT_CODE_NOT_FOUND', `Discount code "${code}" not found`);
      warnings.push({
        code: 'DISCOUNT_CODE_NOT_FOUND',
        severity: ValidationSeverity.WARNING,
        scope: `discount.${code}`,
        message: `Discount code "${code}" not found`,
        resolution_hint: 'Verify the discount code is correct and active.',
      });
    }
  }
  
  // Step 2: Check eligibility
  const eligibleDiscounts: Discount[] = [];
  for (const discount of foundDiscounts) {
    const eligibility = checkDiscountEligibility(
      discount,
      nights,
      checkIn,
      ctx.booking_date,
      seasons
    );
    
    if (eligibility.eligible) {
      eligibleDiscounts.push(discount);
    } else {
      // Auto-remove with warning (Phase 6 MR-5)
      audit.addStep(
        AuditStepType.DISCOUNT_REMOVED,
        `Discount "${discount.name}" removed: ${eligibility.reason}`,
        { discount_id: discount.id, code: eligibility.code },
        { removed: true, reason: eligibility.reason },
        0
      );
      
      warnings.push({
        code: eligibility.code ?? 'DISCOUNT_NOT_ELIGIBLE',
        severity: ValidationSeverity.WARNING,
        scope: `discount.${discount.id}`,
        message: eligibility.reason ?? 'Discount not eligible',
        resolution_hint: undefined,
      });
    }
  }
  
  if (eligibleDiscounts.length === 0) {
    return { discounts: [], total_discount: 0, warnings };
  }
  
  // Step 3: Resolve stacking
  const resolvedDiscounts = resolveDiscountStacking(eligibleDiscounts, audit);
  
  // Step 4: Apply discounts sequentially (non-compounding per A-009)
  // Base amount is calculated BEFORE any discount is applied (A-010)
  const discountResults: DiscountResult[] = [];
  let totalDiscount = 0;
  
  for (const discount of resolvedDiscounts) {
    const { base_amount, base_composition, excluded } = calculateDiscountBase(
      discount.base_type,
      costs
    );
    
    const { discount_amount, warnings: discountWarnings } = applyDiscount(
      discount,
      base_amount, // Original base, not reduced by previous discounts (non-compounding)
      audit
    );
    
    warnings.push(...discountWarnings);
    totalDiscount += discount_amount;
    
    const result: DiscountResult = {
      discount_id: discount.id,
      discount_name: discount.name,
      discount_code: discount.code,
      discount_type: discount.discount_type,
      discount_value: discount.discount_value,
      base_type: discount.base_type,
      base_amount,
      discount_amount,
      base_composition,
      excluded_from_base: excluded,
    };
    
    discountResults.push(result);
    
    audit.addStep(
      AuditStepType.DISCOUNT,
      `Applied discount: ${discount.name} (${discount.discount_type === DiscountType.PERCENTAGE ? `${discount.discount_value}%` : `$${discount.discount_value}`})`,
      {
        discount_id: discount.id,
        discount_type: discount.discount_type,
        discount_value: discount.discount_value,
        base_type: discount.base_type,
        base_amount,
        base_composition,
        excluded_from_base: excluded,
      },
      {
        discount_amount,
        post_discount_base: base_amount - discount_amount,
      },
      -discount_amount // Negative for audit (reduction)
    );
  }
  
  return { discounts: discountResults, total_discount: totalDiscount, warnings };
}
