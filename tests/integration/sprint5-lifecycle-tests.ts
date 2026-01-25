/**
 * Sprint 5 Lifecycle Actions Integration Test
 * 
 * Verifies lifecycle actions work correctly:
 * - Actions use AvailableActions as sole source of truth
 * - No optimistic updates
 * - Backend confirms all transitions
 * - Quote status updates correctly
 * 
 * GUARDRAILS VERIFIED:
 * - UI never infers transitions
 * - Lifecycle buttons call backend explicitly
 * - QuoteVersion remains immutable
 * - All transitions confirmed by backend response
 */

import * as fs from 'fs';
import * as path from 'path';

import { QuoteStatus, type EntityId } from '../../src/core/types';
import {
  initializeApp,
  getApiClient,
  type AppContext,
} from '../../src/ui';

import {
  createQuoteService,
  createCalculationService,
} from '../../src/services';

import { loadDataStore } from '../../src/core/calculation';

// ============================================================
// TEST SETUP
// ============================================================

let appContext: AppContext;

async function setup(): Promise<void> {
  const seedPath = path.join(__dirname, '../../src/data/seed/maldives.json');
  const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  const referenceData = loadDataStore(seedData);
  
  appContext = initializeApp({
    dataPath: '/tmp/sprint5-test-data',
    pdfStoragePath: '/tmp/sprint5-test-pdfs',
    referenceData,
  });
}

