/**
 * Leg Calculator
 * 
 * Orchestrates calculation of a single resort leg.
 * 
 * Calculation Order:
 * 1. Resolve entities (resort, room type, age bands)
 * 2. Calculate nightly room rates
 * 3. Calculate extra person charges
 * 4. Calculate meal plan
 * 5. Calculate transfer
 * 6. Calculate activities
 * 7. Calculate festive supplements
 * 8. Calculate pre-tax subtotal
 * 9. Apply discounts
 * 10. Calculate taxes (Green Tax → Service Charge → GST)
 * 11. Apply markup
 * 12. Aggregate totals
 */

import type {
  EntityId,
  MoneyAmount,
  ValidationItem,
} from '../types';

import type {
  Resort,
  RoomType,
  ChildAgeBand,
} from '../entities';

import { LineItemType, AuditStepType, ValidationSeverity } from '../types';

import type {
  CalculationContext,
  LegCalculationInput,
  LegCalculationResult,
  ComponentResult,
  GuestCounts,
  CalculationAuditBuilder,
} from './types';

import { CalculationError, CalculationAuditBuilder as AuditBuilder, resolveGuestCounts } from './types';
import { calculateNightlyRates, getSeasonsForStay } from './components/rate-lookup';
import { calculateExtraPersonCharges, validateOccupancy } from './components/extra-person';
import { calculateMealPlan, calculateTransfer, calculateActivity, calculateFestiveSupplement } from './components/components';
import { calculateDiscounts, type CostBreakdown } from './engines/discount-engine';
import { calculateTaxes, type TaxCalculationInput } from './engines/tax-engine';
import { calculateLegMarkup, type LegCostsForMarkup } from './engines/markup-engine';
import { calculateNights, roundCurrency } from '../utils';

// ============================================================
// MAIN LEG CALCULATION
// ============================================================

/**
 * Calculate a single leg.
 */
