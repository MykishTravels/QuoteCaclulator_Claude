/**
 * Component Calculators
 * 
 * Calculates costs for meal plans, transfers, and activities.
 * 
 * Reference:
 * - Phase 5: MealPlan, TransferType, Activity schemas
 * - Various pricing modes per component type
 */

import type {
  EntityId,
  MoneyAmount,
  CurrencyCode,
} from '../../types';

import type {
  MealPlan,
  TransferType,
  Activity,
  ChildAgeBand,
} from '../../entities';

import { PricingMode, LineItemType, AuditStepType } from '../../types';

import type {
  CalculationContext,
  ComponentResult,
  GuestCounts,
  CalculationAuditBuilder,
} from '../types';

import { CalculationError } from '../types';

// ============================================================
// CURRENCY CONVERSION
// ============================================================

function convertToQuoteCurrency(
  amount: MoneyAmount,
  sourceCurrency: CurrencyCode,
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
// MEAL PLAN CALCULATION
// ============================================================

/**
 * Calculate meal plan cost for a stay.
 */
export function calculateMealPlan(
  ctx: CalculationContext,
  mealPlan: MealPlan,
  guestCounts: GuestCounts,
  nights: number,
  ageBands: readonly ChildAgeBand[],
  audit: CalculationAuditBuilder
): ComponentResult[] {
  const results: ComponentResult[] = [];
  
  // Adult meal cost
  if (guestCounts.adults > 0) {
    const adultCost = calculateMealPlanCost(
      mealPlan.adult_cost,
      mealPlan.currency_code,
      mealPlan.pricing_mode,
      guestCounts.adults,
      nights,
      ctx
    );
    
    results.push({
      reference_id: mealPlan.id,
      line_item_type: LineItemType.MEAL_PLAN,
      description: `${mealPlan.name} - ${guestCounts.adults} Adult(s) × ${nights} nights`,
      cost_amount: adultCost,
      quantity_detail: {
        adults: guestCounts.adults,
        nights,
        per_adult_rate: mealPlan.adult_cost,
        pricing_mode: mealPlan.pricing_mode,
      },
    });
    
    audit.addStep(
      AuditStepType.MEAL_PLAN,
      `${mealPlan.name} for adults`,
      {
        meal_plan_id: mealPlan.id,
        meal_plan_code: mealPlan.code,
        adults: guestCounts.adults,
        nights,
        per_adult_rate: mealPlan.adult_cost,
        currency: mealPlan.currency_code,
      },
      { cost_amount: adultCost },
      adultCost
    );
  }
  
  // Child meal costs by age band
  for (const [bandId, bandInfo] of guestCounts.children_by_band) {
    const band = ageBands.find(b => b.id === bandId);
    if (!band) continue;
    
    const childRate = mealPlan.child_costs_by_band[bandId as string];
    if (childRate === undefined || childRate === 0) {
      // Free for this age band
      continue;
    }
    
    const childCost = calculateMealPlanCost(
      childRate,
      mealPlan.currency_code,
      mealPlan.pricing_mode,
      bandInfo.count,
      nights,
      ctx
    );
    
    results.push({
      reference_id: mealPlan.id,
      line_item_type: LineItemType.MEAL_PLAN,
      description: `${mealPlan.name} - ${bandInfo.count} ${band.name}(s) × ${nights} nights`,
      cost_amount: childCost,
      quantity_detail: {
        children: bandInfo.count,
        age_band_id: bandId,
        age_band_name: band.name,
        nights,
        per_child_rate: childRate,
        pricing_mode: mealPlan.pricing_mode,
      },
    });
    
    audit.addStep(
      AuditStepType.MEAL_PLAN,
      `${mealPlan.name} for children (${band.name})`,
      {
        meal_plan_id: mealPlan.id,
        age_band: band.name,
        children: bandInfo.count,
        nights,
        per_child_rate: childRate,
        currency: mealPlan.currency_code,
      },
      { cost_amount: childCost },
      childCost
    );
  }
  
  return results;
}

function calculateMealPlanCost(
  rate: MoneyAmount,
  currency: CurrencyCode,
  pricingMode: PricingMode,
  count: number,
  nights: number,
  ctx: CalculationContext
): MoneyAmount {
  const rateInQuote = convertToQuoteCurrency(rate, currency, ctx);
  
  switch (pricingMode) {
    case PricingMode.PER_PERSON_PER_NIGHT:
      return rateInQuote * count * nights;
    case PricingMode.PER_PERSON:
      return rateInQuote * count;
    case PricingMode.PER_STAY:
      return rateInQuote;
    default:
      return rateInQuote * count * nights;
  }
}

// ============================================================
// TRANSFER CALCULATION
// ============================================================

/**
 * Calculate transfer cost.
 */
export function calculateTransfer(
  ctx: CalculationContext,
  transfer: TransferType,
  guestCounts: GuestCounts,
  ageBands: readonly ChildAgeBand[],
  audit: CalculationAuditBuilder
): ComponentResult[] {
  const results: ComponentResult[] = [];
  
  switch (transfer.pricing_mode) {
    case PricingMode.PER_PERSON: {
      // Adult transfer cost
      if (guestCounts.adults > 0 && transfer.adult_cost) {
        const adultCost = convertToQuoteCurrency(
          transfer.adult_cost * guestCounts.adults,
          transfer.currency_code,
          ctx
        );
        
        results.push({
          reference_id: transfer.id,
          line_item_type: LineItemType.TRANSFER,
          description: `${transfer.name} - ${guestCounts.adults} Adult(s)`,
          cost_amount: adultCost,
          quantity_detail: {
            adults: guestCounts.adults,
            per_adult_rate: transfer.adult_cost,
          },
        });
        
        audit.addStep(
          AuditStepType.TRANSFER,
          `${transfer.name} for adults`,
          {
            transfer_id: transfer.id,
            adults: guestCounts.adults,
            per_adult_rate: transfer.adult_cost,
          },
          { cost_amount: adultCost },
          adultCost
        );
      }
      
      // Child transfer costs by band
      for (const [bandId, bandInfo] of guestCounts.children_by_band) {
        const band = ageBands.find(b => b.id === bandId);
        if (!band) continue;
        
        const childRate = transfer.child_costs_by_band?.[bandId as string];
        if (childRate === undefined || childRate === 0) continue;
        
        const childCost = convertToQuoteCurrency(
          childRate * bandInfo.count,
          transfer.currency_code,
          ctx
        );
        
        results.push({
          reference_id: transfer.id,
          line_item_type: LineItemType.TRANSFER,
          description: `${transfer.name} - ${bandInfo.count} ${band.name}(s)`,
          cost_amount: childCost,
          quantity_detail: {
            children: bandInfo.count,
            age_band_id: bandId,
            age_band_name: band.name,
            per_child_rate: childRate,
          },
        });
        
        audit.addStep(
          AuditStepType.TRANSFER,
          `${transfer.name} for children (${band.name})`,
          {
            transfer_id: transfer.id,
            children: bandInfo.count,
            age_band: band.name,
            per_child_rate: childRate,
          },
          { cost_amount: childCost },
          childCost
        );
      }
      break;
    }
    
    case PricingMode.PER_BOOKING:
    case PricingMode.PER_TRIP: {
      if (transfer.cost_amount) {
        const cost = convertToQuoteCurrency(
          transfer.cost_amount,
          transfer.currency_code,
          ctx
        );
        
        results.push({
          reference_id: transfer.id,
          line_item_type: LineItemType.TRANSFER,
          description: `${transfer.name} - ${transfer.pricing_mode === PricingMode.PER_BOOKING ? 'Per Booking' : 'Per Trip'}`,
          cost_amount: cost,
          quantity_detail: {
            flat_rate: transfer.cost_amount,
            pricing_mode: transfer.pricing_mode,
          },
        });
        
        audit.addStep(
          AuditStepType.TRANSFER,
          `${transfer.name} (flat rate)`,
          {
            transfer_id: transfer.id,
            flat_rate: transfer.cost_amount,
            pricing_mode: transfer.pricing_mode,
          },
          { cost_amount: cost },
          cost
        );
      }
      break;
    }
  }
  
  return results;
}

// ============================================================
// ACTIVITY CALCULATION
// ============================================================

/**
 * Calculate activity cost.
 */
export function calculateActivity(
  ctx: CalculationContext,
  activity: Activity,
  guestCounts: GuestCounts,
  ageBands: readonly ChildAgeBand[],
  audit: CalculationAuditBuilder
): ComponentResult[] {
  const results: ComponentResult[] = [];
  
  switch (activity.pricing_mode) {
    case PricingMode.PER_PERSON: {
      // Adult activity cost
      if (guestCounts.adults > 0 && activity.adult_cost) {
        const adultCost = convertToQuoteCurrency(
          activity.adult_cost * guestCounts.adults,
          activity.currency_code,
          ctx
        );
        
        results.push({
          reference_id: activity.id,
          line_item_type: LineItemType.ACTIVITY,
          description: `${activity.name} - ${guestCounts.adults} Adult(s)`,
          cost_amount: adultCost,
          quantity_detail: {
            adults: guestCounts.adults,
            per_adult_rate: activity.adult_cost,
          },
        });
        
        audit.addStep(
          AuditStepType.ACTIVITY,
          `${activity.name} for adults`,
          {
            activity_id: activity.id,
            adults: guestCounts.adults,
            per_adult_rate: activity.adult_cost,
          },
          { cost_amount: adultCost },
          adultCost
        );
      }
      
      // Child activity costs by band
      for (const [bandId, bandInfo] of guestCounts.children_by_band) {
        const band = ageBands.find(b => b.id === bandId);
        if (!band) continue;
        
        const childRate = activity.child_costs_by_band?.[bandId as string];
        if (childRate === undefined || childRate === 0) continue;
        
        const childCost = convertToQuoteCurrency(
          childRate * bandInfo.count,
          activity.currency_code,
          ctx
        );
        
        results.push({
          reference_id: activity.id,
          line_item_type: LineItemType.ACTIVITY,
          description: `${activity.name} - ${bandInfo.count} ${band.name}(s)`,
          cost_amount: childCost,
          quantity_detail: {
            children: bandInfo.count,
            age_band_id: bandId,
            age_band_name: band.name,
            per_child_rate: childRate,
          },
        });
        
        audit.addStep(
          AuditStepType.ACTIVITY,
          `${activity.name} for children (${band.name})`,
          {
            activity_id: activity.id,
            children: bandInfo.count,
            age_band: band.name,
            per_child_rate: childRate,
          },
          { cost_amount: childCost },
          childCost
        );
      }
      break;
    }
    
    case PricingMode.PER_BOOKING: {
      if (activity.cost_amount) {
        const cost = convertToQuoteCurrency(
          activity.cost_amount,
          activity.currency_code,
          ctx
        );
        
        results.push({
          reference_id: activity.id,
          line_item_type: LineItemType.ACTIVITY,
          description: `${activity.name} - Per Booking`,
          cost_amount: cost,
          quantity_detail: {
            flat_rate: activity.cost_amount,
            pricing_mode: activity.pricing_mode,
          },
        });
        
        audit.addStep(
          AuditStepType.ACTIVITY,
          `${activity.name} (flat rate)`,
          {
            activity_id: activity.id,
            flat_rate: activity.cost_amount,
          },
          { cost_amount: cost },
          cost
        );
      }
      break;
    }
  }
  
  return results;
}

// ============================================================
// FESTIVE SUPPLEMENT CALCULATION
// ============================================================

/**
 * Calculate festive supplement costs.
 */
export function calculateFestiveSupplement(
  ctx: CalculationContext,
  supplement: import('../../entities').FestiveSupplement,
  guestCounts: GuestCounts,
  ageBands: readonly ChildAgeBand[],
  triggerDate: import('../../types').DateString,
  audit: CalculationAuditBuilder
): ComponentResult[] {
  const results: ComponentResult[] = [];
  
  switch (supplement.pricing_mode) {
    case PricingMode.PER_PERSON: {
      // Adult supplement
      const adultCost = convertToQuoteCurrency(
        supplement.adult_cost * guestCounts.adults,
        supplement.currency_code,
        ctx
      );
      
      if (adultCost > 0) {
        results.push({
          reference_id: supplement.id,
          line_item_type: LineItemType.FESTIVE_SUPPLEMENT,
          description: `${supplement.name} - ${guestCounts.adults} Adult(s)`,
          cost_amount: adultCost,
          quantity_detail: {
            adults: guestCounts.adults,
            per_adult_rate: supplement.adult_cost,
            trigger_date: triggerDate,
            is_mandatory: supplement.is_mandatory,
          },
        });
        
        audit.addStep(
          AuditStepType.FESTIVE_SUPPLEMENT,
          `${supplement.name} for adults (triggered by ${triggerDate})`,
          {
            supplement_id: supplement.id,
            adults: guestCounts.adults,
            per_adult_rate: supplement.adult_cost,
            trigger_date: triggerDate,
          },
          { cost_amount: adultCost },
          adultCost
        );
      }
      
      // Child supplements by band
      for (const [bandId, bandInfo] of guestCounts.children_by_band) {
        const band = ageBands.find(b => b.id === bandId);
        if (!band) continue;
        
        const childRate = supplement.child_costs_by_band?.[bandId as string];
        if (childRate === undefined || childRate === 0) continue;
        
        const childCost = convertToQuoteCurrency(
          childRate * bandInfo.count,
          supplement.currency_code,
          ctx
        );
        
        results.push({
          reference_id: supplement.id,
          line_item_type: LineItemType.FESTIVE_SUPPLEMENT,
          description: `${supplement.name} - ${bandInfo.count} ${band.name}(s)`,
          cost_amount: childCost,
          quantity_detail: {
            children: bandInfo.count,
            age_band_id: bandId,
            age_band_name: band.name,
            per_child_rate: childRate,
            trigger_date: triggerDate,
            is_mandatory: supplement.is_mandatory,
          },
        });
        
        audit.addStep(
          AuditStepType.FESTIVE_SUPPLEMENT,
          `${supplement.name} for children (${band.name})`,
          {
            supplement_id: supplement.id,
            children: bandInfo.count,
            age_band: band.name,
            per_child_rate: childRate,
          },
          { cost_amount: childCost },
          childCost
        );
      }
      break;
    }
    
    case PricingMode.PER_ROOM_PER_NIGHT: {
      const cost = convertToQuoteCurrency(
        supplement.adult_cost, // Uses adult_cost as room rate
        supplement.currency_code,
        ctx
      );
      
      results.push({
        reference_id: supplement.id,
        line_item_type: LineItemType.FESTIVE_SUPPLEMENT,
        description: `${supplement.name} - Per Room`,
        cost_amount: cost,
        quantity_detail: {
          per_room_rate: supplement.adult_cost,
          trigger_date: triggerDate,
          is_mandatory: supplement.is_mandatory,
        },
      });
      
      audit.addStep(
        AuditStepType.FESTIVE_SUPPLEMENT,
        `${supplement.name} (room charge)`,
        {
          supplement_id: supplement.id,
          per_room_rate: supplement.adult_cost,
          trigger_date: triggerDate,
        },
        { cost_amount: cost },
        cost
      );
      break;
    }
  }
  
  return results;
}