async function createTestQuoteWithVersion(): Promise<{
  quoteId: EntityId;
  versionId: EntityId;
}> {
  const quoteService = createQuoteService(appContext.dataContext);
  const calcService = createCalculationService(appContext.dataContext, appContext.referenceData);
  
  const createResult = await quoteService.create({
    client_name: 'Lifecycle Test Client',
    client_email: 'lifecycle@example.com',
    currency_code: 'USD',
    validity_days: 14,
  });
  
  if (!createResult.success) {
    throw new Error(`Failed to create quote: ${createResult.error.message}`);
  }
  
  const quote = createResult.value;
  
  const calcResult = await calcService.calculate({
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
  
  if (!calcResult.success) {
    throw new Error(`Failed to calculate: ${calcResult.error.message}`);
  }
  
  return {
    quoteId: quote.id,
    versionId: calcResult.value.id,
  };
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

// ============================================================
// TEST 1: SEND ACTION (DRAFT → SENT)
// ============================================================

async function testSendAction(): Promise<void> {
  logTest('SEND Action (DRAFT → SENT)');
  
  const { quoteId } = await createTestQuoteWithVersion();
  const api = getApiClient();
  
  // Verify initial state
  let detail = await api.getQuoteDetail(quoteId);
  assert(detail.quote.status === QuoteStatus.DRAFT, 'Initial status should be DRAFT');
  assert(detail.actions.can_send === true, 'can_send should be true for DRAFT with version');
  logPass('Initial state verified: DRAFT with can_send=true');
  
  // Execute SEND action
  const updatedQuote = await api.sendQuote(quoteId);
  
  // Verify backend confirmed transition
  assert(updatedQuote.status === QuoteStatus.SENT, 'Status should be SENT after action');
  logPass('Backend confirmed transition to SENT');
  
  // Refresh and verify available actions changed
  detail = await api.getQuoteDetail(quoteId);
  assert(detail.actions.can_send === false, 'can_send should be false after SENT');
  assert(detail.actions.can_convert === true, 'can_convert should be true for SENT');
  assert(detail.actions.can_reject === true, 'can_reject should be true for SENT');
  assert(detail.actions.can_expire === true, 'can_expire should be true for SENT');
  assert(detail.actions.can_revert_to_draft === true, 'can_revert_to_draft should be true for SENT');
  logPass('Available actions updated correctly');
}

// ============================================================
// TEST 2: REVERT ACTION (SENT → DRAFT)
// ============================================================

async function testRevertAction(): Promise<void> {
  logTest('REVERT Action (SENT → DRAFT)');
  
  const { quoteId } = await createTestQuoteWithVersion();
  const api = getApiClient();
  
  // Send quote first
  await api.sendQuote(quoteId);
  
  let detail = await api.getQuoteDetail(quoteId);
  assert(detail.quote.status === QuoteStatus.SENT, 'Status should be SENT');
  assert(detail.actions.can_revert_to_draft === true, 'can_revert_to_draft should be true');
  logPass('Precondition: Quote is SENT');
  
  // Execute REVERT action
  const updatedQuote = await api.revertQuote(quoteId);
  
  assert(updatedQuote.status === QuoteStatus.DRAFT, 'Status should be DRAFT after revert');
  logPass('Backend confirmed transition to DRAFT');
  
  // Verify actions updated
  detail = await api.getQuoteDetail(quoteId);
  assert(detail.actions.can_send === true, 'can_send should be true after revert');
  logPass('Available actions updated correctly');
}

// ============================================================
// TEST 3: CONVERT ACTION (SENT → CONVERTED) - TERMINAL
// ============================================================

async function testConvertAction(): Promise<void> {
  logTest('CONVERT Action (SENT → CONVERTED) - Terminal');
  
  const { quoteId } = await createTestQuoteWithVersion();
  const api = getApiClient();
  
  // Send quote first
  await api.sendQuote(quoteId);
  
  let detail = await api.getQuoteDetail(quoteId);
  assert(detail.actions.can_convert === true, 'can_convert should be true for SENT');
  logPass('Precondition: Quote is SENT with can_convert=true');
  
  // Execute CONVERT action
  const updatedQuote = await api.convertQuote(quoteId);
  
  assert(updatedQuote.status === QuoteStatus.CONVERTED, 'Status should be CONVERTED');
  logPass('Backend confirmed transition to CONVERTED');
  
  // Verify terminal state - no actions available
  detail = await api.getQuoteDetail(quoteId);
  assert(detail.actions.can_send === false, 'can_send should be false');
  assert(detail.actions.can_convert === false, 'can_convert should be false');
  assert(detail.actions.can_reject === false, 'can_reject should be false');
  assert(detail.actions.can_expire === false, 'can_expire should be false');
  assert(detail.actions.can_revert_to_draft === false, 'can_revert_to_draft should be false');
  logPass('CONVERTED is terminal state - no actions available');
}

// ============================================================
// TEST 4: REJECT ACTION (SENT → REJECTED)
// ============================================================

async function testRejectAction(): Promise<void> {
  logTest('REJECT Action (SENT → REJECTED)');
  
  const { quoteId } = await createTestQuoteWithVersion();
  const api = getApiClient();
  
  await api.sendQuote(quoteId);
  
  let detail = await api.getQuoteDetail(quoteId);
  assert(detail.actions.can_reject === true, 'can_reject should be true for SENT');
  logPass('Precondition: Quote is SENT');
  
  const updatedQuote = await api.rejectQuote(quoteId);
  
  assert(updatedQuote.status === QuoteStatus.REJECTED, 'Status should be REJECTED');
  logPass('Backend confirmed transition to REJECTED');
  
  // Verify can revert from REJECTED
  detail = await api.getQuoteDetail(quoteId);
  assert(detail.actions.can_revert_to_draft === true, 'can_revert_to_draft should be true for REJECTED');
  logPass('REJECTED allows revert to draft');
}

// ============================================================
// TEST 5: EXPIRE ACTION (SENT → EXPIRED)
// ============================================================

async function testExpireAction(): Promise<void> {
  logTest('EXPIRE Action (SENT → EXPIRED) - User-triggered');
  
  const { quoteId } = await createTestQuoteWithVersion();
  const api = getApiClient();
  
  await api.sendQuote(quoteId);
  
  let detail = await api.getQuoteDetail(quoteId);
  assert(detail.actions.can_expire === true, 'can_expire should be true for SENT');
  logPass('Precondition: Quote is SENT');
  
  const updatedQuote = await api.expireQuote(quoteId);
  
  assert(updatedQuote.status === QuoteStatus.EXPIRED, 'Status should be EXPIRED');
  logPass('Backend confirmed transition to EXPIRED');
  
  // Verify can revert from EXPIRED
  detail = await api.getQuoteDetail(quoteId);
  assert(detail.actions.can_revert_to_draft === true, 'can_revert_to_draft should be true for EXPIRED');
  logPass('EXPIRED allows revert to draft');
}

// ============================================================
// TEST 6: INVALID TRANSITION BLOCKED
// ============================================================

async function testInvalidTransitionBlocked(): Promise<void> {
  logTest('Invalid Transition Blocked');
  
  const { quoteId } = await createTestQuoteWithVersion();
  const api = getApiClient();
  
  // Try to convert from DRAFT (should fail)
  const detail = await api.getQuoteDetail(quoteId);
  assert(detail.quote.status === QuoteStatus.DRAFT, 'Status should be DRAFT');
  assert(detail.actions.can_convert === false, 'can_convert should be false for DRAFT');
  logPass('AvailableActions correctly blocks CONVERT from DRAFT');
  
  // Try to call API anyway - should fail
  try {
    await api.convertQuote(quoteId);
    throw new Error('Expected error but action succeeded');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    assert(message.includes('transition') || message.includes('invalid') || message.includes('Invalid'), 
      'Error should mention invalid transition');
    logPass('Backend correctly rejected invalid transition');
  }
}

// ============================================================
// TEST 7: VERSION UNCHANGED AFTER LIFECYCLE ACTIONS
// ============================================================

async function testVersionUnchangedAfterLifecycle(): Promise<void> {
  logTest('QuoteVersion Unchanged After Lifecycle Actions');
  
  const { quoteId, versionId } = await createTestQuoteWithVersion();
  const api = getApiClient();
  
  // Get original version
  const originalVersion = await api.getQuoteVersion(versionId);
  const originalTotal = originalVersion.pricing_summary.quote_totals.total_sell;
  logPass('Original version captured');
  
  // Execute SEND
  await api.sendQuote(quoteId);
  
  // Verify version unchanged
  let currentVersion = await api.getQuoteVersion(versionId);
  assert(
    (currentVersion.pricing_summary.quote_totals.total_sell as number) === (originalTotal as number),
    'Total sell should be unchanged after SEND'
  );
  logPass('Version unchanged after SEND');
  
  // Execute REVERT
  await api.revertQuote(quoteId);
  
  // Verify version still unchanged
  currentVersion = await api.getQuoteVersion(versionId);
  assert(
    (currentVersion.pricing_summary.quote_totals.total_sell as number) === (originalTotal as number),
    'Total sell should be unchanged after REVERT'
  );
  logPass('Version unchanged after REVERT');
  
  // GUARDRAIL VERIFIED: QuoteVersion is immutable through lifecycle transitions
  logPass('GUARDRAIL VERIFIED: QuoteVersion remains immutable');
}

// ============================================================
// TEST RUNNER
// ============================================================

async function runAllTests(): Promise<void> {
  console.log('\n' + '█'.repeat(60));
  console.log('SPRINT 5 LIFECYCLE ACTIONS INTEGRATION TESTS');
  console.log('█'.repeat(60));

  await setup();
  
  const tests = [
    testSendAction,
    testRevertAction,
    testConvertAction,
    testRejectAction,
    testExpireAction,
    testInvalidTransitionBlocked,
    testVersionUnchangedAfterLifecycle,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test();
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

export { runAllTests };

if (require.main === module) {
  runAllTests().catch(console.error);
}
