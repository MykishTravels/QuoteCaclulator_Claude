/**
 * Calculation Context and Types
 * 
 * Defines the input/output contracts for the calculation engine.
 * 
 * Reference:
 * - Phase 4: Locked Refinements
 * - Phase 6: Error Handling
 */

import type {
  EntityId,
  DateString,
  DateTimeString,
  CurrencyCode,
  MoneyAmount,
  Percentage,
  ExchangeRateMap,
  PricingBreakdown,
  Child,
  Result,
  AuditStep,
  AuditWarning,
  ValidationItem,
} from '../types';

import type {
  Resort,
  RoomType,
  Season,
  Rate,
  ChildAgeBand,
  ExtraPersonCharge,
  MealPlan,
  TransferType,
  Activity,
  TaxConfiguration,
  FestiveSupplement,
  Discount,
  MarkupConfiguration,
} from '../entities';

import {
  ExchangeRateSource,
  ValidationSeverity,
  AuditStepType,
  LineItemType,
  DiscountBaseType,
} from '../types';

// ============================================================
// CALCULATION INPUT
// ============================================================

/**
 * Input for calculating a single leg.
 */
export interface LegCalculationInput {
  /** Resort for this leg */
  resort_id: EntityId;
  
  /** Room type selected */
  room_type_id: EntityId;
  
  /** Check-in date */
  check_in_date: DateString;
  
  /** Check-out date */
  check_out_date: DateString;
  
  /** Number of adults */
  adults_count: number;
  
  /** Children with ages */
  children: Child[];
  
  /** Selected meal plan (optional - uses resort default if not specified) */
  meal_plan_id?: EntityId;
  
  /** Selected transfer type (optional - uses resort default if not specified) */
  transfer_type_id?: EntityId;
  
  /** Selected activities */
  activity_ids?: EntityId[];
  
  /** Applied discount codes */
  discount_codes?: string[];
}

/**
 * Input for calculating inter-resort transfer.
 */
export interface InterResortTransferInput {
  /** Description of transfer */
  transfer_description: string;
  
  /** Total cost in source currency */
  cost_amount: MoneyAmount;
  
  /** Source currency */
  currency_code: CurrencyCode;
  
  /** Optional notes */
  notes?: string;
}

/**
 * Full calculation input for a quote.
 */
export interface QuoteCalculationInput {
  /** Client name */
  client_name: string;
  
  /** Client email */
  client_email?: string;
  
  /** Client notes */
  client_notes?: string;
  
  /** Quote currency */
  currency_code: CurrencyCode;
  
  /** Quote validity in days */
  validity_days: number;
  
  /** Legs to calculate */
  legs: LegCalculationInput[];
  
  /** Inter-resort transfers (between consecutive legs) */
  inter_resort_transfers?: InterResortTransferInput[];
  
  /** Quote-level fixed markup override (v1: FIXED only) */
  quote_level_markup?: {
    markup_value: MoneyAmount;
    override_reason?: string;
  };
  
  /** Manually specified exchange rates (optional) */
  manual_exchange_rates?: ExchangeRateMap;
  
  /** Booking date for discount eligibility (defaults to today) */
  booking_date?: DateString;
}

// ============================================================
// CALCULATION CONTEXT
// ============================================================

/**
 * Immutable context for calculation.
 * Contains all reference data and locked values.
 */
export interface CalculationContext {
  /** Quote currency */
  readonly quote_currency: CurrencyCode;
  
  /** Locked exchange rates */
  readonly exchange_rates: ExchangeRateMap;
  
  /** Exchange rate lock timestamp */
  readonly exchange_rate_timestamp: DateTimeString;
  
  /** Exchange rate source */
  readonly exchange_rate_source: ExchangeRateSource;
  
  /** Booking date (for discount eligibility) */
  readonly booking_date: DateString;
  
  /** Reference data accessors */
  readonly data: CalculationDataAccess;
}

