# Sprint 2: Calculation Engine — Verification & Freeze

**Document Type:** Architecture Acceptance  
**Sprint:** 2 — Calculation Engine  
**Date:** 2026-01-20  
**Status:** VERIFICATION COMPLETE

---

## 1. ACCEPTANCE CHECKLIST

### 1.1 Core Calculation Functions

| ID | Requirement | File | Function | Status |
|----|-------------|------|----------|--------|
| C-01 | Nightly rate lookup per room/date | `components/rate-lookup.ts` | `calculateNightlyRates()` | ✅ PASS |
| C-02 | Season resolution for date | `components/rate-lookup.ts` | `lookupRate()` | ✅ PASS |
| C-03 | Currency conversion | `components/rate-lookup.ts` | `convertRateToQuoteCurrency()` | ✅ PASS |
| C-04 | Extra person charge calculation | `components/extra-person.ts` | `calculateExtraPersonCharges()` | ✅ PASS |
| C-05 | Occupancy validation | `components/extra-person.ts` | `validateOccupancy()` | ✅ PASS |
| C-06 | Meal plan calculation | `components/components.ts` | `calculateMealPlan()` | ✅ PASS |
| C-07 | Transfer calculation | `components/components.ts` | `calculateTransfer()` | ✅ PASS |
| C-08 | Activity calculation | `components/components.ts` | `calculateActivity()` | ✅ PASS |
| C-09 | Festive supplement calculation | `components/components.ts` | `calculateFestiveSupplement()` | ✅ PASS |
| C-10 | Tax calculation with ordering | `engines/tax-engine.ts` | `calculateTaxes()` | ✅ PASS |
| C-11 | Discount eligibility checking | `engines/discount-engine.ts` | `checkDiscountEligibility()` | ✅ PASS |
| C-12 | Discount stacking resolution | `engines/discount-engine.ts` | `resolveDiscountStacking()` | ✅ PASS |
| C-13 | Discount application | `engines/discount-engine.ts` | `calculateDiscounts()` | ✅ PASS |
| C-14 | Line item markup | `engines/markup-engine.ts` | `calculateLineItemMarkup()` | ✅ PASS |
| C-15 | Quote-level fixed markup | `engines/markup-engine.ts` | `applyQuoteLevelMarkup()` | ✅ PASS |
| C-16 | IRT markup (destination) | `engines/markup-engine.ts` | `calculateInterResortTransferMarkup()` | ✅ PASS |
| C-17 | Leg orchestration | `leg-calculator.ts` | `calculateLeg()` | ✅ PASS |
| C-18 | Quote orchestration | `quote-calculator.ts` | `calculateQuote()` | ✅ PASS |
| C-19 | Audit trail generation | `types.ts` | `CalculationAuditBuilder` | ✅ PASS |
| C-20 | Error handling with codes | `types.ts` | `CalculationError` | ✅ PASS |

### 1.2 Data Access

| ID | Requirement | File | Implementation | Status |
|----|-------------|------|----------------|--------|
| D-01 | Data access interface | `types.ts` | `CalculationDataAccess` | ✅ PASS |
| D-02 | In-memory adapter | `data-adapter.ts` | `createDataAccess()` | ✅ PASS |
| D-03 | Tax config ordering | `data-adapter.ts` | `.sort((a, b) => a.calculation_order - b.calculation_order)` | ✅ PASS |

### 1.3 Type Contracts

| ID | Requirement | File | Type | Status |
|----|-------------|------|------|--------|
| T-01 | Calculation input | `types.ts` | `QuoteCalculationInput` | ✅ PASS |
| T-02 | Calculation output | `types.ts` | `QuoteCalculationResult` | ✅ PASS |
| T-03 | Leg input | `types.ts` | `LegCalculationInput` | ✅ PASS |
| T-04 | Leg output | `types.ts` | `LegCalculationResult` | ✅ PASS |
| T-05 | Guest counts | `types.ts` | `GuestCounts` | ✅ PASS |
| T-06 | Cost breakdown | `engines/discount-engine.ts` | `CostBreakdown` | ✅ PASS |
| T-07 | Tax input | `engines/tax-engine.ts` | `TaxCalculationInput` | ✅ PASS |

---

## 2. RULE-TO-CODE TRACEABILITY

### 2.1 Phase 4 Locked Refinements

