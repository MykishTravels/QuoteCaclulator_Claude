# Phase 4: Error Inventory

## Error Categories

| Category | Description | User Action | System Action |
|----------|-------------|-------------|---------------|
| **TRANSIENT** | Temporary failure, may succeed on retry | Wait and retry | Auto-retry allowed |
| **VALIDATION** | Input validation failed | Correct input | Fail fast, no retry |
| **NOT_FOUND** | Resource does not exist | Verify ID/selection | Fail fast, no retry |
| **CONFIG** | Configuration missing or invalid | Contact admin | Fail fast, no retry |
| **INVARIANT** | System invariant violated | Contact support | Fail fast, log critical |
| **EXTERNAL** | External service failure | Check service status | May retry with backoff |

---

## 1. CALCULATION ENGINE ERRORS

| Code | Category | Retryable | Where Thrown | Resolution |
|------|----------|-----------|--------------|------------|
| `CALC_INIT_FAILED` | TRANSIENT | ✅ Yes | `quote-calculator.ts` | Retry with fresh context |
| `CALC_FX_LOCK_FAILED` | TRANSIENT | ✅ Yes | `quote-calculator.ts` | Retry or manual FX entry |
| `CALC_RATE_NOT_FOUND` | CONFIG | ❌ No | `rate-lookup.ts` | Admin must configure rates |
| `CALC_SEASON_NOT_FOUND` | CONFIG | ❌ No | `rate-lookup.ts` | Admin must configure seasons |
| `CALC_CURRENCY_CONVERSION_FAILED` | CONFIG | ❌ No | `rate-lookup.ts` | Add missing exchange rate |
| `CALC_ARITHMETIC_ERROR` | INVARIANT | ❌ No | `arithmetic.ts` | Contact support (overflow/underflow) |
| `CALC_NEGATIVE_FINAL_AMOUNT` | VALIDATION | ❌ No | `quote-calculator.ts` | Review discounts |
| `CALC_TAX_CONFIG_INVALID` | CONFIG | ❌ No | `tax-engine.ts` | Admin must fix tax config |
| `CALC_MARKUP_INVALID` | CONFIG | ❌ No | `markup-engine.ts` | Admin must fix markup config |
| `CALC_VERIFICATION_FAILED` | INVARIANT | ❌ No | `quote-calculator.ts` | Contact support (sum mismatch) |

---

## 2. QUOTE SERVICE ERRORS

| Code | Category | Retryable | Where Thrown | Resolution |
|------|----------|-----------|--------------|------------|
| `QUOTE_NOT_FOUND` | NOT_FOUND | ❌ No | `quote-service.ts` | Verify quote ID exists |
| `QUOTE_NOT_EDITABLE` | VALIDATION | ❌ No | `quote-service.ts` | Revert to DRAFT first |
| `QUOTE_NOT_DELETABLE` | VALIDATION | ❌ No | `quote-service.ts` | Only DRAFT can be deleted |
| `INVALID_STATE_TRANSITION` | VALIDATION | ❌ No | `quote-service.ts` | Check allowed transitions |
| `MISSING_VERSION` | VALIDATION | ❌ No | `quote-service.ts` | Calculate before sending |
| `VERSION_NOT_FOUND` | NOT_FOUND | ❌ No | `quote-service.ts` | Verify version ID exists |
| `VALIDATION_FAILED` | VALIDATION | ❌ No | `quote-service.ts` | Fix input data |
| `PERSISTENCE_ERROR` | TRANSIENT | ✅ Yes | `quote-service.ts` | Retry (storage may recover) |

---

## 3. CALCULATION SERVICE ERRORS

| Code | Category | Retryable | Where Thrown | Resolution |
|------|----------|-----------|--------------|------------|
| `QUOTE_NOT_FOUND` | NOT_FOUND | ❌ No | `calculation-service.ts` | Verify quote ID exists |
| `QUOTE_NOT_EDITABLE` | VALIDATION | ❌ No | `calculation-service.ts` | Quote must be in DRAFT |
| `CALCULATION_FAILED` | VARIES | ⚠️ See inner | `calculation-service.ts` | Check inner error code |
| `VERSION_CREATION_FAILED` | TRANSIENT | ✅ Yes | `calculation-service.ts` | Retry (storage may recover) |
| `DATA_LOAD_FAILED` | TRANSIENT | ✅ Yes | `calculation-service.ts` | Retry (data loading issue) |

---

## 4. PDF SERVICE ERRORS

