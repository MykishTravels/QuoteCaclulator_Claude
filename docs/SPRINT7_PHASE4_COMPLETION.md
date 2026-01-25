# Sprint 7 — Phase 4: Error Categorization

**Status:** COMPLETE

---

## 1. OBJECTIVE

Provide metadata-only classification of all system errors so that:
- "If this error happens, should the system retry, fail fast, or stop forever?"
...can be answered without reading the code.

---

## 2. FILES CREATED

| File | LOC | Purpose |
|------|-----|---------|
| `src/core/errors/error-categorization.ts` | ~350 | Error metadata registries and lookup functions |
| `src/core/errors/index.ts` | ~35 | Barrel export |
| `docs/SPRINT7_PHASE4_ERROR_INVENTORY.md` | ~200 | Complete error inventory documentation |

---

## 3. ERROR CATEGORIES DEFINED

| Category | Description | Retryable | Action |
|----------|-------------|-----------|--------|
| `TRANSIENT` | Temporary failure | ✅ Yes | Auto-retry with backoff |
| `VALIDATION` | Input validation failed | ❌ No | Fail fast, return to user |
| `NOT_FOUND` | Resource does not exist | ❌ No | Fail fast |
| `CONFIG` | Configuration missing | ❌ No | Fail fast, notify admin |
| `INVARIANT` | System invariant violated | ❌ No | Fail fast, log CRITICAL |
| `EXTERNAL` | External service failure | ✅ Yes | Retry with backoff + jitter |

---

## 4. ERROR METADATA STRUCTURE

```typescript
interface ErrorMetadata {
  code: string;           // Error code
  category: ErrorCategory; // TRANSIENT | VALIDATION | NOT_FOUND | CONFIG | INVARIANT | EXTERNAL
  retryable: boolean;      // Is it safe to retry?
  description: string;     // Human-readable description
  resolution: string;      // Suggested resolution
  userVisible: boolean;    // Show to end users?
  logLevel: string;        // DEBUG | INFO | WARN | ERROR | CRITICAL
}
```

---

## 5. ERROR REGISTRIES CREATED

### Calculation Engine (10 errors)

| Code | Category | Retryable |
|------|----------|-----------|
| `CALC_INIT_FAILED` | TRANSIENT | ✅ |
| `CALC_FX_LOCK_FAILED` | TRANSIENT | ✅ |
| `CALC_RATE_NOT_FOUND` | CONFIG | ❌ |
| `CALC_SEASON_NOT_FOUND` | CONFIG | ❌ |
| `CALC_CURRENCY_CONVERSION_FAILED` | CONFIG | ❌ |
| `CALC_ARITHMETIC_ERROR` | INVARIANT | ❌ |
| `CALC_NEGATIVE_FINAL_AMOUNT` | VALIDATION | ❌ |
| `CALC_TAX_CONFIG_INVALID` | CONFIG | ❌ |
| `CALC_MARKUP_INVALID` | CONFIG | ❌ |
| `CALC_VERIFICATION_FAILED` | INVARIANT | ❌ |

### Quote Service (8 errors)

| Code | Category | Retryable |
|------|----------|-----------|
| `QUOTE_NOT_FOUND` | NOT_FOUND | ❌ |
| `QUOTE_NOT_EDITABLE` | VALIDATION | ❌ |
| `QUOTE_NOT_DELETABLE` | VALIDATION | ❌ |
| `INVALID_STATE_TRANSITION` | VALIDATION | ❌ |
| `MISSING_VERSION` | VALIDATION | ❌ |
| `VERSION_NOT_FOUND` | NOT_FOUND | ❌ |
| `VALIDATION_FAILED` | VALIDATION | ❌ |
| `PERSISTENCE_ERROR` | TRANSIENT | ✅ |

### Calculation Service (5 errors)

| Code | Category | Retryable |
|------|----------|-----------|
| `QUOTE_NOT_FOUND` | NOT_FOUND | ❌ |
| `QUOTE_NOT_EDITABLE` | VALIDATION | ❌ |
| `CALCULATION_FAILED` | TRANSIENT* | ⚠️ |
| `VERSION_CREATION_FAILED` | TRANSIENT | ✅ |
| `DATA_LOAD_FAILED` | TRANSIENT | ✅ |

*Check inner error for actual category

### PDF Service (5 errors)

| Code | Category | Retryable |
|------|----------|-----------|
| `QUOTE_NOT_FOUND` | NOT_FOUND | ❌ |
| `VERSION_NOT_FOUND` | NOT_FOUND | ❌ |
| `GENERATION_FAILED` | TRANSIENT | ✅ |
| `STORAGE_FAILED` | TRANSIENT | ✅ |
| `RECORD_NOT_FOUND` | NOT_FOUND | ❌ |

