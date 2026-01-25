/**
 * Calculation Engines - Barrel Export
 */

export {
  checkDiscountEligibility,
  resolveDiscountStacking,
  calculateDiscountBase,
  applyDiscount,
  calculateDiscounts,
  type EligibilityResult,
  type CostBreakdown,
} from './discount-engine';

export {
  countGreenTaxEligibleGuests,
  calculateTaxes,
  validateTaxConfigurations,
  type TaxCalculationInput,
  type TaxBreakdown,
} from './tax-engine';

export {
  shouldExcludeFromMarkup,
  calculateMarkupAmount,
  calculateLineItemMarkup,
  calculateLegMarkup,
  applyQuoteLevelMarkup,
  calculateInterResortTransferMarkup,
  // NOTE: calculateMarginPercentage and calculateMarkupPercentage 
  // are canonical in utils/arithmetic.ts - not re-exported here to avoid collision
  type LineItemMarkupResult,
  type LegCostsForMarkup,
  type QuoteLevelMarkupInput,
} from './markup-engine';
