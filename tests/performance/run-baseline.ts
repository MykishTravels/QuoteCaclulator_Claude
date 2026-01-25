/**
 * Performance Baseline Runner
 * 
 * Standalone script to measure performance baselines.
 * Run with: npx tsx tests/performance/run-baseline.ts
 * 
 * PHASE 6: Measurement only - no optimization.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import type { EntityId } from '../../src/core/types/index.js';
import { QuoteService, CalculationService } from '../../src/services/index.js';
import { loadDataStore, type DataStore } from '../../src/core/calculation/index.js';
import { createJsonDataContext } from '../../src/data/repositories/json-repository.js';
import type { DataContext } from '../../src/data/repositories/interfaces.js';
import { setDefaultLogger, NoOpLogger } from '../../src/core/logging/index.js';

// ============================================================
// CONFIGURATION
// ============================================================

const TEST_DATA_PATH = '/tmp/perf-baseline-run';
const WARMUP_ITERATIONS = 2;
const MEASUREMENT_ITERATIONS = 5;

// ============================================================
// TYPES
// ============================================================

interface MeasurementResult {
  name: string;
  inputSize: number;
  inputDescription: string;
  timings: number[];
  avgMs: number;
  minMs: number;
  maxMs: number;
}

interface LegConfig {
  nights: number;
  adults: number;
  children: number;
  activities: number;
  discounts: number;
}

// ============================================================
// GLOBALS
// ============================================================

let dataContext: DataContext;
let referenceData: DataStore;
let quoteService: QuoteService;
let calculationService: CalculationService;
const results: MeasurementResult[] = [];

// ============================================================
// SETUP
// ============================================================

function setup(): void {
  console.log('Setting up test environment...');
  
  // Suppress logging
  setDefaultLogger(new NoOpLogger());
  
  // Clean up
  if (fs.existsSync(TEST_DATA_PATH)) {
    fs.rmSync(TEST_DATA_PATH, { recursive: true });
  }
  fs.mkdirSync(TEST_DATA_PATH, { recursive: true });
  
  // Load reference data
  const seedPath = path.join(__dirname, '../../src/data/seed/maldives.json');
  const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  referenceData = loadDataStore(seedData);
  
  // Create context
  dataContext = createJsonDataContext(TEST_DATA_PATH);
  
  // Create services
  quoteService = new QuoteService(dataContext);
  calculationService = new CalculationService(dataContext, referenceData);
  
  console.log('Setup complete.\n');
}

// ============================================================
// HELPERS
// ============================================================

async function createQuote(): Promise<EntityId> {
  const result = await quoteService.create({
    client_name: 'Performance Test',
    client_email: 'perf@test.com',
    currency_code: 'USD',
    validity_days: 14,
  });
  
  if (!result.success) {
    throw new Error(`Failed to create quote: ${result.error.message}`);
  }
  
  return result.value.id;
}

function buildLegInput(config: LegConfig) {
  const checkIn = '2026-03-01';
  const checkOutDate = new Date('2026-03-01');
  checkOutDate.setDate(checkOutDate.getDate() + config.nights);
  const checkOut = checkOutDate.toISOString().split('T')[0];
  
  const children: Array<{ age: number }> = [];
  for (let i = 0; i < config.children; i++) {
    children.push({ age: 5 + i });
  }
  
  const activities: Array<{ activity_id: EntityId; quantity: number }> = [];
  const availableActivities = referenceData.activities.slice(0, config.activities);
  for (const activity of availableActivities) {
    activities.push({ activity_id: activity.id, quantity: 1 });
  }
  
  const discounts: EntityId[] = [];
  const availableDiscounts = referenceData.discounts.slice(0, config.discounts);
  for (const discount of availableDiscounts) {
    discounts.push(discount.id);
  }
  
  return {
    resort_id: 'RST-001' as EntityId,
    room_type_id: 'RT-001' as EntityId,
    check_in_date: checkIn,
    check_out_date: checkOut,
    adults_count: config.adults,
    children,
    meal_plan_id: 'MP-001' as EntityId,
    transfer_type_id: 'TT-001' as EntityId,
    activities,
    discounts,
  };
}

async function measureCalculation(
  name: string,
  description: string,
  legConfigs: LegConfig[],
  iterations: number = MEASUREMENT_ITERATIONS
): Promise<MeasurementResult> {
  const timings: number[] = [];
  
  for (let i = 0; i < WARMUP_ITERATIONS + iterations; i++) {
    const quoteId = await createQuote();
    const legs = legConfigs.map(buildLegInput);
    
    const start = performance.now();
    const result = await calculationService.calculate({ quote_id: quoteId, legs });
    const elapsed = performance.now() - start;
    
    if (!result.success) {
      console.error(`  Calculation failed: ${result.error.message}`);
      continue;
    }
    
    if (i >= WARMUP_ITERATIONS) {
      timings.push(elapsed);
    }
  }
  
  const sorted = [...timings].sort((a, b) => a - b);
  const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
  
  return {
    name,
    inputSize: legConfigs.length,
    inputDescription: description,
    timings,
    avgMs: avg,
    minMs: sorted[0] || 0,
    maxMs: sorted[sorted.length - 1] || 0,
  };
}

function recordAndLog(result: MeasurementResult): void {
  results.push(result);
  console.log(`  ${result.inputDescription}: avg=${result.avgMs.toFixed(2)}ms, min=${result.minMs.toFixed(2)}ms, max=${result.maxMs.toFixed(2)}ms`);
}

// ============================================================
// TESTS
// ============================================================

async function runLegsScaling(): Promise<void> {
  console.log('LEGS SCALING:');
  const baseConfig: LegConfig = { nights: 5, adults: 2, children: 0, activities: 0, discounts: 0 };
  
  for (const legCount of [1, 2, 5, 10]) {
    const configs = Array(legCount).fill(baseConfig);
    const result = await measureCalculation(
      'legs_scaling',
      `${legCount} leg(s)`,
      configs
    );
    recordAndLog(result);
  }
  console.log('');
}

async function runNightsScaling(): Promise<void> {
  console.log('NIGHTS SCALING:');
  
  for (const nights of [3, 7, 14, 30]) {
    const config: LegConfig = { nights, adults: 2, children: 0, activities: 0, discounts: 0 };
    const result = await measureCalculation(
      'nights_scaling',
      `${nights} nights`,
      [config]
    );
    recordAndLog(result);
  }
  console.log('');
}

async function runGuestsScaling(): Promise<void> {
  console.log('GUESTS SCALING:');
  
  // Note: Guest scaling is limited by room occupancy validation.
  // Beach Villa (RT-001) has max_adults=3, max_children=2, max_occupancy=4
  // We test within valid ranges only.
  const configs = [
    { adults: 1, children: 0, desc: '1 guest (1A+0C)' },
    { adults: 2, children: 0, desc: '2 guests (2A+0C)' },
    { adults: 2, children: 2, desc: '4 guests (2A+2C)' },
    { adults: 3, children: 1, desc: '4 guests (3A+1C)' },
  ];
  
  for (const { adults, children, desc } of configs) {
    const config: LegConfig = { nights: 5, adults, children, activities: 0, discounts: 0 };
    const result = await measureCalculation('guests_scaling', desc, [config]);
    recordAndLog(result);
  }
  console.log('');
}

async function runCombinedLoad(): Promise<void> {
  console.log('COMBINED LOAD:');
  
  // Minimal
  {
    const config: LegConfig = { nights: 3, adults: 2, children: 0, activities: 0, discounts: 0 };
    const result = await measureCalculation('combined', 'MINIMAL (1 leg, 3 nights, 2 guests)', [config]);
    recordAndLog(result);
  }
  
  // Typical
  {
    const config: LegConfig = { nights: 5, adults: 2, children: 2, activities: 2, discounts: 1 };
    const result = await measureCalculation('combined', 'TYPICAL (2 legs, 5 nights, 4 guests, 2 act, 1 disc)', [config, config]);
    recordAndLog(result);
  }
  
  // Large - use more legs/nights instead of exceeding occupancy limits
  {
    const config: LegConfig = { nights: 14, adults: 2, children: 2, activities: 5, discounts: 3 };
    const configs = Array(5).fill(config);
    const result = await measureCalculation('combined', 'LARGE (5 legs, 14 nights, 4 guests, 5 act, 3 disc)', configs);
    recordAndLog(result);
  }
  
  // Extreme - maximize legs and nights within occupancy limits
  {
    const config: LegConfig = { nights: 30, adults: 2, children: 2, activities: 5, discounts: 3 };
    const configs = Array(10).fill(config);
    const result = await measureCalculation('combined', 'EXTREME (10 legs, 30 nights, 4 guests)', configs, 3);
    recordAndLog(result);
  }
  
  console.log('');
}

async function runServiceOperations(): Promise<void> {
  console.log('SERVICE OPERATIONS:');
  
  // create()
  {
    const timings: number[] = [];
    for (let i = 0; i < WARMUP_ITERATIONS + MEASUREMENT_ITERATIONS; i++) {
      const start = performance.now();
      await quoteService.create({
        client_name: 'Create Test',
        client_email: 'create@test.com',
        currency_code: 'USD',
        validity_days: 14,
      });
      const elapsed = performance.now() - start;
      if (i >= WARMUP_ITERATIONS) {
        timings.push(elapsed);
      }
    }
    const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
    console.log(`  QuoteService.create(): avg=${avg.toFixed(2)}ms`);
  }
  
  // send()
  {
    const timings: number[] = [];
    for (let i = 0; i < WARMUP_ITERATIONS + MEASUREMENT_ITERATIONS; i++) {
      const quoteId = await createQuote();
      const config: LegConfig = { nights: 5, adults: 2, children: 0, activities: 0, discounts: 0 };
      await calculationService.calculate({ quote_id: quoteId, legs: [buildLegInput(config)] });
      
      const start = performance.now();
      await quoteService.send(quoteId);
      const elapsed = performance.now() - start;
      if (i >= WARMUP_ITERATIONS) {
        timings.push(elapsed);
      }
    }
    const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
    console.log(`  QuoteService.send(): avg=${avg.toFixed(2)}ms`);
  }
  
  console.log('');
}

// ============================================================
// ANALYSIS
// ============================================================

function analyzeScaling(name: string, filterName: string): void {
  const data = results.filter(r => r.name === filterName);
  if (data.length < 2) return;
  
  const sorted = data.sort((a, b) => a.inputSize - b.inputSize);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  
  // Extract numeric input size from description for certain tests
  let inputRatio: number;
  let timeRatio: number;
  
  if (filterName === 'nights_scaling') {
    // Parse nights from description
    const firstNights = parseInt(first.inputDescription);
    const lastNights = parseInt(last.inputDescription);
    inputRatio = lastNights / firstNights;
  } else if (filterName === 'guests_scaling') {
    // Parse guests from description
    const firstMatch = first.inputDescription.match(/(\d+) guests/);
    const lastMatch = last.inputDescription.match(/(\d+) guests/);
    inputRatio = parseInt(lastMatch?.[1] || '1') / parseInt(firstMatch?.[1] || '1');
  } else {
    inputRatio = last.inputSize / first.inputSize;
  }
  
  timeRatio = last.avgMs / first.avgMs;
  
  let complexity = 'UNKNOWN';
  if (timeRatio < inputRatio * 1.5) {
    complexity = 'LINEAR (O(n)) ✓';
  } else if (timeRatio < inputRatio * inputRatio * 0.5) {
    complexity = 'SUPER-LINEAR (O(n log n)) ⚠️';
  } else if (timeRatio < inputRatio * inputRatio * 1.5) {
    complexity = 'QUADRATIC (O(n²)) ⚠️';
  } else {
    complexity = 'WORSE THAN QUADRATIC ❌';
  }
  
  console.log(`  ${name}: input ${inputRatio.toFixed(1)}x → time ${timeRatio.toFixed(1)}x = ${complexity}`);
}

function printSummary(): void {
  console.log('='.repeat(70));
  console.log('PERFORMANCE BASELINE SUMMARY');
  console.log('='.repeat(70));
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Node: ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log(`Warmup: ${WARMUP_ITERATIONS} iterations`);
  console.log(`Measurement: ${MEASUREMENT_ITERATIONS} iterations`);
  console.log('');
  
  console.log('SCALING ANALYSIS:');
  analyzeScaling('Legs', 'legs_scaling');
  analyzeScaling('Nights', 'nights_scaling');
  analyzeScaling('Guests', 'guests_scaling');
  console.log('');
  
  console.log('THRESHOLDS:');
  const typical = results.find(r => r.inputDescription.includes('TYPICAL'));
  const large = results.find(r => r.inputDescription.includes('LARGE'));
  const extreme = results.find(r => r.inputDescription.includes('EXTREME'));
  
  if (typical) {
    const status = typical.avgMs < 500 ? '✓ ACCEPTABLE' : '⚠️ SLOW';
    console.log(`  TYPICAL quote: ${typical.avgMs.toFixed(2)}ms ${status}`);
  }
  if (large) {
    const status = large.avgMs < 2000 ? '✓ ACCEPTABLE' : '⚠️ SLOW';
    console.log(`  LARGE quote: ${large.avgMs.toFixed(2)}ms ${status}`);
  }
  if (extreme) {
    const status = extreme.avgMs < 5000 ? '✓ ACCEPTABLE' : '⚠️ SLOW';
    console.log(`  EXTREME quote: ${extreme.avgMs.toFixed(2)}ms ${status}`);
  }
  
  console.log('');
  console.log('='.repeat(70));
}

// ============================================================
// MAIN
// ============================================================

async function main(): Promise<void> {
  console.log('');
  console.log('='.repeat(70));
  console.log('PERFORMANCE BASELINE MEASUREMENT');
  console.log('='.repeat(70));
  console.log('');
  
  setup();
  
  await runLegsScaling();
  await runNightsScaling();
  await runGuestsScaling();
  await runCombinedLoad();
  await runServiceOperations();
  
  printSummary();
  
  // Cleanup
  if (fs.existsSync(TEST_DATA_PATH)) {
    fs.rmSync(TEST_DATA_PATH, { recursive: true });
  }
}

main().catch(console.error);