/**
 * Interface for accessing reference data during calculation.
 */
export interface CalculationDataAccess {
  // Core lookups
  getResort(id: EntityId): Resort | null;
  getRoomType(id: EntityId): RoomType | null;
  getChildAgeBands(resortId: EntityId): readonly ChildAgeBand[];
  
  // Season and rate lookups
  getSeasonForDate(resortId: EntityId, date: DateString): Season | null;
  getRate(resortId: EntityId, roomTypeId: EntityId, seasonId: EntityId, date: DateString): Rate | null;
  
  // Component lookups
  getExtraPersonCharges(resortId: EntityId, roomTypeId: EntityId): readonly ExtraPersonCharge[];
  getMealPlan(id: EntityId): MealPlan | null;
  getDefaultMealPlan(resortId: EntityId): MealPlan | null;
  getTransferType(id: EntityId): TransferType | null;
  getDefaultTransferType(resortId: EntityId): TransferType | null;
  getActivity(id: EntityId): Activity | null;
  
  // Tax and discount lookups
  getTaxConfigurations(resortId: EntityId, date: DateString): readonly TaxConfiguration[];
  getFestiveSupplements(resortId: EntityId, checkIn: DateString, checkOut: DateString): readonly FestiveSupplement[];
  getDiscountByCode(resortId: EntityId, code: string): Discount | null;
  
  // Markup lookup
  getMarkupConfiguration(resortId: EntityId): MarkupConfiguration | null;
}

// ============================================================
// CALCULATION OUTPUT (Intermediate)
// ============================================================

/**
 * Nightly rate result.
 */
export interface NightlyRateResult {
  date: DateString;
  season_id: EntityId;
  season_name: string;
  rate_id: EntityId;
  source_cost: MoneyAmount;
  source_currency: CurrencyCode;
  cost_amount: MoneyAmount; // In quote currency
}

/**
 * Extra person charge result.
 */
export interface ExtraPersonChargeResult {
  guest_type: 'adult' | 'child';
  age_band_id: EntityId | null;
  age_band_name: string | null;
  child_age: number | null;
  count: number;
  nights: number;
  per_unit_cost: MoneyAmount;
  total_cost: MoneyAmount;
}

/**
 * Component calculation result (meals, transfers, activities).
 */
export interface ComponentResult {
  reference_id: EntityId;
  line_item_type: LineItemType;
  description: string;
  cost_amount: MoneyAmount;
  quantity_detail: Record<string, unknown>;
}

/**
 * Tax calculation result.
 */
export interface TaxResult {
  tax_config_id: EntityId;
  tax_type: LineItemType;
  name: string;
  cost_amount: MoneyAmount;
  base_amount: MoneyAmount;
  rate_value: MoneyAmount | Percentage;
  calculation_method: string;
  quantity_detail: Record<string, unknown>;
}

/**
 * Discount calculation result.
 */
export interface DiscountResult {
  discount_id: EntityId;
  discount_name: string;
  discount_code: string;
  discount_type: string;
  discount_value: MoneyAmount | Percentage;
  base_type: DiscountBaseType;
  base_amount: MoneyAmount;
  discount_amount: MoneyAmount;
  base_composition: LineItemType[];
  excluded_from_base: LineItemType[];
}

/**
 * Markup calculation result.
 */
export interface MarkupResult {
  source: 'RESORT' | 'QUOTE_LEVEL';
  markup_config_id: EntityId | null;
  markup_type: 'PERCENTAGE' | 'FIXED';
  markup_value: MoneyAmount | Percentage;
  cost_amount: MoneyAmount;
  markup_amount: MoneyAmount;
  sell_amount: MoneyAmount;
}

// ============================================================
// LEG CALCULATION OUTPUT
// ============================================================

/**
 * Complete leg calculation result.
 */
export interface LegCalculationResult {
  /** Input echoed back */
  input: LegCalculationInput;
  
