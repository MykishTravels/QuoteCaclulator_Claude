# Sprint 4: Output Generation — COMPLETION SUMMARY

**Date:** 2026-01-23  
**Status:** COMPLETE  

---

## 1. GUARDRAILS COMPLIANCE

| Guardrail | Status | Implementation |
|-----------|--------|----------------|
| QuoteVersion is read-only | ✅ | Services fetch version, never modify |
| Email send ≠ state transition | ✅ | No status changes in EmailService |
| Display modes are filters only | ✅ | `selectPricing()` filters, never recalculates |
| Entity schemas locked | ✅ | No new fields added to PDFRecord/EmailRecord |
| PricingVisibility runtime-only | ✅ | Not persisted in PDFRecord |
| v1 storage: local filesystem | ✅ | `LocalFileStorage` adapter |
| v1 email: stub only | ✅ | `StubEmailAdapter` logs but doesn't send |

---

## 2. DELIVERABLES

### 2.1 Output Types (`/src/output/types.ts`)

| Type | Purpose | Notes |
|------|---------|-------|
| `PricingVisibility` | Runtime-only visibility filter | COST_ONLY, SELL_ONLY, FULL_BREAKDOWN |
| `PDFSection` | Sections includable in PDF | HEADER, CLIENT_INFO, LEGS, etc. |
| `PDFGenerationOptions` | PDF generation parameters | display_mode + pricing_visibility |
| `EmailGenerationOptions` | Email send parameters | recipient, attach_pdf, resend_of |
| `RenderedQuote` | Template-ready quote data | Filtered by visibility |
| `StoragePort` | Storage abstraction | store, retrieve, delete, getSize |
| `EmailPort` | Email abstraction | send method |

### 2.2 Template Renderer (`/src/output/template-renderer.ts`)

**Key Functions:**

| Function | Purpose | Guardrail Compliance |
|----------|---------|---------------------|
| `renderQuote()` | Converts QuoteVersion → RenderedQuote | Read-only, pure function |
| `selectPricing()` | Filters cost/sell based on visibility | No recalculation |
| `formatMoney()` | Currency formatting | Display only |
| `formatDate()` | Date formatting | Display only |

**Critical Implementation:**
```typescript
// selectPricing() is a FILTER - selects existing values, never recalculates
function selectPricing(
  cost: MoneyAmount,
  markup: MoneyAmount,
  sell: MoneyAmount,
  visibility: PricingVisibility,
  currency: CurrencyCode
): RenderedPricing {
  switch (visibility) {
    case PricingVisibility.COST_ONLY:
      return { label: 'Cost', amount: cost, currency };
    case PricingVisibility.SELL_ONLY:
      return { label: 'Total', amount: sell, currency };
    // ... all values come directly from QuoteVersion
  }
}
```

### 2.3 PDF Generator (`/src/output/pdf-generator.ts`)

| Feature | Implementation |
|---------|----------------|
| Format | Minimal PDF 1.4 structure |
| Content | Text-based with sections |
| Sections | Header, Client Info, Legs, Transfers, Summary, Taxes, Footer |
| Configurability | Sections can be included/excluded |

### 2.4 PDF Service (`/src/output/pdf-service.ts`)

| Method | Purpose | Returns |
|--------|---------|---------|
| `generate()` | Create PDF for specific version | PDFRecord |
| `generateForCurrentVersion()` | Create PDF for quote's current version | PDFRecord |
| `retrieve()` | Get PDF content by record ID | Buffer |
| `listByQuote()` | List all PDFs for a quote | PDFRecord[] |
| `listByVersion()` | List all PDFs for a version | PDFRecord[] |
| `getById()` | Get single PDF record | PDFRecord |

**PDFRecord Persistence:**
- `display_mode` → Persisted (DETAILED or SIMPLIFIED)
- `pricing_visibility` → NOT persisted (runtime-only)

### 2.5 Email Service (`/src/output/email-service.ts`)

| Method | Purpose | Returns |
|--------|---------|---------|
| `send()` | Send email for specific version | EmailRecord |
| `sendForCurrentVersion()` | Send email for quote's current version | EmailRecord |
| `resend()` | Resend previous email | EmailRecord (linked via resend_of) |
| `listByQuote()` | List all emails for a quote | EmailRecord[] |
| `getById()` | Get single email record | EmailRecord |

