/**
 * Tax Engine
 * 
 * Calculates taxes in the correct order per destination configuration.
 * 
 * CRITICAL CONSTRAINTS (Phase 4 Locked):
 * - Tax functions receive EXPLICIT base_amount as input (no inference)
 * - Green Tax is NEVER marked up (government pass-through)
 * - Calculation order: Green Tax → Service Charge → GST
 * - Service Charge is cumulative base for GST
 * 
 * Reference:
 * - Phase 4: Locked Refinement #3 (Explicit Tax Bases)
 * - A-007: Tax calculation order per destination config
 * - A-008: Green Tax never marked up
 * - A-019: TaxConfiguration.applies_to is informational only
 */

import type {
  EntityId,
  DateString,
  MoneyAmount,
  Percentage,
} from '../../types';

import type {
  TaxConfiguration,
} from '../../entities';

import { TaxType, TaxCalculationMethod, LineItemType, AuditStepType } from '../../types';

import type {
  CalculationContext,
  TaxResult,
  GuestCounts,
  CalculationAuditBuilder,
} from '../types';

import { CalculationError } from '../types';

// ============================================================
// TAX CALCULATION HELPERS
// ============================================================

/**
 * Calculate fixed per-person-per-night tax (Green Tax).
 */
function calculateFixedTax(
  config: TaxConfiguration,
  eligibleGuests: number,
  nights: number,
  ctx: CalculationContext
): MoneyAmount {
  const rateInQuote = convertToQuoteCurrency(
    config.rate_value,
    config.currency_code ?? ctx.quote_currency,
    ctx
  );
  
  return rateInQuote * eligibleGuests * nights;
}

/**
 * Calculate percentage tax.
 */
function calculatePercentageTax(
  config: TaxConfiguration,
  explicitBaseAmount: MoneyAmount
): MoneyAmount {
  return explicitBaseAmount * (config.rate_value as Percentage) / 100;
}

/**
 * Convert amount to quote currency.
 */
function convertToQuoteCurrency(
  amount: MoneyAmount,
  sourceCurrency: string,
  ctx: CalculationContext
): MoneyAmount {
  if (sourceCurrency === ctx.quote_currency) {
    return amount;
  }
  
  const rate = ctx.exchange_rates[sourceCurrency];
  if (rate === undefined) {
    throw new CalculationError(
      'CALC_CURRENCY_CONVERSION_FAILED',
      `No exchange rate for ${sourceCurrency}`,
      { source_currency: sourceCurrency }
    );
  }
  
  return amount * rate;
}

/**
 * Map tax type to line item type.
 */
function taxTypeToLineItemType(taxType: TaxType): LineItemType {
  switch (taxType) {
    case TaxType.GREEN_TAX:
      return LineItemType.GREEN_TAX;
    case TaxType.SERVICE_CHARGE:
      return LineItemType.SERVICE_CHARGE;
    case TaxType.GST:
      return LineItemType.GST;
    case TaxType.VAT:
      return LineItemType.VAT;
    default:
      return LineItemType.GST; // Fallback
  }
}

// ============================================================
// GREEN TAX ELIGIBILITY
// ============================================================

/**
 * Count guests eligible for Green Tax.
 * Children under threshold age are exempt.
 */
export function countGreenTaxEligibleGuests(
  guestCounts: GuestCounts,
  ageThreshold: number
): number {
  return guestCounts.eligible_for_green_tax;
}

// ============================================================
// MAIN TAX CALCULATION
// ============================================================

/**
 * Input for tax calculation with explicit bases.
 */
export interface TaxCalculationInput {
  /** Subtotal of non-tax items after discounts */
  post_discount_subtotal: MoneyAmount;
  
  /** Guest counts for fixed taxes */
  guest_counts: GuestCounts;
  
  /** Number of nights */
  nights: number;
  
  /** Components included in the subtotal (for audit) */
  subtotal_composition: LineItemType[];
}

/**
 * Calculate all taxes for a leg.
 * 
 * Flow:
 * 1. Get tax configurations ordered by calculation_order
 * 2. Calculate each tax with explicit base
 * 3. Accumulate cumulative bases for subsequent taxes
 * 4. Return all taxes with full audit trail
 */
