/**
 * Performance Baseline Measurements
 * 
 * PHASE 6: Measurement, not optimization.
 * 
 * This file measures current performance to establish baselines.
 * It does NOT assert pass/fail thresholds.
 * It does NOT optimize anything.
 * 
 * Purpose:
 * - Document current performance
 * - Detect accidental O(n²) complexity
 * - Provide baseline for future comparison
 */

import { describe, it, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import type { EntityId } from '../../src/core/types';
import { QuoteService, CalculationService } from '../../src/services';
import { loadDataStore, type DataStore } from '../../src/core/calculation';
import { createJsonDataContext } from '../../src/data/repositories/json-repository';
import type { DataContext } from '../../src/data/repositories/interfaces';

// Suppress logging during performance tests
import { setDefaultLogger, NoOpLogger } from '../../src/core/logging';

// ============================================================
// TEST CONFIGURATION
// ============================================================

const TEST_DATA_PATH = '/tmp/perf-test-data';
const WARMUP_ITERATIONS = 2;
const MEASUREMENT_ITERATIONS = 5;

// ============================================================
// PERFORMANCE RESULTS STORAGE
// ============================================================

interface MeasurementResult {
  name: string;
  inputSize: number;
  timings: number[];
  avgMs: number;
  minMs: number;
  maxMs: number;
}

const results: MeasurementResult[] = [];

function recordResult(name: string, inputSize: number, timings: number[]): void {
  const sorted = [...timings].sort((a, b) => a - b);
  const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
  
  results.push({
    name,
    inputSize,
    timings,
    avgMs: avg,
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
  });
}

// ============================================================
// TEST SETUP
// ============================================================

let dataContext: DataContext;
let referenceData: DataStore;
let quoteService: QuoteService;
let calculationService: CalculationService;

beforeAll(() => {
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
});

// ============================================================
// HELPER: CREATE QUOTE
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

// ============================================================
// HELPER: BUILD LEG INPUT
// ============================================================

interface LegConfig {
  nights: number;
  adults: number;
  children: number;
  activities: number;
  discounts: number;
}

function buildLegInput(config: LegConfig) {
  const checkIn = '2026-03-01';
  const checkOutDate = new Date('2026-03-01');
  checkOutDate.setDate(checkOutDate.getDate() + config.nights);
  const checkOut = checkOutDate.toISOString().split('T')[0];
  
  // Build children array
  const children: Array<{ age: number }> = [];
  for (let i = 0; i < config.children; i++) {
    children.push({ age: 5 + i }); // Ages 5, 6, 7, ...
  }
  
  // Build activities array (use first N activities from seed if available)
  const activities: Array<{ activity_id: EntityId; quantity: number }> = [];
  const availableActivities = referenceData.activities.slice(0, config.activities);
  for (const activity of availableActivities) {
    activities.push({ activity_id: activity.id, quantity: 1 });
  }
  
  // Build discounts array (use first N discounts from seed if available)
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

// ============================================================
// HELPER: MEASURE CALCULATION
// ============================================================

async function measureCalculation(
  name: string,
  legConfigs: LegConfig[],
  iterations: number = MEASUREMENT_ITERATIONS
): Promise<number[]> {
  const timings: number[] = [];
  
  for (let i = 0; i < WARMUP_ITERATIONS + iterations; i++) {
    const quoteId = await createQuote();
    const legs = legConfigs.map(buildLegInput);
    
    const start = performance.now();
    await calculationService.calculate({ quote_id: quoteId, legs });
    const elapsed = performance.now() - start;
    
    // Skip warmup iterations
    if (i >= WARMUP_ITERATIONS) {
      timings.push(elapsed);
    }
  }
  
  return timings;
}

// ============================================================
// SCALING TESTS
// ============================================================

describe('Performance Baseline: Calculation Scaling', () => {
  
  describe('Legs Scaling', () => {
    const legCounts = [1, 2, 5, 10];
    const baseConfig: LegConfig = { nights: 5, adults: 2, children: 0, activities: 0, discounts: 0 };
    
    for (const legCount of legCounts) {
      it(`measures ${legCount} leg(s)`, async () => {
        const configs = Array(legCount).fill(baseConfig);
        const timings = await measureCalculation(`legs_${legCount}`, configs);
        recordResult('legs_scaling', legCount, timings);
        
        console.log(`  ${legCount} legs: avg=${(timings.reduce((a,b)=>a+b,0)/timings.length).toFixed(2)}ms`);
      }, 60000);
    }
  });
  
  describe('Nights Scaling', () => {
    const nightCounts = [3, 7, 14, 30];
    
    for (const nights of nightCounts) {
      it(`measures ${nights} nights`, async () => {
        const config: LegConfig = { nights, adults: 2, children: 0, activities: 0, discounts: 0 };
        const timings = await measureCalculation(`nights_${nights}`, [config]);
        recordResult('nights_scaling', nights, timings);
        
        console.log(`  ${nights} nights: avg=${(timings.reduce((a,b)=>a+b,0)/timings.length).toFixed(2)}ms`);
      }, 60000);
    }
  });
  
  describe('Guests Scaling', () => {
    const guestConfigs = [
      { adults: 2, children: 0 },
      { adults: 2, children: 2 },
      { adults: 4, children: 4 },
      { adults: 6, children: 6 },
    ];
    
    for (const { adults, children } of guestConfigs) {
      const totalGuests = adults + children;
      it(`measures ${totalGuests} guests (${adults}A + ${children}C)`, async () => {
        const config: LegConfig = { nights: 5, adults, children, activities: 0, discounts: 0 };
        const timings = await measureCalculation(`guests_${totalGuests}`, [config]);
        recordResult('guests_scaling', totalGuests, timings);
        
        console.log(`  ${totalGuests} guests: avg=${(timings.reduce((a,b)=>a+b,0)/timings.length).toFixed(2)}ms`);
      }, 60000);
    }
  });
  
  describe('Activities Scaling', () => {
    const activityCounts = [0, 2, 5];
    
    for (const activities of activityCounts) {
      it(`measures ${activities} activities`, async () => {
        const config: LegConfig = { nights: 5, adults: 2, children: 0, activities, discounts: 0 };
        const timings = await measureCalculation(`activities_${activities}`, [config]);
        recordResult('activities_scaling', activities, timings);
        
        console.log(`  ${activities} activities: avg=${(timings.reduce((a,b)=>a+b,0)/timings.length).toFixed(2)}ms`);
      }, 60000);
    }
  });
  
  describe('Discounts Scaling', () => {
    const discountCounts = [0, 1, 3];
    
    for (const discounts of discountCounts) {
      it(`measures ${discounts} discounts`, async () => {
        const config: LegConfig = { nights: 5, adults: 2, children: 0, activities: 0, discounts };
        const timings = await measureCalculation(`discounts_${discounts}`, [config]);
        recordResult('discounts_scaling', discounts, timings);
        
        console.log(`  ${discounts} discounts: avg=${(timings.reduce((a,b)=>a+b,0)/timings.length).toFixed(2)}ms`);
      }, 60000);
    }
  });
});

// ============================================================
// COMBINED LOAD TESTS
// ============================================================

describe('Performance Baseline: Combined Load', () => {
  
  it('measures MINIMAL quote (1 leg, 3 nights, 2 guests)', async () => {
    const config: LegConfig = { nights: 3, adults: 2, children: 0, activities: 0, discounts: 0 };
    const timings = await measureCalculation('minimal', [config]);
    recordResult('combined_minimal', 1, timings);
    
    console.log(`  MINIMAL: avg=${(timings.reduce((a,b)=>a+b,0)/timings.length).toFixed(2)}ms`);
  }, 60000);
  
  it('measures TYPICAL quote (2 legs, 5 nights, 4 guests, 2 activities, 1 discount)', async () => {
    const config: LegConfig = { nights: 5, adults: 2, children: 2, activities: 2, discounts: 1 };
    const timings = await measureCalculation('typical', [config, config]);
    recordResult('combined_typical', 2, timings);
    
    console.log(`  TYPICAL: avg=${(timings.reduce((a,b)=>a+b,0)/timings.length).toFixed(2)}ms`);
  }, 60000);
  
  it('measures LARGE quote (5 legs, 14 nights, 8 guests, 5 activities, 3 discounts)', async () => {
    const config: LegConfig = { nights: 14, adults: 4, children: 4, activities: 5, discounts: 3 };
    const configs = Array(5).fill(config);
    const timings = await measureCalculation('large', configs);
    recordResult('combined_large', 5, timings);
    
    console.log(`  LARGE: avg=${(timings.reduce((a,b)=>a+b,0)/timings.length).toFixed(2)}ms`);
  }, 120000);
  
  it('measures EXTREME quote (10 legs, 30 nights, 12 guests)', async () => {
    const config: LegConfig = { nights: 30, adults: 6, children: 6, activities: 5, discounts: 3 };
    const configs = Array(10).fill(config);
    const timings = await measureCalculation('extreme', configs, 3); // Fewer iterations for extreme
    recordResult('combined_extreme', 10, timings);
    
    console.log(`  EXTREME: avg=${(timings.reduce((a,b)=>a+b,0)/timings.length).toFixed(2)}ms`);
  }, 300000);
});

// ============================================================
// SERVICE OPERATION TESTS
// ============================================================

describe('Performance Baseline: Service Operations', () => {
  
  it('measures QuoteService.create()', async () => {
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
    
    recordResult('service_create', 1, timings);
    console.log(`  QuoteService.create(): avg=${(timings.reduce((a,b)=>a+b,0)/timings.length).toFixed(2)}ms`);
  }, 30000);
  
  it('measures QuoteService.send()', async () => {
    const timings: number[] = [];
    
    for (let i = 0; i < WARMUP_ITERATIONS + MEASUREMENT_ITERATIONS; i++) {
      // Setup: create and calculate
      const quoteId = await createQuote();
      const config: LegConfig = { nights: 5, adults: 2, children: 0, activities: 0, discounts: 0 };
      await calculationService.calculate({ quote_id: quoteId, legs: [buildLegInput(config)] });
      
      // Measure send
      const start = performance.now();
      await quoteService.send(quoteId);
      const elapsed = performance.now() - start;
      
      if (i >= WARMUP_ITERATIONS) {
        timings.push(elapsed);
      }
    }
    
    recordResult('service_send', 1, timings);
    console.log(`  QuoteService.send(): avg=${(timings.reduce((a,b)=>a+b,0)/timings.length).toFixed(2)}ms`);
  }, 60000);
});

// ============================================================
// RESULTS SUMMARY
// ============================================================

describe('Performance Baseline: Summary', () => {
  
  it('outputs results summary', () => {
    console.log('\n');
    console.log('='.repeat(60));
    console.log('PERFORMANCE BASELINE RESULTS');
    console.log('='.repeat(60));
    console.log(`Date: ${new Date().toISOString()}`);
    console.log(`Node: ${process.version}`);
    console.log(`Warmup iterations: ${WARMUP_ITERATIONS}`);
    console.log(`Measurement iterations: ${MEASUREMENT_ITERATIONS}`);
    console.log('');
    
    // Group by test type
    const groups = new Map<string, MeasurementResult[]>();
    for (const result of results) {
      const groupName = result.name.split('_')[0];
      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName)!.push(result);
    }
    
    // Output each group
    for (const [groupName, groupResults] of groups) {
      console.log(`${groupName.toUpperCase()} SCALING:`);
      
      let prevAvg = 0;
      for (const result of groupResults) {
        const ratio = prevAvg > 0 ? (result.avgMs / prevAvg).toFixed(1) : '-';
        console.log(`  ${result.name}: avg=${result.avgMs.toFixed(2)}ms, min=${result.minMs.toFixed(2)}ms, max=${result.maxMs.toFixed(2)}ms (${ratio}x)`);
        prevAvg = result.avgMs;
      }
      console.log('');
    }
    
    // Scaling analysis
    console.log('SCALING ANALYSIS:');
    analyzeScaling('legs_scaling', results.filter(r => r.name === 'legs_scaling'));
    analyzeScaling('nights_scaling', results.filter(r => r.name === 'nights_scaling'));
    analyzeScaling('guests_scaling', results.filter(r => r.name === 'guests_scaling'));
    
    console.log('='.repeat(60));
  });
});

function analyzeScaling(name: string, data: MeasurementResult[]): void {
  if (data.length < 2) return;
  
  // Calculate scaling factor
  const sorted = data.sort((a, b) => a.inputSize - b.inputSize);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  
  const inputRatio = last.inputSize / first.inputSize;
  const timeRatio = last.avgMs / first.avgMs;
  
  // Determine complexity
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
  
  console.log(`  ${name}: input ${inputRatio}x → time ${timeRatio.toFixed(1)}x = ${complexity}`);
}
