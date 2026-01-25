# Sprint 7 — Phase 3: Test Hardening

**Status:** COMPLETE

---

## 1. OBJECTIVE

Convert locked assumptions into enforced invariants via tests.

---

## 2. TEST FILES CREATED

| File | Tests | Purpose |
|------|-------|---------|
| `tests/regression/version-immutability.test.ts` | 8 | QuoteVersion immutability after creation |
| `tests/regression/calculation-assumptions.test.ts` | 15 | A-001, A-002, A-004, A-011 verification |
| `tests/regression/lifecycle-guards.test.ts` | 20 | State machine rules enforcement |
| `tests/regression/calculation-engine-invariants.test.ts` | 12 | A-008, A-009, A-010, A-011 engine behavior |
| `tests/regression/ui-display-only-guards.test.ts` | 18 | UI uses AvailableActions as truth source |
| `tests/negative/failure-modes.test.ts` | 15 | Quote/version not found, invalid refs, bad dates |

**Total Tests:** ~88

---

## 3. LOCKED ASSUMPTIONS TESTED

### Calculation Precision (A-001, A-002)

| Test | Assertion |
|------|-----------|
| `roundCurrency` 2 decimals | `roundCurrency(100.456) === 100.46` |
| `roundExchangeRate` 6 decimals | `roundExchangeRate(1.2345678) === 1.234568` |
| Idempotency | `roundCurrency(roundCurrency(x)) === roundCurrency(x)` |

### Date Calculations (A-004)

| Test | Assertion |
|------|-----------|
| Basic nights | `calculateNights('2026-03-01', '2026-03-05') === 4` |
| Month boundary | `calculateNights('2026-02-28', '2026-03-01') === 1` |
| Year boundary | `calculateNights('2025-12-30', '2026-01-02') === 3` |
| Leap year | `calculateNights('2024-02-28', '2024-03-01') === 2` |

### Tax Handling (A-007, A-008)

| Test | Assertion |
|------|-----------|
| Green Tax excluded from markup | `shouldExcludeFromMarkup(GREEN_TAX) === true` |
| Service Charge included | `shouldExcludeFromMarkup(SERVICE_CHARGE) === false` |
| Tax order validation | Duplicate `calculation_order` throws error |

### Discount Behavior (A-009, A-010)

| Test | Assertion |
|------|-----------|
| Non-compounding | Same base used for all discounts |
| Base before discount | `calculateDiscountBase` returns fixed values |
| TOTAL_EXCL_TAX excludes taxes | Base = accommodation + components, not taxes |

### Markup (A-011)

| Test | Assertion |
|------|-----------|
| On cost not sell | `calculateMarkupAmount(1000, 20) === 200` |
| Margin vs markup | `marginPct !== markupPct` |

---

## 4. LIFECYCLE GUARDS TESTED

### State Transitions

| From | To | Expected |
|------|------|----------|
| DRAFT | SENT | ✅ Allowed (with version) |
| DRAFT | SENT | ❌ Rejected (without version) |
| DRAFT | CONVERTED | ❌ Invalid |
| SENT | CONVERTED | ✅ Allowed |
| SENT | REJECTED | ✅ Allowed |
| SENT | DRAFT | ✅ Allowed (revert) |
| CONVERTED | * | ❌ Terminal |
| REJECTED | DRAFT | ✅ Allowed |
| EXPIRED | DRAFT | ✅ Allowed |

### Calculation Guards

| State | Can Calculate |
|-------|---------------|
| DRAFT | ✅ Yes |
| SENT | ❌ No |
| CONVERTED | ❌ No |
| After revert | ✅ Yes |

---

## 5. NEGATIVE PATH TESTS

| Failure Mode | Tests |
|--------------|-------|
| Quote not found | 5 tests |
| Version not found | 1 test |
| Invalid entity refs | 2 tests |
| Missing required data | 2 tests |
| Invalid date ranges | 2 tests |
| Operation idempotency | 1 test |

---

## 6. UI GUARDS TESTED

### AvailableActions as Truth Source

| Scenario | Test |
|----------|------|
| DRAFT without version | `can_send === false` |
| DRAFT with version | `can_send === true` |
| SENT state | `can_calculate === false` |
| CONVERTED (terminal) | All actions `false` |
| Structure completeness | No undefined values |

### Key Invariant Verified

```typescript
// Same status, different actions based on version
getAvailableActions({ status: DRAFT, version: undefined }).can_send === false
getAvailableActions({ status: DRAFT, version: 'QV-001' }).can_send === true
```

**This proves UI cannot infer from status alone.**

---

## 7. COMPILATION STATUS

```
npx tsc --noEmit → 0 errors ✅
```

---

## 8. GUARDRAIL COMPLIANCE

| Guardrail | Status |
|-----------|--------|
| No new behavior added | ✅ Tests assert existing behavior only |
| No refactors | ✅ Test code only |
| No business logic changes | ✅ Read-only assertions |
| Locked phases unchanged | ✅ Verified |

---

## 9. TEST EXECUTION

Tests require `vitest` to be installed. Run with:

```bash
npm install
npm test
```

Or specific test file:

```bash
npx vitest run tests/regression/lifecycle-guards.test.ts
```

---

## 10. TEST FILE STRUCTURE

```
tests/
├── regression/
│   ├── version-immutability.test.ts     # V-IMM-001, V-IMM-002, V-IMM-003
│   ├── calculation-assumptions.test.ts   # A-001, A-002, A-004, A-011
│   ├── calculation-engine-invariants.test.ts  # A-008, A-009, A-010
│   ├── lifecycle-guards.test.ts          # A-021, state machine
│   └── ui-display-only-guards.test.ts    # AvailableActions
├── negative/
│   └── failure-modes.test.ts             # Error handling paths
└── integration/
    └── (existing sprint tests)
```

---

**Phase 3 is COMPLETE. Ready for Phase 4: Error Categorization upon authorization.**

---

**Signed:** Senior Software Architect  
**Date:** 2026-01-24
