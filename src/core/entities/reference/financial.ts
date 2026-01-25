/**
 * Reference Data Entities - Financial Configuration
 * 
 * TaxConfiguration, Discount, and MarkupConfiguration entities.
 * 
 * Reference: Phase 5 - Section B.11, B.13, B.17
 */

import type {
  EntityId,
  DateString,
  CurrencyCode,
  MoneyAmount,
  Percentage,
} from '../types';

import {
  TaxType,
  TaxCalculationMethod,
  TaxAppliesTo,
  DiscountType,
  DiscountBaseType,
  DiscountApplicationOrder,
  MarkupType,
  MarkupScope,
  LineItemType,
} from '../types';

// ============================================================
// TAX CONFIGURATION
// Reference: Phase 5 - Section B.11
// ============================================================

/**
 * Tax configuration for a resort.
 * Reference: A-007 - Tax calculation order defined per destination configuration
 * Reference: A-019 - TaxConfiguration.applies_to is informational only
 */
export interface TaxConfiguration {
  readonly id: EntityId;
  readonly resort_id: EntityId;
  
  readonly tax_type: TaxType;
  readonly name: string;
  
  readonly calculation_method: TaxCalculationMethod;
  
  /**
   * For FIXED: amount per unit
   * For PERCENTAGE: percentage value (e.g., 16.00 = 16%)
   */
  readonly rate_value: MoneyAmount | Percentage;
  
  /** Required for FIXED calculation method */
  readonly currency_code?: CurrencyCode;
  
  /**
   * Informational only per A-019.
   * Runtime calculation always receives explicit base_amount as input.
   */
  readonly applies_to: TaxAppliesTo;
  
  /** If true, subsequent taxes may include this tax in their base */
  readonly is_cumulative_base: boolean;
  
  /** Order in which this tax is calculated (lower = earlier) */
  readonly calculation_order: number;
  
  // Child rules (for FIXED_PER_PERSON_PER_NIGHT)
  /** Whether children are charged this tax */
  readonly applies_to_children: boolean;
  /** Children > this age are charged (typically 2 for Green Tax) */
  readonly child_age_threshold?: number;
  
  readonly valid_from: DateString;
  readonly valid_to: DateString;
  
  readonly notes?: string;
}

/**
 * Validates tax configuration.
 */
export function validateTaxConfiguration(tax: TaxConfiguration): string[] {
  const errors: string[] = [];
  
  if (tax.calculation_method === TaxCalculationMethod.FIXED_PER_PERSON_PER_NIGHT) {
    if (!tax.currency_code) {
      errors.push('currency_code required for FIXED_PER_PERSON_PER_NIGHT calculation');
    }
    if (tax.applies_to_children && tax.child_age_threshold === undefined) {
      errors.push('child_age_threshold required when applies_to_children is true');
    }
  }
  
  if (tax.calculation_method === TaxCalculationMethod.PERCENTAGE) {
    const rate = tax.rate_value as number;
    if (rate < 0 || rate > 100) {
      errors.push('Percentage rate_value must be between 0 and 100');
    }
  }
  
  return errors;
}

// ============================================================
// DISCOUNT
// Reference: Phase 5 - Section B.13
// ============================================================

/**
 * Promotional discount offer.
 * Reference: Phase 4 Locked Refinement #2 - base_type explicit, never on taxes
 * Reference: A-009 - Stacked discounts are non-compounding
 */
export interface Discount {
  readonly id: EntityId;
  readonly resort_id: EntityId;
  
  readonly name: string;
  readonly code: string;
  
  readonly discount_type: DiscountType;
  /** For PERCENTAGE: percentage (e.g., 10.00 = 10%); For FIXED: amount */
  readonly discount_value: MoneyAmount | Percentage;
  /** Required if discount_type = FIXED */
  readonly discount_currency_code?: CurrencyCode;
  
  /**
   * What the discount applies to.
   * ROOM_ONLY: room rate line items only
   * PRE_TAX_TOTAL: all non-tax line items
   * 
   * Constraint: Discounts NEVER apply to taxes (hard constraint)
   */
  readonly base_type: DiscountBaseType;
  
  /** Always BEFORE_TAX - after-tax discounts not supported */
  readonly application_order: DiscountApplicationOrder;
  
  // Eligibility criteria
  /** Minimum nights required to qualify */
  readonly minimum_nights?: number;
  /** Maximum nights (for targeted promotions) */
  readonly maximum_nights?: number;
  /** Days before check-in for early bird discount */
  readonly booking_window_days?: number;
  
