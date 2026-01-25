# Phase 5: Startup Requirements Inventory

## Overview

This document lists every assumption required for the system to start successfully.
**If any requirement is not met, the system MUST refuse to start.**

---

## 1. DIRECTORY REQUIREMENTS

| Requirement | Path | Condition | Failure Mode |
|-------------|------|-----------|--------------|
| Data directory | `AppInitOptions.dataPath` | Must be writable | STARTUP_FAIL |
| PDF storage directory | `AppInitOptions.pdfStoragePath` | Must be writable | STARTUP_FAIL |

---

## 2. SEED DATA REQUIREMENTS

### 2.1 Required Collections (non-empty)

| Collection | Minimum | Reason |
|------------|---------|--------|
| `currencies` | 1+ | Quote currency selection |
| `resorts` | 1+ | Resort selection in legs |
| `roomTypes` | 1+ | Room selection in legs |
| `seasons` | 1+ | Rate lookup requires season |
| `rates` | 1+ | Nightly rate calculation |
| `childAgeBands` | 0+ | Optional (children allowed if present) |
| `mealPlans` | 0+ | Optional (calculation handles empty) |
| `transferTypes` | 0+ | Optional (calculation handles empty) |
| `activities` | 0+ | Optional (calculation handles empty) |
| `taxConfigurations` | 0+ | Optional (no taxes if empty) |
| `festiveSupplements` | 0+ | Optional (no festive if empty) |
| `discounts` | 0+ | Optional (no discounts if empty) |
| `markupConfigurations` | 0+ | Optional (no markup if empty) |

### 2.2 Referential Integrity

| From | To | Condition |
|------|-----|-----------|
| `roomTypes[].resort_id` | `resorts[].id` | Every room type must reference existing resort |
| `rates[].room_type_id` | `roomTypes[].id` | Every rate must reference existing room type |
| `rates[].season_id` | `seasons[].id` | Every rate must reference existing season |
| `taxConfigurations[].resort_id` | `resorts[].id` | Every tax config must reference existing resort |
| `markupConfigurations[].resort_id` | `resorts[].id` | Every markup config must reference existing resort |

### 2.3 Data Validity

| Entity | Field | Constraint |
|--------|-------|------------|
| `currencies` | `code` | Must be 3-character ISO code |
| `currencies` | `decimal_places` | Must be 0-4 |
| `seasons` | `start_date` / `end_date` | End must be >= start |
| `rates` | `rate_amount` | Must be > 0 |
| `taxConfigurations` | `calculation_order` | Must be unique within resort |
| `childAgeBands` | `min_age` / `max_age` | No overlapping bands per resort |

---

## 3. VALIDATION PRIORITIES

### P0 - CRITICAL (Refuse to start)

1. Data directory not writable
2. PDF storage directory not writable
3. No currencies in seed data
4. No resorts in seed data
5. No room types in seed data
6. No seasons in seed data
7. No rates in seed data

### P1 - ERROR (Log error, refuse to start)

1. Room type references non-existent resort
2. Rate references non-existent room type
3. Rate references non-existent season
4. Tax config references non-existent resort
5. Markup config references non-existent resort
6. Duplicate tax calculation_order within resort

### P2 - WARNING (Log warning, allow start)

1. Resort has no room types
2. Resort has no tax configurations
3. Resort has no markup configuration
4. Season with no rates
5. Room type with no rates

---

## 4. IMPLEMENTATION CHECKLIST

```
[ ] validateDirectoryWritable(path) → throws if not writable
[ ] validateSeedDataMinimums(data) → throws if missing required data
[ ] validateReferentialIntegrity(data) → throws if broken references
[ ] validateDataConstraints(data) → throws if invalid values
[ ] validateStartupRequirements(options) → orchestrates all checks
```

---

## 5. ERROR MESSAGES

| Code | Message | Resolution |
|------|---------|------------|
| `STARTUP_DIR_NOT_WRITABLE` | "Directory is not writable: {path}" | Check permissions |
| `STARTUP_DIR_NOT_FOUND` | "Directory does not exist: {path}" | Create directory |
| `STARTUP_NO_CURRENCIES` | "Seed data contains no currencies" | Add currencies to seed |
| `STARTUP_NO_RESORTS` | "Seed data contains no resorts" | Add resorts to seed |
| `STARTUP_NO_ROOM_TYPES` | "Seed data contains no room types" | Add room types to seed |
| `STARTUP_NO_SEASONS` | "Seed data contains no seasons" | Add seasons to seed |
| `STARTUP_NO_RATES` | "Seed data contains no rates" | Add rates to seed |
| `STARTUP_BROKEN_REF` | "{entity} references non-existent {target}: {id}" | Fix seed data |
| `STARTUP_INVALID_DATA` | "{entity}.{field}: {reason}" | Fix seed data |