| Code | Category | Retryable | Where Thrown | Resolution |
|------|----------|-----------|--------------|------------|
| `QUOTE_NOT_FOUND` | NOT_FOUND | ❌ No | `pdf-service.ts` | Verify quote ID exists |
| `VERSION_NOT_FOUND` | NOT_FOUND | ❌ No | `pdf-service.ts` | Verify version ID exists |
| `GENERATION_FAILED` | TRANSIENT | ✅ Yes | `pdf-service.ts` | Retry PDF generation |
| `STORAGE_FAILED` | TRANSIENT | ✅ Yes | `pdf-service.ts` | Retry (storage may recover) |
| `RECORD_NOT_FOUND` | NOT_FOUND | ❌ No | `pdf-service.ts` | Verify PDF record ID exists |

---

## 5. EMAIL SERVICE ERRORS

| Code | Category | Retryable | Where Thrown | Resolution |
|------|----------|-----------|--------------|------------|
| `QUOTE_NOT_FOUND` | NOT_FOUND | ❌ No | `email-service.ts` | Verify quote ID exists |
| `VERSION_NOT_FOUND` | NOT_FOUND | ❌ No | `email-service.ts` | Verify version ID exists |
| `SEND_FAILED` | EXTERNAL | ✅ Yes | `email-service.ts` | Retry (email service may recover) |
| `RECORD_NOT_FOUND` | NOT_FOUND | ❌ No | `email-service.ts` | Verify email record ID exists |
| `ORIGINAL_NOT_FOUND` | NOT_FOUND | ❌ No | `email-service.ts` | Original email for resend not found |

---

## 6. STATE MACHINE ERRORS

| Code | Category | Retryable | Where Thrown | Resolution |
|------|----------|-----------|--------------|------------|
| `INVALID_TRANSITION` | VALIDATION | ❌ No | `state-machine.ts` | Check valid transitions |
| `MISSING_VERSION` | VALIDATION | ❌ No | `state-machine.ts` | Calculate before sending |
| `QUOTE_NOT_FOUND` | NOT_FOUND | ❌ No | `state-machine.ts` | Verify quote ID exists |
| `TERMINAL_STATE` | VALIDATION | ❌ No | `state-machine.ts` | CONVERTED is terminal |

---

## 7. ARITHMETIC ERRORS

| Code | Category | Retryable | Where Thrown | Resolution |
|------|----------|-----------|--------------|------------|
| `OVERFLOW` | INVARIANT | ❌ No | `arithmetic.ts` | Value exceeds safe range |
| `UNDERFLOW` | INVARIANT | ❌ No | `arithmetic.ts` | Value below safe range |
| `NEGATIVE_NOT_ALLOWED` | VALIDATION | ❌ No | `arithmetic.ts` | Result cannot be negative |
| `DIVIDE_BY_ZERO` | INVARIANT | ❌ No | `arithmetic.ts` | Division by zero attempted |

---

## SUMMARY BY CATEGORY

| Category | Count | Retryable Count |
|----------|-------|-----------------|
| TRANSIENT | 8 | 8 |
| VALIDATION | 13 | 0 |
| NOT_FOUND | 12 | 0 |
| CONFIG | 5 | 0 |
| INVARIANT | 4 | 0 |
| EXTERNAL | 1 | 1 |
| **TOTAL** | **43** | **9** |

---

## RETRY DECISION MATRIX

```
┌─────────────────────────────────────────────────────────────────┐
│                    ERROR RETRY DECISION                         │
├─────────────────────────────────────────────────────────────────┤
│  Category        │  Action                                      │
├──────────────────┼──────────────────────────────────────────────┤
│  TRANSIENT       │  Auto-retry up to N times with backoff       │
│  VALIDATION      │  Fail fast, return to user with message      │
│  NOT_FOUND       │  Fail fast, resource does not exist          │
│  CONFIG          │  Fail fast, notify admin, log as warning     │
│  INVARIANT       │  Fail fast, log as CRITICAL, alert on-call   │
│  EXTERNAL        │  Retry with exponential backoff + jitter     │
└─────────────────────────────────────────────────────────────────┘
```

---

## EXISTING INFRASTRUCTURE

The codebase already has:

1. **`CALCULATION_ERROR_RETRYABLE`** in `src/core/utils/errors.ts` - Maps calculation errors to retry semantics
2. **`isRetryableCalculationError()`** - Helper function
3. **`ERROR_CODE_REGISTRY`** - Metadata for validation errors

Phase 4 implementation will extend this pattern to ALL service errors.
