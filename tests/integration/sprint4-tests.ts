/**
 * Sprint 4 Integration Tests
 * 
 * Tests proving:
 * 1. PDF generates correctly from QuoteVersion
 * 2. PDFRecord persisted with display_mode (not pricing_visibility)
 * 3. Email sends with correct attachment
 * 4. EmailRecord persisted with status
 * 5. Resend creates linked record
 * 6. No entity or lifecycle violations
 * 7. QuoteVersion is read-only (never modified)
 */

import type { EntityId, MoneyAmount } from '../../src/core/types';
import { PDFDisplayMode, EmailStatus } from '../../src/core/types';

import type { Quote, QuoteVersion, PDFRecord, EmailRecord } from '../../src/core/entities';

import {
  QuoteService,
  createQuoteService,
  CalculationService,
  createCalculationService,
} from '../../src/services';

import {
  PDFService,
  createPDFService,
  PricingVisibility,
  EmailService,
  createEmailService,
  createLocalFileStorage,
  createStubEmailAdapter,
  DEFAULT_PDF_SECTIONS,
  type StubEmailAdapter,
} from '../../src/output';

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
  pdfService: PDFService;
  emailService: EmailService;
  emailAdapter: StubEmailAdapter;
  referenceData: DataStore;
}

async function setupTestContext(): Promise<TestContext> {
  // Load reference data
  const seedPath = path.join(__dirname, '../../src/data/seed/maldives.json');
  const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  const referenceData = loadDataStore(seedData);

  // Create fresh data context
  const dataContext = createJsonDataContext('/tmp/test-data');

  // Create storage and email adapters
  const storage = createLocalFileStorage('/tmp/test-pdfs');
  const emailAdapter = createStubEmailAdapter();

  // Create services
  const quoteService = createQuoteService(dataContext);
  const calculationService = createCalculationService(dataContext, referenceData);
  const pdfService = createPDFService(dataContext, storage);
  const emailService = createEmailService(dataContext, emailAdapter, storage);

  return {
    dataContext,
    quoteService,
    calculationService,
    pdfService,
    emailService,
    emailAdapter,
    referenceData,
  };
}

async function createCalculatedQuote(ctx: TestContext): Promise<{ quote: Quote; version: QuoteVersion }> {
  // Create quote
  const createResult = await ctx.quoteService.create({
    client_name: 'Test Client',
    client_email: 'test@example.com',
    currency_code: 'USD',
    validity_days: 14,
  });
  
  if (!createResult.success) {
    throw new Error(`Failed to create quote: ${createResult.error.message}`);
  }
  const quote = createResult.value;

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
        children: [{ age: 8 }],
        meal_plan_id: 'MP-002' as EntityId,
        transfer_type_id: 'TRN-001' as EntityId,
      },
    ],
  });

  if (!calcResult.success) {
    throw new Error(`Failed to calculate: ${calcResult.error.message}`);
  }

  // Refresh quote to get updated current_version_id
  const refreshedQuote = await ctx.quoteService.getById(quote.id);
  if (!refreshedQuote.success) {
    throw new Error('Failed to refresh quote');
  }

  return { quote: refreshedQuote.value, version: calcResult.value };
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
// TEST 1: PDF Generation - Basic
// ============================================================

async function testPDFGenerationBasic(ctx: TestContext): Promise<void> {
  logTest('PDF Generation - Basic');

  const { quote, version } = await createCalculatedQuote(ctx);

  // Generate PDF
  const pdfResult = await ctx.pdfService.generate(quote.id, version.id, {
    display_mode: PDFDisplayMode.DETAILED,
    pricing_visibility: PricingVisibility.SELL_ONLY,
    sections: DEFAULT_PDF_SECTIONS,
  });

  assert(pdfResult.success, `PDF generation should succeed: ${pdfResult.success ? '' : pdfResult.error.message}`);
  const record = pdfResult.value;
  logPass('PDF generated successfully');

  // Verify record structure
  assert(record.quote_id === quote.id, 'Record should reference quote');
  assert(record.quote_version_id === version.id, 'Record should reference version');
  assert(record.display_mode === PDFDisplayMode.DETAILED, 'Display mode should be persisted');
  assert(record.file_size_bytes > 0, 'File should have content');
  assert(record.file_reference.length > 0, 'File reference should exist');
  logPass('PDFRecord structure verified');

  // Verify display_mode persisted (pricing_visibility is NOT)
  assert(record.display_mode === PDFDisplayMode.DETAILED, 'display_mode should be DETAILED');
  // Note: There is no pricing_visibility field in PDFRecord (runtime-only)
  logPass('display_mode persisted, pricing_visibility is runtime-only');
}