| Lock ID | Rule | File | Line(s) | Implementation |
|---------|------|------|---------|----------------|
| **#1** | Single rounding point (`roundCurrency`) | `leg-calculator.ts` | 388-434 | `roundCurrency()` called ONLY on final result assignment |
| **#1** | Single rounding point | `quote-calculator.ts` | 345-367 | `roundCurrency()` on aggregated totals only |
| **#2** | Discount `base_type` determines base | `engines/discount-engine.ts` | 288-326 | `calculateDiscountBase(baseType, costs)` switch on `DiscountBaseType` |
| **#2** | Taxes excluded from discount base | `engines/discount-engine.ts` | 68-73 | `TAX_ITEMS` constant excludes GREEN_TAX, SERVICE_CHARGE, GST, VAT |
| **#3** | Explicit tax base (no inference) | `engines/tax-engine.ts` | 68-70 | `calculatePercentageTax(config, explicitBaseAmount)` |
| **#3** | Tax base passed as parameter | `engines/tax-engine.ts` | 139 | `TaxCalculationInput.post_discount_subtotal` |
| **#4** | IRT uses destination markup | `engines/markup-engine.ts` | 305-319 | `calculateInterResortTransferMarkup(costAmount, destinationResortId, ...)` |
| **#4** | IRT destination enforced | `quote-calculator.ts` | 139-144 | `destinationResortId = legResults[toLegIndex].resortId` |
| **#5** | Quote-level FIXED only | `types.ts` | 413-414 | `markup_type: 'FIXED'` (literal, not union) |
| **#5** | Quote-level input has no type | `types.ts` | 133-136 | `quote_level_markup?: { markup_value: MoneyAmount }` |

### 2.2 Assumptions (BRD Appendix A)

| ID | Assumption | File | Line(s) | Implementation |
|----|------------|------|---------|----------------|
| A-001 | 2 decimal precision | `utils/currency.ts` | `roundCurrency()` | `Math.round(amount * 100) / 100` |
| A-002 | 6 decimal exchange rates | `utils/currency.ts` | `roundExchangeRate()` | `Math.round(rate * 1000000) / 1000000` |
| A-003 | ISO 8601 dates | `types/primitives.ts` | `DateString` | Branded type `YYYY-MM-DD` |
| A-004 | Nights = checkout - checkin | `utils/dates.ts` | `calculateNights()` | `daysBetween(checkIn, checkOut)` |
| A-005 | One season per night | `components/rate-lookup.ts` | 48-55 | `ctx.data.getSeasonForDate()` returns single `Season \| null` |
| A-007 | Tax order per destination | `data-adapter.ts` | 113 | `.sort((a, b) => a.calculation_order - b.calculation_order)` |
| A-008 | Green Tax never marked up | `engines/markup-engine.ts` | 49-50 | `if (lineItemType === LineItemType.GREEN_TAX) { return true; }` |
| A-009 | Non-compounding discounts | `engines/discount-engine.ts` | 471 | Comment: `// Original base, not reduced by previous discounts` |
| A-010 | Discount base before any discount | `engines/discount-engine.ts` | 459 | Comment: `// Base amount is calculated BEFORE any discount is applied` |
| A-011 | Markup on cost, not sell | `engines/markup-engine.ts` | 79-81 | `costAmount * (config.markup_value / 100)` |
| A-014 | Child max age 11 | `entities/reference/accommodation.ts` | `ChildAgeBand.max_age` | Validated via schema |
| A-019 | Explicit tax base_amount | `engines/tax-engine.ts` | 7 | Comment: `Tax functions receive EXPLICIT base_amount as input` |

### 2.3 Phase 6 Error Handling

| Code | Rule | File | Implementation |
|------|------|------|----------------|
| HR-4 | Over-discount → cap + WARNING | `engines/discount-engine.ts:349-365` | `if (discountAmount > baseAmount) { warnings.push(...); discountAmount = baseAmount; }` |
| MR-5 | Ineligible discount → auto-remove + WARNING | `engines/discount-engine.ts:432-448` | `audit.addStep(DISCOUNT_REMOVED, ...)` |

---

## 3. FROZEN PUBLIC CONTRACT

### 3.1 Primary Entry Point (FROZEN)

```typescript
// File: quote-calculator.ts
export function calculateQuote(
  input: QuoteCalculationInput,
  dataAccess: CalculationDataAccess
): QuoteCalculationResult;
```

**Stability:** This signature MUST NOT change. All consumers depend on it.

### 3.2 Frozen Input Types

| Type | File | Stability |
|------|------|-----------|
| `QuoteCalculationInput` | `types.ts:110-143` | FROZEN |
| `LegCalculationInput` | `types.ts:58-88` | FROZEN |
| `InterResortTransferInput` | `types.ts:93-105` | FROZEN |

### 3.3 Frozen Output Types

| Type | File | Stability |
|------|------|-----------|
| `QuoteCalculationResult` | `types.ts:391-448` | FROZEN |
| `LegCalculationResult` | `types.ts:295-367` | FROZEN |
| `InterResortTransferResult` | `types.ts:376-386` | FROZEN |

