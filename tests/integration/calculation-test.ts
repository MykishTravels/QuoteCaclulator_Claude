/**
 * Calculation Engine Integration Test
 * 
 * Tests the calculation engine with Maldives seed data.
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  calculateQuote,
  createDataAccess,
  loadDataStore,
  type QuoteCalculationInput,
  type DataStore,
} from '../../src/core/calculation';

import type { DateString, EntityId } from '../../src/core/types';

// ============================================================
// LOAD SEED DATA
// ============================================================

function loadSeedData(): DataStore {
  const seedPath = path.join(__dirname, '../../src/data/seed/maldives.json');
  const rawData = fs.readFileSync(seedPath, 'utf-8');
  const seedData = JSON.parse(rawData);
  
  // Transform seed data to match DataStore shape
  return loadDataStore({
    currencies: seedData.currencies,
    resorts: seedData.resorts,
    childAgeBands: seedData.childAgeBands,
    roomTypes: seedData.roomTypes,
    seasons: seedData.seasons,
    rates: seedData.rates,
    extraPersonCharges: seedData.extraPersonCharges,
    mealPlans: seedData.mealPlans,
    transferTypes: seedData.transferTypes,
    activities: seedData.activities,
    taxConfigurations: seedData.taxConfigurations,
    festiveSupplements: seedData.festiveSupplements,
    discounts: seedData.discounts,
    markupConfigurations: seedData.markupConfigurations,
  });
}

// ============================================================
// TEST CASES
// ============================================================

/**
 * Test 1: Single resort, 2 adults, 4 nights, High Season
 * 
 * Expected breakdown:
 * - Room: 4 nights × $650 (Beach Villa High Season) = $2,600
 * - Meals: 2 adults × 4 nights × $120 (Half Board) = $960
 * - Transfer: 2 adults × $550 (Seaplane) = $1,100
 * - Pre-tax subtotal: $4,660
 * - Green Tax: 2 guests × 4 nights × $6 = $48
 * - Service Charge: 10% of $4,660 = $466
 * - GST: 16% of ($4,660 + $466) = $820.16
 * - Total Cost: $5,994.16
 * - Markup: 15% of $4,660 = $699
 * - Total Sell: ~$6,693.16
 */
function testSingleResortBasic() {
  console.log('\n=== TEST 1: Single Resort Basic (2 adults, 4 nights High Season) ===\n');
  
  const store = loadSeedData();
  const dataAccess = createDataAccess(store);
  
  const input: QuoteCalculationInput = {
    client_name: 'Test Client',
    currency_code: 'USD',
    validity_days: 14,
    legs: [
      {
        resort_id: 'RST-001' as EntityId, // Azure Paradise
        room_type_id: 'RT-001' as EntityId, // Beach Villa
        check_in_date: '2025-03-10' as DateString, // High Season
        check_out_date: '2025-03-14' as DateString, // 4 nights
        adults_count: 2,
        children: [],
        meal_plan_id: 'MP-002' as EntityId, // Half Board ($120/person/night)
        transfer_type_id: 'TT-001' as EntityId, // Seaplane ($550/person)
      },
    ],
  };
  
  const result = calculateQuote(input, dataAccess);
  
  console.log('Success:', result.success);
  console.log('Legs:', result.legs.length);
  
  if (result.legs.length > 0) {
    const leg = result.legs[0];
    console.log('\nLeg 1 Breakdown:');
    console.log('  Resort:', leg.resort.name);
    console.log('  Room:', leg.room_type.name);
    console.log('  Nights:', leg.nights);
    console.log('  Room Cost:', leg.room_cost.toFixed(2), '(expected: 2600.00)');
    console.log('  Extra Person Cost:', leg.extra_person_cost.toFixed(2));
    console.log('  Component Cost:', leg.component_cost.toFixed(2));
    console.log('  Pre-tax Subtotal:', leg.pre_tax_subtotal.toFixed(2), '(expected: ~4660.00)');
    console.log('  Total Discount:', leg.total_discount.toFixed(2));
    console.log('  Total Taxes:', leg.total_taxes.toFixed(2));
    console.log('  Total Cost:', leg.totals.cost_amount.toFixed(2));
    console.log('  Markup:', leg.totals.markup_amount.toFixed(2));
    console.log('  Sell:', leg.totals.sell_amount.toFixed(2));
  }
  
  console.log('\nQuote Totals:');
  console.log('  Total Cost:', result.totals.total_cost.toFixed(2));
  console.log('  Total Markup:', result.totals.total_markup.toFixed(2));
  console.log('  Total Sell:', result.totals.total_sell.toFixed(2));
  console.log('  Margin %:', result.totals.margin_percentage.toFixed(2) + '%');
  
  console.log('\nTaxes Breakdown:');
  console.log('  Green Tax:', result.taxes_breakdown.green_tax.toFixed(2), '(expected: 48.00)');
  console.log('  Service Charge:', result.taxes_breakdown.service_charge.toFixed(2));
  console.log('  GST:', result.taxes_breakdown.gst.toFixed(2));
  
  console.log('\nWarnings:', result.warnings.length);
  for (const w of result.warnings) {
    console.log('  -', w.code, ':', w.message);
  }
  
  console.log('\nAudit Steps:', result.audit_steps.length);
  
  return result;
}

