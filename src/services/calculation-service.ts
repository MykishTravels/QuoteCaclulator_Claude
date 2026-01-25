/**
 * Calculation Service
 * 
 * Bridges the calculation engine to quote persistence.
 * 
 * Responsibilities:
 * - Accept calculation requests
 * - Invoke calculation engine (black box)
 * - Create immutable QuoteVersion from results
 * - Update Quote.current_version_id
 * 
 * Constraints:
 * - Does NOT contain any pricing logic
 * - Only calls calculation engine, never modifies it
 * - Always creates new version (immutable)
 */

import type {
  EntityId,
  DateString,
  DateTimeString,
  CurrencyCode,
  MoneyAmount,
  Percentage,
  Result,
  Child,
  PricingBreakdown,
  QuantityDetail,
  AuditStep,
  AuditWarning,
  ValidationItem,
} from '../core/types';

import {
  success,
  failure,
  QuoteStatus,
  ExchangeRateSource,
  MarkupType,
  DiscountType,
  GuestType,
  PricingMode,
  ValidationSeverity,
  InterResortTransferMarkupSource,
} from '../core/types';

import type {
  Quote,
  QuoteVersion,
  QuoteLeg,
  QuoteLegRoom,
  NightlyRoomRate,
  ExtraPersonChargeLineItem,
  QuoteLegLineItem,
  AppliedDiscount,
  InterResortTransfer,
  QuotePricingSummary,
  LegSummary,
  QuoteTotals,
  TaxesBreakdown,
  QuoteValidationResult,
  QuoteCalculationAudit,
  QuoteLevelMarkup,
} from '../core/entities';

import type { DataContext } from '../data/repositories/interfaces';

import {
  calculateQuote,
  createDataAccess,
  type QuoteCalculationInput,
  type LegCalculationInput,
  type QuoteCalculationResult,
  type LegCalculationResult,
  type DataStore,
} from '../core/calculation';

import { generateId } from '../core/utils';
import { canCalculate } from './state-machine';

// Logging imports (observability only)
import {
  getLogger,
  generateCorrelationId,
  startTimer,
  Operations,
} from '../core/logging';

// ============================================================
// CALCULATION SERVICE ERRORS
// ============================================================

export enum CalculationServiceError {
  QUOTE_NOT_FOUND = 'QUOTE_NOT_FOUND',
  QUOTE_NOT_EDITABLE = 'QUOTE_NOT_EDITABLE',
  CALCULATION_FAILED = 'CALCULATION_FAILED',
  VERSION_CREATION_FAILED = 'VERSION_CREATION_FAILED',
  DATA_LOAD_FAILED = 'DATA_LOAD_FAILED',
}

export class CalculationServiceException extends Error {
  constructor(
    public readonly code: CalculationServiceError,
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(`[${code}] ${message}`);
    this.name = 'CalculationServiceException';
  }
}

// ============================================================
// CALCULATION INPUT DTOs
// ============================================================

/**
 * Input for a leg calculation request.
 */
export interface LegInput {
  resort_id: EntityId;
  room_type_id: EntityId;
  check_in_date: string;
  check_out_date: string;
  adults_count: number;
  children: Child[];
  meal_plan_id?: EntityId;
  transfer_type_id?: EntityId;
  activity_ids?: EntityId[];
  discount_codes?: string[];
}

/**
 * Inter-resort transfer input.
 */
export interface InterResortTransferInputDTO {
  transfer_description: string;
  cost_amount: MoneyAmount;
  currency_code: CurrencyCode;
  notes?: string;
}

/**
 * Full calculation request.
 */
export interface CalculateQuoteRequest {
  quote_id: EntityId;
  legs: LegInput[];
  inter_resort_transfers?: InterResortTransferInputDTO[];
  quote_level_markup?: {
    markup_value: MoneyAmount;
    override_reason?: string;
  };
}

// ============================================================
// CALCULATION SERVICE
// ============================================================

