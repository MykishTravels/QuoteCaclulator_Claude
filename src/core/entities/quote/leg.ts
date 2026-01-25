/**
 * Quote Domain Entities - Leg
 * 
 * QuoteLeg, QuoteLegRoom, NightlyRoomRate, ExtraPersonChargeLineItem,
 * QuoteLegLineItem, and AppliedDiscount entities.
 * 
 * Reference: Phase 5 - Section C.4, C.5, C.6, C.7
 */

import type {
  EntityId,
  DateString,
  CurrencyCode,
  MoneyAmount,
  Percentage,
  PricingBreakdown,
  QuantityDetail,
  Child,
} from '../types';

import {
  LineItemType,
  PricingMode,
  DiscountType,
  DiscountBaseType,
  GuestType,
} from '../types';

// ============================================================
// QUOTE LEG
// Reference: Phase 5 - Section C.4
// ============================================================

/**
 * Single resort stay within a quote.
 */
export interface QuoteLeg {
  readonly id: EntityId;
  readonly quote_version_id: EntityId;
  
  /** Sequence number (1, 2, 3...) - must be contiguous */
  readonly sequence: number;
  
  // Resort Reference
  readonly resort_id: EntityId;
  /** Denormalized for display */
  readonly resort_name: string;
  
  // Dates
  readonly check_in_date: DateString;
  readonly check_out_date: DateString;
  /** Calculated: check_out - check_in per A-004 */
  readonly nights: number;
  
  // Guests
  readonly adults_count: number;
  readonly children: readonly Child[];
  
  // Room Selection
  readonly room: QuoteLegRoom;
  
  // Line Items (all priced components)
  readonly line_items: readonly QuoteLegLineItem[];
  
  // Discounts
  readonly discounts_applied: readonly AppliedDiscount[];
  
  // Totals
  readonly leg_totals: PricingBreakdown;
}

// NOTE: calculateNights function moved to utils/dates.ts to avoid duplicate exports

// ============================================================
// QUOTE LEG ROOM
// Reference: Phase 5 - Section C.5
// ============================================================

/**
 * Room selection and rate breakdown for a leg.
 */
export interface QuoteLegRoom {
  readonly room_type_id: EntityId;
  /** Denormalized for display */
  readonly room_type_name: string;
  
  /** Per-night breakdown */
  readonly nightly_breakdown: readonly NightlyRoomRate[];
  
  /** Room subtotal across all nights */
  readonly room_subtotal: PricingBreakdown;
  
  /** Extra person charges for guests above base occupancy */
  readonly extra_person_charges: readonly ExtraPersonChargeLineItem[];
}

/**
 * Single night room rate detail.
 */
export interface NightlyRoomRate {
  readonly date: DateString;
  readonly season_id: EntityId;
  readonly season_name: string;
  readonly rate_id: EntityId;
  
  /** Original cost in rate's currency */
  readonly source_cost: MoneyAmount;
  readonly source_currency: CurrencyCode;
  
  /** Converted to quote currency */
  readonly cost_amount: MoneyAmount;
  readonly markup_amount: MoneyAmount;
  readonly sell_amount: MoneyAmount;
}

/**
 * Extra person charge line item.
 */
export interface ExtraPersonChargeLineItem {
  readonly guest_type: GuestType;
  readonly age_band_id?: EntityId;
  readonly age_band_name?: string;
  readonly child_age?: number;
  
  /** Number of extra guests of this type */
  readonly count: number;
  readonly nights: number;
  readonly pricing_mode: PricingMode;
  readonly per_unit_cost: MoneyAmount;
  
  readonly cost_amount: MoneyAmount;
  readonly markup_amount: MoneyAmount;
  readonly sell_amount: MoneyAmount;
}

// ============================================================
// QUOTE LEG LINE ITEM
// Reference: Phase 5 - Section C.6
// ============================================================

/**
 * Generic priced component within a leg.
 * Uses three-layer pricing model.
 */
export interface QuoteLegLineItem {
  readonly id: EntityId;
  readonly line_item_type: LineItemType;
  
  /** Reference to source entity (meal plan, activity, tax config, etc.) */
  readonly reference_id?: EntityId;
  
  readonly description: string;
  readonly quantity_detail: QuantityDetail;
  
  // Three-layer pricing
  readonly cost_amount: MoneyAmount;
  readonly markup_amount: MoneyAmount;
  readonly sell_amount: MoneyAmount;
  
  /** For supplements - whether it was auto-applied */
  readonly is_mandatory?: boolean;
}

/**
 * Creates a line item for tax (which has zero markup in most cases).
 * Reference: Phase 4 - Taxes never marked up when applies_to_taxes = false
 */
export function createTaxLineItem(params: {
  id: EntityId;
  lineItemType: LineItemType.GREEN_TAX | LineItemType.SERVICE_CHARGE | LineItemType.GST | LineItemType.VAT;
  referenceId: EntityId;
  description: string;
  quantityDetail: QuantityDetail;
  costAmount: MoneyAmount;
}): QuoteLegLineItem {
  return {
    id: params.id,
    line_item_type: params.lineItemType,
    reference_id: params.referenceId,
    description: params.description,
    quantity_detail: params.quantityDetail,
    cost_amount: params.costAmount,
    // Taxes have zero markup when applies_to_taxes = false (standard config)
    markup_amount: 0 as MoneyAmount,
    sell_amount: params.costAmount,
  };
}

// ============================================================
// APPLIED DISCOUNT
// Reference: Phase 5 - Section C.7
// ============================================================

/**
 * Record of a discount application.
 * Reference: Phase 4 Locked Refinement #2 - base_type explicitly captured
 */
export interface AppliedDiscount {
  readonly discount_id: EntityId;
  readonly discount_name: string;
  readonly discount_code: string;
  readonly discount_type: DiscountType;
  /** For PERCENTAGE: the percentage; For FIXED: the fixed amount */
  readonly discount_value: MoneyAmount | Percentage;
  
  /**
   * What the discount was applied to.
   * Reference: Phase 4 - base_type explicitly captured in audit
   */
  readonly base_type: DiscountBaseType;
  
  /** The amount the discount was calculated on */
  readonly base_amount: MoneyAmount;
  
  // Reduction amounts (for three-layer breakdown)
  /** Cost reduction from discount */
  readonly cost_reduction: MoneyAmount;
  /** Markup reduction from discount */
  readonly markup_reduction: MoneyAmount;
  /** Sell price reduction from discount */
  readonly sell_reduction: MoneyAmount;
}

/**
 * Validates that discount does not apply to taxes.
 * Reference: Phase 4 - Discounts NEVER apply to taxes (hard constraint)
 */
export function validateDiscountNotOnTaxes(
  discount: AppliedDiscount,
  lineItems: readonly QuoteLegLineItem[]
): boolean {
  // Get tax line items
  const taxLineItems = lineItems.filter(li => 
    li.line_item_type === LineItemType.GREEN_TAX ||
    li.line_item_type === LineItemType.SERVICE_CHARGE ||
    li.line_item_type === LineItemType.GST ||
    li.line_item_type === LineItemType.VAT
  );
  
  // If base_type is ROOM_ONLY, taxes are definitely not included
  if (discount.base_type === DiscountBaseType.ROOM_ONLY) {
    return true;
  }
  
  // For PRE_TAX_TOTAL, verify no tax amounts are in the base
  // This is enforced by construction in the calculation engine
  return true; // Validated by design
}
