# Sprint 7 — Phase 5: Startup & Configuration Safety

**Status:** COMPLETE

---

## 1. OBJECTIVE

Fail fast if configuration is invalid. The system must refuse to start with bad data.

---

## 2. FILES CREATED

| File | LOC | Purpose |
|------|-----|---------|
| `src/startup/startup-validation.ts` | ~460 | Startup validation functions |
| `src/startup/index.ts` | ~20 | Barrel export |
| `docs/SPRINT7_PHASE5_STARTUP_REQUIREMENTS.md` | ~150 | Requirements documentation |

---

## 3. FILES MODIFIED

| File | Change |
|------|--------|
| `src/ui/app-init.ts` | Added `validateStartupRequirements()` call at app start |

---

## 4. VALIDATION PHASES

### Phase 1: Directory Validation

| Check | Error Code | Action |
|-------|------------|--------|
| Data directory exists/writable | `DIR_NOT_FOUND` / `DIR_NOT_WRITABLE` | **FAIL** |
| PDF storage directory exists/writable | `DIR_NOT_FOUND` / `DIR_NOT_WRITABLE` | **FAIL** |

### Phase 2: Seed Data Minimums

| Check | Error Code | Action |
|-------|------------|--------|
| At least 1 currency | `NO_CURRENCIES` | **FAIL** |
| At least 1 resort | `NO_RESORTS` | **FAIL** |
| At least 1 room type | `NO_ROOM_TYPES` | **FAIL** |
| At least 1 season | `NO_SEASONS` | **FAIL** |
| At least 1 rate | `NO_RATES` | **FAIL** |

### Phase 3: Referential Integrity

| Check | Error Code | Action |
|-------|------------|--------|
| RoomType → Resort | `BROKEN_REFERENCE` | **FAIL** |
| Rate → RoomType | `BROKEN_REFERENCE` | **FAIL** |
| Rate → Season | `BROKEN_REFERENCE` | **FAIL** |
| TaxConfig → Resort | `BROKEN_REFERENCE` | **FAIL** |
| MarkupConfig → Resort | `BROKEN_REFERENCE` | **FAIL** |
| MealPlan → Resort | `BROKEN_REFERENCE` | **FAIL** |
| TransferType → Resort | `BROKEN_REFERENCE` | **FAIL** |
| Activity → Resort | `BROKEN_REFERENCE` | **FAIL** |

### Phase 4: Data Constraints

| Check | Error Code | Action |
|-------|------------|--------|
| Currency code = 3 chars | `INVALID_DATA` | **FAIL** |
| Currency decimal_places 0-4 | `INVALID_DATA` | **FAIL** |
| Season date_ranges valid | `INVALID_DATA` | **FAIL** |
| Rate cost_amount > 0 | `INVALID_DATA` | **FAIL** |
| Tax calculation_order unique | `DUPLICATE_TAX_ORDER` | **FAIL** |
| Age bands non-overlapping | `OVERLAPPING_AGE_BANDS` | **FAIL** |

---

## 5. ERROR CLASSES

### StartupValidationError

Single validation error with code and details.

```typescript
class StartupValidationError extends Error {
  code: StartupErrorCode;
  details?: Record<string, unknown>;
}
```

### StartupValidationErrors

Aggregates multiple validation errors.

```typescript
class StartupValidationErrors extends Error {
  errors: StartupValidationError[];
}
```

---

## 6. STARTUP ERROR CODES

| Code | Category | Description |
|------|----------|-------------|
| `STARTUP_DIR_NOT_FOUND` | Directory | Path does not exist or is not a directory |
| `STARTUP_DIR_NOT_WRITABLE` | Directory | Directory is not writable |
| `STARTUP_DIR_CREATION_FAILED` | Directory | Failed to create directory |
| `STARTUP_NO_CURRENCIES` | Minimum | No currencies in seed data |
| `STARTUP_NO_RESORTS` | Minimum | No resorts in seed data |
| `STARTUP_NO_ROOM_TYPES` | Minimum | No room types in seed data |
| `STARTUP_NO_SEASONS` | Minimum | No seasons in seed data |
| `STARTUP_NO_RATES` | Minimum | No rates in seed data |
| `STARTUP_BROKEN_REF` | Integrity | Entity references non-existent target |
| `STARTUP_INVALID_DATA` | Constraint | Data value violates constraint |
| `STARTUP_DUPLICATE_TAX_ORDER` | Constraint | Duplicate tax calculation order |
| `STARTUP_OVERLAPPING_AGE_BANDS` | Constraint | Overlapping child age bands |

---

## 7. INTEGRATION

### app-init.ts

```typescript
export function initializeApp(options: AppInitOptions): AppContext {
  // PHASE 5: Validate startup requirements FIRST
  // If this fails, we throw and refuse to start.
  // No fallbacks. No defaults. No silent failures.
  validateStartupRequirements({
    dataPath: options.dataPath,
    pdfStoragePath: options.pdfStoragePath,
    seedData: options.referenceData,
  });
  
  // ... rest of initialization
}
```

---

## 8. GUARDRAIL COMPLIANCE

| Guardrail | Status |
|-----------|--------|
| Fail fast | ✅ Throws on ANY error |
| No defaults | ✅ No fallback values provided |
| No auto-repair | ✅ No data fixing |
| No silent fallbacks | ✅ All errors thrown with messages |
| Loud failure | ✅ Clear error messages with codes |

---

## 9. VALIDATION FUNCTION SIGNATURES

```typescript
// Directory validation
validateDirectoryWritable(dirPath: string, purpose: string): void

// Seed data minimum validation
validateSeedDataMinimums(data: Partial<DataStore>): void

// Referential integrity validation
validateReferentialIntegrity(data: Partial<DataStore>): void

// Data constraint validation
validateDataConstraints(data: Partial<DataStore>): void

// Orchestrator (calls all above in order)
validateStartupRequirements(options: StartupValidationOptions): void
```

---

## 10. EXAMPLE ERROR OUTPUT

```
StartupValidationErrors: Startup validation failed with 2 error(s):
  - [STARTUP_NO_CURRENCIES] Seed data contains no currencies. At least one currency is required.
  - [STARTUP_BROKEN_REF] RoomType "RT-001" references non-existent resort: RST-INVALID
```

---

## 11. COMPILATION STATUS

```
npx tsc --noEmit → 0 errors ✅
```

---

## 12. WHAT THIS PHASE DOES NOT DO

Per Phase 5 guardrails:

- ❌ Does NOT provide default values
- ❌ Does NOT auto-repair broken references
- ❌ Does NOT silently skip missing data
- ❌ Does NOT attempt recovery
- ❌ Does NOT change existing behavior

It ONLY validates and throws if invalid.

---

**Phase 5 is COMPLETE. Ready for Phase 6: Performance Baseline upon authorization.**

---

**Signed:** Senior Software Architect  
**Date:** 2026-01-24