  /** Resolved resort */
  resort: {
    id: EntityId;
    name: string;
  };
  
  /** Resolved room type */
  room_type: {
    id: EntityId;
    name: string;
  };
  
  /** Number of nights */
  nights: number;
  
  /** Nightly room rates */
  nightly_rates: NightlyRateResult[];
  
  /** Room cost subtotal (before markup) */
  room_cost: MoneyAmount;
  
  /** Extra person charges */
  extra_person_charges: ExtraPersonChargeResult[];
  
  /** Total extra person cost */
  extra_person_cost: MoneyAmount;
  
  /** Component results (meals, transfers, activities) */
  components: ComponentResult[];
  
  /** Total component cost */
  component_cost: MoneyAmount;
  
  /** Festive supplements */
  festive_supplements: ComponentResult[];
  
  /** Total festive cost */
  festive_cost: MoneyAmount;
  
  /** Pre-tax subtotal (room + extra + components + festive) */
  pre_tax_subtotal: MoneyAmount;
  
  /** Applied discounts */
  discounts: DiscountResult[];
  
  /** Total discount amount */
  total_discount: MoneyAmount;
  
  /** Post-discount subtotal */
  post_discount_subtotal: MoneyAmount;
  
  /** Tax calculations */
  taxes: TaxResult[];
  
  /** Total tax amount */
  total_taxes: MoneyAmount;
  
  /** Post-tax subtotal (before markup) */
  post_tax_cost: MoneyAmount;
  
  /** Markup result */
  markup: MarkupResult;
  
  /** Final leg totals */
  totals: PricingBreakdown;
  
  /** Resolved children with age bands */
  resolved_children: Array<Child & { age_band_name: string }>;
}

// ============================================================
// QUOTE CALCULATION OUTPUT
// ============================================================

/**
 * Inter-resort transfer calculation result.
 */
export interface InterResortTransferResult {
  from_leg_index: number;
  to_leg_index: number;
  transfer_description: string;
  cost_amount: MoneyAmount;
  markup_amount: MoneyAmount;
  sell_amount: MoneyAmount;
  markup_source: 'DESTINATION_RESORT';
  markup_config_id: EntityId;
  notes: string | null;
}

/**
 * Complete quote calculation result.
 */
export interface QuoteCalculationResult {
  /** Calculation success */
  success: boolean;
  
  /** Calculation timestamp */
  calculated_at: DateTimeString;
  
  /** Quote currency */
  currency_code: CurrencyCode;
  
  /** Exchange rates used */
  exchange_rates: ExchangeRateMap;
  exchange_rate_timestamp: DateTimeString;
  exchange_rate_source: ExchangeRateSource;
  
  /** Leg results */
  legs: LegCalculationResult[];
  
  /** Inter-resort transfer results */
  inter_resort_transfers: InterResortTransferResult[];
  
  /** Quote-level markup (if applied) */
  quote_level_markup: {
    markup_type: 'FIXED';
    markup_value: MoneyAmount;
    override_reason: string | null;
  } | null;
  
  /** Quote totals */
  totals: {
    legs_cost: MoneyAmount;
    legs_markup: MoneyAmount;
    legs_sell: MoneyAmount;
    irt_cost: MoneyAmount;
    irt_markup: MoneyAmount;
    irt_sell: MoneyAmount;
    quote_level_markup: MoneyAmount;
    total_cost: MoneyAmount;
    total_markup: MoneyAmount;
    total_sell: MoneyAmount;
    margin_percentage: Percentage;
    total_taxes: MoneyAmount;
  };
  
  /** Taxes breakdown by type */
  taxes_breakdown: {
    green_tax: MoneyAmount;
    service_charge: MoneyAmount;
    gst: MoneyAmount;
    vat: MoneyAmount;
  };
  
  /** Validation warnings (calculation-time) */
  warnings: ValidationItem[];
  
  /** Audit trail */
  audit_steps: AuditStep[];
}

