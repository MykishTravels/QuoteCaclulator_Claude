/**
 * Sprint 4 UI Integration Test
 * 
 * Verifies all Sprint 4 UI actions call real backend endpoints successfully.
 * 
 * Tests:
 * 1. getQuoteDetail() - Fetch quote + version + actions
 * 2. generatePdf() - Generate PDF
 * 3. getPdfRecords() - List PDFs
 * 4. downloadPdf() - Download PDF content
 * 5. sendEmail() - Send email
 * 6. resendEmail() - Resend email
 * 7. getEmailRecords() - List emails
 * 
 * GUARDRAIL: These tests verify pass-through only.
 * - No calculations in UI layer
 * - No lifecycle logic in UI layer
 */

import * as fs from 'fs';
import * as path from 'path';

import type { EntityId } from '../../src/core/types';
import { PDFDisplayMode } from '../../src/core/types';

import {
  initializeApp,
  getApiClient,
  PricingVisibility,
  DEFAULT_PDF_SECTIONS,
  type AppContext,
  type PDFGenerationOptions,
  type EmailGenerationOptions,
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
  // Load seed data
  const seedPath = path.join(__dirname, '../../src/data/seed/maldives.json');
  const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  const referenceData = loadDataStore(seedData);
  
  // Initialize app
  appContext = initializeApp({
    dataPath: '/tmp/ui-integration-test-data',
    pdfStoragePath: '/tmp/ui-integration-test-pdfs',
    referenceData,
  });
}

