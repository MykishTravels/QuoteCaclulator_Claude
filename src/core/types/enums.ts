/**
 * Enumeration Types
 * 
 * All enumerated values for the Multi-Resort Travel Quote Engine.
 * These are closed sets - extension requires a new phase approval.
 * 
 * Reference: Phase 5 - Section A.1 Enums
 */

// ============================================================
// PRICING ENUMS
// ============================================================

/**
 * Pricing mode for components (meals, transfers, activities, etc.)
 */
export enum PricingMode {
  PER_PERSON_PER_NIGHT = 'PER_PERSON_PER_NIGHT',
  PER_ROOM_PER_NIGHT = 'PER_ROOM_PER_NIGHT',
  PER_STAY = 'PER_STAY',
  PER_PERSON = 'PER_PERSON',
  PER_BOOKING = 'PER_BOOKING',
  PER_TRIP = 'PER_TRIP',
}

/**
 * Transfer direction indicator
 */
export enum TransferDirection {
  ARRIVAL = 'ARRIVAL',
  DEPARTURE = 'DEPARTURE',
  BOTH = 'BOTH',
}

// ============================================================
// TAX ENUMS
// ============================================================

/**
 * Tax types supported by the system.
 * Reference: Phase 4 - Tax calculation order (Green Tax → Service Charge → GST)
 */
export enum TaxType {
  GREEN_TAX = 'GREEN_TAX',
  SERVICE_CHARGE = 'SERVICE_CHARGE',
  GST = 'GST',
  VAT = 'VAT',
  OTHER = 'OTHER',
}

/**
 * Tax calculation method.
 * Reference: Phase 5 - TaxConfiguration schema
 */
export enum TaxCalculationMethod {
  FIXED_PER_PERSON_PER_NIGHT = 'FIXED_PER_PERSON_PER_NIGHT',
  PERCENTAGE = 'PERCENTAGE',
}

/**
 * Tax base indicator (informational only per A-019).
 * Runtime calculation always receives explicit base_amount as input.
 */
export enum TaxAppliesTo {
  ACCOMMODATION_ONLY = 'ACCOMMODATION_ONLY',
  SUBTOTAL_BEFORE_TAX = 'SUBTOTAL_BEFORE_TAX',
  CUMULATIVE = 'CUMULATIVE',
}

// ============================================================
// DISCOUNT ENUMS
// ============================================================

/**
 * Discount calculation type.
 */
export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

/**
 * Discount base type - what the discount applies to.
 * Reference: Phase 4 Locked Refinement #2 - base_type explicitly captured
 * Constraint: Discounts NEVER apply to taxes (hard constraint)
 */
export enum DiscountBaseType {
  /** Applies to room rate line items only */
  ROOM_ONLY = 'ROOM_ONLY',
  /** Applies to all non-tax line items */
  PRE_TAX_TOTAL = 'PRE_TAX_TOTAL',
}

/**
 * Discount application timing.
 * Note: AFTER_TAX not supported - discounts never apply to taxes.
 */
export enum DiscountApplicationOrder {
  BEFORE_TAX = 'BEFORE_TAX',
}

// ============================================================
// MARKUP ENUMS
// ============================================================

/**
 * Markup calculation type.
 * Reference: Phase 4 Locked Refinement #5 - FIXED only at quote level in v1
 */
export enum MarkupType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

/**
 * Markup configuration scope.
 */
export enum MarkupScope {
  RESORT = 'RESORT',
  QUOTE = 'QUOTE',
}

// ============================================================
// QUOTE LIFECYCLE ENUMS
// ============================================================

/**
 * Quote status lifecycle states.
 * Reference: BRD v1.2 Section 3.3.1 - Quote Status Definitions
 */
export enum QuoteStatus {
  /** Quote is being edited; not yet sent to client */
  DRAFT = 'DRAFT',
  /** Quote has been emailed to client; awaiting response */
  SENT = 'SENT',
  /** Quote validity period has elapsed */
  EXPIRED = 'EXPIRED',
  /** Client has confirmed booking (terminal state) */
  CONVERTED = 'CONVERTED',
  /** Client has declined the quote */
  REJECTED = 'REJECTED',
}

/**
 * Line item types for pricing breakdown.
 * These map to distinct calculation paths in the engine.
 */
