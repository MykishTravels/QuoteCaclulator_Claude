# Sprint 7 — Phase 2: Structured Logging Infrastructure

**Status:** COMPLETE

---

## 1. OBJECTIVE

Add observability without affecting system behavior.

---

## 2. FILES CREATED

| File | LOC | Purpose |
|------|-----|---------|
| `src/core/logging/logger.ts` | ~250 | Logger interface, ConsoleLogger, NoOpLogger |
| `src/core/logging/correlation.ts` | ~140 | Correlation ID generation, OperationContext, Timer |
| `src/core/logging/index.ts` | ~30 | Barrel export |

---

## 3. FILES MODIFIED

| File | Changes |
|------|---------|
| `src/core/index.ts` | Added `export * from './logging'` |
| `src/services/calculation-service.ts` | Added logging imports + `calculate()` logging |
| `src/services/quote-service.ts` | Added logging imports + `transitionTo()`, `send()` logging |
| `src/output/pdf-service.ts` | Added logging imports + `generate()` logging |
| `src/output/email-service.ts` | Added logging imports + `send()` logging |

---

## 4. LOGGING INFRASTRUCTURE

### Logger Interface

```typescript
interface Logger {
  debug(entry): void;
  info(entry): void;
  warn(entry): void;
  error(entry): void;
  child(context): Logger;
  getLevel(): LogLevel;
  setLevel(level): void;
}
```

### Log Entry Structure

```typescript
interface LogEntry {
  timestamp: DateTimeString;
  level: LogLevel;
  correlation_id: string;
  operation: string;
  message: string;
  quote_id?: EntityId;
  version_id?: EntityId;
  duration_ms?: number;
  error_code?: string;
  context?: Record<string, unknown>;
}
```

### Correlation ID Format

```
COR-{YYYYMMDD}-{HHMMSS}-{random8}
Example: COR-20260124-143052-a1b2c3d4
```

---

## 5. OPERATIONS LOGGED

### CalculationService

| Operation | Events Logged |
|-----------|---------------|
| `calculation.start` | Start, quote not found, quote not editable |
| `calculation.complete` | Calculation failed, success with duration |
| `version.create` | Version persistence failed |

### QuoteService

| Operation | Events Logged |
|-----------|---------------|
| `quote.send` | Start, not found, not DRAFT, missing version |
| `quote.revert` | Start, success, failure |
| `quote.convert` | Start, success, failure |
| `quote.reject` | Start, success, failure |
| `quote.expire` | Start, success, failure |

### PDFService

| Operation | Events Logged |
|-----------|---------------|
| `pdf.generate` | Start, quote not found, version not found, generation failed, storage failed, success |

### EmailService

| Operation | Events Logged |
|-----------|---------------|
| `email.send` | Start, quote not found, version not found, send failed, persistence warning, success |
| `email.resend` | Same as send (distinguished by operation name) |

---

## 6. GUARDRAIL COMPLIANCE

| Guardrail | Status |
|-----------|--------|
| Logging is side-effect only | ✅ No control flow changes |
| No conditional logic based on logs | ✅ Verified |
| No error swallowing | ✅ All errors still returned/thrown |
| No retries triggered by logging | ✅ No retry logic added |
| No behavior changes | ✅ Verified |

---

## 7. COMPILATION STATUS

```
npx tsc --noEmit
# (no output - clean compilation)
```

---

## 8. USAGE EXAMPLES

### Basic Logging

```typescript
import { getLogger, generateCorrelationId, startTimer, Operations } from '../core/logging';

const correlationId = generateCorrelationId();
const timer = startTimer();
const logger = getLogger().child({ correlation_id: correlationId });

logger.info({
  correlation_id: correlationId,
  operation: Operations.QUOTE_SEND,
  message: 'Starting quote send',
  quote_id: quoteId,
});

// ... operation ...

logger.info({
  correlation_id: correlationId,
  operation: Operations.QUOTE_SEND,
  message: 'Quote sent successfully',
  quote_id: quoteId,
  duration_ms: timer.stop(),
});
```

### Testing with NoOpLogger

```typescript
import { setDefaultLogger, NoOpLogger } from '../core/logging';

beforeEach(() => {
  setDefaultLogger(new NoOpLogger());
});
```

---

## 9. SAMPLE LOG OUTPUT

```
[2026-01-24T14:30:52.123Z] [INFO] [COR-20260124-143052-a1b2c3d4] calculation.start quote=Q-2026-001 Starting quote calculation { legs_count: 2 }
[2026-01-24T14:30:52.456Z] [INFO] [COR-20260124-143052-a1b2c3d4] calculation.complete quote=Q-2026-001 version=QV-001 Quote calculation completed successfully (333ms) { version_number: 1, total_sell: 15000 }
```

---

**Phase 2 is COMPLETE. Ready for Phase 3: Test Hardening.**

---

**Signed:** Senior Software Architect  
**Date:** 2026-01-24