// ============================================================
// CALCULATION ERRORS
// ============================================================

/**
 * Calculation error codes.
 * Reference: Phase 6 Section C
 */
export type CalculationErrorCode =
  | 'CALC_INIT_FAILED'
  | 'CALC_FX_LOCK_FAILED'
  | 'CALC_RATE_NOT_FOUND'
  | 'CALC_SEASON_NOT_FOUND'
  | 'CALC_CURRENCY_CONVERSION_FAILED'
  | 'CALC_ARITHMETIC_ERROR'
  | 'CALC_NEGATIVE_FINAL_AMOUNT'
  | 'CALC_TAX_CONFIG_INVALID'
  | 'CALC_MARKUP_INVALID'
  | 'CALC_VERIFICATION_FAILED';

/**
 * Calculation error with context.
 */
export class CalculationError extends Error {
  constructor(
    public readonly code: CalculationErrorCode,
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(`[${code}] ${message}`);
    this.name = 'CalculationError';
  }
}

// ============================================================
// AUDIT BUILDER
// ============================================================

/**
 * Builder for accumulating audit steps during calculation.
 */
export class CalculationAuditBuilder {
  private steps: AuditStep[] = [];
  private warnings: AuditWarning[] = [];
  private stepNumber = 0;
  
  constructor(private readonly legId?: EntityId) {}
  
  /**
   * Add an audit step.
   */
  addStep(
    stepType: AuditStepType,
    description: string,
    inputs: Record<string, unknown>,
    outputs: Record<string, unknown>,
    resultAmount: MoneyAmount
  ): void {
    this.stepNumber++;
    this.steps.push({
      step_number: this.stepNumber,
      step_type: stepType,
      leg_id: this.legId,
      timestamp: new Date().toISOString() as DateTimeString,
      description,
      inputs,
      outputs,
      result_amount: resultAmount,
    });
  }
  
  /**
   * Add a warning.
   */
  addWarning(code: string, message: string): void {
    this.warnings.push({
      code,
      severity: ValidationSeverity.WARNING,
      message,
    });
  }
  
  /**
   * Get all steps.
   */
  getSteps(): readonly AuditStep[] {
    return this.steps;
  }
  
  /**
   * Get all warnings.
   */
  getWarnings(): readonly AuditWarning[] {
    return this.warnings;
  }
  
  /**
   * Merge another builder's steps.
   */
  merge(other: CalculationAuditBuilder): void {
    for (const step of other.getSteps()) {
      this.stepNumber++;
      this.steps.push({ ...step, step_number: this.stepNumber });
    }
    this.warnings.push(...other.getWarnings());
  }
}

// ============================================================
// HELPER TYPES
// ============================================================

/**
 * Guest counts for pricing calculations.
 */
export interface GuestCounts {
  adults: number;
  children_by_band: Map<EntityId, { count: number; ages: number[] }>;
  total_guests: number;
  eligible_for_green_tax: number; // Guests over threshold age
}

/**
 * Resolve guest counts from input.
 */
export function resolveGuestCounts(
  adults: number,
  children: Child[],
  ageBands: readonly ChildAgeBand[],
  greenTaxAgeThreshold: number = 2
): GuestCounts {
  const childrenByBand = new Map<EntityId, { count: number; ages: number[] }>();
  
  for (const child of children) {
    const band = ageBands.find(b => child.age >= b.min_age && child.age <= b.max_age);
    if (band) {
      const existing = childrenByBand.get(band.id) ?? { count: 0, ages: [] };
      existing.count++;
      existing.ages.push(child.age);
      childrenByBand.set(band.id, existing);
    }
  }
  
  // Count guests eligible for green tax (over threshold)
  const childrenOverThreshold = children.filter(c => c.age > greenTaxAgeThreshold).length;
  
  return {
    adults,
    children_by_band: childrenByBand,
    total_guests: adults + children.length,
    eligible_for_green_tax: adults + childrenOverThreshold,
  };
}