export enum LineItemType {
  ROOM = 'ROOM',
  EXTRA_PERSON = 'EXTRA_PERSON',
  MEAL_PLAN = 'MEAL_PLAN',
  TRANSFER = 'TRANSFER',
  ACTIVITY = 'ACTIVITY',
  FESTIVE_SUPPLEMENT = 'FESTIVE_SUPPLEMENT',
  GREEN_TAX = 'GREEN_TAX',
  SERVICE_CHARGE = 'SERVICE_CHARGE',
  GST = 'GST',
  VAT = 'VAT',
}

/**
 * Check if a line item type is a tax.
 * Reference: Phase 4 - Taxes never marked up when applies_to_taxes = false
 */
export function isTaxLineItem(type: LineItemType): boolean {
  return (
    type === LineItemType.GREEN_TAX ||
    type === LineItemType.SERVICE_CHARGE ||
    type === LineItemType.GST ||
    type === LineItemType.VAT
  );
}

/**
 * Check if a line item is a government pass-through tax.
 * Reference: A-008 - Government pass-through taxes never marked up
 */
export function isGovernmentPassThroughTax(type: LineItemType): boolean {
  return type === LineItemType.GREEN_TAX;
}

// ============================================================
// VALIDATION ENUMS
// ============================================================

/**
 * Validation severity levels.
 * Reference: Phase 3 - BLOCKING vs WARNING
 */
export enum ValidationSeverity {
  /** Prevents quote from being sent */
  BLOCKING = 'BLOCKING',
  /** Informational; does not block */
  WARNING = 'WARNING',
}

// ============================================================
// EXCHANGE RATE ENUMS
// ============================================================

/**
 * Exchange rate source indicator.
 * Reference: Phase 5 - exchange_rate_source field
 */
export enum ExchangeRateSource {
  /** Same currency, rate = 1.0 */
  SYSTEM_DEFAULT = 'SYSTEM_DEFAULT',
  /** Consultant entered rate manually */
  MANUAL_ENTRY = 'MANUAL_ENTRY',
  /** Retrieved from external API (future) */
  API_FEED = 'API_FEED',
}

// ============================================================
// AUDIT ENUMS
// ============================================================

/**
 * Audit step types for calculation traceability.
 * Reference: Phase 4 Section J - Audit Trail Structure
 */
export enum AuditStepType {
  RATE_LOOKUP = 'RATE_LOOKUP',
  EXTRA_PERSON = 'EXTRA_PERSON',
  MEAL_PLAN = 'MEAL_PLAN',
  TRANSFER = 'TRANSFER',
  ACTIVITY = 'ACTIVITY',
  FESTIVE_SUPPLEMENT = 'FESTIVE_SUPPLEMENT',
  PRE_TAX_SUBTOTAL = 'PRE_TAX_SUBTOTAL',
  DISCOUNT = 'DISCOUNT',
  DISCOUNT_REMOVED = 'DISCOUNT_REMOVED',
  DISCOUNT_STACKING_RESOLVED = 'DISCOUNT_STACKING_RESOLVED',
  TAX_CALCULATION = 'TAX_CALCULATION',
  MARKUP = 'MARKUP',
  LEG_TOTAL = 'LEG_TOTAL',
  INTER_RESORT_TRANSFER = 'INTER_RESORT_TRANSFER',
  QUOTE_LEVEL_MARKUP = 'QUOTE_LEVEL_MARKUP',
  QUOTE_AGGREGATION = 'QUOTE_AGGREGATION',
}

// ============================================================
// PDF ENUMS
// ============================================================

/**
 * PDF display mode.
 * Reference: BRD v1.2 FR-041a
 */
export enum PDFDisplayMode {
  /** Full per-leg breakdown with all line items */
  DETAILED = 'DETAILED',
  /** Per-leg totals and quote totals only */
  SIMPLIFIED = 'SIMPLIFIED',
}

// ============================================================
// EMAIL ENUMS
// ============================================================

/**
 * Email send status.
 */
export enum EmailStatus {
  SENT = 'SENT',
  FAILED = 'FAILED',
}

// ============================================================
// INTER-RESORT TRANSFER ENUMS
// ============================================================

/**
 * Markup source for inter-resort transfers.
 * Reference: Phase 4 Locked Refinement #4 - Destination resort in v1
 */
export enum InterResortTransferMarkupSource {
  DESTINATION_RESORT = 'DESTINATION_RESORT',
}

// ============================================================
// GUEST TYPE ENUM
// ============================================================

/**
 * Guest type for pricing calculations.
 */
export enum GuestType {
  ADULT = 'adult',
  CHILD = 'child',
}
