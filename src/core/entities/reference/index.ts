/**
 * Reference Data Entities - Barrel Export
 * 
 * All 17 reference data entities per Phase 5.
 */

// Core entities
export {
  type Currency,
  type Resort,
  type ChildAgeBand,
  validateChildAgeBandCoverage,
  findAgeBandForAge,
} from './core';

// Accommodation entities
export {
  type RoomType,
  validateRoomTypeOccupancy,
  type Season,
  isDateInSeason,
  validateSeasonNonOverlap,
  type Rate,
  findApplicableRate,
} from './accommodation';

// Pricing component entities
export {
  type ExtraPersonCharge,
  findExtraPersonCharge,
  type MealPlan,
  getMealPlanChildCost,
  type TransferType,
  getTransferChildCost,
  validateTransferPricing,
  type Activity,
  isActivityAvailableOnDate,
  getActivityChildCost,
} from './components';

// Financial configuration entities
export {
  type TaxConfiguration,
  validateTaxConfiguration,
  type Discount,
  validateDiscountConfiguration,
  type MarkupConfiguration,
  validateMarkupConfiguration,
  shouldApplyMarkup,
} from './financial';

// Operational rule entities
export {
  type FestiveSupplement,
  findFestiveSupplementTrigger,
  getFestiveSupplementChildCost,
  type BlackoutDate,
  isDateBlackedOut,
  findOverlappingBlackouts,
  type MinimumStayRule,
  getMinimumStayRulePriority,
  findApplicableMinimumStay,
  type HoneymoonPerk,
} from './rules';
