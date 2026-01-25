/**
 * Markup Engine
 * 
 * Calculates markup on costs to derive sell amounts.
 * 
 * CRITICAL CONSTRAINTS (Phase 4 Locked):
 * - Green Tax NEVER marked up (A-008, government pass-through)
 * - Quote-level markup: FIXED only in v1 (Phase 4 Lock #5)
 * - When quote-level fixed markup is used, line items show markup_amount = 0
 * - Markup is calculated on cost, not on sell (A-011)
 * 
 * Reference:
 * - Phase 4: Locked Refinement #5 (Quote-level FIXED only)
 * - BRD v1.2 Section 6.6: Markup vs Margin definitions
 */

import type {
  EntityId,
  MoneyAmount,
  Percentage,
} from '../../types';

import type {
  MarkupConfiguration,
} from '../../entities';

import { MarkupType, MarkupScope, LineItemType, AuditStepType, TaxType } from '../../types';

import type {
  CalculationContext,
  MarkupResult,
  CalculationAuditBuilder,
} from '../types';

import { CalculationError } from '../types';

// ============================================================
// MARKUP HELPERS
// ============================================================

/**
 * Check if a line item type should be excluded from markup.
 */
export function shouldExcludeFromMarkup(
  lineItemType: LineItemType,
  config: MarkupConfiguration
): boolean {
  // Green Tax is ALWAYS excluded (A-008)
  if (lineItemType === LineItemType.GREEN_TAX) {
    return true;
  }
  
  // Check configuration excludes
  if (config.excluded_components?.includes(lineItemType)) {
    return true;
  }
  
  // Check applies_to_taxes setting for tax line items
  const taxTypes = [
    LineItemType.SERVICE_CHARGE,
    LineItemType.GST,
    LineItemType.VAT,
  ];
  
  if (taxTypes.includes(lineItemType) && !config.applies_to_taxes) {
    return true;
  }
  
  return false;
}

/**
 * Calculate markup amount for a cost.
 */
export function calculateMarkupAmount(
  costAmount: MoneyAmount,
  config: MarkupConfiguration
): MoneyAmount {
  if (config.markup_type === MarkupType.PERCENTAGE) {
    return costAmount * (config.markup_value as Percentage) / 100;
  } else {
    // Fixed markup - typically applied at quote level, not line item
    return config.markup_value as MoneyAmount;
  }
}

// ============================================================
// LINE ITEM MARKUP
// ============================================================

/**
 * Result of line item markup calculation.
 */
export interface LineItemMarkupResult {
  cost_amount: MoneyAmount;
  markup_amount: MoneyAmount;
  sell_amount: MoneyAmount;
  markup_excluded: boolean;
  exclusion_reason?: string;
}

/**
 * Calculate markup for a single line item.
 */
export function calculateLineItemMarkup(
  costAmount: MoneyAmount,
  lineItemType: LineItemType,
  config: MarkupConfiguration,
  useQuoteLevelMarkup: boolean
): LineItemMarkupResult {
  // If using quote-level fixed markup, line items have zero markup
  if (useQuoteLevelMarkup) {
    return {
      cost_amount: costAmount,
      markup_amount: 0,
      sell_amount: costAmount, // Sell = cost at line level; markup added at quote level
      markup_excluded: true,
      exclusion_reason: 'Quote-level fixed markup in use',
    };
  }
  
  // Check if this line item should be excluded
  if (shouldExcludeFromMarkup(lineItemType, config)) {
    return {
      cost_amount: costAmount,
      markup_amount: 0,
      sell_amount: costAmount,
      markup_excluded: true,
      exclusion_reason: lineItemType === LineItemType.GREEN_TAX
        ? 'Green Tax never marked up'
        : 'Excluded by markup configuration',
    };
  }
  
  // Calculate markup
  const markupAmount = calculateMarkupAmount(costAmount, config);
  
  return {
    cost_amount: costAmount,
    markup_amount: markupAmount,
    sell_amount: costAmount + markupAmount,
    markup_excluded: false,
  };
}

