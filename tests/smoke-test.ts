/**
 * Production Smoke Test
 * 
 * Run with: npx tsx tests/smoke-test.ts
 */

import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { QuoteService, CalculationService } from '../src/services/index.js';
import { loadDataStore } from '../src/core/calculation/index.js';
import { createJsonDataContext } from '../src/data/repositories/json-repository.js';
import { validateStartupRequirements } from '../src/startup/index.js';
import { setDefaultLogger, ConsoleLogger } from '../src/core/logging/index.js';
import type { EntityId } from '../src/core/types/index.js';

async function runSmokeTest(): Promise<void> {
  console.log('========================================');
  console.log('PRODUCTION SMOKE TEST');
  console.log('========================================');
  console.log('');

  // Enable logging
  setDefaultLogger(new ConsoleLogger('INFO'));

  // Load seed data
  const seedPath = path.join(__dirname, '../src/data/seed/maldives.json');
  const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  const referenceData = loadDataStore(seedData);

  const DATA_PATH = '/tmp/smoke-test-data';
  const PDF_PATH = '/tmp/smoke-test-pdfs';

  // Clean up
  if (fs.existsSync(DATA_PATH)) fs.rmSync(DATA_PATH, { recursive: true });
  if (fs.existsSync(PDF_PATH)) fs.rmSync(PDF_PATH, { recursive: true });

  console.log('1. STARTUP VALIDATION');
  try {
    validateStartupRequirements({
      dataPath: DATA_PATH,
      pdfStoragePath: PDF_PATH,
      seedData: referenceData,
    });
    console.log('   ✅ Startup validation PASSED');
  } catch (e: any) {
    console.log('   ❌ Startup validation FAILED:', e.message);
    process.exit(1);
  }
  console.log('');

  // Create services
  const dataContext = createJsonDataContext(DATA_PATH);
  const quoteService = new QuoteService(dataContext);
  const calculationService = new CalculationService(dataContext, referenceData);

  console.log('2. CREATE QUOTE');
  const createResult = await quoteService.create({
    client_name: 'Smoke Test Client',
    client_email: 'smoke@test.com',
    currency_code: 'USD',
    validity_days: 14,
  });
  if (!createResult.success) {
    console.log('   ❌ Create FAILED:', createResult.error.message);
    process.exit(1);
  }
  const quoteId = createResult.value.id;
  console.log('   ✅ Quote created: ' + quoteId);
  console.log('');

  console.log('3. ATTEMPT SEND WITHOUT VERSION (should BLOCK)');
  const sendWithoutVersion = await quoteService.send(quoteId);
  if (sendWithoutVersion.success) {
    console.log('   ❌ SECURITY FAILURE: Send succeeded without version!');
    process.exit(1);
  }
  console.log('   ✅ Send correctly BLOCKED: ' + sendWithoutVersion.error.code);
  console.log('');

  console.log('4. CALCULATE QUOTE');
  const calcResult = await calculationService.calculate({
    quote_id: quoteId,
    legs: [{
      resort_id: 'RST-001' as EntityId,
      room_type_id: 'RT-001' as EntityId,
      check_in_date: '2026-03-01',
      check_out_date: '2026-03-05',
      adults_count: 2,
      children: [],
      meal_plan_id: 'MP-001' as EntityId,
      transfer_type_id: 'TT-001' as EntityId,
      activities: [],
      discounts: [],
    }],
  });
  if (!calcResult.success) {
    console.log('   ❌ Calculate FAILED:', calcResult.error.message);
    process.exit(1);
  }
  console.log('   ✅ Version created: v' + calcResult.value.version_number);
  console.log('   ✅ Calculation completed successfully');
  console.log('');

  console.log('5. SEND QUOTE');
  const sendResult = await quoteService.send(quoteId);
  if (!sendResult.success) {
    console.log('   ❌ Send FAILED:', sendResult.error.message);
    process.exit(1);
  }
  console.log('   ✅ Quote sent, status: ' + sendResult.value.status);
  console.log('');

  console.log('6. CONVERT QUOTE');
  const convertResult = await quoteService.markConverted(quoteId);
  if (!convertResult.success) {
    console.log('   ❌ Convert FAILED:', convertResult.error.message);
    process.exit(1);
  }
  console.log('   ✅ Quote converted, status: ' + convertResult.value.status);
  console.log('');

  console.log('7. ATTEMPT EDIT CONVERTED (should BLOCK)');
  const editConverted = await calculationService.calculate({
    quote_id: quoteId,
    legs: [{
      resort_id: 'RST-001' as EntityId,
      room_type_id: 'RT-001' as EntityId,
      check_in_date: '2026-03-01',
      check_out_date: '2026-03-05',
      adults_count: 2,
      children: [],
      meal_plan_id: 'MP-001' as EntityId,
      transfer_type_id: 'TT-001' as EntityId,
      activities: [],
      discounts: [],
    }],
  });
  if (editConverted.success) {
    console.log('   ❌ SECURITY FAILURE: Edit succeeded on CONVERTED quote!');
    process.exit(1);
  }
  console.log('   ✅ Edit correctly BLOCKED: ' + editConverted.error.code);
  console.log('');

  console.log('========================================');
  console.log('ALL SMOKE TESTS PASSED ✅');
  console.log('========================================');
}

runSmokeTest().catch(err => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
