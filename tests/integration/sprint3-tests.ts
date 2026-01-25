/**
 * Sprint 3 Integration Tests
 * 
 * Tests proving:
 * 1. Draft → Calculate → Version created
 * 2. Send blocked without version
 * 3. Edit after send → requires revert to DRAFT
 * 4. Invalid transitions blocked
 * 5. Multi-leg + IRT ID resolution
 * 6. QuotePricingSummary shape integrity
 * 7. Version immutability
 */

import type { EntityId, DateString, MoneyAmount, Child } from '../../src/core/types';
import { QuoteStatus } from '../../src/core/types';

import type { Quote, QuoteVersion } from '../../src/core/entities';

import {
  QuoteService,
  createQuoteService,
  QuoteServiceError,
  CalculationService,
  createCalculationService,
  CalculationServiceError,
  validateTransition,
  canSend,
  canEdit,
  isTerminalState,
  StateTransitionError,
} from '../../src/services';

import { createJsonDataContext } from '../../src/data/repositories/json-repository';
import type { DataContext } from '../../src/data/repositories/interfaces';
import { loadDataStore, type DataStore } from '../../src/core/calculation';

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// TEST UTILITIES
// ============================================================

interface TestContext {
  dataContext: DataContext;
  quoteService: QuoteService;
  calculationService: CalculationService;
  referenceData: DataStore;
}