export class CalculationService {
  constructor(
    private readonly dataContext: DataContext,
    private readonly referenceDataStore: DataStore
  ) {}

  /**
   * Calculate a quote and create a new version.
   * 
   * Flow:
   * 1. Load quote
   * 2. Validate quote is in editable state
   * 3. Build calculation input
   * 4. Invoke calculation engine
   * 5. Transform result to QuoteVersion
   * 6. Persist version
   * 7. Update quote.current_version_id
   * 8. Return new version
   */
  async calculate(
    request: CalculateQuoteRequest
  ): Promise<Result<QuoteVersion, CalculationServiceException>> {
    // LOGGING: Start operation tracking (observability only)
    const correlationId = generateCorrelationId();
    const timer = startTimer();
    const logger = getLogger().child({ correlation_id: correlationId, quote_id: request.quote_id });
    
    logger.info({
      correlation_id: correlationId,
      operation: Operations.CALCULATION_START,
      message: 'Starting quote calculation',
      quote_id: request.quote_id,
      context: { legs_count: request.legs.length },
    });

    // Step 1: Load quote
    const quote = await this.dataContext.quotes.findById(request.quote_id);
    if (!quote) {
      // LOGGING: Log failure (observability only - error still returned)
      logger.error({
        correlation_id: correlationId,
        operation: Operations.CALCULATION_START,
        message: 'Quote not found',
        quote_id: request.quote_id,
        error_code: CalculationServiceError.QUOTE_NOT_FOUND,
        duration_ms: timer.stop(),
      });
      return failure(new CalculationServiceException(
        CalculationServiceError.QUOTE_NOT_FOUND,
        `Quote not found: ${request.quote_id}`,
        { quote_id: request.quote_id }
      ));
    }

    // Step 2: Validate quote is editable
    if (!canCalculate(quote)) {
      // LOGGING: Log failure (observability only)
      logger.error({
        correlation_id: correlationId,
        operation: Operations.CALCULATION_START,
        message: 'Quote not editable',
        quote_id: quote.id,
        error_code: CalculationServiceError.QUOTE_NOT_EDITABLE,
        duration_ms: timer.stop(),
        context: { status: quote.status },
      });
      return failure(new CalculationServiceException(
        CalculationServiceError.QUOTE_NOT_EDITABLE,
        `Quote ${quote.id} is in status ${quote.status}; calculation only allowed in DRAFT`,
        { quote_id: quote.id, status: quote.status }
      ));
    }

    // Step 3: Build calculation input
    const calcInput = this.buildCalculationInput(quote, request);

    // Step 4: Invoke calculation engine
    const dataAccess = createDataAccess(this.referenceDataStore);
    const calcResult = calculateQuote(calcInput, dataAccess);

    if (!calcResult.success) {
      // LOGGING: Log failure (observability only)
      logger.error({
        correlation_id: correlationId,
        operation: Operations.CALCULATION_COMPLETE,
        message: 'Calculation engine failed',
        quote_id: quote.id,
        error_code: CalculationServiceError.CALCULATION_FAILED,
        duration_ms: timer.stop(),
        context: { warnings_count: calcResult.warnings.length },
      });
      return failure(new CalculationServiceException(
        CalculationServiceError.CALCULATION_FAILED,
        `Calculation failed: ${calcResult.warnings[0]?.message ?? 'Unknown error'}`,
        { quote_id: quote.id, warnings: calcResult.warnings }
      ));
    }

    // Step 5: Transform result to QuoteVersion
    const versionNumber = await this.dataContext.quoteVersions.getNextVersionNumber(quote.id);
    const versionId = generateId('QV') as EntityId;

    const version = this.transformToQuoteVersion(
      versionId,
      quote.id,
      versionNumber,
      calcResult,
      request
    );

    // Step 6: Persist version
    const createResult = await this.dataContext.quoteVersions.create(version);
    if (!createResult.success) {
      // LOGGING: Log failure (observability only)
      logger.error({
        correlation_id: correlationId,
        operation: Operations.VERSION_CREATE,
        message: 'Failed to persist version',
        quote_id: quote.id,
        version_id: versionId,
        error_code: CalculationServiceError.VERSION_CREATION_FAILED,
        duration_ms: timer.stop(),
      });
      return failure(new CalculationServiceException(
        CalculationServiceError.VERSION_CREATION_FAILED,
        `Failed to create version: ${createResult.error.message}`,
        { quote_id: quote.id, version_number: versionNumber }
      ));
    }

    // Step 7: Update quote.current_version_id
    await this.dataContext.quotes.update(quote.id, {
      current_version_id: versionId,
    } as any);

    // LOGGING: Log success (observability only)
    logger.info({
      correlation_id: correlationId,
      operation: Operations.CALCULATION_COMPLETE,
      message: 'Quote calculation completed successfully',
      quote_id: quote.id,
      version_id: versionId,
      duration_ms: timer.stop(),
      context: {
        version_number: versionNumber,
        total_sell: calcResult.totals?.total_sell,
      },
    });

    // Step 8: Return new version
    return success(createResult.value);
  }