/**
 * Test 2: Family with child (2 adults + 1 child age 8)
 * 
 * Child (age 8) falls into CAB-003 (Child 6-11)
 * Extra person charge: $75/night for child
 * Green Tax: 3 guests (all over age 2)
 */
function testWithChild() {
  console.log('\n=== TEST 2: Family with Child (2 adults + 1 child age 8) ===\n');
  
  const store = loadSeedData();
  const dataAccess = createDataAccess(store);
  
  const input: QuoteCalculationInput = {
    client_name: 'Thompson Family',
    currency_code: 'USD',
    validity_days: 14,
    legs: [
      {
        resort_id: 'RST-001' as EntityId,
        room_type_id: 'RT-001' as EntityId, // Beach Villa (base: 2 adults, 0 children)
        check_in_date: '2025-03-10' as DateString,
        check_out_date: '2025-03-14' as DateString, // 4 nights
        adults_count: 2,
        children: [{ age: 8, age_band_id: null }], // Will resolve to CAB-003
        meal_plan_id: 'MP-002' as EntityId, // Half Board
        transfer_type_id: 'TT-001' as EntityId, // Seaplane
      },
    ],
  };
  
  const result = calculateQuote(input, dataAccess);
  
  console.log('Success:', result.success);
  
  if (result.legs.length > 0) {
    const leg = result.legs[0];
    console.log('Room Cost:', leg.room_cost.toFixed(2), '(4 nights × $650 = $2,600)');
    console.log('Extra Person Cost:', leg.extra_person_cost.toFixed(2), '(expected: 4 × $75 = $300)');
    console.log('Component Cost:', leg.component_cost.toFixed(2), '(meals + transfer)');
    console.log('Pre-tax Subtotal:', leg.pre_tax_subtotal.toFixed(2));
    console.log('Total Sell:', result.totals.total_sell.toFixed(2));
    
    console.log('\nResolved Children:');
    for (const child of leg.resolved_children) {
      console.log(`  Age ${child.age}: ${child.age_band_name} (${child.age_band_id})`);
    }
  }
  
  console.log('\nGreen Tax:', result.taxes_breakdown.green_tax.toFixed(2), '(3 guests × 4 nights × $6 = $72)');
  
  return result;
}

/**
 * Test 3: Long stay discount (7 nights)
 * 
 * STAY7 discount: 10% off ROOM_ONLY base
 * Booking early enough for EARLY90 (15% off ROOM_ONLY) - but not stackable
 */