async function setupTestContext(): Promise<TestContext> {
  // Load reference data
  const seedPath = path.join(__dirname, '../../src/data/seed/maldives.json');
  const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  const referenceData = loadDataStore(seedData);

  // Create fresh data context (in-memory, dataDir not used)
  const dataContext = createJsonDataContext('/tmp/test-data');

  // Create services
  const quoteService = createQuoteService(dataContext);
  const calculationService = createCalculationService(dataContext, referenceData);

  return { dataContext, quoteService, calculationService, referenceData };
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function logTest(name: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${name}`);
  console.log('='.repeat(60));
}

function logPass(message: string): void {
  console.log(`  ✅ ${message}`);
}

function logFail(message: string): void {
  console.log(`  ❌ ${message}`);
}

// ============================================================
// TEST 1: Quote CRUD Operations
// ============================================================

async function testQuoteCRUD(ctx: TestContext): Promise<void> {
  logTest('Quote CRUD Operations');

  // CREATE
  const createResult = await ctx.quoteService.create({
    client_name: 'John Smith',
    client_email: 'john@example.com',
    client_notes: 'VIP client',
    currency_code: 'USD',
    validity_days: 14,
  });

  assert(createResult.success, 'Quote creation should succeed');
  const quote = createResult.value;
  
  assert(quote.status === QuoteStatus.DRAFT, 'New quote should be DRAFT');
  assert(quote.current_version_id === null, 'New quote should have no version');
  assert(quote.client_name === 'John Smith', 'Client name should match');
  logPass('Quote created successfully in DRAFT status');

  // READ
  const readResult = await ctx.quoteService.getById(quote.id);
  assert(readResult.success, 'Quote read should succeed');
  assert(readResult.value.id === quote.id, 'Read quote should match created');
  logPass('Quote read successfully');

  // UPDATE
  const updateResult = await ctx.quoteService.update(quote.id, {
    client_name: 'John Smith Jr.',
    validity_days: 21,
  });
  assert(updateResult.success, 'Quote update should succeed');
  assert(updateResult.value.client_name === 'John Smith Jr.', 'Name should be updated');
  assert(updateResult.value.validity_days === 21, 'Validity should be updated');
  logPass('Quote updated successfully');

  // DELETE
  const deleteResult = await ctx.quoteService.delete(quote.id);
  assert(deleteResult.success, 'Quote delete should succeed');
  
  const afterDelete = await ctx.quoteService.getById(quote.id);
  assert(!afterDelete.success, 'Deleted quote should not be found');
  logPass('Quote deleted successfully');
}

// ============================================================
// TEST 2: Draft → Calculate → Version Created
// ============================================================

async function testDraftCalculateVersion(ctx: TestContext): Promise<void> {
  logTest('Draft → Calculate → Version Created');

  // Create quote
  const createResult = await ctx.quoteService.create({
    client_name: 'Test Client',
    currency_code: 'USD',
    validity_days: 14,
  });
  assert(createResult.success, 'Quote creation should succeed');
  const quote = createResult.value;

  // Verify no version exists
  const versionsBeforeResult = await ctx.quoteService.getVersions(quote.id);
  assert(versionsBeforeResult.success, 'Get versions should succeed');
  assert(versionsBeforeResult.value.length === 0, 'No versions should exist before calculation');
  logPass('Quote created with no version');

  // Calculate
  const calcResult = await ctx.calculationService.calculate({
    quote_id: quote.id,
    legs: [
      {
        resort_id: 'RST-001' as EntityId,
        room_type_id: 'RT-001' as EntityId,
        check_in_date: '2026-03-01',
        check_out_date: '2026-03-05',
        adults_count: 2,
        children: [],
        meal_plan_id: 'MP-002' as EntityId,
        transfer_type_id: 'TRN-001' as EntityId,
      },
    ],
  });

  assert(calcResult.success, `Calculation should succeed: ${calcResult.success ? '' : (calcResult.error as any)?.message}`);
  const version = calcResult.value;
  logPass('Calculation succeeded');

  // Verify version created
  assert(version.version_number === 1, 'First version should be number 1');
  assert(version.quote_id === quote.id, 'Version should reference quote');
  logPass('Version created with number 1');

  // Verify quote.current_version_id updated
  const updatedQuoteResult = await ctx.quoteService.getById(quote.id);
  assert(updatedQuoteResult.success, 'Get quote should succeed');
  assert(
    updatedQuoteResult.value.current_version_id === version.id,
    'Quote should reference new version'
  );
  logPass('Quote.current_version_id updated');

  // Verify version count
  const versionsAfterResult = await ctx.quoteService.getVersions(quote.id);
  assert(versionsAfterResult.success, 'Get versions should succeed');
  assert(versionsAfterResult.value.length === 1, 'One version should exist after calculation');
  logPass('Version count is 1');
}

// ============================================================
// TEST 3: Send Blocked Without Version
// ============================================================

async function testSendBlockedWithoutVersion(ctx: TestContext): Promise<void> {
  logTest('Send Blocked Without Version');

  // Create quote without calculating
  const createResult = await ctx.quoteService.create({
    client_name: 'No Version Client',
    currency_code: 'USD',
    validity_days: 14,
  });
  assert(createResult.success, 'Quote creation should succeed');
  const quote = createResult.value;

  // Attempt to send
  const sendResult = await ctx.quoteService.send(quote.id);
  assert(!sendResult.success, 'Send should fail without version');
  assert(
    sendResult.error.code === QuoteServiceError.MISSING_VERSION,
    'Error should be MISSING_VERSION'
  );
  logPass('Send correctly blocked without version');

  // Verify canSend returns false
  assert(!canSend(quote), 'canSend should return false without version');
  logPass('canSend correctly returns false');
}

// ============================================================
// TEST 4: State Machine Transitions
// ============================================================

async function testStateMachineTransitions(ctx: TestContext): Promise<void> {
  logTest('State Machine Transitions');

  // Create and calculate quote
  const createResult = await ctx.quoteService.create({
    client_name: 'State Test Client',
    currency_code: 'USD',
    validity_days: 14,
  });
  const quote = createResult.value;

  await ctx.calculationService.calculate({
    quote_id: quote.id,
    legs: [{
      resort_id: 'RST-001' as EntityId,
      room_type_id: 'RT-001' as EntityId,
      check_in_date: '2026-03-01',
      check_out_date: '2026-03-03',
      adults_count: 2,
      children: [],
    }],
  });

  // DRAFT → SENT (valid with version)
  const sendResult = await ctx.quoteService.send(quote.id);
  assert(sendResult.success, 'Send should succeed with version');
  assert(sendResult.value.status === QuoteStatus.SENT, 'Status should be SENT');
  logPass('DRAFT → SENT succeeded');

  // SENT → DRAFT (revert)
  const revertResult = await ctx.quoteService.revertToDraft(quote.id);
  assert(revertResult.success, 'Revert should succeed');
  assert(revertResult.value.status === QuoteStatus.DRAFT, 'Status should be DRAFT');
  logPass('SENT → DRAFT succeeded');

  // Re-send for terminal state tests
  await ctx.quoteService.send(quote.id);

  // SENT → CONVERTED (terminal)
  const convertResult = await ctx.quoteService.markConverted(quote.id);
  assert(convertResult.success, 'Convert should succeed');
  assert(convertResult.value.status === QuoteStatus.CONVERTED, 'Status should be CONVERTED');
  logPass('SENT → CONVERTED succeeded');

  // CONVERTED is terminal - no transitions allowed
  assert(isTerminalState(QuoteStatus.CONVERTED), 'CONVERTED should be terminal');
  
  const revertFromConvertedResult = await ctx.quoteService.revertToDraft(quote.id);
  assert(!revertFromConvertedResult.success, 'Revert from CONVERTED should fail');
  logPass('CONVERTED correctly blocks all transitions');
}

// ============================================================
// TEST 5: Invalid Transitions Blocked
// ============================================================

async function testInvalidTransitionsBlocked(ctx: TestContext): Promise<void> {
  logTest('Invalid Transitions Blocked');

  // Create quote
  const createResult = await ctx.quoteService.create({
    client_name: 'Invalid Transition Client',
    currency_code: 'USD',
    validity_days: 14,
  });
  const quote = createResult.value;

  // DRAFT → CONVERTED (invalid - must go through SENT)
  const invalidResult = await ctx.quoteService.markConverted(quote.id);
  assert(!invalidResult.success, 'DRAFT → CONVERTED should fail');
  assert(
    invalidResult.error.code === QuoteServiceError.INVALID_STATE_TRANSITION,
    'Error should be INVALID_STATE_TRANSITION'
  );
  logPass('DRAFT → CONVERTED correctly blocked');

  // DRAFT → EXPIRED (invalid)
  const expireResult = await ctx.quoteService.markExpired(quote.id);
  assert(!expireResult.success, 'DRAFT → EXPIRED should fail');
  logPass('DRAFT → EXPIRED correctly blocked');

  // DRAFT → REJECTED (invalid)
  const rejectResult = await ctx.quoteService.markRejected(quote.id);
  assert(!rejectResult.success, 'DRAFT → REJECTED should fail');
  logPass('DRAFT → REJECTED correctly blocked');
}

// ============================================================
// TEST 6: Edit After Send Requires Revert
// ============================================================

async function testEditAfterSendRequiresRevert(ctx: TestContext): Promise<void> {
  logTest('Edit After Send Requires Revert');

  // Create, calculate, and send
  const createResult = await ctx.quoteService.create({
    client_name: 'Edit Test Client',
    currency_code: 'USD',
    validity_days: 14,
  });
  const quote = createResult.value;

  await ctx.calculationService.calculate({
    quote_id: quote.id,
    legs: [{
      resort_id: 'RST-001' as EntityId,
      room_type_id: 'RT-001' as EntityId,
      check_in_date: '2026-03-01',
      check_out_date: '2026-03-03',
      adults_count: 2,
      children: [],
    }],
  });

  await ctx.quoteService.send(quote.id);
  logPass('Quote sent');

  // Attempt edit while SENT
  const editResult = await ctx.quoteService.update(quote.id, {
    client_name: 'New Name',
  });
  assert(!editResult.success, 'Edit while SENT should fail');
  assert(
    editResult.error.code === QuoteServiceError.QUOTE_NOT_EDITABLE,
    'Error should be QUOTE_NOT_EDITABLE'
  );
  logPass('Edit while SENT correctly blocked');

  // Attempt calculation while SENT
  const calcResult = await ctx.calculationService.calculate({
    quote_id: quote.id,
    legs: [{
      resort_id: 'RST-001' as EntityId,
      room_type_id: 'RT-001' as EntityId,
      check_in_date: '2026-03-01',
      check_out_date: '2026-03-03',
      adults_count: 2,
      children: [],
    }],
  });
  assert(!calcResult.success, 'Calculation while SENT should fail');
  assert(
    calcResult.error.code === CalculationServiceError.QUOTE_NOT_EDITABLE,
    'Error should be QUOTE_NOT_EDITABLE'
  );
  logPass('Calculation while SENT correctly blocked');

  // Revert to DRAFT
  await ctx.quoteService.revertToDraft(quote.id);

  // Now edit should work
  const editAfterRevert = await ctx.quoteService.update(quote.id, {
    client_name: 'New Name After Revert',
  });
  assert(editAfterRevert.success, 'Edit after revert should succeed');
  logPass('Edit after revert to DRAFT succeeded');
}

// ============================================================
// TEST 7: Multi-Leg + IRT ID Resolution
// ============================================================

async function testMultiLegIRTResolution(ctx: TestContext): Promise<void> {
  logTest('Multi-Leg + IRT ID Resolution');

  // Create quote
  const createResult = await ctx.quoteService.create({
    client_name: 'Multi-Leg Client',
    currency_code: 'USD',
    validity_days: 14,
  });
  const quote = createResult.value;

  // Calculate with 2 legs and IRT
  const calcResult = await ctx.calculationService.calculate({
    quote_id: quote.id,
    legs: [
      {
        resort_id: 'RST-001' as EntityId,
        room_type_id: 'RT-001' as EntityId,
        check_in_date: '2026-03-01',
        check_out_date: '2026-03-05',
        adults_count: 2,
        children: [],
        meal_plan_id: 'MP-002' as EntityId,
        transfer_type_id: 'TRN-001' as EntityId,
      },
      {
        resort_id: 'RST-002' as EntityId,
        room_type_id: 'RT-003' as EntityId,
        check_in_date: '2026-03-05',
        check_out_date: '2026-03-08',
        adults_count: 2,
        children: [],
        meal_plan_id: 'MP-004' as EntityId,
        transfer_type_id: 'TRN-003' as EntityId,
      },
    ],
    inter_resort_transfers: [
      {
        transfer_description: 'Seaplane Resort 1 to Resort 2',
        cost_amount: 800 as MoneyAmount,
        currency_code: 'USD',
      },
    ],
  });

  assert(calcResult.success, `Multi-leg calculation should succeed: ${calcResult.success ? '' : (calcResult.error as any)?.message}`);
  const version = calcResult.value;
  logPass('Multi-leg calculation succeeded');

  // Verify 2 legs created with IDs
  assert(version.legs.length === 2, 'Should have 2 legs');
  assert(version.legs[0].sequence === 1, 'First leg sequence should be 1');
  assert(version.legs[1].sequence === 2, 'Second leg sequence should be 2');
  
  const leg1Id = version.legs[0].id;
  const leg2Id = version.legs[1].id;
  assert(leg1Id.startsWith('QL-'), 'Leg 1 ID should start with QL-');
  assert(leg2Id.startsWith('QL-'), 'Leg 2 ID should start with QL-');
  assert(leg1Id !== leg2Id, 'Leg IDs should be unique');
  logPass('Legs created with unique IDs');

  // Verify IRT uses leg IDs (not indexes)
  assert(version.inter_resort_transfers.length === 1, 'Should have 1 IRT');
  const irt = version.inter_resort_transfers[0];
  
  assert(irt.from_leg_id === leg1Id, 'IRT from_leg_id should match leg 1 ID');
  assert(irt.to_leg_id === leg2Id, 'IRT to_leg_id should match leg 2 ID');
  assert(irt.markup_source === 'DESTINATION_RESORT', 'IRT markup should be from destination');
  logPass('IRT correctly uses leg IDs (not indexes)');
}

// ============================================================
// TEST 8: QuotePricingSummary Shape Integrity
// ============================================================

async function testPricingSummaryShape(ctx: TestContext): Promise<void> {
  logTest('QuotePricingSummary Shape Integrity');

  // Create and calculate
  const createResult = await ctx.quoteService.create({
    client_name: 'Summary Test Client',
    currency_code: 'USD',
    validity_days: 14,
  });
  const quote = createResult.value;

  const calcResult = await ctx.calculationService.calculate({
    quote_id: quote.id,
    legs: [{
      resort_id: 'RST-001' as EntityId,
      room_type_id: 'RT-001' as EntityId,
      check_in_date: '2026-03-01',
      check_out_date: '2026-03-05',
      adults_count: 2,
      children: [{ age: 8 }],
      meal_plan_id: 'MP-002' as EntityId,
      transfer_type_id: 'TRN-001' as EntityId,
    }],
  });

  assert(calcResult.success, 'Calculation should succeed');
  const version = calcResult.value;
  const summary = version.pricing_summary;

  // Verify canonical structure exists
  assert(Array.isArray(summary.leg_summaries), 'leg_summaries should be array');
  assert(summary.inter_resort_transfer_total !== undefined, 'inter_resort_transfer_total should exist');
  assert(summary.quote_totals !== undefined, 'quote_totals should exist');
  assert(summary.taxes_breakdown !== undefined, 'taxes_breakdown should exist');
  logPass('Canonical structure present');

  // Verify leg_summaries
  assert(summary.leg_summaries.length === 1, 'Should have 1 leg summary');
  const legSummary = summary.leg_summaries[0];
  assert(legSummary.leg_id !== undefined, 'leg_id should exist');
  assert(legSummary.resort_name !== undefined, 'resort_name should exist');
  assert(legSummary.nights === 4, 'nights should be 4');
  assert(typeof legSummary.pre_tax_cost === 'number', 'pre_tax_cost should be number');
  assert(typeof legSummary.tax_cost === 'number', 'tax_cost should be number');
  logPass('leg_summaries shape correct');

  // Verify quote_totals
  const totals = summary.quote_totals;
  assert(typeof totals.total_cost === 'number', 'total_cost should be number');
  assert(typeof totals.line_item_markup_total === 'number', 'line_item_markup_total should be number');
  assert(typeof totals.quote_level_fixed_markup === 'number', 'quote_level_fixed_markup should be number');
  assert(typeof totals.total_markup === 'number', 'total_markup should be number');
  assert(typeof totals.total_sell === 'number', 'total_sell should be number');
  assert(typeof totals.markup_percentage === 'number', 'markup_percentage should be number');
  assert(typeof totals.margin_percentage === 'number', 'margin_percentage should be number');
  logPass('quote_totals shape correct');

  // Verify taxes_breakdown uses canonical field names
  const taxes = summary.taxes_breakdown;
  assert(typeof taxes.green_tax_total === 'number', 'green_tax_total should be number');
  assert(typeof taxes.service_charge_total === 'number', 'service_charge_total should be number');
  assert(typeof taxes.gst_total === 'number', 'gst_total should be number');
  assert(typeof taxes.total_taxes === 'number', 'total_taxes should be number');
  logPass('taxes_breakdown shape correct with canonical field names');
}

// ============================================================
// TEST 9: Version Immutability (Multiple Calculations)
// ============================================================

async function testVersionImmutability(ctx: TestContext): Promise<void> {
  logTest('Version Immutability (Multiple Calculations)');

  // Create quote
  const createResult = await ctx.quoteService.create({
    client_name: 'Version Test Client',
    currency_code: 'USD',
    validity_days: 14,
  });
  const quote = createResult.value;

  // First calculation
  const calc1Result = await ctx.calculationService.calculate({
    quote_id: quote.id,
    legs: [{
      resort_id: 'RST-001' as EntityId,
      room_type_id: 'RT-001' as EntityId,
      check_in_date: '2026-03-01',
      check_out_date: '2026-03-03',
      adults_count: 2,
      children: [],
    }],
  });
  assert(calc1Result.success, 'First calculation should succeed');
  const version1 = calc1Result.value;
  logPass('Version 1 created');

  // Second calculation (different dates = different price)
  const calc2Result = await ctx.calculationService.calculate({
    quote_id: quote.id,
    legs: [{
      resort_id: 'RST-001' as EntityId,
      room_type_id: 'RT-001' as EntityId,
      check_in_date: '2026-03-01',
      check_out_date: '2026-03-05',
      adults_count: 2,
      children: [],
    }],
  });
  assert(calc2Result.success, 'Second calculation should succeed');
  const version2 = calc2Result.value;
  logPass('Version 2 created');

  // Verify versions are distinct
  assert(version1.id !== version2.id, 'Version IDs should differ');
  assert(version1.version_number === 1, 'Version 1 number should be 1');
  assert(version2.version_number === 2, 'Version 2 number should be 2');
  logPass('Versions have distinct IDs and numbers');

  // Verify both versions still exist
  const allVersionsResult = await ctx.quoteService.getVersions(quote.id);
  assert(allVersionsResult.success, 'Get versions should succeed');
  assert(allVersionsResult.value.length === 2, 'Should have 2 versions');
  logPass('Both versions preserved');

  // Verify version 1 is unchanged (immutable)
  const version1Retrieved = await ctx.quoteService.getVersion(version1.id);
  assert(version1Retrieved.success, 'Get version 1 should succeed');
  assert(
    version1Retrieved.value.legs[0].nights === 2,
    'Version 1 should still have 2 nights (unchanged)'
  );
  logPass('Version 1 is immutable');

  // Verify quote points to latest
  const quoteAfter = await ctx.quoteService.getById(quote.id);
  assert(quoteAfter.success, 'Get quote should succeed');
  assert(
    quoteAfter.value.current_version_id === version2.id,
    'Quote should point to version 2'
  );
  logPass('Quote.current_version_id points to latest version');
}

// ============================================================
// TEST 10: Validation Result and Audit Structure
// ============================================================

async function testValidationAndAuditStructure(ctx: TestContext): Promise<void> {
  logTest('Validation Result and Audit Structure');

  // Create and calculate
  const createResult = await ctx.quoteService.create({
    client_name: 'Audit Test Client',
    currency_code: 'USD',
    validity_days: 14,
  });
  const quote = createResult.value;

  const calcResult = await ctx.calculationService.calculate({
    quote_id: quote.id,
    legs: [{
      resort_id: 'RST-001' as EntityId,
      room_type_id: 'RT-001' as EntityId,
      check_in_date: '2026-03-01',
      check_out_date: '2026-03-03',
      adults_count: 2,
      children: [],
    }],
  });

  assert(calcResult.success, 'Calculation should succeed');
  const version = calcResult.value;

  // Verify validation_result canonical structure
  const validation = version.validation_result;
  assert(validation.quote_version_id === version.id, 'quote_version_id should match');
  assert(typeof validation.is_valid === 'boolean', 'is_valid should be boolean');
  assert(typeof validation.can_proceed === 'boolean', 'can_proceed should be boolean');
  assert(Array.isArray(validation.blocking_errors), 'blocking_errors should be array');
  assert(Array.isArray(validation.warnings), 'warnings should be array');
  assert(validation.validated_at !== undefined, 'validated_at should exist');
  logPass('validation_result canonical structure verified');

  // Verify calculation_audit canonical structure
  const audit = version.calculation_audit;
  assert(audit.quote_version_id === version.id, 'quote_version_id should match');
  assert(audit.calculated_at !== undefined, 'calculated_at should exist');
  assert(Array.isArray(audit.calculation_steps), 'calculation_steps should be array');
  assert(Array.isArray(audit.warnings), 'warnings should be array');
  logPass('calculation_audit canonical structure verified');

  // Verify calculation_steps have required fields
  if (audit.calculation_steps.length > 0) {
    const step = audit.calculation_steps[0];
    assert(typeof step.step_number === 'number', 'step_number should be number');
    assert(step.step_type !== undefined, 'step_type should exist');
    assert(step.timestamp !== undefined, 'timestamp should exist');
    assert(step.description !== undefined, 'description should exist');
    logPass('calculation_steps have required fields');
  }
}

// ============================================================
// MAIN TEST RUNNER
// ============================================================

async function runAllTests(): Promise<void> {
  console.log('\n' + '█'.repeat(60));
  console.log('SPRINT 3 INTEGRATION TESTS');
  console.log('█'.repeat(60));

  const ctx = await setupTestContext();

  const tests = [
    testQuoteCRUD,
    testDraftCalculateVersion,
    testSendBlockedWithoutVersion,
    testStateMachineTransitions,
    testInvalidTransitionsBlocked,
    testEditAfterSendRequiresRevert,
    testMultiLegIRTResolution,
    testPricingSummaryShape,
    testVersionImmutability,
    testValidationAndAuditStructure,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    // Create fresh context for each test
    const testCtx = await setupTestContext();
    try {
      await test(testCtx);
      passed++;
    } catch (error) {
      failed++;
      console.error(`\n  ❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log('\n' + '█'.repeat(60));
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('█'.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

// Export for test runner
export { runAllTests };

// Run if executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}