  /**
   * Build calculation engine input from request.
   */
  private buildCalculationInput(
    quote: Quote,
    request: CalculateQuoteRequest
  ): QuoteCalculationInput {
    const legs: LegCalculationInput[] = request.legs.map(leg => ({
      resort_id: leg.resort_id,
      room_type_id: leg.room_type_id,
      check_in_date: leg.check_in_date as DateString,
      check_out_date: leg.check_out_date as DateString,
      adults_count: leg.adults_count,
      children: leg.children,
      meal_plan_id: leg.meal_plan_id,
      transfer_type_id: leg.transfer_type_id,
      activity_ids: leg.activity_ids,
      discount_codes: leg.discount_codes,
    }));

    return {
      client_name: quote.client_name,
      client_email: quote.client_email,
      currency_code: quote.currency_code,
      validity_days: quote.validity_days,
      legs,
      inter_resort_transfers: request.inter_resort_transfers?.map(irt => ({
        transfer_description: irt.transfer_description,
        cost_amount: irt.cost_amount,
        currency_code: irt.currency_code,
        notes: irt.notes,
      })),
      quote_level_markup: request.quote_level_markup,
    };
  }

  /**
   * Transform calculation result to QuoteVersion entity.
   * 
   * CRITICAL: Maps calculation engine output to canonical entity schemas.
   * - Legs created first to get IDs
   * - IRT leg indexes resolved to leg IDs
   * - All nested structures conform to Phase 5 entity definitions
   */
  private transformToQuoteVersion(
    versionId: EntityId,
    quoteId: EntityId,
    versionNumber: number,
    result: QuoteCalculationResult,
    request: CalculateQuoteRequest
  ): QuoteVersion {
    const now = new Date().toISOString() as DateTimeString;

    // ================================================================
    // STEP 1: Transform legs (creates leg IDs needed for IRT mapping)
    // ================================================================
    const legs: QuoteLeg[] = result.legs.map((legResult, index) => 
      this.transformLeg(versionId, index, legResult)
    );

    // ================================================================
    // STEP 2: Transform inter-resort transfers (resolves indexes to IDs)
    // ================================================================
    const interResortTransfers: InterResortTransfer[] = 
      result.inter_resort_transfers.map((irt, index) => 
        this.transformInterResortTransfer(versionId, irt, legs, result.currency_code)
      );

    // ================================================================
    // STEP 3: Build pricing summary (canonical structure)
    // ================================================================
    const pricingSummary = this.buildPricingSummary(
      legs,
      interResortTransfers,
      result
    );

    // ================================================================
    // STEP 4: Build validation result (canonical structure)
    // ================================================================
    const validationResult = this.buildValidationResult(
      versionId,
      result.warnings,
      now
    );

    // ================================================================
    // STEP 5: Build calculation audit (canonical structure)
    // ================================================================
    const calculationAudit = this.buildCalculationAudit(
      versionId,
      result.calculated_at,
      result.audit_steps,
      result.warnings
    );

    // ================================================================
    // STEP 6: Build quote-level markup
    // ================================================================
    const quoteLevelMarkup: QuoteLevelMarkup | null = result.quote_level_markup
      ? {
          markup_type: MarkupType.FIXED,
          markup_value: result.quote_level_markup.markup_value,
          currency_code: result.currency_code,
          override_reason: result.quote_level_markup.override_reason ?? undefined,
        }
      : null;

    // ================================================================
    // STEP 7: Assemble QuoteVersion
    // ================================================================
    const version: QuoteVersion = {
      id: versionId,
      quote_id: quoteId,
      version_number: versionNumber,
      currency_code: result.currency_code,
      exchange_rates_used: result.exchange_rates,
      exchange_rate_timestamp: result.exchange_rate_timestamp,
      exchange_rate_source: result.exchange_rate_source,
      legs,
      inter_resort_transfers: interResortTransfers,
      quote_level_markup: quoteLevelMarkup,
      pricing_summary: pricingSummary,
      validation_result: validationResult,
      calculation_audit: calculationAudit,
      created_at: now,
    };

    return version;
  }