// ============================================================
// TEST 2: PDF Generation - Different Visibility Modes
// ============================================================

async function testPDFVisibilityModes(ctx: TestContext): Promise<void> {
  logTest('PDF Generation - Different Visibility Modes');

  const { quote, version } = await createCalculatedQuote(ctx);

  // Generate with COST_ONLY
  const costOnlyResult = await ctx.pdfService.generate(quote.id, version.id, {
    display_mode: PDFDisplayMode.DETAILED,
    pricing_visibility: PricingVisibility.COST_ONLY,
  });
  assert(costOnlyResult.success, 'COST_ONLY generation should succeed');
  logPass('COST_ONLY visibility works');

  // Generate with FULL_BREAKDOWN
  const fullResult = await ctx.pdfService.generate(quote.id, version.id, {
    display_mode: PDFDisplayMode.SIMPLIFIED,
    pricing_visibility: PricingVisibility.FULL_BREAKDOWN,
  });
  assert(fullResult.success, 'FULL_BREAKDOWN generation should succeed');
  logPass('FULL_BREAKDOWN visibility works');

  // Verify records have different display_modes
  assert(costOnlyResult.value.display_mode === PDFDisplayMode.DETAILED, 'First record should be DETAILED');
  assert(fullResult.value.display_mode === PDFDisplayMode.SIMPLIFIED, 'Second record should be SIMPLIFIED');
  logPass('Different display_modes persisted correctly');
}

// ============================================================
// TEST 3: PDF Retrieval
// ============================================================

async function testPDFRetrieval(ctx: TestContext): Promise<void> {
  logTest('PDF Retrieval');

  const { quote, version } = await createCalculatedQuote(ctx);

  // Generate PDF
  const pdfResult = await ctx.pdfService.generate(quote.id, version.id, {
    display_mode: PDFDisplayMode.DETAILED,
    pricing_visibility: PricingVisibility.SELL_ONLY,
  });
  assert(pdfResult.success, 'PDF generation should succeed');
  const record = pdfResult.value;

  // Retrieve PDF content
  const retrieveResult = await ctx.pdfService.retrieve(record.id);
  assert(retrieveResult.success, 'PDF retrieval should succeed');
  
  const content = retrieveResult.value;
  assert(content.length > 0, 'PDF content should not be empty');
  assert(content.length === record.file_size_bytes, 'Content size should match record');
  logPass('PDF content retrieved successfully');

  // Verify it's a valid PDF (starts with %PDF)
  const pdfHeader = content.toString('utf-8').substring(0, 5);
  assert(pdfHeader === '%PDF-', 'Content should be valid PDF');
  logPass('PDF content is valid PDF format');
}

// ============================================================
// TEST 4: Email Send - Basic
// ============================================================