  // Stacking rules (reference: A-009)
  /** Whether this can be combined with other discounts */
  readonly is_stackable: boolean;
  /** If stackable, which discount IDs this can stack with */
  readonly stackable_with?: readonly EntityId[];
  
  // Blackouts
  /** Season IDs during which this discount is not valid */
  readonly blackout_season_ids?: readonly EntityId[];
  
  readonly valid_from: DateString;
  readonly valid_to: DateString;
  
  /** Human-readable eligibility description */
  readonly eligibility_criteria?: string;
  readonly notes?: string;
}

/**
 * Validates discount configuration.
 */
export function validateDiscountConfiguration(discount: Discount): string[] {
  const errors: string[] = [];
  
  if (discount.discount_type === DiscountType.FIXED) {
    if (!discount.discount_currency_code) {
      errors.push('discount_currency_code required for FIXED discount type');
    }
  }
  
  if (discount.discount_type === DiscountType.PERCENTAGE) {
    const value = discount.discount_value as number;
    if (value < 0 || value > 100) {
      errors.push('Percentage discount_value must be between 0 and 100');
    }
  }
  
  if (discount.minimum_nights !== undefined && discount.minimum_nights < 1) {
    errors.push('minimum_nights must be at least 1');
  }
  
  if (discount.maximum_nights !== undefined && discount.minimum_nights !== undefined) {
    if (discount.maximum_nights < discount.minimum_nights) {
      errors.push('maximum_nights cannot be less than minimum_nights');
    }
  }
  
  if (discount.booking_window_days !== undefined && discount.booking_window_days < 1) {
    errors.push('booking_window_days must be at least 1');
  }
  
  return errors;
}

// ============================================================
// MARKUP CONFIGURATION
// Reference: Phase 5 - Section B.17
// ============================================================

/**
 * Markup/margin configuration.
 * Reference: Phase 4 Locked Refinement #5 - Quote level: FIXED only in v1
 * Reference: A-008 - Government pass-through taxes never marked up
 */
export interface MarkupConfiguration {
  readonly id: EntityId;
  readonly scope: MarkupScope;
  
  /** Required if scope = RESORT */
  readonly resort_id?: EntityId;
  
  readonly markup_type: MarkupType;
  /** For PERCENTAGE: percentage (e.g., 15.00 = 15%); For FIXED: amount */
  readonly markup_value: MoneyAmount | Percentage;
  
  /** Required if markup_type = FIXED */
  readonly fixed_markup_currency?: CurrencyCode;
  
  /**
   * Whether to apply markup to tax line items.
   * Reference: A-008 - GREEN_TAX never marked up regardless of this setting
   */
  readonly applies_to_taxes: boolean;
  
  /** Specific components excluded from markup */
  readonly excluded_components?: readonly LineItemType[];
  
  readonly valid_from: DateString;
  readonly valid_to: DateString;
  
  readonly notes?: string;
}

/**
 * Validates markup configuration.
 */
export function validateMarkupConfiguration(config: MarkupConfiguration): string[] {
  const errors: string[] = [];
  
  if (config.scope === MarkupScope.RESORT && !config.resort_id) {
    errors.push('resort_id required when scope is RESORT');
  }
  
  if (config.markup_type === MarkupType.FIXED && !config.fixed_markup_currency) {
    errors.push('fixed_markup_currency required for FIXED markup type');
  }
  
  if (config.markup_type === MarkupType.PERCENTAGE) {
    const value = config.markup_value as number;
    if (value < 0) {
      errors.push('Percentage markup_value cannot be negative');
    }
  }
  
  if (config.markup_type === MarkupType.FIXED) {
    const value = config.markup_value as number;
    if (value < 0) {
      errors.push('Fixed markup_value cannot be negative');
    }
  }
  
  return errors;
}

/**
 * Determines if a line item should have markup applied.
 * Reference: A-008 - Government pass-through taxes never marked up
 */
export function shouldApplyMarkup(
  config: MarkupConfiguration,
  lineItemType: LineItemType
): boolean {
  // Government pass-through taxes are NEVER marked up (A-008)
  if (lineItemType === LineItemType.GREEN_TAX) {
    return false;
  }
  
  // Check if taxes should be marked up
  const isTax = [
    LineItemType.GREEN_TAX,
    LineItemType.SERVICE_CHARGE,
    LineItemType.GST,
    LineItemType.VAT,
  ].includes(lineItemType);
  
  if (isTax && !config.applies_to_taxes) {
    return false;
  }
  
  // Check explicit exclusions
  if (config.excluded_components?.includes(lineItemType)) {
    return false;
  }
  
  return true;
}