function testWithDiscount() {
  console.log('\n=== TEST 3: Long Stay Discount (7 nights, Low Season) ===\n');
  
  const store = loadSeedData();
  const dataAccess = createDataAccess(store);
  
  // 7 nights in Low Season (May-Oct)
  const input: QuoteCalculationInput = {
    client_name: 'Discount Test',
    currency_code: 'USD',
    validity_days: 14,
    booking_date: '2025-01-01' as DateString, // Book early for EARLY90
    legs: [
      {
        resort_id: 'RST-001' as EntityId,
        room_type_id: 'RT-001' as EntityId, // Beach Villa
        check_in_date: '2025-06-10' as DateString, // Low Season ($450/night)
        check_out_date: '2025-06-17' as DateString, // 7 nights
        adults_count: 2,
        children: [],
        discount_codes: ['STAY7'], // 10% off room only
      },
    ],
  };
  
  const result = calculateQuote(input, dataAccess);
  
  console.log('Success:', result.success);
  
  if (result.legs.length > 0) {
    const leg = result.legs[0];
    console.log('Room Cost (pre-discount):', leg.room_cost.toFixed(2), '(7 × $450 = $3,150)');
    console.log('Pre-tax Subtotal:', leg.pre_tax_subtotal.toFixed(2));
    console.log('Total Discount:', leg.total_discount.toFixed(2), '(expected: 10% of $3,150 = $315)');
    console.log('Post-discount Subtotal:', leg.post_discount_subtotal.toFixed(2));
    
    console.log('\nDiscounts Applied:');
    for (const d of leg.discounts) {
      console.log(`  ${d.discount_name}: $${d.discount_amount.toFixed(2)} (${d.base_type} base: $${d.base_amount.toFixed(2)})`);
    }
  }
  
  console.log('\nWarnings:', result.warnings.length);
  for (const w of result.warnings) {
    console.log('  -', w.code, ':', w.message);
  }
  
  return result;
}

/**
 * Test 4: Quote-level fixed markup (VIP pricing)
 * 
 * Replaces percentage markup with fixed $500
 */
function testQuoteLevelMarkup() {
  console.log('\n=== TEST 4: Quote-Level Fixed Markup ($500) ===\n');
  
  const store = loadSeedData();
  const dataAccess = createDataAccess(store);
  
  const input: QuoteCalculationInput = {
    client_name: 'VIP Client',
    currency_code: 'USD',
    validity_days: 14,
    legs: [
      {
        resort_id: 'RST-001' as EntityId,
        room_type_id: 'RT-001' as EntityId,
        check_in_date: '2025-03-10' as DateString,
        check_out_date: '2025-03-14' as DateString,
        adults_count: 2,
        children: [],
      },
    ],
    quote_level_markup: {
      markup_value: 500,
      override_reason: 'VIP negotiated rate',
    },
  };
  
  const result = calculateQuote(input, dataAccess);
  
  console.log('Success:', result.success);
  
  if (result.legs.length > 0) {
    const leg = result.legs[0];
    console.log('Line Item Markup:', leg.totals.markup_amount.toFixed(2), '(should be 0 when quote-level used)');
  }
  
  console.log('Quote Level Markup:', result.quote_level_markup?.markup_value);
  console.log('Total Cost:', result.totals.total_cost.toFixed(2));
  console.log('Total Markup:', result.totals.total_markup.toFixed(2), '(should be 500)');
  console.log('Total Sell:', result.totals.total_sell.toFixed(2));
  
  return result;
}

// ============================================================
// RUN TESTS
// ============================================================

function runAllTests() {
  console.log('========================================');
  console.log('  CALCULATION ENGINE INTEGRATION TESTS');
  console.log('========================================');
  
  try {
    testSingleResortBasic();
    testWithChild();
    testWithDiscount();
    testQuoteLevelMarkup();
    
    console.log('\n========================================');
    console.log('  ALL TESTS COMPLETED');
    console.log('========================================\n');
  } catch (error) {
    console.error('\nTEST FAILED:', error);
    process.exit(1);
  }
}

// Run if executed directly
runAllTests();