async function testEmailSendBasic(ctx: TestContext): Promise<void> {
  logTest('Email Send - Basic');

  const { quote, version } = await createCalculatedQuote(ctx);

  // Send email
  const emailResult = await ctx.emailService.send(quote.id, version.id, {
    recipient_email: 'client@example.com',
    attach_pdf: true,
    pdf_options: {
      display_mode: PDFDisplayMode.DETAILED,
      pricing_visibility: PricingVisibility.SELL_ONLY,
    },
  });

  assert(emailResult.success, `Email send should succeed: ${emailResult.success ? '' : emailResult.error.message}`);
  const record = emailResult.value;
  logPass('Email sent successfully');

  // Verify record structure
  assert(record.quote_id === quote.id, 'Record should reference quote');
  assert(record.quote_version_id === version.id, 'Record should reference version');
  assert(record.recipient_email === 'client@example.com', 'Recipient should match');
  assert(record.status === EmailStatus.SENT, 'Status should be SENT');
  assert(record.subject.includes(quote.id), 'Subject should include quote ID');
  logPass('EmailRecord structure verified');

  // Verify email adapter received the send
  const lastSend = ctx.emailAdapter.getLastSend();
  assert(lastSend !== undefined, 'Email adapter should have send log');
  assert(lastSend.to === 'client@example.com', 'Adapter should have correct recipient');
  assert(lastSend.attachmentCount === 1, 'Should have PDF attachment');
  logPass('Email adapter received correct send request');
}

// ============================================================
// TEST 5: Email Send - No State Transition
// ============================================================

async function testEmailNoStateTransition(ctx: TestContext): Promise<void> {
  logTest('Email Send - No State Transition');

  const { quote, version } = await createCalculatedQuote(ctx);

  // Record original status
  const originalStatus = quote.status;
  logPass(`Original status: ${originalStatus}`);

  // Send email
  const emailResult = await ctx.emailService.send(quote.id, version.id, {
    recipient_email: 'client@example.com',
    attach_pdf: false,
  });
  assert(emailResult.success, 'Email send should succeed');
  logPass('Email sent');

  // Verify quote status unchanged
  const refreshedQuote = await ctx.quoteService.getById(quote.id);
  assert(refreshedQuote.success, 'Should be able to get quote');
  assert(refreshedQuote.value.status === originalStatus, 'Status should NOT change after email send');
  logPass('Quote status unchanged after email send');
}

// ============================================================
// TEST 6: Email Resend
// ============================================================

async function testEmailResend(ctx: TestContext): Promise<void> {
  logTest('Email Resend');

  const { quote, version } = await createCalculatedQuote(ctx);

  // Send original email
  const originalResult = await ctx.emailService.send(quote.id, version.id, {
    recipient_email: 'client@example.com',
    attach_pdf: true,
  });
  assert(originalResult.success, 'Original email should succeed');
  const originalRecord = originalResult.value;
  logPass('Original email sent');

  // Resend
  const resendResult = await ctx.emailService.resend(originalRecord.id);
  assert(resendResult.success, 'Resend should succeed');
  const resendRecord = resendResult.value;
  logPass('Email resent');

  // Verify resend record links to original
  assert(resendRecord.resend_of === originalRecord.id, 'Resend should link to original');
  assert(resendRecord.recipient_email === originalRecord.recipient_email, 'Recipient should match');
  assert(resendRecord.id !== originalRecord.id, 'Should be new record');
  logPass('Resend record correctly linked to original');
}

// ============================================================
// TEST 7: Email Send Failure Handling
// ============================================================

async function testEmailSendFailure(ctx: TestContext): Promise<void> {
  logTest('Email Send Failure Handling');

  const { quote, version } = await createCalculatedQuote(ctx);

  // Configure adapter to fail
  ctx.emailAdapter.setSimulateFailure(true, 'SMTP connection refused');

  // Attempt send
  const emailResult = await ctx.emailService.send(quote.id, version.id, {
    recipient_email: 'client@example.com',
    attach_pdf: false,
  });

  // Should return failure
  assert(!emailResult.success, 'Email send should fail');
  assert(emailResult.error.message.includes('SMTP connection refused'), 'Error should contain failure reason');
  logPass('Send failure correctly reported');

  // Reset adapter
  ctx.emailAdapter.setSimulateFailure(false);
}

// ============================================================
// TEST 8: QuoteVersion Not Modified
// ============================================================