  /**
   * Transform a single leg calculation result to QuoteLeg entity.
   */
  private transformLeg(
    versionId: EntityId,
    index: number,
    legResult: LegCalculationResult
  ): QuoteLeg {
    const legId = generateId('QL') as EntityId;

    // Build nightly breakdown
    const nightlyBreakdown: NightlyRoomRate[] = legResult.nightly_rates.map(nr => ({
      date: nr.date,
      season_id: nr.season_id,
      season_name: nr.season_name,
      rate_id: nr.rate_id,
      source_cost: nr.source_cost,
      source_currency: nr.source_currency,
      cost_amount: nr.cost_amount,
      markup_amount: 0 as MoneyAmount, // Markup applied at leg level
      sell_amount: nr.cost_amount,
    }));

    // Build extra person charges
    const extraPersonCharges: ExtraPersonChargeLineItem[] = 
      legResult.extra_person_charges.map(epc => ({
        guest_type: epc.guest_type === 'adult' ? GuestType.ADULT : GuestType.CHILD,
        age_band_id: epc.age_band_id ?? undefined,
        age_band_name: epc.age_band_name ?? undefined,
        child_age: epc.child_age ?? undefined,
        count: epc.count,
        nights: epc.nights,
        pricing_mode: PricingMode.PER_PERSON_PER_NIGHT,
        per_unit_cost: epc.per_unit_cost,
        cost_amount: epc.total_cost,
        markup_amount: 0 as MoneyAmount, // Markup applied at leg level
        sell_amount: epc.total_cost,
      }));

    // Build room
    const room: QuoteLegRoom = {
      room_type_id: legResult.room_type.id,
      room_type_name: legResult.room_type.name,
      nightly_breakdown: nightlyBreakdown,
      room_subtotal: {
        cost_amount: legResult.room_cost,
        markup_amount: 0 as MoneyAmount,
        sell_amount: legResult.room_cost,
      },
      extra_person_charges: extraPersonCharges,
    };

    // Build line items from components
    const lineItems: QuoteLegLineItem[] = [];

    // Add component line items (meals, transfers, activities)
    for (const comp of legResult.components) {
      lineItems.push({
        id: generateId('LI') as EntityId,
        line_item_type: comp.line_item_type,
        reference_id: comp.reference_id,
        description: comp.description,
        quantity_detail: comp.quantity_detail as QuantityDetail,
        cost_amount: comp.cost_amount,
        markup_amount: 0 as MoneyAmount,
        sell_amount: comp.cost_amount,
      });
    }

    // Add festive supplement line items
    for (const fest of legResult.festive_supplements) {
      lineItems.push({
        id: generateId('LI') as EntityId,
        line_item_type: fest.line_item_type,
        reference_id: fest.reference_id,
        description: fest.description,
        quantity_detail: fest.quantity_detail as QuantityDetail,
        cost_amount: fest.cost_amount,
        markup_amount: 0 as MoneyAmount,
        sell_amount: fest.cost_amount,
        is_mandatory: true,
      });
    }

    // Add tax line items
    for (const tax of legResult.taxes) {
      lineItems.push({
        id: generateId('LI') as EntityId,
        line_item_type: tax.tax_type,
        reference_id: tax.tax_config_id,
        description: tax.name,
        quantity_detail: tax.quantity_detail as QuantityDetail,
        cost_amount: tax.cost_amount,
        markup_amount: 0 as MoneyAmount, // Taxes never marked up
        sell_amount: tax.cost_amount,
      });
    }

    // Build applied discounts
    const discountsApplied: AppliedDiscount[] = legResult.discounts.map(d => ({
      discount_id: d.discount_id,
      discount_name: d.discount_name,
      discount_code: d.discount_code,
      discount_type: d.discount_type === 'PERCENTAGE' 
        ? DiscountType.PERCENTAGE 
        : DiscountType.FIXED,
      discount_value: d.discount_value,
      base_type: d.base_type,
      base_amount: d.base_amount,
      cost_reduction: d.discount_amount,
      markup_reduction: 0 as MoneyAmount,
      sell_reduction: d.discount_amount,
    }));

    // Strip age_band_name from resolved children to match Child interface
    const children: Child[] = legResult.resolved_children.map(c => ({
      age: c.age,
      age_band_id: c.age_band_id,
    }));

    return {
      id: legId,
      quote_version_id: versionId,
      sequence: index + 1,
      resort_id: legResult.resort.id,
      resort_name: legResult.resort.name,
      check_in_date: legResult.input.check_in_date,
      check_out_date: legResult.input.check_out_date,
      nights: legResult.nights,
      adults_count: legResult.input.adults_count,
      children,
      room,
      line_items: lineItems,
      discounts_applied: discountsApplied,
      leg_totals: legResult.totals,
    };
  }