### 3.4 Frozen Data Access Interface

```typescript
// File: types.ts:176-201
export interface CalculationDataAccess {
  getResort(id: EntityId): Resort | null;
  getRoomType(id: EntityId): RoomType | null;
  getChildAgeBands(resortId: EntityId): readonly ChildAgeBand[];
  getSeasonForDate(resortId: EntityId, date: DateString): Season | null;
  getRate(resortId: EntityId, roomTypeId: EntityId, seasonId: EntityId, date: DateString): Rate | null;
  getExtraPersonCharges(resortId: EntityId, roomTypeId: EntityId): readonly ExtraPersonCharge[];
  getMealPlan(id: EntityId): MealPlan | null;
  getDefaultMealPlan(resortId: EntityId): MealPlan | null;
  getTransferType(id: EntityId): TransferType | null;
  getDefaultTransferType(resortId: EntityId): TransferType | null;
  getActivity(id: EntityId): Activity | null;
  getTaxConfigurations(resortId: EntityId, date: DateString): readonly TaxConfiguration[];
  getFestiveSupplements(resortId: EntityId, checkIn: DateString, checkOut: DateString): readonly FestiveSupplement[];
  getDiscountByCode(resortId: EntityId, code: string): Discount | null;
  getMarkupConfiguration(resortId: EntityId): MarkupConfiguration | null;
}
```

**Stability:** Interface FROZEN. Implementations may vary (JSON, SQL, etc.).

### 3.5 Barrel Export (FROZEN)

```typescript
// File: index.ts - Public API surface
export { calculateQuote } from './quote-calculator';
export { calculateLeg } from './leg-calculator';
export { createDataAccess, loadDataStore, type DataStore } from './data-adapter';
export type { QuoteCalculationInput, QuoteCalculationResult, ... } from './types';
```

---

## 4. COUPLING RISK ANALYSIS

### 4.1 Identified Risks

| Risk ID | Severity | Description | Location | Mitigation |
|---------|----------|-------------|----------|------------|
| CR-01 | **LOW** | Orphaned `context.ts` with alternative `CalculationContext` definition | `context.ts` | DELETE before Sprint 3 or document as future alternative |
| CR-02 | **LOW** | Redundant import alias in leg-calculator | `leg-calculator.ts:44` | Cosmetic; no functional impact |
| CR-03 | **NONE** | Clean dependency direction: calculation → {types, entities, utils} | All files | No action needed |

### 4.2 Dependency Graph (Verified)

```
quote-calculator.ts
  └─> leg-calculator.ts
        └─> components/*.ts
        └─> engines/*.ts
  └─> engines/markup-engine.ts
  └─> types.ts
  └─> ../utils (roundCurrency, today)

data-adapter.ts
  └─> ../entities (isDateInSeason)
  └─> ../utils (isWithinRange)
  └─> types.ts (CalculationDataAccess)
```

**Assessment:** No circular dependencies. No upward coupling to service/API layers.

### 4.3 Sprint 3 Interface Points

| Interface | Consumer | Contract |
|-----------|----------|----------|
| `calculateQuote()` | Quote Service | Input/Output types frozen |
| `CalculationDataAccess` | Repository layer | Must implement this interface |
| `QuoteCalculationResult` | Quote entity persistence | Maps to `QuoteVersion.calculation_result` |

---

## 5. DEAD CODE REPORT

| File | Status | Action Required |
|------|--------|-----------------|
| `context.ts` | ORPHANED | DELETE or integrate before Sprint 3 |

---

## 6. VERIFICATION SUMMARY

| Category | Items | Passed | Failed |
|----------|-------|--------|--------|
| Core Functions | 20 | 20 | 0 |
| Data Access | 3 | 3 | 0 |
| Type Contracts | 7 | 7 | 0 |
| Phase 4 Locks | 5 | 5 | 0 |
| Assumptions | 12 | 12 | 0 |
| Error Handling | 2 | 2 | 0 |
| **TOTAL** | **49** | **49** | **0** |

---

## 7. DECLARATION

### Pre-Sprint 3 Checklist

- [x] All Phase 4 locked refinements implemented and verified
- [x] All relevant BRD assumptions enforced in code
- [x] Public contract defined and frozen
- [x] No circular dependencies
- [x] No blocking coupling risks
- [ ] Dead code (`context.ts`) requires cleanup

### Decision

**SAFE TO PROCEED TO SPRINT 3**

Conditional on:
1. Delete or explicitly deprecate `/src/core/calculation/context.ts` before beginning Sprint 3
2. Do not modify frozen interfaces without formal change request
3. Sprint 3 must implement `CalculationDataAccess` via repository layer, not create alternative data access patterns

---

**Signed:** Architecture Review  
**Date:** 2026-01-20