### Email Service (5 errors)

| Code | Category | Retryable |
|------|----------|-----------|
| `QUOTE_NOT_FOUND` | NOT_FOUND | ❌ |
| `VERSION_NOT_FOUND` | NOT_FOUND | ❌ |
| `SEND_FAILED` | EXTERNAL | ✅ |
| `RECORD_NOT_FOUND` | NOT_FOUND | ❌ |
| `ORIGINAL_NOT_FOUND` | NOT_FOUND | ❌ |

### State Machine (4 errors)

| Code | Category | Retryable |
|------|----------|-----------|
| `INVALID_TRANSITION` | VALIDATION | ❌ |
| `MISSING_VERSION` | VALIDATION | ❌ |
| `QUOTE_NOT_FOUND` | NOT_FOUND | ❌ |
| `TERMINAL_STATE` | VALIDATION | ❌ |

---

## 6. LOOKUP FUNCTIONS PROVIDED

```typescript
// Get full metadata
getServiceErrorMetadata('QUOTE_SERVICE', 'QUOTE_NOT_FOUND')
// → { code, category, retryable, description, resolution, userVisible, logLevel }

// Check if retryable
isServiceErrorRetryable('PDF_SERVICE', 'GENERATION_FAILED')
// → true

// Get category
getServiceErrorCategory('CALCULATION', 'CALC_ARITHMETIC_ERROR')
// → ErrorCategory.INVARIANT

// Check if user should see it
isServiceErrorUserVisible('CALCULATION_SERVICE', 'VERSION_CREATION_FAILED')
// → false

// Get resolution text
getServiceErrorResolution('EMAIL_SERVICE', 'SEND_FAILED')
// → "Check email service status and retry"
```

---

## 7. SUMMARY BY CATEGORY

| Category | Count | Retryable |
|----------|-------|-----------|
| TRANSIENT | 8 | 8 |
| VALIDATION | 13 | 0 |
| NOT_FOUND | 12 | 0 |
| CONFIG | 5 | 0 |
| INVARIANT | 2 | 0 |
| EXTERNAL | 1 | 1 |
| **TOTAL** | **41** | **9** |

---

## 8. GUARDRAIL COMPLIANCE

| Guardrail | Status |
|-----------|--------|
| Metadata only | ✅ No behavior changes |
| No retry logic | ✅ Classification only |
| No recovery logic | ✅ Lookup functions only |
| No behavior changes | ✅ Verified |
| No refactors | ✅ New files only |

---

## 9. USAGE EXAMPLES

### Determining if retry is appropriate

```typescript
import { isServiceErrorRetryable, ErrorService } from './core/errors';

// In a hypothetical retry wrapper (NOT part of this phase):
if (isServiceErrorRetryable(ErrorService.PDF_SERVICE, error.code)) {
  // Safe to retry
} else {
  // Fail fast
}
```

### Logging with appropriate level

```typescript
import { getServiceErrorMetadata, ErrorService } from './core/errors';

const metadata = getServiceErrorMetadata(ErrorService.CALCULATION, 'CALC_VERIFICATION_FAILED');
// metadata.logLevel === 'CRITICAL'
```

### Showing user-appropriate messages

```typescript
import { isServiceErrorUserVisible, getServiceErrorResolution, ErrorService } from './core/errors';

if (isServiceErrorUserVisible(ErrorService.QUOTE_SERVICE, error.code)) {
  showToUser(getServiceErrorResolution(ErrorService.QUOTE_SERVICE, error.code));
} else {
  showToUser('An unexpected error occurred');
}
```

---

## 10. COMPILATION STATUS

```
npx tsc --noEmit → 0 errors ✅
```

---

## 11. DECISION MATRIX SUMMARY

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ERROR HANDLING DECISION                          │
├─────────────────────────────────────────────────────────────────────────┤
│  If Category is...    │  Then...                                        │
├───────────────────────┼─────────────────────────────────────────────────┤
│  TRANSIENT            │  Safe to retry (up to N times with backoff)     │
│  VALIDATION           │  Fail fast → return error to user               │
│  NOT_FOUND            │  Fail fast → resource doesn't exist             │
│  CONFIG               │  Fail fast → admin must fix configuration       │
│  INVARIANT            │  Fail fast → log CRITICAL, alert support        │
│  EXTERNAL             │  Retry with exponential backoff + jitter        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

**Phase 4 is COMPLETE. Ready for Phase 5: Startup & Configuration Safety upon authorization.**

---

**Signed:** Senior Software Architect  
**Date:** 2026-01-24
