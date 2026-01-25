/**
 * Quote Domain Entities - Pricing Summary
 * 
 * Reference: Phase 5 - Section C.9
 */

import type {
  EntityId,
  MoneyAmount,
  Percentage,
  PricingBreakdown,
} from '../types';

// ============================================================
// QUOTE PRICING SUMMARY
// Reference: Phase 5 - Section C.9
// ============================================================

/**
 * Complete pricing summary for a quote version.
 */
export interface QuotePricingSummary {
  /** Summary for each leg */
  readonly leg_summaries: readonly LegSummary[];
  
  /** Inter-resort transfer totals */
  readonly inter_resort_transfer_total: PricingBreakdown;
  
  /** Overall quote totals */
  readonly quote_totals: QuoteTotals;
  
  /** Tax breakdown by type */
  readonly taxes_breakdown: TaxesBreakdown;
}

// ============================================================
// LEG SUMMARY
// ============================================================

/**
 * Summary for a single leg.
 */
export interface LegSummary {
  readonly leg_id: EntityId;
  readonly resort_name: string;
  readonly nights: number;
  
  /** Sum of non-tax line items (cost) */
  readonly pre_tax_cost: MoneyAmount;
  /** Sum of tax line items (cost) */
  readonly tax_cost: MoneyAmount;
  
  /** Total leg amounts */
  readonly cost_amount: MoneyAmount;
  readonly markup_amount: MoneyAmount;
  readonly sell_amount: MoneyAmount;
}

// ============================================================
// QUOTE TOTALS
// ============================================================

/**
 * Overall quote totals.
 * Reference: BRD v1.2 Section 6.6 - Markup vs Margin Definitions
 */
export interface QuoteTotals {
  /** Total cost across all legs and transfers */
  readonly total_cost: MoneyAmount;
  
  /** Sum of all line item markups (before quote-level override) */
  readonly line_item_markup_total: MoneyAmount;
  
  /** Quote-level fixed markup (if applied) - replaces line item markups */
  readonly quote_level_fixed_markup: MoneyAmount;
  
  /**
   * Total markup.
   * If quote_level_fixed_markup > 0: equals quote_level_fixed_markup
   * Otherwise: equals line_item_markup_total
   */
  readonly total_markup: MoneyAmount;
  
  /** Total sell price: total_cost + total_markup */
  readonly total_sell: MoneyAmount;
  
  /**
   * Markup as percentage of cost: (total_markup / total_cost) × 100
   * Reference: BRD v1.2 Section 6.6
   */
  readonly markup_percentage: Percentage;
  
  /**
   * Margin as percentage of sell: (total_markup / total_sell) × 100
   * Reference: BRD v1.2 Section 6.6
   */
  readonly margin_percentage: Percentage;
}

/**
 * Validates quote totals invariants.
 */
export function validateQuoteTotals(totals: QuoteTotals): string[] {
  const errors: string[] = [];
  
  const totalCost = totals.total_cost as number;
  const totalMarkup = totals.total_markup as number;
  const totalSell = totals.total_sell as number;
  
  // Invariant: total_sell = total_cost + total_markup
  const expectedSell = totalCost + totalMarkup;
  if (Math.abs(totalSell - expectedSell) > 0.01) {
    errors.push(`total_sell (${totalSell}) does not equal total_cost + total_markup (${expectedSell})`);
  }
  
  // If quote-level fixed markup is set, it should equal total_markup
  const fixedMarkup = totals.quote_level_fixed_markup as number;
  if (fixedMarkup > 0) {
    if (totals.line_item_markup_total as number !== 0) {
      errors.push('line_item_markup_total should be 0 when quote_level_fixed_markup is set');
    }
    if (Math.abs(totalMarkup - fixedMarkup) > 0.01) {
      errors.push('total_markup should equal quote_level_fixed_markup when fixed markup is set');
    }
  }
  
  // Margin percentage validation
  if (totalSell > 0) {
    const expectedMargin = (totalMarkup / totalSell) * 100;
    if (Math.abs((totals.margin_percentage as number) - expectedMargin) > 0.01) {
      errors.push(`margin_percentage (${totals.margin_percentage}) does not match calculated value (${expectedMargin.toFixed(2)})`);
    }
  }
  
  // Markup percentage validation
  if (totalCost > 0) {
    const expectedMarkupPct = (totalMarkup / totalCost) * 100;
    if (Math.abs((totals.markup_percentage as number) - expectedMarkupPct) > 0.01) {
      errors.push(`markup_percentage (${totals.markup_percentage}) does not match calculated value (${expectedMarkupPct.toFixed(2)})`);
    }
  }
  
  return errors;
}

// ============================================================
// TAXES BREAKDOWN
// ============================================================

/**
 * Breakdown of taxes by type.
 */
export interface TaxesBreakdown {
  /** Total Green Tax across all legs */
  readonly green_tax_total: MoneyAmount;
  /** Total Service Charge across all legs */
  readonly service_charge_total: MoneyAmount;
  /** Total GST across all legs */
  readonly gst_total: MoneyAmount;
  /** Total VAT across all legs (if applicable) */
  readonly vat_total?: MoneyAmount;
  
  /** Sum of all taxes */
  readonly total_taxes: MoneyAmount;
}

/**
 * Validates taxes breakdown total.
 */
export function validateTaxesBreakdown(breakdown: TaxesBreakdown): string[] {
  const errors: string[] = [];
  
  const greenTax = breakdown.green_tax_total as number;
  const serviceCharge = breakdown.service_charge_total as number;
  const gst = breakdown.gst_total as number;
  const vat = (breakdown.vat_total as number) || 0;
  const total = breakdown.total_taxes as number;
  
  const expectedTotal = greenTax + serviceCharge + gst + vat;
  
  if (Math.abs(total - expectedTotal) > 0.01) {
    errors.push(`total_taxes (${total}) does not equal sum of components (${expectedTotal})`);
  }
  
  return errors;
}

/**
 * Creates an empty taxes breakdown.
 */
export function createEmptyTaxesBreakdown(): TaxesBreakdown {
  return {
    green_tax_total: 0 as MoneyAmount,
    service_charge_total: 0 as MoneyAmount,
    gst_total: 0 as MoneyAmount,
    total_taxes: 0 as MoneyAmount,
  };
}