async function createTestQuoteWithVersion(): Promise<{
  quoteId: EntityId;
  versionId: EntityId;
}> {
  // Create quote via services (not API client - we need the quote service directly)
  const quoteService = createQuoteService(appContext.dataContext);
  const calcService = createCalculationService(appContext.dataContext, appContext.referenceData);
  
  // Create quote
  const createResult = await quoteService.create({
    client_name: 'UI Test Client',
    client_email: 'uitest@example.com',
    currency_code: 'USD',
    validity_days: 14,
  });
  
  if (!createResult.success) {
    throw new Error(`Failed to create quote: ${createResult.error.message}`);
  }
  
  const quote = createResult.value;
  
  // Calculate to create version
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
// TEST 1: getQuoteDetail
// ============================================================

async function testGetQuoteDetail(): Promise<void> {
  logTest('getQuoteDetail() - Fetch quote + version + actions');
  
  const { quoteId, versionId } = await createTestQuoteWithVersion();
  const api = getApiClient();
  
  const detail = await api.getQuoteDetail(quoteId);
  
  assert(detail.quote !== null, 'Quote should be returned');
  assert(detail.quote.id === quoteId, 'Quote ID should match');
  assert(detail.quote.client_name === 'UI Test Client', 'Client name should match');
  logPass('Quote fetched successfully');
  
  assert(detail.currentVersion !== null, 'Current version should be returned');
  assert(detail.currentVersion.id === versionId, 'Version ID should match');
  logPass('Current version fetched successfully');
  
  assert(detail.actions !== null, 'Actions should be returned');
  assert(typeof detail.actions.can_edit === 'boolean', 'can_edit should be boolean');
  assert(typeof detail.actions.can_send === 'boolean', 'can_send should be boolean');
  logPass('Actions fetched successfully');
}

// ============================================================
// TEST 2: generatePdf
// ============================================================

async function testGeneratePdf(): Promise<EntityId> {
  logTest('generatePdf() - Generate PDF');
  
  const { quoteId, versionId } = await createTestQuoteWithVersion();
  const api = getApiClient();
  
  const options: PDFGenerationOptions = {
    display_mode: PDFDisplayMode.DETAILED,
    pricing_visibility: PricingVisibility.SELL_ONLY,
    sections: [...DEFAULT_PDF_SECTIONS],
  };
  
  const record = await api.generatePdf(quoteId, versionId, options);
  
  assert(record !== null, 'PDF record should be returned');
  assert(record.quote_id === quoteId, 'Quote ID should match');
  assert(record.quote_version_id === versionId, 'Version ID should match');
  assert(record.display_mode === PDFDisplayMode.DETAILED, 'Display mode should match');
  assert(record.file_size_bytes > 0, 'File size should be positive');
  logPass('PDF generated successfully');
  
  return record.id;
}

// ============================================================
// TEST 3: getPdfRecords
// ============================================================

async function testGetPdfRecords(): Promise<void> {
  logTest('getPdfRecords() - List PDFs');
  
  const { quoteId, versionId } = await createTestQuoteWithVersion();
  const api = getApiClient();
  
  // Generate a PDF first
  await api.generatePdf(quoteId, versionId, {
    display_mode: PDFDisplayMode.SIMPLIFIED,
    pricing_visibility: PricingVisibility.COST_ONLY,
  });
  
  // List PDFs
  const records = await api.getPdfRecords(quoteId);
  
  assert(records.length >= 1, 'Should have at least 1 PDF record');
  assert(records[0].quote_id === quoteId, 'Quote ID should match');
  logPass('PDF records listed successfully');
}

// ============================================================
// TEST 4: downloadPdf
// ============================================================

async function testDownloadPdf(): Promise<void> {
  logTest('downloadPdf() - Download PDF content');
  
  const { quoteId, versionId } = await createTestQuoteWithVersion();
  const api = getApiClient();
  
  // Generate a PDF first
  const record = await api.generatePdf(quoteId, versionId, {
    display_mode: PDFDisplayMode.DETAILED,
    pricing_visibility: PricingVisibility.SELL_ONLY,
  });
  
  // Download PDF
  const blob = await api.downloadPdf(record.id);
  
  assert(blob !== null, 'Blob should be returned');
  assert(blob.size > 0, 'Blob should have content');
  assert(blob.type === 'application/pdf', 'Blob should be PDF type');
  logPass('PDF downloaded successfully');
}

// ============================================================
// TEST 5: sendEmail
// ============================================================

async function testSendEmail(): Promise<EntityId> {
  logTest('sendEmail() - Send email');
  
  const { quoteId, versionId } = await createTestQuoteWithVersion();
  const api = getApiClient();
  
  const options: EmailGenerationOptions = {
    recipient_email: 'client@example.com',
    attach_pdf: true,
    pdf_options: {
      display_mode: PDFDisplayMode.DETAILED,
      pricing_visibility: PricingVisibility.SELL_ONLY,
    },
  };
  
  const record = await api.sendEmail(quoteId, versionId, options);
  
  assert(record !== null, 'Email record should be returned');
  assert(record.quote_id === quoteId, 'Quote ID should match');
  assert(record.recipient_email === 'client@example.com', 'Recipient should match');
  assert(record.status === 'SENT', 'Status should be SENT');
  logPass('Email sent successfully');
  
  // Verify quote status unchanged (GUARDRAIL)
  const detail = await api.getQuoteDetail(quoteId);
  assert(detail.quote.status === 'DRAFT', 'Quote status should still be DRAFT after email');
  logPass('Quote status unchanged after email (guardrail verified)');
  
  return record.id;
}

// ============================================================
// TEST 6: resendEmail
// ============================================================

async function testResendEmail(): Promise<void> {
  logTest('resendEmail() - Resend email');
  
  const { quoteId, versionId } = await createTestQuoteWithVersion();
  const api = getApiClient();
  
  // Send original email
  const originalRecord = await api.sendEmail(quoteId, versionId, {
    recipient_email: 'original@example.com',
    attach_pdf: false,
  });
  
  // Resend
  const resendRecord = await api.resendEmail(originalRecord.id);
  
  assert(resendRecord !== null, 'Resend record should be returned');
  assert(resendRecord.resend_of === originalRecord.id, 'resend_of should link to original');
  assert(resendRecord.id !== originalRecord.id, 'Resend should have new ID');
  logPass('Email resent successfully');
}

// ============================================================
// TEST 7: getEmailRecords
// ============================================================

async function testGetEmailRecords(): Promise<void> {
  logTest('getEmailRecords() - List emails');
  
  const { quoteId, versionId } = await createTestQuoteWithVersion();
  const api = getApiClient();
  
  // Send an email first
  await api.sendEmail(quoteId, versionId, {
    recipient_email: 'list-test@example.com',
    attach_pdf: false,
  });
  
  // List emails
  const records = await api.getEmailRecords(quoteId);
  
  assert(records.length >= 1, 'Should have at least 1 email record');
  assert(records[0].quote_id === quoteId, 'Quote ID should match');
  logPass('Email records listed successfully');
}

// ============================================================
// TEST RUNNER
// ============================================================

async function runAllTests(): Promise<void> {
  console.log('\n' + '█'.repeat(60));
  console.log('SPRINT 4 UI INTEGRATION TESTS');
  console.log('Verifying UI → Backend Connection');
  console.log('█'.repeat(60));

  // Setup
  await setup();
  
  const tests = [
    testGetQuoteDetail,
    testGeneratePdf,
    testGetPdfRecords,
    testDownloadPdf,
    testSendEmail,
    testResendEmail,
    testGetEmailRecords,
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

// Export for test runner
export { runAllTests };

// Run if executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}
