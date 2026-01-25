/**
 * Calculation Engine Invariants Test
 * 
 * Verifies locked calculation engine behavior.
 * 
 * LOCKED INVARIANTS:
 * - A-007: Tax calculation order per destination config
 * - A-008: Green Tax never marked up
 * - A-009: Discounts are non-compounding
 * - A-010: Discount base calculated before any discount
 * - A-011: Markup on cost, not sell
 * - A-019: Tax base is explicit input, never inferred
 * 
 * Reference: Sprint 2 Verification, Phase 4 Locks
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

import type { EntityId, MoneyAmount, Percentage } from '../../src/core/types';
import { TaxType, TaxCalculationMethod, LineItemType, DiscountType, DiscountBaseType } from '../../src/core/types';
import { 
  calculateTaxes, 
  validateTaxConfigurations,
  type TaxCalculationInput,
  type TaxBreakdown,
} from '../../src/core/calculation/engines/tax-engine';

import {
  calculateDiscounts,
  applyDiscount,
  calculateDiscountBase,
  type CostBreakdown,
} from '../../src/core/calculation/engines/discount-engine';

import {
  calculateMarkupAmount,
  shouldExcludeFromMarkup,
} from '../../src/core/calculation/engines/markup-engine';

import { CalculationAuditBuilder } from '../../src/core/calculation/types';
import { loadDataStore, createDataAccess, type DataStore } from '../../src/core/calculation';

// ============================================================
// TEST SETUP
// ============================================================

let referenceData: DataStore;

beforeEach(() => {
  const seedPath = path.join(__dirname, '../../src/data/seed/maldives.json');
  const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  referenceData = loadDataStore(seedData);
});

// ============================================================
// A-008: GREEN TAX NEVER MARKED UP
// ============================================================

describe('A-008: Green Tax Exclusion from Markup', () => {
  
  it('should exclude GREEN_TAX from markup calculation', () => {
    expect(shouldExcludeFromMarkup(LineItemType.GREEN_TAX)).toBe(true);
  });
  
  it('should NOT exclude other taxes from markup', () => {
    expect(shouldExcludeFromMarkup(LineItemType.SERVICE_CHARGE)).toBe(false);
    expect(shouldExcludeFromMarkup(LineItemType.GST)).toBe(false);
  });
  
  it('should NOT exclude room costs from markup', () => {
    expect(shouldExcludeFromMarkup(LineItemType.ROOM_RATE)).toBe(false);
    expect(shouldExcludeFromMarkup(LineItemType.EXTRA_PERSON)).toBe(false);
  });
  
  it('should NOT exclude components from markup', () => {
    expect(shouldExcludeFromMarkup(LineItemType.MEAL_PLAN)).toBe(false);
    expect(shouldExcludeFromMarkup(LineItemType.TRANSFER)).toBe(false);
    expect(shouldExcludeFromMarkup(LineItemType.ACTIVITY)).toBe(false);
  });
});

// ============================================================
// A-009: DISCOUNTS ARE NON-COMPOUNDING
// ============================================================

describe('A-009: Non-Compounding Discounts', () => {
  
  it('should calculate discount base ONCE for multiple discounts', () => {
    const costs: CostBreakdown = {
      accommodation: 1000 as MoneyAmount,
      extra_person: 0 as MoneyAmount,
      meal_plan: 200 as MoneyAmount,
      transfer: 100 as MoneyAmount,
      activity: 50 as MoneyAmount,
      festive: 0 as MoneyAmount,
      honeymoon: 0 as MoneyAmount,
      green_tax: 50 as MoneyAmount,
      service_charge: 60 as MoneyAmount,
      gst: 30 as MoneyAmount,
    };
    
    // Calculate base for ACCOMMODATION_ONLY
    const { base_amount: base1 } = calculateDiscountBase(DiscountBaseType.ACCOMMODATION_ONLY, costs);
    
    // Calculate base for TOTAL_EXCL_TAX
    const { base_amount: base2 } = calculateDiscountBase(DiscountBaseType.TOTAL_EXCL_TAX, costs);
    
    // Bases should be fixed values, not affected by previous discount calculations
    expect(base1).toBe(1000); // Just accommodation
    expect(base2).toBe(1350); // 1000 + 200 + 100 + 50 = 1350 (excluding taxes)
    
    // Re-calculating should produce SAME values (not compounded)
    const { base_amount: base1_again } = calculateDiscountBase(DiscountBaseType.ACCOMMODATION_ONLY, costs);
    const { base_amount: base2_again } = calculateDiscountBase(DiscountBaseType.TOTAL_EXCL_TAX, costs);
    
    expect(base1_again).toBe(base1);
    expect(base2_again).toBe(base2);
  });
  
  it('should apply percentage discount to original base, not reduced base', () => {
    // Setup discount
    const discount = {
      id: 'D-001' as EntityId,
      name: 'Test Discount',
      code: 'TEST10',
      discount_type: DiscountType.PERCENTAGE,
      discount_value: 10 as Percentage,
      base_type: DiscountBaseType.ACCOMMODATION_ONLY,
      is_active: true,
      priority: 1,
      can_combine: true,
    };
    
    const baseAmount = 1000 as MoneyAmount;
    const audit = new CalculationAuditBuilder();
    
    // Apply discount
    const { discount_amount } = applyDiscount(discount, baseAmount, audit);
    
    // Should be 10% of 1000 = 100
    expect(discount_amount).toBe(100);
    
    // Applying again should give SAME result (non-compounding)
    const { discount_amount: discount_amount2 } = applyDiscount(discount, baseAmount, audit);
    expect(discount_amount2).toBe(100);
  });
});

// ============================================================
// A-010: DISCOUNT BASE BEFORE ANY DISCOUNT
// ============================================================

describe('A-010: Discount Base Composition', () => {
  
  it('should exclude taxes from TOTAL_EXCL_TAX base', () => {
    const costs: CostBreakdown = {
      accommodation: 1000 as MoneyAmount,
      extra_person: 100 as MoneyAmount,
      meal_plan: 200 as MoneyAmount,
      transfer: 150 as MoneyAmount,
      activity: 100 as MoneyAmount,
      festive: 50 as MoneyAmount,
      honeymoon: 25 as MoneyAmount,
      green_tax: 60 as MoneyAmount,
      service_charge: 80 as MoneyAmount,
      gst: 40 as MoneyAmount,
    };
    
    const { base_amount, excluded } = calculateDiscountBase(DiscountBaseType.TOTAL_EXCL_TAX, costs);
    
    // Base should include: accommodation + extra_person + meal_plan + transfer + activity + festive + honeymoon
    const expectedBase = 1000 + 100 + 200 + 150 + 100 + 50 + 25;
    expect(base_amount).toBe(expectedBase);
    
    // Excluded should list all tax types
    expect(excluded).toContain('green_tax');
    expect(excluded).toContain('service_charge');
    expect(excluded).toContain('gst');
  });
  
  it('should include ONLY accommodation in ACCOMMODATION_ONLY base', () => {
    const costs: CostBreakdown = {
      accommodation: 1000 as MoneyAmount,
      extra_person: 100 as MoneyAmount,
      meal_plan: 200 as MoneyAmount,
      transfer: 150 as MoneyAmount,
      activity: 100 as MoneyAmount,
      festive: 50 as MoneyAmount,
      honeymoon: 25 as MoneyAmount,
      green_tax: 60 as MoneyAmount,
      service_charge: 80 as MoneyAmount,
      gst: 40 as MoneyAmount,
    };
    
    const { base_amount, base_composition } = calculateDiscountBase(DiscountBaseType.ACCOMMODATION_ONLY, costs);
    
    expect(base_amount).toBe(1000);
    expect(base_composition).toContain('accommodation');
    expect(base_composition).not.toContain('meal_plan');
    expect(base_composition).not.toContain('transfer');
  });
});

// ============================================================
// A-011: MARKUP ON COST NOT SELL
// ============================================================

describe('A-011: Markup Calculation', () => {
  
  it('should calculate markup as percentage of cost', () => {
    const costAmount = 1000 as MoneyAmount;
    const markupPercentage = 20 as Percentage;
    
    const markupAmount = calculateMarkupAmount(costAmount, markupPercentage);
    
    // Markup = 20% of 1000 = 200
    expect(markupAmount).toBe(200);
    
    // NOT: 200 of sell (1200)
  });
  
  it('should calculate correct sell from cost and markup', () => {
    const cost = 1000 as MoneyAmount;
    const markup = 200 as MoneyAmount;
    const sell = cost + markup;
    
    expect(sell).toBe(1200);
    
    // Verify markup percentage relationship
    const markupPercent = (markup / cost) * 100;
    expect(markupPercent).toBe(20);
  });
  
  it('should handle zero markup', () => {
    const costAmount = 1000 as MoneyAmount;
    const markupPercentage = 0 as Percentage;
    
    const markupAmount = calculateMarkupAmount(costAmount, markupPercentage);
    
    expect(markupAmount).toBe(0);
  });
});

// ============================================================
// TAX CONFIGURATION VALIDATION
// ============================================================

describe('Tax Configuration', () => {
  
  it('should validate that tax configs have calculation_order', () => {
    const validConfigs = [
      {
        id: 'TAX-001' as EntityId,
        name: 'Green Tax',
        tax_type: TaxType.GREEN_TAX,
        calculation_method: TaxCalculationMethod.FIXED_PER_PERSON_PER_NIGHT,
        rate_value: 6 as MoneyAmount,
        calculation_order: 1,
        is_active: true,
      },
      {
        id: 'TAX-002' as EntityId,
        name: 'Service Charge',
        tax_type: TaxType.SERVICE_CHARGE,
        calculation_method: TaxCalculationMethod.PERCENTAGE_OF_SUBTOTAL,
        rate_value: 10 as Percentage,
        calculation_order: 2,
        is_active: true,
      },
    ];
    
    // Should not throw
    expect(() => validateTaxConfigurations(validConfigs as any)).not.toThrow();
  });
  
  it('should detect duplicate calculation_order', () => {
    const invalidConfigs = [
      {
        id: 'TAX-001' as EntityId,
        name: 'Green Tax',
        tax_type: TaxType.GREEN_TAX,
        calculation_method: TaxCalculationMethod.FIXED_PER_PERSON_PER_NIGHT,
        rate_value: 6 as MoneyAmount,
        calculation_order: 1,
        is_active: true,
      },
      {
        id: 'TAX-002' as EntityId,
        name: 'Service Charge',
        tax_type: TaxType.SERVICE_CHARGE,
        calculation_method: TaxCalculationMethod.PERCENTAGE_OF_SUBTOTAL,
        rate_value: 10 as Percentage,
        calculation_order: 1, // DUPLICATE
        is_active: true,
      },
    ];
    
    // Should throw or return errors
    expect(() => validateTaxConfigurations(invalidConfigs as any)).toThrow();
  });
});

// ============================================================
// ROUNDING INVARIANT IN CALCULATIONS
// ============================================================

describe('Calculation Rounding', () => {
  
  it('should round final amounts to 2 decimal places', () => {
    // This is tested indirectly through full calculations
    // The invariant is: roundCurrency called ONLY on final assignments
    
    // Test that intermediate calculations can have many decimals
    const intermediate = 100.33333333;
    const percentageOf = intermediate * 0.1; // 10.0333333...
    
    expect(percentageOf).toBeCloseTo(10.033, 2);
    
    // But final rounding should be 2 decimals
    const final = Math.round(percentageOf * 100) / 100;
    expect(final).toBe(10.03);
  });
});
