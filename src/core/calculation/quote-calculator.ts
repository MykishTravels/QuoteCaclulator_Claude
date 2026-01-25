/**
 * Quote Calculator
 * 
 * Main orchestrator for full quote calculation.
 * 
 * Handles:
 * - Multiple legs (multi-resort quotes)
 * - Inter-resort transfers
 * - Quote-level markup override
 * - Exchange rate locking
 * - Full audit trail
 * 
 * Reference:
 * - Phase 4: Full calculation flow
 * - Phase 6: Error handling and recovery
 */

import type {
  EntityId,
  DateString,
  DateTimeString,
  CurrencyCode,
  MoneyAmount,
  Percentage,
  ExchangeRateMap,
  ValidationItem,
} from '../types';

import { ExchangeRateSource, AuditStepType, ValidationSeverity } from '../types';

import type {
  QuoteCalculationInput,
  QuoteCalculationResult,
  InterResortTransferResult,
  CalculationContext,
  CalculationDataAccess,
  LegCalculationResult,
} from './types';

import { CalculationError, CalculationAuditBuilder } from './types';
import { calculateLeg } from './leg-calculator';
import { calculateInterResortTransferMarkup, applyQuoteLevelMarkup, calculateMarginPercentage } from './engines/markup-engine';
import { roundCurrency, today } from '../utils';

// ============================================================
// EXCHANGE RATE LOCKING
// ============================================================

/**
 * Lock exchange rates for the calculation.
 * In v1, we use manual rates or default to 1.0 for same currency.
 */
function lockExchangeRates(
  quoteCurrency: CurrencyCode,
  manualRates?: ExchangeRateMap
): { rates: ExchangeRateMap; source: ExchangeRateSource; timestamp: DateTimeString } {
  const timestamp = new Date().toISOString() as DateTimeString;
  
  // Always include quote currency at 1.0
  const rates: ExchangeRateMap = {
    [quoteCurrency]: 1.0,
    ...(manualRates ?? {}),
  };
  
  const source = manualRates 
    ? ExchangeRateSource.MANUAL_ENTRY 
    : ExchangeRateSource.SYSTEM_DEFAULT;
  
  return { rates, source, timestamp };
}

// ============================================================
// CONTEXT CREATION
// ============================================================

/**
 * Create calculation context from input and data access.
 */
function createCalculationContext(
  input: QuoteCalculationInput,
  dataAccess: CalculationDataAccess
): CalculationContext {
  const { rates, source, timestamp } = lockExchangeRates(
    input.currency_code,
    input.manual_exchange_rates
  );
  
  return {
    quote_currency: input.currency_code,
    exchange_rates: rates,
    exchange_rate_timestamp: timestamp,
    exchange_rate_source: source,
    booking_date: input.booking_date ?? today(),
    data: dataAccess,
  };
}

// ============================================================
// INTER-RESORT TRANSFER CALCULATION
// ============================================================

/**
 * Calculate inter-resort transfers between legs.
 */
function calculateInterResortTransfers(
  ctx: CalculationContext,
  input: QuoteCalculationInput,
  legResults: Array<{ resortId: EntityId }>,
  audit: CalculationAuditBuilder
): InterResortTransferResult[] {
  if (!input.inter_resort_transfers || input.inter_resort_transfers.length === 0) {
    return [];
  }
  
  const results: InterResortTransferResult[] = [];
  
  for (let i = 0; i < input.inter_resort_transfers.length; i++) {
    const transfer = input.inter_resort_transfers[i];
    const fromLegIndex = i;
    const toLegIndex = i + 1;
    
    if (toLegIndex >= legResults.length) {
      continue; // No destination leg
    }
    
    // Convert cost to quote currency
    let costInQuote = transfer.cost_amount;
    if (transfer.currency_code !== ctx.quote_currency) {
      const rate = ctx.exchange_rates[transfer.currency_code];
      if (rate === undefined) {
        throw new CalculationError(
          'CALC_CURRENCY_CONVERSION_FAILED',
          `No exchange rate for ${transfer.currency_code}`,
          { source_currency: transfer.currency_code }
        );
      }
      costInQuote = transfer.cost_amount * rate;
    }
    
    // Get destination resort for markup (Phase 4 Lock #4)
    const destinationResortId = legResults[toLegIndex].resortId;
    
    const markupResult = calculateInterResortTransferMarkup(
      costInQuote,
      destinationResortId,
      ctx,
      audit
    );
    
    results.push({
      from_leg_index: fromLegIndex,
      to_leg_index: toLegIndex,
      transfer_description: transfer.transfer_description,
      cost_amount: roundCurrency(costInQuote),
      markup_amount: roundCurrency(markupResult.markup_amount),
      sell_amount: roundCurrency(markupResult.sell_amount),
      markup_source: 'DESTINATION_RESORT',
      markup_config_id: markupResult.markup_config_id!,
      notes: transfer.notes ?? null,
    });
  }
  
  return results;
}

