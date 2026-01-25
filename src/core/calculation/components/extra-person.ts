/**
 * Extra Person Charge Calculator
 * 
 * Calculates charges for guests exceeding room base occupancy.
 * 
 * Reference:
 * - Phase 5: ExtraPersonCharge schema
 * - A-014: Max child age is 11; 12+ is adult
 */

import type {
  EntityId,
  MoneyAmount,
} from '../../types';

import type {
  RoomType,
  ChildAgeBand,
  ExtraPersonCharge,
} from '../../entities';

import { PricingMode, AuditStepType } from '../../types';

import type {
  CalculationContext,
  ExtraPersonChargeResult,
  GuestCounts,
  CalculationAuditBuilder,
} from '../types';

import { CalculationError } from '../types';

// ============================================================
// EXTRA PERSON CALCULATION
// ============================================================

/**
 * Calculate extra person charges for a room.
 * Returns unrounded costs.
 */
export function calculateExtraPersonCharges(
  ctx: CalculationContext,
  resortId: EntityId,
  roomType: RoomType,
  guestCounts: GuestCounts,
  nights: number,
  ageBands: readonly ChildAgeBand[],
  audit: CalculationAuditBuilder
): { charges: ExtraPersonChargeResult[]; totalCost: MoneyAmount } {
  const results: ExtraPersonChargeResult[] = [];
  let totalCost = 0;
  
  // Get all extra person charges for this room type
  const allCharges = ctx.data.getExtraPersonCharges(resortId, roomType.id);
  
  // Calculate extra adults
  const extraAdults = Math.max(0, guestCounts.adults - roomType.base_occupancy_adults);
  if (extraAdults > 0) {
    const adultCharge = allCharges.find(c => c.applies_to === 'adult');
    if (adultCharge) {
      const cost = calculateChargeAmount(adultCharge, extraAdults, nights, ctx);
      results.push({
        guest_type: 'adult',
        age_band_id: null,
        age_band_name: null,
        child_age: null,
        count: extraAdults,
        nights,
        per_unit_cost: convertToQuoteCurrency(adultCharge.cost_amount, adultCharge.currency_code, ctx),
        total_cost: cost,
      });
      totalCost += cost;
      
      audit.addStep(
        AuditStepType.EXTRA_PERSON,
        `Extra adult charge: ${extraAdults} adult(s) × ${nights} nights`,
        {
          guest_type: 'adult',
          count: extraAdults,
          nights,
          pricing_mode: adultCharge.pricing_mode,
          per_unit_cost: adultCharge.cost_amount,
          currency: adultCharge.currency_code,
        },
        {
          total_cost: cost,
        },
        cost
      );
    }
  }
  
  // Calculate extra children by age band
  let totalChildrenInBase = roomType.base_occupancy_children;
  
  for (const [bandId, bandInfo] of guestCounts.children_by_band) {
    const band = ageBands.find(b => b.id === bandId);
    if (!band) continue;
    
    // Determine how many children in this band are "extra"
    // First, use up any base occupancy
    const childrenFromBase = Math.min(bandInfo.count, totalChildrenInBase);
    totalChildrenInBase -= childrenFromBase;
    const extraInBand = bandInfo.count - childrenFromBase;
    
    if (extraInBand > 0) {
      const childCharge = allCharges.find(
        c => c.applies_to === 'child' && c.child_age_band_id === bandId
      );
      
      if (childCharge) {
        const cost = calculateChargeAmount(childCharge, extraInBand, nights, ctx);
        
        // Create one result per child for granular tracking
        for (let i = 0; i < extraInBand; i++) {
          const childAge = bandInfo.ages[childrenFromBase + i];
          const perChildCost = calculateChargeAmount(childCharge, 1, nights, ctx);
          
          results.push({
            guest_type: 'child',
            age_band_id: bandId,
            age_band_name: band.name,
            child_age: childAge ?? null,
            count: 1,
            nights,
            per_unit_cost: convertToQuoteCurrency(childCharge.cost_amount, childCharge.currency_code, ctx),
            total_cost: perChildCost,
          });
          totalCost += perChildCost;
        }
        
        audit.addStep(
          AuditStepType.EXTRA_PERSON,
          `Extra child charge (${band.name}): ${extraInBand} child(ren) × ${nights} nights`,
          {
            guest_type: 'child',
            age_band_id: bandId,
            age_band_name: band.name,
            count: extraInBand,
            nights,
            pricing_mode: childCharge.pricing_mode,
            per_unit_cost: childCharge.cost_amount,
            currency: childCharge.currency_code,
          },
          {
            total_cost: cost,
          },
          cost
        );
      }
    }
  }
  
  return { charges: results, totalCost };
}

/**
 * Calculate charge amount based on pricing mode.
 */
function calculateChargeAmount(
  charge: ExtraPersonCharge,
  count: number,
  nights: number,
  ctx: CalculationContext
): MoneyAmount {
  const costInQuote = convertToQuoteCurrency(charge.cost_amount, charge.currency_code, ctx);
  
  switch (charge.pricing_mode) {
    case PricingMode.PER_PERSON_PER_NIGHT:
      return costInQuote * count * nights;
    case PricingMode.PER_STAY:
      return costInQuote * count;
    default:
      return costInQuote * count * nights; // Default to per person per night
  }
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

// ============================================================
// OCCUPANCY VALIDATION
// ============================================================

/**
 * Check if guests exceed room capacity.
 */
export function validateOccupancy(
  roomType: RoomType,
  adults: number,
  childrenCount: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const total = adults + childrenCount;
  
  if (adults > roomType.max_occupancy_adults) {
    errors.push(
      `Adults (${adults}) exceeds maximum (${roomType.max_occupancy_adults}) for ${roomType.name}`
    );
  }
  
  if (childrenCount > roomType.max_occupancy_children) {
    errors.push(
      `Children (${childrenCount}) exceeds maximum (${roomType.max_occupancy_children}) for ${roomType.name}`
    );
  }
  
  if (total > roomType.max_occupancy_total) {
    errors.push(
      `Total guests (${total}) exceeds maximum (${roomType.max_occupancy_total}) for ${roomType.name}`
    );
  }
  
  return { valid: errors.length === 0, errors };
}