**Critical: No State Transition**
```typescript
// EmailService.send() does NOT modify quote status
// State transitions remain explicit API actions
async send(...): Promise<Result<EmailRecord, ...>> {
  // 1. Fetch Quote and QuoteVersion (read-only)
  // 2. Generate email content
  // 3. Optionally generate PDF attachment
  // 4. Send via email port
  // 5. Create EmailRecord
  // 6. Return record
  // NOTE: Quote status is NEVER changed
}
```

### 2.6 Adapters

| Adapter | Purpose | Implementation |
|---------|---------|----------------|
| `LocalFileStorage` | Filesystem storage | `fs` module operations |
| `StubEmailAdapter` | Mock email sending | Logs sends, simulates success/failure |

---

## 3. FILE INVENTORY

```
/src/output/
├── index.ts              (barrel export)
├── types.ts              (runtime types, ports)
├── template-renderer.ts  (QuoteVersion → RenderedQuote)
├── pdf-generator.ts      (RenderedQuote → PDF Buffer)
├── pdf-service.ts        (orchestration + record persistence)
├── email-service.ts      (orchestration + record persistence)
├── storage-adapter.ts    (local filesystem)
└── email-adapter.ts      (stub SMTP)

/src/global.d.ts          (Node.js type declarations)

/tests/integration/
└── sprint4-tests.ts      (10 integration tests)
```

---

## 4. INTEGRATION TESTS

| Test | Assertion |
|------|-----------|
| PDF Generation - Basic | PDF generates, record persisted with display_mode |
| PDF Visibility Modes | COST_ONLY, SELL_ONLY, FULL_BREAKDOWN all work |
| PDF Retrieval | Content retrievable by record ID |
| Email Send - Basic | Email sent, record persisted with status |
| Email No State Transition | Quote status unchanged after email send |
| Email Resend | New record links to original via resend_of |
| Email Send Failure | Failure correctly reported and logged |
| QuoteVersion Not Modified | Version unchanged after multiple PDF/email operations |
| PDF List Operations | listByQuote, listByVersion work correctly |
| Email List Operations | listByQuote works correctly |

---

## 5. SCHEMA COMPLIANCE

### PDFRecord (Locked - Phase 5 D.2)

| Field | Type | Source |
|-------|------|--------|
| id | EntityId | Generated |
| quote_id | EntityId | Input |
| quote_version_id | EntityId | Input |
| generated_at | DateTimeString | System |
| display_mode | PDFDisplayMode | Options (persisted) |
| sections_included | readonly string[] | Options |
| file_reference | string | Storage |
| file_size_bytes | number | Storage |

**NOT in schema:** `pricing_visibility` (runtime-only)

### EmailRecord (Locked - Phase 5 D.1)

| Field | Type | Source |
|-------|------|--------|
| id | EntityId | Generated |
| quote_id | EntityId | Input |
| quote_version_id | EntityId | Input |
| recipient_email | string | Options |
| subject | string | Generated |
| body_preview | string | Generated |
| sent_at | DateTimeString | System |
| status | EmailStatus | Send result |
| failure_reason | string? | Send result |
| resend_of | EntityId? | Options |

---

## 6. METRICS

| Metric | Value |
|--------|-------|
| New TypeScript files | 9 |
| New lines of code | ~1,500 |
| Integration tests | 10 |
| Entity modifications | 0 |
| Lifecycle changes | 0 |

---

## 7. SUCCESS CRITERIA — VERIFIED

| Criterion | Status |
|-----------|--------|
| PDFs generate correctly from any valid QuoteVersion | ✅ |
| Emails send with correct attachment + EmailRecord persisted | ✅ |
| No entity or lifecycle violations occur | ✅ |
| No Phase 1–6 locks are broken | ✅ |
| All logic is output-only and deterministic | ✅ |
| PricingVisibility is runtime-only | ✅ |
| Email send does not trigger state transition | ✅ |

---

## 8. KNOWN LIMITATIONS (v1)

1. **PDF Quality**: Minimal text-based PDF (no styling)
2. **Email**: Stub only (no real SMTP)
3. **Storage**: Local filesystem only (no S3)
4. **Pricing Visibility**: Not recoverable from PDFRecord

---

**Sprint 4 is COMPLETE.**

---

**Signed:** Architecture Implementation  
**Date:** 2026-01-23