async function testQuoteVersionNotModified(ctx: TestContext): Promise<void> {
  logTest('QuoteVersion Not Modified');

  const { quote, version } = await createCalculatedQuote(ctx);

  // Record original version data
  const originalTotalSell = version.pricing_summary.quote_totals.total_sell;
  const originalLegsCount = version.legs.length;
  const originalVersionNumber = version.version_number;

  // Generate multiple PDFs with different options
  await ctx.pdfService.generate(quote.id, version.id, {
    display_mode: PDFDisplayMode.DETAILED,
    pricing_visibility: PricingVisibility.COST_ONLY,
  });
  await ctx.pdfService.generate(quote.id, version.id, {
    display_mode: PDFDisplayMode.SIMPLIFIED,
    pricing_visibility: PricingVisibility.FULL_BREAKDOWN,
  });

  // Send multiple emails
  await ctx.emailService.send(quote.id, version.id, {
    recipient_email: 'client1@example.com',
    attach_pdf: true,
  });
  await ctx.emailService.send(quote.id, version.id, {
    recipient_email: 'client2@example.com',
    attach_pdf: false,
  });

  // Fetch version again
  const versionResult = await ctx.quoteService.getVersion(version.id);
  assert(versionResult.success, 'Should be able to get version');
  const fetchedVersion = versionResult.value;

  // Verify nothing changed
  assert(
    (fetchedVersion.pricing_summary.quote_totals.total_sell as number) === (originalTotalSell as number),
    'Total sell should be unchanged'
  );
  assert(fetchedVersion.legs.length === originalLegsCount, 'Legs count should be unchanged');
  assert(fetchedVersion.version_number === originalVersionNumber, 'Version number should be unchanged');
  logPass('QuoteVersion is immutable - all values unchanged');
}

// ============================================================
// TEST 9: PDF List Operations
// ============================================================

async function testPDFListOperations(ctx: TestContext): Promise<void> {
  logTest('PDF List Operations');

  const { quote, version } = await createCalculatedQuote(ctx);

  // Generate multiple PDFs
  await ctx.pdfService.generate(quote.id, version.id, {
    display_mode: PDFDisplayMode.DETAILED,
    pricing_visibility: PricingVisibility.SELL_ONLY,
  });
  await ctx.pdfService.generate(quote.id, version.id, {
    display_mode: PDFDisplayMode.SIMPLIFIED,
    pricing_visibility: PricingVisibility.SELL_ONLY,
  });

  // List by quote
  const byQuote = await ctx.pdfService.listByQuote(quote.id);
  assert(byQuote.length === 2, 'Should have 2 PDFs for quote');
  logPass('listByQuote returns correct count');

  // List by version
  const byVersion = await ctx.pdfService.listByVersion(version.id);
  assert(byVersion.length === 2, 'Should have 2 PDFs for version');
  logPass('listByVersion returns correct count');
}

// ============================================================
// TEST 10: Email List Operations
// ============================================================

async function testEmailListOperations(ctx: TestContext): Promise<void> {
  logTest('Email List Operations');

  const { quote, version } = await createCalculatedQuote(ctx);

  // Send multiple emails
  await ctx.emailService.send(quote.id, version.id, {
    recipient_email: 'client1@example.com',
    attach_pdf: false,
  });
  await ctx.emailService.send(quote.id, version.id, {
    recipient_email: 'client2@example.com',
    attach_pdf: false,
  });

  // List by quote
  const byQuote = await ctx.emailService.listByQuote(quote.id);
  assert(byQuote.length === 2, 'Should have 2 emails for quote');
  logPass('listByQuote returns correct count');
}

// ============================================================
// MAIN TEST RUNNER
// ============================================================

async function runAllTests(): Promise<void> {
  console.log('\n' + '█'.repeat(60));
  console.log('SPRINT 4 INTEGRATION TESTS');
  console.log('█'.repeat(60));

  const tests = [
    testPDFGenerationBasic,
    testPDFVisibilityModes,
    testPDFRetrieval,
    testEmailSendBasic,
    testEmailNoStateTransition,
    testEmailResend,
    testEmailSendFailure,
    testQuoteVersionNotModified,
    testPDFListOperations,
    testEmailListOperations,
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