export function calculateLeg(
  ctx: CalculationContext,
  input: LegCalculationInput,
  legIndex: number,
  useQuoteLevelMarkup: boolean,
  audit: CalculationAuditBuilder
): { result: LegCalculationResult; warnings: ValidationItem[] } {
  const warnings: ValidationItem[] = [];
  
  // ============================================================
  // STEP 1: Resolve Entities
  // ============================================================
  
  const resort = ctx.data.getResort(input.resort_id);
  if (!resort) {
    throw new CalculationError(
      'CALC_INIT_FAILED',
      `Resort not found: ${input.resort_id}`,
      { resort_id: input.resort_id }
    );
  }
  
  const roomType = ctx.data.getRoomType(input.room_type_id);
  if (!roomType) {
    throw new CalculationError(
      'CALC_INIT_FAILED',
      `Room type not found: ${input.room_type_id}`,
      { room_type_id: input.room_type_id }
    );
  }
  
  const ageBands = ctx.data.getChildAgeBands(resort.id);
  const nights = calculateNights(input.check_in_date, input.check_out_date);
  
  // Resolve guest counts
  const guestCounts = resolveGuestCounts(input.adults_count, input.children, ageBands, 2);
  
  // Validate occupancy
  const occupancyCheck = validateOccupancy(roomType, input.adults_count, input.children.length);
  if (!occupancyCheck.valid) {
    throw new CalculationError(
      'CALC_INIT_FAILED',
      occupancyCheck.errors.join('; '),
      { adults: input.adults_count, children: input.children.length, room_type: roomType.name }
    );
  }
  
  // Resolve children with age band names
  const resolvedChildren = input.children.map(child => {
    const band = ageBands.find(b => child.age >= b.min_age && child.age <= b.max_age);
    return {
      ...child,
      age_band_id: band?.id,
      age_band_name: band?.name ?? 'Unknown',
    };
  });
  
  // Get seasons for the stay (for discount blackout checking)
  const seasons = getSeasonsForStay(ctx, resort.id, input.check_in_date, input.check_out_date);
  
  // ============================================================
  // STEP 2: Calculate Nightly Room Rates
  // ============================================================
  
  const { rates: nightlyRates, totalCost: roomCost } = calculateNightlyRates(
    ctx,
    resort.id,
    roomType.id,
    input.check_in_date,
    input.check_out_date,
    audit
  );
  
  // ============================================================
  // STEP 3: Calculate Extra Person Charges
  // ============================================================
  
  const { charges: extraPersonCharges, totalCost: extraPersonCost } = calculateExtraPersonCharges(
    ctx,
    resort.id,
    roomType,
    guestCounts,
    nights,
    ageBands,
    audit
  );
  
  // ============================================================
  // STEP 4-7: Calculate Components
  // ============================================================
  
  const components: ComponentResult[] = [];
  let mealPlanCost = 0;
  let transferCost = 0;
  let activityCost = 0;
  let festiveCost = 0;
  
  // Meal Plan
  const mealPlanId = input.meal_plan_id ?? ctx.data.getDefaultMealPlan(resort.id)?.id;
  if (mealPlanId) {
    const mealPlan = ctx.data.getMealPlan(mealPlanId);
    if (mealPlan) {
      const mealResults = calculateMealPlan(ctx, mealPlan, guestCounts, nights, ageBands, audit);
      components.push(...mealResults);
      mealPlanCost = mealResults.reduce((sum, r) => sum + r.cost_amount, 0);
    }
  }
  
  // Transfer
  const transferId = input.transfer_type_id ?? ctx.data.getDefaultTransferType(resort.id)?.id;
  if (transferId) {
    const transfer = ctx.data.getTransferType(transferId);
    if (transfer) {
      const transferResults = calculateTransfer(ctx, transfer, guestCounts, ageBands, audit);
      components.push(...transferResults);
      transferCost = transferResults.reduce((sum, r) => sum + r.cost_amount, 0);
    }
  } else if (resort.transfer_required) {
    warnings.push({
      code: 'TRANSFER_REQUIRED',
      severity: ValidationSeverity.WARNING,
      scope: `leg[${legIndex}]`,
      message: `${resort.name} requires transfer but none selected`,
      resolution_hint: 'Select a transfer type for this resort',
    });
  }
  
  // Activities
  if (input.activity_ids && input.activity_ids.length > 0) {
    for (const activityId of input.activity_ids) {
      const activity = ctx.data.getActivity(activityId);
      if (activity) {
        const activityResults = calculateActivity(ctx, activity, guestCounts, ageBands, audit);
        components.push(...activityResults);
        activityCost += activityResults.reduce((sum, r) => sum + r.cost_amount, 0);
      }
    }
  }
  
  // Festive Supplements
  const festiveSupplements = ctx.data.getFestiveSupplements(
    resort.id,
    input.check_in_date,
    input.check_out_date
  );
  
  const festiveSuppResults: ComponentResult[] = [];
  for (const supplement of festiveSupplements) {
    // Find the trigger date within the stay
    const triggerDate = supplement.trigger_dates.find(d =>
      d >= input.check_in_date && d < input.check_out_date
    );
    
    if (triggerDate) {
      const suppResults = calculateFestiveSupplement(
        ctx,
        supplement,
        guestCounts,
        ageBands,
        triggerDate,
        audit
      );
      festiveSuppResults.push(...suppResults);
      festiveCost += suppResults.reduce((sum, r) => sum + r.cost_amount, 0);
    }
  }
  
  // ============================================================
  // STEP 8: Calculate Pre-Tax Subtotal
  // ============================================================
  
  const preTaxSubtotal = roomCost + extraPersonCost + mealPlanCost + transferCost + activityCost + festiveCost;
  
  audit.addStep(
    AuditStepType.PRE_TAX_SUBTOTAL,
    'Pre-tax subtotal calculated',
    {
      room_cost: roomCost,
      extra_person_cost: extraPersonCost,
      meal_plan_cost: mealPlanCost,
      transfer_cost: transferCost,
      activity_cost: activityCost,
      festive_cost: festiveCost,
    },
    { pre_tax_subtotal: preTaxSubtotal },
    preTaxSubtotal
  );
  
  // ============================================================
  // STEP 9: Apply Discounts
  // ============================================================
  
  const costBreakdown: CostBreakdown = {
    room: roomCost,
    extra_person: extraPersonCost,
    meal_plan: mealPlanCost,
    transfer: transferCost,
    activity: activityCost,
    festive_supplement: festiveCost,
  };
  
  const { discounts, total_discount: totalDiscount, warnings: discountWarnings } = calculateDiscounts(
    ctx,
    resort.id,
    input.discount_codes ?? [],
    costBreakdown,
    nights,
    input.check_in_date,
    seasons,
    audit
  );
  
  warnings.push(...discountWarnings);
  
  const postDiscountSubtotal = preTaxSubtotal - totalDiscount;
  
  // ============================================================
  // STEP 10: Calculate Taxes
  // ============================================================
  
  const taxInput: TaxCalculationInput = {
    post_discount_subtotal: postDiscountSubtotal,
    guest_counts: guestCounts,
    nights,
    subtotal_composition: [
      LineItemType.ROOM,
      LineItemType.EXTRA_PERSON,
      LineItemType.MEAL_PLAN,
      LineItemType.TRANSFER,
      LineItemType.ACTIVITY,
      LineItemType.FESTIVE_SUPPLEMENT,
    ],
  };
  
  const { taxes, total_taxes: totalTaxes, breakdown: taxBreakdown } = calculateTaxes(
    ctx,
    resort.id,
    input.check_in_date,
    taxInput,
    audit
  );
  
  // ============================================================
  // STEP 11: Apply Markup
  // ============================================================
  
  const markupConfig = ctx.data.getMarkupConfiguration(resort.id);
  if (!markupConfig && !useQuoteLevelMarkup) {
    throw new CalculationError(
      'CALC_MARKUP_INVALID',
      `No markup configuration for resort ${resort.id}`,
      { resort_id: resort.id }
    );
  }
  
  const legCostsForMarkup: LegCostsForMarkup = {
    room_cost: roomCost - totalDiscount * (roomCost / preTaxSubtotal), // Pro-rate discount to room
    extra_person_cost: extraPersonCost,
    meal_plan_cost: mealPlanCost,
    transfer_cost: transferCost,
    activity_cost: activityCost,
    festive_cost: festiveCost,
    green_tax: taxBreakdown.green_tax,
    service_charge: taxBreakdown.service_charge,
    gst: taxBreakdown.gst,
    vat: taxBreakdown.vat,
  };
  
  // Simplified: apply markup to post-discount pre-tax amount (not taxes)
  const markupableCost = postDiscountSubtotal;
  const totalMarkup = useQuoteLevelMarkup 
    ? 0 
    : markupConfig 
      ? markupableCost * ((markupConfig.markup_value as number) / 100)
      : 0;
  
  if (!useQuoteLevelMarkup && markupConfig) {
    audit.addStep(
      AuditStepType.MARKUP,
      `Resort markup: ${markupConfig.markup_value}%`,
      {
        markup_config_id: markupConfig.id,
        markup_percentage: markupConfig.markup_value,
        markupable_cost: markupableCost,
      },
      { markup_amount: totalMarkup },
      totalMarkup
    );
  }
  
  // ============================================================
  // STEP 12: Aggregate Totals
  // ============================================================
  
  const totalCost = postDiscountSubtotal + totalTaxes;
  const totalSell = totalCost + totalMarkup;
  
  audit.addStep(
    AuditStepType.LEG_TOTAL,
    `Leg ${legIndex + 1} total calculated`,
    {
      pre_discount_subtotal: preTaxSubtotal,
      total_discount: totalDiscount,
      post_discount_subtotal: postDiscountSubtotal,
      total_taxes: totalTaxes,
      total_cost: totalCost,
    },
    {
      total_markup: totalMarkup,
      total_sell: totalSell,
    },
    totalSell
  );
  
  // Build result with ROUNDED final values
  const result: LegCalculationResult = {
    input,
    resort: {
      id: resort.id,
      name: resort.name,
    },
    room_type: {
      id: roomType.id,
      name: roomType.name,
    },
    nights,
    nightly_rates: nightlyRates.map(r => ({
      ...r,
      cost_amount: roundCurrency(r.cost_amount),
    })),
    room_cost: roundCurrency(roomCost),
    extra_person_charges: extraPersonCharges.map(c => ({
      ...c,
      per_unit_cost: roundCurrency(c.per_unit_cost),
      total_cost: roundCurrency(c.total_cost),
    })),
    extra_person_cost: roundCurrency(extraPersonCost),
    components: components.map(c => ({
      ...c,
      cost_amount: roundCurrency(c.cost_amount),
    })),
    component_cost: roundCurrency(mealPlanCost + transferCost + activityCost),
    festive_supplements: festiveSuppResults.map(f => ({
      ...f,
      cost_amount: roundCurrency(f.cost_amount),
    })),
    festive_cost: roundCurrency(festiveCost),
    pre_tax_subtotal: roundCurrency(preTaxSubtotal),
    discounts: discounts.map(d => ({
      ...d,
      base_amount: roundCurrency(d.base_amount),
      discount_amount: roundCurrency(d.discount_amount),
    })),
    total_discount: roundCurrency(totalDiscount),
    post_discount_subtotal: roundCurrency(postDiscountSubtotal),
    taxes: taxes.map(t => ({
      ...t,
      cost_amount: roundCurrency(t.cost_amount),
      base_amount: roundCurrency(t.base_amount),
    })),
    total_taxes: roundCurrency(totalTaxes),
    post_tax_cost: roundCurrency(totalCost),
    markup: {
      source: useQuoteLevelMarkup ? 'QUOTE_LEVEL' : 'RESORT',
      markup_config_id: useQuoteLevelMarkup ? null : markupConfig?.id ?? null,
      markup_type: 'PERCENTAGE',
      markup_value: markupConfig?.markup_value ?? 0,
      cost_amount: roundCurrency(markupableCost),
      markup_amount: roundCurrency(totalMarkup),
      sell_amount: roundCurrency(markupableCost + totalMarkup),
    },
    totals: {
      cost_amount: roundCurrency(totalCost),
      markup_amount: roundCurrency(totalMarkup),
      sell_amount: roundCurrency(totalSell),
    },
    resolved_children: resolvedChildren,
  };
  
  return { result, warnings };
}