  /**
   * Transform inter-resort transfer result to entity.
   * CRITICAL: Resolves leg indexes to leg IDs.
   */
  private transformInterResortTransfer(
    versionId: EntityId,
    irt: QuoteCalculationResult['inter_resort_transfers'][0],
    legs: QuoteLeg[],
    currencyCode: CurrencyCode
  ): InterResortTransfer {
    // Resolve leg indexes to leg IDs
    const fromLegId = legs[irt.from_leg_index]?.id;
    const toLegId = legs[irt.to_leg_index]?.id;

    if (!fromLegId || !toLegId) {
      throw new Error(
        `Invalid leg index in IRT: from=${irt.from_leg_index}, to=${irt.to_leg_index}, ` +
        `available legs=${legs.length}`
      );
    }

    // Calculate passenger count from destination leg
    const destinationLeg = legs[irt.to_leg_index];
    const passengerCount = destinationLeg.adults_count + destinationLeg.children.length;

    return {
      id: generateId('IRT') as EntityId,
      quote_version_id: versionId,
      from_leg_id: fromLegId,
      to_leg_id: toLegId,
      transfer_description: irt.transfer_description,
      passenger_count: passengerCount,
      cost_amount: irt.cost_amount,
      markup_amount: irt.markup_amount,
      sell_amount: irt.sell_amount,
      currency_code: currencyCode,
      markup_source: InterResortTransferMarkupSource.DESTINATION_RESORT,
      markup_config_id: irt.markup_config_id,
      notes: irt.notes ?? undefined,
    };
  }