// ============================================================
// LEG-LEVEL MARKUP
// ============================================================

/**
 * Input costs by category for leg markup calculation.
 */
export interface LegCostsForMarkup {
  room_cost: MoneyAmount;
  extra_person_cost: MoneyAmount;
  meal_plan_cost: MoneyAmount;
  transfer_cost: MoneyAmount;
  activity_cost: MoneyAmount;
  festive_cost: MoneyAmount;
  green_tax: MoneyAmount;
  service_charge: MoneyAmount;
  gst: MoneyAmount;
  vat: MoneyAmount;
}

/**
 * Calculate total markup for a leg.
 * Returns breakdown by category.
 */
export function calculateLegMarkup(
  costs: LegCostsForMarkup,
  config: MarkupConfiguration,
  useQuoteLevelMarkup: boolean,
  audit: CalculationAuditBuilder
): { markups: Record<string, MoneyAmount>; total_markup: MoneyAmount; total_sell: MoneyAmount } {
  if (useQuoteLevelMarkup) {
    // No line-item markup when quote-level fixed markup is used
    const totalCost = 
      costs.room_cost +
      costs.extra_person_cost +
      costs.meal_plan_cost +
      costs.transfer_cost +
      costs.activity_cost +
      costs.festive_cost +
      costs.green_tax +
      costs.service_charge +
      costs.gst +
      costs.vat;
    
    audit.addStep(
      AuditStepType.MARKUP,
      'Markup deferred to quote level (fixed markup in use)',
      { quote_level_markup: true },
      { total_cost: totalCost, total_markup: 0 },
      0
    );
    
    return {
      markups: {},
      total_markup: 0,
      total_sell: totalCost,
    };
  }
  
  const markups: Record<string, MoneyAmount> = {};
  let totalMarkup = 0;
  
  // Calculate markup by category
  const categories: Array<{ key: string; cost: MoneyAmount; type: LineItemType }> = [
    { key: 'room', cost: costs.room_cost, type: LineItemType.ROOM },
    { key: 'extra_person', cost: costs.extra_person_cost, type: LineItemType.EXTRA_PERSON },
    { key: 'meal_plan', cost: costs.meal_plan_cost, type: LineItemType.MEAL_PLAN },
    { key: 'transfer', cost: costs.transfer_cost, type: LineItemType.TRANSFER },
    { key: 'activity', cost: costs.activity_cost, type: LineItemType.ACTIVITY },
    { key: 'festive', cost: costs.festive_cost, type: LineItemType.FESTIVE_SUPPLEMENT },
    { key: 'green_tax', cost: costs.green_tax, type: LineItemType.GREEN_TAX },
    { key: 'service_charge', cost: costs.service_charge, type: LineItemType.SERVICE_CHARGE },
    { key: 'gst', cost: costs.gst, type: LineItemType.GST },
    { key: 'vat', cost: costs.vat, type: LineItemType.VAT },
  ];
  
  for (const { key, cost, type } of categories) {
    if (cost === 0) continue;
    
    const result = calculateLineItemMarkup(cost, type, config, false);
    markups[key] = result.markup_amount;
    totalMarkup += result.markup_amount;
    
    if (!result.markup_excluded && result.markup_amount > 0) {
      audit.addStep(
        AuditStepType.MARKUP,
        `Markup on ${key}: ${config.markup_value}%`,
        {
          category: key,
          cost_amount: cost,
          markup_percentage: config.markup_value,
        },
        {
          markup_amount: result.markup_amount,
          sell_amount: result.sell_amount,
        },
        result.markup_amount
      );
    }
  }
  
  const totalCost = Object.values(costs).reduce((a, b) => a + b, 0);
  
  return {
    markups,
    total_markup: totalMarkup,
    total_sell: totalCost + totalMarkup,
  };
}

// ============================================================
// QUOTE-LEVEL MARKUP
// ============================================================