export function calculateTaxes(
  ctx: CalculationContext,
  resortId: EntityId,
  date: DateString,
  input: TaxCalculationInput,
  audit: CalculationAuditBuilder
): { taxes: TaxResult[]; total_taxes: MoneyAmount; breakdown: TaxBreakdown } {
  // Get tax configs ordered by calculation_order
  const taxConfigs = ctx.data.getTaxConfigurations(resortId, date);
  
  if (taxConfigs.length === 0) {
    return {
      taxes: [],
      total_taxes: 0,
      breakdown: { green_tax: 0, service_charge: 0, gst: 0, vat: 0 },
    };
  }
  
  const results: TaxResult[] = [];
  const breakdown: TaxBreakdown = { green_tax: 0, service_charge: 0, gst: 0, vat: 0 };
  
  // Track cumulative base for CUMULATIVE taxes
  let cumulativeBase = input.post_discount_subtotal;
  let totalTaxes = 0;
  
  for (const config of taxConfigs) {
    let taxAmount: MoneyAmount;
    let baseAmount: MoneyAmount;
    let baseComposition: string[];
    
    switch (config.calculation_method) {
      case TaxCalculationMethod.FIXED_PER_PERSON_PER_NIGHT: {
        // Green Tax: fixed amount × eligible guests × nights
        const eligibleGuests = input.guest_counts.eligible_for_green_tax;
        
        taxAmount = calculateFixedTax(config, eligibleGuests, input.nights, ctx);
        baseAmount = taxAmount; // For fixed, base = result
        baseComposition = ['FIXED_PER_PERSON_PER_NIGHT'];
        
        audit.addStep(
          AuditStepType.TAX_CALCULATION,
          `${config.name} ($${config.rate_value}/person/night)`,
          {
            tax_config_id: config.id,
            tax_type: config.tax_type,
            calculation_method: config.calculation_method,
            eligible_guests: eligibleGuests,
            nights: input.nights,
            rate_per_guest_per_night: config.rate_value,
            currency: config.currency_code,
          },
          {
            tax_amount: taxAmount,
          },
          taxAmount
        );
        break;
      }
      
      case TaxCalculationMethod.PERCENTAGE: {
        // Determine the base for this tax
        switch (config.applies_to) {
          case 'SUBTOTAL_BEFORE_TAX':
            baseAmount = input.post_discount_subtotal;
            baseComposition = [...input.subtotal_composition.map(t => t.toString()), 'DISCOUNT'];
            break;
          
          case 'CUMULATIVE':
            baseAmount = cumulativeBase;
            baseComposition = [...input.subtotal_composition.map(t => t.toString()), 'DISCOUNT', ...getCumulativeTaxNames(results)];
            break;
          
          case 'ACCOMMODATION_ONLY':
            // Would need room-only subtotal - simplified for now
            baseAmount = input.post_discount_subtotal;
            baseComposition = ['ROOM'];
            break;
          
          default:
            baseAmount = input.post_discount_subtotal;
            baseComposition = input.subtotal_composition.map(t => t.toString());
        }
        
        taxAmount = calculatePercentageTax(config, baseAmount);
        
        audit.addStep(
          AuditStepType.TAX_CALCULATION,
          `${config.name} (${config.rate_value}%)`,
          {
            tax_config_id: config.id,
            tax_type: config.tax_type,
            calculation_method: config.calculation_method,
            explicit_base_amount: baseAmount,
            rate_percentage: config.rate_value,
            base_composition: baseComposition,
            is_cumulative_base: config.is_cumulative_base,
          },
          {
            tax_amount: taxAmount,
            base_amount_used: baseAmount,
            cumulative_total_for_next_tax: config.is_cumulative_base ? cumulativeBase + taxAmount : cumulativeBase,
          },
          taxAmount
        );
        break;
      }
      
      default:
        throw new CalculationError(
          'CALC_TAX_CONFIG_INVALID',
          `Unknown tax calculation method: ${config.calculation_method}`,
          { tax_config_id: config.id }
        );
    }
    
    // Build result
    const result: TaxResult = {
      tax_config_id: config.id,
      tax_type: taxTypeToLineItemType(config.tax_type),
      name: config.name,
      cost_amount: taxAmount,
      base_amount: baseAmount,
      rate_value: config.rate_value,
      calculation_method: config.calculation_method,
      quantity_detail: {
        base_amount: baseAmount,
        rate_value: config.rate_value,
        calculation_method: config.calculation_method,
        base_composition: baseComposition,
      },
    };
    
    results.push(result);
    totalTaxes += taxAmount;
    
    // Update breakdown
    switch (config.tax_type) {
      case TaxType.GREEN_TAX:
        breakdown.green_tax += taxAmount;
        break;
      case TaxType.SERVICE_CHARGE:
        breakdown.service_charge += taxAmount;
        break;
      case TaxType.GST:
        breakdown.gst += taxAmount;
        break;
      case TaxType.VAT:
        breakdown.vat += taxAmount;
        break;
    }
    
    // Update cumulative base if this tax is cumulative
    if (config.is_cumulative_base) {
      cumulativeBase += taxAmount;
    }
  }
  
  return { taxes: results, total_taxes: totalTaxes, breakdown };
}

/**
 * Tax breakdown by type.
 */
export interface TaxBreakdown {
  green_tax: MoneyAmount;
  service_charge: MoneyAmount;
  gst: MoneyAmount;
  vat: MoneyAmount;
}

/**
 * Get names of cumulative taxes for audit.
 */
function getCumulativeTaxNames(results: TaxResult[]): string[] {
  return results
    .filter(r => r.quantity_detail?.['is_cumulative_base'])
    .map(r => r.name);
}

// ============================================================
// TAX VALIDATION
// ============================================================

/**
 * Validate tax configurations for a resort.
 */
export function validateTaxConfigurations(
  configs: readonly TaxConfiguration[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for duplicate calculation orders
  const orders = configs.map(c => c.calculation_order);
  const uniqueOrders = new Set(orders);
  if (orders.length !== uniqueOrders.size) {
    errors.push('Duplicate tax calculation orders detected');
  }
  
  // Check for Green Tax configuration
  const greenTax = configs.find(c => c.tax_type === TaxType.GREEN_TAX);
  if (greenTax) {
    if (greenTax.calculation_method !== TaxCalculationMethod.FIXED_PER_PERSON_PER_NIGHT) {
      errors.push('Green Tax must use FIXED_PER_PERSON_PER_NIGHT calculation method');
    }
    if (!greenTax.currency_code) {
      errors.push('Green Tax must specify a currency code');
    }
  }
  
  // Check GST/VAT comes after Service Charge
  const serviceCharge = configs.find(c => c.tax_type === TaxType.SERVICE_CHARGE);
  const gst = configs.find(c => c.tax_type === TaxType.GST);
  const vat = configs.find(c => c.tax_type === TaxType.VAT);
  
  if (serviceCharge && gst && gst.calculation_order <= serviceCharge.calculation_order) {
    errors.push('GST must be calculated after Service Charge (for cumulative base)');
  }
  
  if (serviceCharge && vat && vat.calculation_order <= serviceCharge.calculation_order) {
    errors.push('VAT must be calculated after Service Charge (for cumulative base)');
  }
  
  return { valid: errors.length === 0, errors };
}
