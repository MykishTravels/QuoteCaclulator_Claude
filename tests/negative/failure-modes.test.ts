/**
 * Negative Path Tests
 * 
 * Verifies system handles failure modes correctly.
 * 
 * FAILURE MODES TESTED:
 * - Quote not found
 * - Version not found
 * - Invalid entity references in calculation
 * - Missing required data
 * - Invalid date ranges
 * 
 * Reference: Sprint 7 Production Readiness
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import { QuoteStatus, type EntityId } from '../../src/core/types';
import { 
  QuoteService, 
  CalculationService, 
  QuoteServiceError,
  CalculationServiceError,
} from '../../src/services';
import { loadDataStore, type DataStore } from '../../src/core/calculation';
import { createJsonDataContext } from '../../src/data/repositories/json-repository';
import type { DataContext } from '../../src/data/repositories/interfaces';

// ============================================================
// TEST SETUP
// ============================================================

const TEST_DATA_PATH = '/tmp/negative-path-test';

let dataContext: DataContext;
let referenceData: DataStore;
let quoteService: QuoteService;
let calculationService: CalculationService;

beforeEach(async () => {
  if (fs.existsSync(TEST_DATA_PATH)) {
    fs.rmSync(TEST_DATA_PATH, { recursive: true });
  }
  fs.mkdirSync(TEST_DATA_PATH, { recursive: true });
  
  const seedPath = path.join(__dirname, '../../src/data/seed/maldives.json');
  const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  referenceData = loadDataStore(seedData);
  
  dataContext = createJsonDataContext(TEST_DATA_PATH);
  
  quoteService = new QuoteService(dataContext);
  calculationService = new CalculationService(dataContext, referenceData);
});

afterEach(() => {
  if (fs.existsSync(TEST_DATA_PATH)) {
    fs.rmSync(TEST_DATA_PATH, { recursive: true });
  }
});

// ============================================================
// QUOTE NOT FOUND
// ============================================================

describe('Quote Not Found', () => {
  
  it('should return error when getting non-existent quote', async () => {
    const result = await quoteService.getById('Q-NONEXISTENT' as EntityId);
    
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(QuoteServiceError.QUOTE_NOT_FOUND);
  });
  
  it('should return error when sending non-existent quote', async () => {
    const result = await quoteService.send('Q-NONEXISTENT' as EntityId);
    
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(QuoteServiceError.QUOTE_NOT_FOUND);
  });
  
  it('should return error when calculating non-existent quote', async () => {
    const result = await calculationService.calculate({
      quote_id: 'Q-NONEXISTENT' as EntityId,
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
    
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(CalculationServiceError.QUOTE_NOT_FOUND);
  });
  
  it('should return error when deleting non-existent quote', async () => {
    const result = await quoteService.delete('Q-NONEXISTENT' as EntityId);
    
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(QuoteServiceError.QUOTE_NOT_FOUND);
  });
  
  it('should return error when reverting non-existent quote', async () => {
    const result = await quoteService.revertToDraft('Q-NONEXISTENT' as EntityId);
    
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(QuoteServiceError.QUOTE_NOT_FOUND);
  });
});

// ============================================================
// VERSION NOT FOUND
// ============================================================

describe('Version Not Found', () => {
  
  it('should return error when getting non-existent version', async () => {
    // Create a quote first
    const createResult = await quoteService.create({
      client_name: 'Test',
      client_email: 'test@example.com',
      currency_code: 'USD',
      validity_days: 14,
    });
    expect(createResult.success).toBe(true);
    const quoteId = createResult.value.id;
    
    // Try to get non-existent version
    const result = await quoteService.getVersion(quoteId, 'QV-NONEXISTENT' as EntityId);
    
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(QuoteServiceError.VERSION_NOT_FOUND);
  });
});

// ============================================================
// INVALID ENTITY REFERENCES IN CALCULATION
// ============================================================

describe('Invalid Entity References', () => {
  
  it('should fail calculation with non-existent resort', async () => {
    // Create quote
    const createResult = await quoteService.create({
      client_name: 'Test',
      client_email: 'test@example.com',
      currency_code: 'USD',
      validity_days: 14,
    });
    const quoteId = createResult.value.id;
    
    // Calculate with bad resort ID
    const result = await calculationService.calculate({
      quote_id: quoteId,
      legs: [{
        resort_id: 'RST-NONEXISTENT' as EntityId,
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
    
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(CalculationServiceError.CALCULATION_FAILED);
  });
  
  it('should fail calculation with non-existent room type', async () => {
    // Create quote
    const createResult = await quoteService.create({
      client_name: 'Test',
      client_email: 'test@example.com',
      currency_code: 'USD',
      validity_days: 14,
    });
    const quoteId = createResult.value.id;
    
    // Calculate with bad room type ID
    const result = await calculationService.calculate({
      quote_id: quoteId,
      legs: [{
        resort_id: 'RST-001' as EntityId,
        room_type_id: 'RT-NONEXISTENT' as EntityId,
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
    
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(CalculationServiceError.CALCULATION_FAILED);
  });
});

// ============================================================
// MISSING REQUIRED DATA
// ============================================================

describe('Missing Required Data', () => {
  
  it('should fail calculation with empty legs array', async () => {
    // Create quote
    const createResult = await quoteService.create({
      client_name: 'Test',
      client_email: 'test@example.com',
      currency_code: 'USD',
      validity_days: 14,
    });
    const quoteId = createResult.value.id;
    
    // Calculate with no legs
    const result = await calculationService.calculate({
      quote_id: quoteId,
      legs: [],
    });
    
    // Should fail (no legs to calculate)
    expect(result.success).toBe(false);
  });
  
  it('should fail calculation with zero adults', async () => {
    // Create quote
    const createResult = await quoteService.create({
      client_name: 'Test',
      client_email: 'test@example.com',
      currency_code: 'USD',
      validity_days: 14,
    });
    const quoteId = createResult.value.id;
    
    // Calculate with zero adults
    const result = await calculationService.calculate({
      quote_id: quoteId,
      legs: [{
        resort_id: 'RST-001' as EntityId,
        room_type_id: 'RT-001' as EntityId,
        check_in_date: '2026-03-01',
        check_out_date: '2026-03-05',
        adults_count: 0,
        children: [],
        meal_plan_id: 'MP-001' as EntityId,
        transfer_type_id: 'TT-001' as EntityId,
        activities: [],
        discounts: [],
      }],
    });
    
    // Should fail (occupancy validation)
    expect(result.success).toBe(false);
  });
});

// ============================================================
// INVALID DATE RANGES
// ============================================================

describe('Invalid Date Ranges', () => {
  
  it('should fail calculation with checkout before checkin', async () => {
    // Create quote
    const createResult = await quoteService.create({
      client_name: 'Test',
      client_email: 'test@example.com',
      currency_code: 'USD',
      validity_days: 14,
    });
    const quoteId = createResult.value.id;
    
    // Calculate with invalid dates
    const result = await calculationService.calculate({
      quote_id: quoteId,
      legs: [{
        resort_id: 'RST-001' as EntityId,
        room_type_id: 'RT-001' as EntityId,
        check_in_date: '2026-03-05',   // After checkout
        check_out_date: '2026-03-01',  // Before checkin
        adults_count: 2,
        children: [],
        meal_plan_id: 'MP-001' as EntityId,
        transfer_type_id: 'TT-001' as EntityId,
        activities: [],
        discounts: [],
      }],
    });
    
    expect(result.success).toBe(false);
  });
  
  it('should fail calculation with same checkin and checkout', async () => {
    // Create quote
    const createResult = await quoteService.create({
      client_name: 'Test',
      client_email: 'test@example.com',
      currency_code: 'USD',
      validity_days: 14,
    });
    const quoteId = createResult.value.id;
    
    // Calculate with 0 nights
    const result = await calculationService.calculate({
      quote_id: quoteId,
      legs: [{
        resort_id: 'RST-001' as EntityId,
        room_type_id: 'RT-001' as EntityId,
        check_in_date: '2026-03-01',
        check_out_date: '2026-03-01', // Same day = 0 nights
        adults_count: 2,
        children: [],
        meal_plan_id: 'MP-001' as EntityId,
        transfer_type_id: 'TT-001' as EntityId,
        activities: [],
        discounts: [],
      }],
    });
    
    expect(result.success).toBe(false);
  });
});

// ============================================================
// CONCURRENT OPERATION GUARDS
// ============================================================

describe('Operation Idempotency', () => {
  
  it('should handle duplicate send attempts gracefully', async () => {
    // Create and calculate
    const createResult = await quoteService.create({
      client_name: 'Test',
      client_email: 'test@example.com',
      currency_code: 'USD',
      validity_days: 14,
    });
    const quoteId = createResult.value.id;
    
    await calculationService.calculate({
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
    
    // First send
    const firstSend = await quoteService.send(quoteId);
    expect(firstSend.success).toBe(true);
    
    // Second send (should fail - already SENT)
    const secondSend = await quoteService.send(quoteId);
    expect(secondSend.success).toBe(false);
    expect(secondSend.error.code).toBe(QuoteServiceError.INVALID_STATE_TRANSITION);
    
    // Quote should still be in SENT state
    const quote = await quoteService.getById(quoteId);
    expect(quote.success).toBe(true);
    expect(quote.value.status).toBe(QuoteStatus.SENT);
  });
});