/**
 * Quote-level markup input (v1: FIXED only).
 */
export interface QuoteLevelMarkupInput {
  markup_value: MoneyAmount;
  override_reason?: string;
}

/**
 * Apply quote-level fixed markup.
 * This replaces line-item markups.
 */
export function applyQuoteLevelMarkup(
  totalCost: MoneyAmount,
  input: QuoteLevelMarkupInput,
  audit: CalculationAuditBuilder
): { total_markup: MoneyAmount; total_sell: MoneyAmount } {
  audit.addStep(
    AuditStepType.QUOTE_LEVEL_MARKUP,
    `Quote-level fixed markup: $${input.markup_value.toFixed(2)}`,
    {
      markup_type: 'FIXED',
      markup_value: input.markup_value,
      override_reason: input.override_reason,
      total_cost: totalCost,
    },
    {
      total_sell: totalCost + input.markup_value,
      margin_percentage: (input.markup_value / (totalCost + input.markup_value)) * 100,
    },
    input.markup_value
  );
  
  return {
    total_markup: input.markup_value,
    total_sell: totalCost + input.markup_value,
  };
}

// ============================================================
// INTER-RESORT TRANSFER MARKUP
// ============================================================

/**
 * Calculate markup for inter-resort transfer.
 * Uses DESTINATION resort markup (Phase 4 Lock #4).
 */
export function calculateInterResortTransferMarkup(
  costAmount: MoneyAmount,
  destinationResortId: EntityId,
  ctx: CalculationContext,
  audit: CalculationAuditBuilder
): MarkupResult {
  const config = ctx.data.getMarkupConfiguration(destinationResortId);
  
  if (!config) {
    throw new CalculationError(
      'CALC_MARKUP_INVALID',
      `No markup configuration for destination resort ${destinationResortId}`,
      { resort_id: destinationResortId }
    );
  }
  
  // Fixed markup not applicable to individual transfers (would be quote level)
  if (config.markup_type === MarkupType.FIXED) {
    return {
      source: 'RESORT',
      markup_config_id: config.id,
      markup_type: 'FIXED',
      markup_value: 0,
      cost_amount: costAmount,
      markup_amount: 0,
      sell_amount: costAmount,
    };
  }
  
  const markupAmount = costAmount * (config.markup_value as Percentage) / 100;
  
  audit.addStep(
    AuditStepType.INTER_RESORT_TRANSFER,
    `Inter-resort transfer markup from destination (${config.markup_value}%)`,
    {
      markup_source: 'DESTINATION_RESORT',
      markup_config_id: config.id,
      markup_percentage: config.markup_value,
      cost_amount: costAmount,
    },
    {
      markup_amount: markupAmount,
      sell_amount: costAmount + markupAmount,
    },
    markupAmount
  );
  
  return {
    source: 'RESORT',
    markup_config_id: config.id,
    markup_type: 'PERCENTAGE',
    markup_value: config.markup_value,
    cost_amount: costAmount,
    markup_amount: markupAmount,
    sell_amount: costAmount + markupAmount,
  };
}

// ============================================================
// MARGIN CALCULATION
// ============================================================

/**
 * Calculate margin percentage from markup and sell.
 * Margin = (markup / sell) × 100
 * 
 * Reference: BRD v1.2 Section 6.6
 */
export function calculateMarginPercentage(
  totalMarkup: MoneyAmount,
  totalSell: MoneyAmount
): Percentage {
  if (totalSell === 0) {
    return 0;
  }
  return (totalMarkup / totalSell) * 100;
}

/**
 * Calculate markup percentage from cost and sell.
 * Markup % = ((sell - cost) / cost) × 100
 */
export function calculateMarkupPercentage(
  totalCost: MoneyAmount,
  totalSell: MoneyAmount
): Percentage {
  if (totalCost === 0) {
    return 0;
  }
  return ((totalSell - totalCost) / totalCost) * 100;
}
