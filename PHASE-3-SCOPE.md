# Phase 3 — Branding & PDF Engine (Execution Contract)

This document defines EXACTLY what Phase 3 is allowed to do.
Anything not listed here is OUT OF SCOPE.

---

## Phase Objective
Enable tenant-specific branding and professional PDF generation,
without altering pricing logic, authentication, or admin workflows.

---

## IN SCOPE (APPROVED)

### 1. Tenant Branding System (Database-Driven)
- Read branding from `tenant_settings`
- Fields include:
  - company_name
  - logo_url
  - primary_color
  - secondary_color
  - contact details
  - terms_conditions
- NO hardcoded branding values
- NO environment-based branding

---

### 2. PDF Generation Engine
- Generate professional PDFs per quote version
- PDFs must include:
  - Tenant logo
  - Tenant colors
  - Quote number
  - Client details
  - Itinerary (legs)
  - Pricing summary (from backend data only)
  - Terms & conditions footer
- PDFs are generated server-side
- Store PDF metadata in `pdf_records`

---

### 3. Email Template Structure (NO SENDING)
- Define email template structure only
- Variables allowed:
  - client_name
  - quote_number
  - total_price
  - expiry_date
- NO SMTP
- NO email delivery
- NO user triggers

---

## EXPLICITLY OUT OF SCOPE (DO NOT TOUCH)

- Authentication or users
- Admin UI
- Pricing logic or formulas
- Calculation order
- Discounts, markups, taxes
- Frontend changes
- Data import tooling
- Multi-template pricing logic (Option B)
- Tenant signup flows

---

## EXECUTION RULES

- Backend is the single source of truth
- UI (if referenced) only displays returned values
- Pricing values are read-only inputs to PDFs
- Stop and ask if any requirement is unclear
- No assumptions allowed

---

## EXIT CRITERIA

Phase 3 is complete when:
- A branded PDF can be generated for tenant `mykish`
- Branding comes ONLY from the database
- No governance rules are violated