  /**
   * Build QuotePricingSummary per canonical entity schema.
   */
  private buildPricingSummary(
    legs: QuoteLeg[],
    interResortTransfers: InterResortTransfer[],
    result: QuoteCalculationResult
  ): QuotePricingSummary {
    // Build leg summaries
    const legSummaries: LegSummary[] = legs.map((leg, index) => {
      const legResult = result.legs[index];
      return {
        leg_id: leg.id,
        resort_name: leg.resort_name,
        nights: leg.nights,
        pre_tax_cost: legResult.post_discount_subtotal,
        tax_cost: legResult.total_taxes,
        cost_amount: leg.leg_totals.cost_amount,
        markup_amount: leg.leg_totals.markup_amount,
        sell_amount: leg.leg_totals.sell_amount,
      };
    });

    // Build inter-resort transfer total
    const interResortTransferTotal: PricingBreakdown = {
      cost_amount: result.totals.irt_cost,
      markup_amount: result.totals.irt_markup,
      sell_amount: result.totals.irt_sell,
    };

    // Calculate line item markup total (sum of all leg markups)
    const lineItemMarkupTotal = result.quote_level_markup 
      ? 0 as MoneyAmount  // When quote-level markup used, line items show 0
      : result.totals.legs_markup + result.totals.irt_markup as MoneyAmount;

    // Calculate markup percentage: (markup / cost) × 100
    const totalCost = result.totals.total_cost as number;
    const totalMarkup = result.totals.total_markup as number;
    const markupPercentage = totalCost > 0 
      ? ((totalMarkup / totalCost) * 100) as Percentage
      : 0 as Percentage;

    // Build quote totals
    const quoteTotals: QuoteTotals = {
      total_cost: result.totals.total_cost,
      line_item_markup_total: lineItemMarkupTotal,
      quote_level_fixed_markup: result.totals.quote_level_markup,
      total_markup: result.totals.total_markup,
      total_sell: result.totals.total_sell,
      markup_percentage: markupPercentage,
      margin_percentage: result.totals.margin_percentage,
    };

    // Build taxes breakdown
    const taxesBreakdown: TaxesBreakdown = {
      green_tax_total: result.taxes_breakdown.green_tax,
      service_charge_total: result.taxes_breakdown.service_charge,
      gst_total: result.taxes_breakdown.gst,
      vat_total: result.taxes_breakdown.vat > 0 
        ? result.taxes_breakdown.vat 
        : undefined,
      total_taxes: result.totals.total_taxes,
    };

    return {
      leg_summaries: legSummaries,
      inter_resort_transfer_total: interResortTransferTotal,
      quote_totals: quoteTotals,
      taxes_breakdown: taxesBreakdown,
    };
  }

  /**
   * Build QuoteValidationResult per canonical entity schema.
   */
  private buildValidationResult(
    versionId: EntityId,
    warnings: readonly ValidationItem[],
    validatedAt: DateTimeString
  ): QuoteValidationResult {
    const blockingErrors = warnings.filter(w => w.severity === ValidationSeverity.BLOCKING);
    const warningItems = warnings.filter(w => w.severity === ValidationSeverity.WARNING);

    return {
      quote_version_id: versionId,
      is_valid: blockingErrors.length === 0,
      can_proceed: blockingErrors.length === 0,
      blocking_errors: blockingErrors,
      warnings: warningItems,
      validated_at: validatedAt,
    };
  }

  /**
   * Build QuoteCalculationAudit per canonical entity schema.
   */
  private buildCalculationAudit(
    versionId: EntityId,
    calculatedAt: DateTimeString,
    steps: readonly AuditStep[],
    warnings: readonly ValidationItem[]
  ): QuoteCalculationAudit {
    // Convert ValidationItem[] to AuditWarning[]
    const auditWarnings: AuditWarning[] = warnings.map(w => ({
      code: w.code,
      severity: w.severity,
      message: w.message,
    }));

    return {
      quote_version_id: versionId,
      calculated_at: calculatedAt,
      calculation_steps: steps,
      warnings: auditWarnings,
    };
  }
}

/**
 * Factory function to create CalculationService.
 */
export function createCalculationService(
  dataContext: DataContext,
  referenceDataStore: DataStore
): CalculationService {
  return new CalculationService(dataContext, referenceDataStore);
}
