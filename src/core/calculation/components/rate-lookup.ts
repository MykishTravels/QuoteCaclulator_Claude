/**
 * Rate Lookup Component
 * 
 * Finds the applicable rate for a room type on a given date.
 * Handles season resolution and currency conversion.
 * 
 * Reference:
 * - Phase 4: Rate lookup is per-night, per-room
 * - A-005: Each night belongs to exactly one season
 */

import type {
  EntityId,
  DateString,
  CurrencyCode,
  MoneyAmount,
} from '../../types';

import type {
  Rate,
  Season,
} from '../../entities';

import type {
  CalculationContext,
  NightlyRateResult,
  CalculationAuditBuilder,
} from '../types';

import { CalculationError } from '../types';
import { AuditStepType } from '../../types';
import { dateRangeArray, calculateNights } from '../../utils';

// ============================================================
// RATE LOOKUP
// ============================================================

/**
 * Look up the rate for a specific room type and date.
 */
export function lookupRate(
  ctx: CalculationContext,
  resortId: EntityId,
  roomTypeId: EntityId,
  date: DateString
): { season: Season; rate: Rate } {
  // Find season for date
  const season = ctx.data.getSeasonForDate(resortId, date);
  if (!season) {
    throw new CalculationError(
      'CALC_SEASON_NOT_FOUND',
      `No season found for date ${date} at resort ${resortId}`,
      { resort_id: resortId, date }
    );
  }
  
  // Find rate for room type in season
  const rate = ctx.data.getRate(resortId, roomTypeId, season.id, date);
  if (!rate) {
    throw new CalculationError(
      'CALC_RATE_NOT_FOUND',
      `No rate found for room ${roomTypeId} in season ${season.name} on ${date}`,
      { resort_id: resortId, room_type_id: roomTypeId, season_id: season.id, date }
    );
  }
  
  return { season, rate };
}

/**
 * Convert a rate to quote currency.
 */
export function convertRateToQuoteCurrency(
  ctx: CalculationContext,
  rate: Rate
): MoneyAmount {
  if (rate.currency_code === ctx.quote_currency) {
    return rate.cost_amount;
  }
  
  const exchangeRate = ctx.exchange_rates[rate.currency_code];
  if (exchangeRate === undefined) {
    throw new CalculationError(
      'CALC_CURRENCY_CONVERSION_FAILED',
      `No exchange rate for ${rate.currency_code} to ${ctx.quote_currency}`,
      { source_currency: rate.currency_code, quote_currency: ctx.quote_currency }
    );
  }
  
  // Rate interpretation: 1 unit of source = rate units of quote
  return rate.cost_amount * exchangeRate;
}

// ============================================================
// NIGHTLY BREAKDOWN
// ============================================================

/**
 * Calculate nightly room rates for a stay.
 * Returns unrounded costs (rounding happens at finalization).
 */
export function calculateNightlyRates(
  ctx: CalculationContext,
  resortId: EntityId,
  roomTypeId: EntityId,
  checkIn: DateString,
  checkOut: DateString,
  audit: CalculationAuditBuilder
): { rates: NightlyRateResult[]; totalCost: MoneyAmount } {
  const nights = dateRangeArray(checkIn, checkOut);
  const results: NightlyRateResult[] = [];
  let totalCost = 0;
  
  for (const date of nights) {
    const { season, rate } = lookupRate(ctx, resortId, roomTypeId, date);
    const costInQuoteCurrency = convertRateToQuoteCurrency(ctx, rate);
    
    results.push({
      date,
      season_id: season.id,
      season_name: season.name,
      rate_id: rate.id,
      source_cost: rate.cost_amount,
      source_currency: rate.currency_code,
      cost_amount: costInQuoteCurrency,
    });
    
    totalCost += costInQuoteCurrency;
    
    // Audit each rate lookup
    audit.addStep(
      AuditStepType.RATE_LOOKUP,
      `Room rate for ${date} (${season.name})`,
      {
        room_type_id: roomTypeId,
        date,
        season_id: season.id,
        season_name: season.name,
      },
      {
        rate_id: rate.id,
        source_cost: rate.cost_amount,
        source_currency: rate.currency_code,
        cost_in_quote_currency: costInQuoteCurrency,
      },
      costInQuoteCurrency
    );
  }
  
  return { rates: results, totalCost };
}

// ============================================================
// SEASON VALIDATION
// ============================================================

/**
 * Check if all nights of a stay have valid seasons.
 * Returns list of dates without seasons.
 */
export function validateSeasonCoverage(
  ctx: CalculationContext,
  resortId: EntityId,
  checkIn: DateString,
  checkOut: DateString
): DateString[] {
  const nights = dateRangeArray(checkIn, checkOut);
  const missingDates: DateString[] = [];
  
  for (const date of nights) {
    const season = ctx.data.getSeasonForDate(resortId, date);
    if (!season) {
      missingDates.push(date);
    }
  }
  
  return missingDates;
}

/**
 * Get unique seasons for a stay.
 */
export function getSeasonsForStay(
  ctx: CalculationContext,
  resortId: EntityId,
  checkIn: DateString,
  checkOut: DateString
): Season[] {
  const nights = dateRangeArray(checkIn, checkOut);
  const seenIds = new Set<EntityId>();
  const seasons: Season[] = [];
  
  for (const date of nights) {
    const season = ctx.data.getSeasonForDate(resortId, date);
    if (season && !seenIds.has(season.id)) {
      seenIds.add(season.id);
      seasons.push(season);
    }
  }
  
  return seasons;
}
