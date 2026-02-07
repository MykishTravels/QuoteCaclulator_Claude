# Mykish Quote System — Governance & Architecture (LOCKED)

⚠️ This document is a HARD GOVERNANCE CONTRACT.
⚠️ It must be read before any code is written.
⚠️ It must not be changed without explicit owner approval.

---

## 1. Platform Type
- SaaS-ready
- Multi-tenant
- Shared infrastructure
- Shared codebase
- Data isolation via `tenant_id` (mandatory)

---

## 2. Tenant Isolation (LOCKED)
- `tenant_id` exists on ALL tables
- Every query MUST filter by `tenant_id`
- No cross-tenant joins
- No shared data between tenants

### Tenant Resolution Order (MANDATORY)
1. Subdomain (primary)
   - `{tenant}.quotes.mykish.travel`
2. `X-Tenant-ID` header (fallback)
3. BLOCK request if neither present

### Failure Modes
- Missing tenant → `400 TENANT_REQUIRED`
- Invalid/inactive tenant → `403 TENANT_INVALID`

---

## 3. Pricing Logic Ownership (LOCKED — NON-NEGOTIABLE)

### PLATFORM-OWNED (IMMUTABLE)
- Calculation formulas
- Calculation order
- Tax compounding rules
- Markup application method
- Discount application rules
- Rounding behaviour

### TENANT-CONFIGURABLE (INPUTS ONLY)
- Rate amounts (room, season)
- Tax percentages and types
- Markup percentages
- Discount values and conditions
- Festive supplement amounts
- Extra person charges
- Enable/disable optional components

### FORBIDDEN
- No tenant-level pricing logic
- No custom formulas
- No calculation order changes
- No pricing templates (Option B) in MVP

### FUTURE-READY (NOT ACTIVE)
- Schema may support templates
- Templates require explicit future approval

---

## 4. Database Rules (LOCKED)
- PostgreSQL **15.x only**
- AWS RDS
- No direct DB edits (no console, no clients)
- Migrations ONLY
- Migration tool: `node-pg-migrate`
- All migrations:
  - Git-tracked
  - Reversible
  - Reviewed

---

## 5. UI & API Rules
- Backend is the single source of truth
- UI NEVER calculates pricing
- API blocks unresolved tenant requests
- Auth required for ALL APIs except:
  - Login
  - Password reset

---

## 6. Branding Rules
- 100% database-driven branding
- ZERO hardcoded branding
- Tenant settings control:
  - Logo
  - Primary / secondary colors
  - Company name
  - Contact details
  - Terms & conditions
  - PDF template configuration
  - Email template configuration

---

## 7. Hosting & Code Access
- Tenants NEVER see source code
- Repository remains private
- Single infra by default
- Optional future: isolated tenant deployment (BYO hosting)

---

## 8. Execution Discipline
- No phase skipping
- No assumptions
- Stop and ask if unclear
- Execution must follow approved phase scope ONLY