// ============================================================
// MAIN QUOTE CALCULATION
// ============================================================

/**
 * Calculate a full quote.
 * 
 * This is the main entry point for quote calculation.
 */
export function calculateQuote(
  input: QuoteCalculationInput,
  dataAccess: CalculationDataAccess
): QuoteCalculationResult {
  const startTime = new Date();
  const audit = new CalculationAuditBuilder();
  const warnings: ValidationItem[] = [];
  
  try {
    // ============================================================
    // STEP 1: Create Calculation Context
    // ============================================================
    
    const ctx = createCalculationContext(input, dataAccess);
    
    audit.addStep(
      AuditStepType.QUOTE_AGGREGATION,
      'Calculation initialized',
      {
        quote_currency: ctx.quote_currency,
        exchange_rates: ctx.exchange_rates,
        legs_count: input.legs.length,
      },
      { context_created: true },
      0
    );
    
    // ============================================================
    // STEP 2: Determine Markup Strategy
    // ============================================================
    
    const useQuoteLevelMarkup = !!input.quote_level_markup;
    
    if (useQuoteLevelMarkup) {
      audit.addStep(
        AuditStepType.QUOTE_LEVEL_MARKUP,
        'Quote-level fixed markup will be used',
        { markup_value: input.quote_level_markup!.markup_value },
        { line_item_markup: 'disabled' },
        0
      );
    }
    
    // ============================================================
    // STEP 3: Calculate Each Leg
    // ============================================================
    
    const legResults: LegCalculationResult[] = [];
    const legMeta: Array<{ resortId: EntityId }> = [];
    
    for (let i = 0; i < input.legs.length; i++) {
      const legInput = input.legs[i];
      const legAudit = new CalculationAuditBuilder();
      
      const { result, warnings: legWarnings } = calculateLeg(
        ctx,
        legInput,
        i,
        useQuoteLevelMarkup,
        legAudit
      );
      
      legResults.push(result);
      legMeta.push({ resortId: legInput.resort_id });
      warnings.push(...legWarnings);
      audit.merge(legAudit);
    }
    
    // ============================================================
    // STEP 4: Calculate Inter-Resort Transfers
    // ============================================================
    
    const irtResults = calculateInterResortTransfers(ctx, input, legMeta, audit);
    
    // ============================================================
    // STEP 5: Aggregate Totals
    // ============================================================
    
    // Legs totals
    const legsCost = legResults.reduce((sum, leg) => sum + leg.totals.cost_amount, 0);
    const legsMarkup = legResults.reduce((sum, leg) => sum + leg.totals.markup_amount, 0);
    const legsSell = legResults.reduce((sum, leg) => sum + leg.totals.sell_amount, 0);
    
    // IRT totals
    const irtCost = irtResults.reduce((sum, irt) => sum + irt.cost_amount, 0);
    const irtMarkup = irtResults.reduce((sum, irt) => sum + irt.markup_amount, 0);
    const irtSell = irtResults.reduce((sum, irt) => sum + irt.sell_amount, 0);
    
    // Quote-level markup
    let quoteLevelMarkupAmount = 0;
    if (useQuoteLevelMarkup && input.quote_level_markup) {
      const totalCostForMarkup = legsCost + irtCost;
      const { total_markup } = applyQuoteLevelMarkup(
        totalCostForMarkup,
        input.quote_level_markup,
        audit
      );
      quoteLevelMarkupAmount = total_markup;
    }
    
    // Final totals
    const totalCost = legsCost + irtCost;
    const totalMarkup = useQuoteLevelMarkup ? quoteLevelMarkupAmount : (legsMarkup + irtMarkup);
    const totalSell = totalCost + totalMarkup;
    const marginPercentage = calculateMarginPercentage(totalMarkup, totalSell);
    
    // Tax breakdown
    const taxesBreakdown = {
      green_tax: legResults.reduce((sum, leg) => sum + (leg.taxes.find(t => t.tax_type === 'GREEN_TAX')?.cost_amount ?? 0), 0),
      service_charge: legResults.reduce((sum, leg) => sum + (leg.taxes.find(t => t.tax_type === 'SERVICE_CHARGE')?.cost_amount ?? 0), 0),
      gst: legResults.reduce((sum, leg) => sum + (leg.taxes.find(t => t.tax_type === 'GST')?.cost_amount ?? 0), 0),
      vat: legResults.reduce((sum, leg) => sum + (leg.taxes.find(t => t.tax_type === 'VAT')?.cost_amount ?? 0), 0),
    };
    
    const totalTaxes = legResults.reduce((sum, leg) => sum + leg.total_taxes, 0);
    
    audit.addStep(
      AuditStepType.QUOTE_AGGREGATION,
      'Quote totals calculated',
      {
        legs_cost: legsCost,
        irt_cost: irtCost,
        total_cost: totalCost,
      },
      {
        total_markup: totalMarkup,
        total_sell: totalSell,
        margin_percentage: marginPercentage,
      },
      totalSell
    );
    
    // ============================================================
    // STEP 6: Verify Calculation
    // ============================================================
    
    // Verify cost + markup = sell
    const verifiedSell = totalCost + totalMarkup;
    if (Math.abs(verifiedSell - totalSell) > 0.01) {
      throw new CalculationError(
        'CALC_VERIFICATION_FAILED',
        `Sell verification failed: expected ${verifiedSell}, got ${totalSell}`,
        { expected: verifiedSell, actual: totalSell }
      );
    }
    
    // Verify non-negative final amounts
    if (totalSell < 0) {
      throw new CalculationError(
        'CALC_NEGATIVE_FINAL_AMOUNT',
        'Final sell amount cannot be negative',
        { total_sell: totalSell }
      );
    }
    
    // ============================================================
    // STEP 7: Build Result
    // ============================================================
    
    return {
      success: true,
      calculated_at: new Date().toISOString() as DateTimeString,
      currency_code: ctx.quote_currency,
      exchange_rates: ctx.exchange_rates,
      exchange_rate_timestamp: ctx.exchange_rate_timestamp,
      exchange_rate_source: ctx.exchange_rate_source,
      legs: legResults,
      inter_resort_transfers: irtResults,
      quote_level_markup: useQuoteLevelMarkup && input.quote_level_markup
        ? {
            markup_type: 'FIXED',
            markup_value: roundCurrency(input.quote_level_markup.markup_value),
            override_reason: input.quote_level_markup.override_reason ?? null,
          }
        : null,
      totals: {
        legs_cost: roundCurrency(legsCost),
        legs_markup: roundCurrency(legsMarkup),
        legs_sell: roundCurrency(legsSell),
        irt_cost: roundCurrency(irtCost),
        irt_markup: roundCurrency(irtMarkup),
        irt_sell: roundCurrency(irtSell),
        quote_level_markup: roundCurrency(quoteLevelMarkupAmount),
        total_cost: roundCurrency(totalCost),
        total_markup: roundCurrency(totalMarkup),
        total_sell: roundCurrency(totalSell),
        margin_percentage: roundCurrency(marginPercentage),
        total_taxes: roundCurrency(totalTaxes),
      },
      taxes_breakdown: {
        green_tax: roundCurrency(taxesBreakdown.green_tax),
        service_charge: roundCurrency(taxesBreakdown.service_charge),
        gst: roundCurrency(taxesBreakdown.gst),
        vat: roundCurrency(taxesBreakdown.vat),
      },
      warnings,
      audit_steps: audit.getSteps() as any[],
    };
    
  } catch (error) {
    // Handle calculation errors
    if (error instanceof CalculationError) {
      return {
        success: false,
        calculated_at: new Date().toISOString() as DateTimeString,
        currency_code: input.currency_code,
        exchange_rates: {},
        exchange_rate_timestamp: new Date().toISOString() as DateTimeString,
        exchange_rate_source: ExchangeRateSource.SYSTEM_DEFAULT,
        legs: [],
        inter_resort_transfers: [],
        quote_level_markup: null,
        totals: {
          legs_cost: 0,
          legs_markup: 0,
          legs_sell: 0,
          irt_cost: 0,
          irt_markup: 0,
          irt_sell: 0,
          quote_level_markup: 0,
          total_cost: 0,
          total_markup: 0,
          total_sell: 0,
          margin_percentage: 0,
          total_taxes: 0,
        },
        taxes_breakdown: {
          green_tax: 0,
          service_charge: 0,
          gst: 0,
          vat: 0,
        },
        warnings: [{
          code: error.code,
          severity: ValidationSeverity.BLOCKING,
          scope: 'calculation',
          message: error.message,
          resolution_hint: getResolutionHint(error.code),
        }],
        audit_steps: audit.getSteps() as any[],
      };
    }
    
    throw error;
  }
}

/**
 * Get resolution hint for error code.
 */
function getResolutionHint(code: string): string | undefined {
  const hints: Record<string, string> = {
    'CALC_INIT_FAILED': 'Check that all referenced entities exist.',
    'CALC_FX_LOCK_FAILED': 'Manually enter exchange rates.',
    'CALC_RATE_NOT_FOUND': 'Admin must configure rates for this room/season/date.',
    'CALC_SEASON_NOT_FOUND': 'Admin must configure seasons covering these dates.',
    'CALC_CURRENCY_CONVERSION_FAILED': 'Add missing exchange rate.',
    'CALC_ARITHMETIC_ERROR': 'Contact support.',
    'CALC_NEGATIVE_FINAL_AMOUNT': 'Review discounts and configuration.',
    'CALC_TAX_CONFIG_INVALID': 'Admin must fix tax configuration.',
    'CALC_MARKUP_INVALID': 'Admin must configure markup.',
    'CALC_VERIFICATION_FAILED': 'Contact support.',
  };
  
  return hints[code];
}
