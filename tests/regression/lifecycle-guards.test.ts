/**
 * Lifecycle Guard Regression Test
 * 
 * Verifies state machine rules are enforced.
 * 
 * LOCKED INVARIANTS:
 * - Quote cannot be sent without a QuoteVersion (A-021)
 * - State transitions must follow valid paths
 * - CONVERTED state is terminal
 * - Only DRAFT quotes can be calculated
 * - UI never infers transitions (tested via service layer)
 * 
 * Reference: Sprint 5 Lifecycle, State Machine
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import { QuoteStatus, type EntityId } from '../../src/core/types';
import { QuoteService, CalculationService, QuoteServiceError } from '../../src/services';
import { loadDataStore, type DataStore } from '../../src/core/calculation';
import { createJsonDataContext } from '../../src/data/repositories/json-repository';
import type { DataContext } from '../../src/data/repositories/interfaces';

// ============================================================
// TEST SETUP
// ============================================================

const TEST_DATA_PATH = '/tmp/lifecycle-guard-test';

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
// HELPER FUNCTIONS
// ============================================================

async function createQuote(): Promise<EntityId> {
  const result = await quoteService.create({
    client_name: 'Lifecycle Test Client',
    client_email: 'test@example.com',
    currency_code: 'USD',
    validity_days: 14,
  });
  
  if (!result.success) {
    throw new Error(`Failed to create quote: ${result.error.message}`);
  }
  
  return result.value.id;
}

async function calculateQuote(quoteId: EntityId): Promise<EntityId> {
  const result = await calculationService.calculate({
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
  
  if (!result.success) {
    throw new Error(`Failed to calculate: ${result.error.message}`);
  }
  
  return result.value.id;
}

// ============================================================
// A-021: QUOTE CANNOT BE SENT WITHOUT VERSION
// ============================================================

describe('A-021: Quote Cannot Be Sent Without Version', () => {
  
  it('should reject send on quote without version', async () => {
    // Arrange: Create quote but DON'T calculate
    const quoteId = await createQuote();
    
    // Act: Attempt to send
    const result = await quoteService.send(quoteId);
    
    // Assert: Should fail with MISSING_VERSION
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(QuoteServiceError.MISSING_VERSION);
  });
  
  it('should allow send on quote WITH version', async () => {
    // Arrange: Create quote and calculate
    const quoteId = await createQuote();
    await calculateQuote(quoteId);
    
    // Act: Send
    const result = await quoteService.send(quoteId);
    
    // Assert: Should succeed
    expect(result.success).toBe(true);
    expect(result.value.status).toBe(QuoteStatus.SENT);
  });
});

// ============================================================
// STATE TRANSITION RULES
// ============================================================

describe('State Transition Rules', () => {
  
  describe('DRAFT state', () => {
    
    it('should allow DRAFT → SENT (with version)', async () => {
      const quoteId = await createQuote();
      await calculateQuote(quoteId);
      
      const result = await quoteService.send(quoteId);
      
      expect(result.success).toBe(true);
      expect(result.value.status).toBe(QuoteStatus.SENT);
    });
    
    it('should NOT allow DRAFT → CONVERTED', async () => {
      const quoteId = await createQuote();
      await calculateQuote(quoteId);
      
      const result = await quoteService.markConverted(quoteId);
      
      expect(result.success).toBe(false);
      expect(result.error.code).toBe(QuoteServiceError.INVALID_STATE_TRANSITION);
    });
    
    it('should NOT allow DRAFT → REJECTED', async () => {
      const quoteId = await createQuote();
      await calculateQuote(quoteId);
      
      const result = await quoteService.markRejected(quoteId);
      
      expect(result.success).toBe(false);
      expect(result.error.code).toBe(QuoteServiceError.INVALID_STATE_TRANSITION);
    });
    
    it('should NOT allow DRAFT → EXPIRED', async () => {
      const quoteId = await createQuote();
      await calculateQuote(quoteId);
      
      const result = await quoteService.markExpired(quoteId);
      
      expect(result.success).toBe(false);
      expect(result.error.code).toBe(QuoteServiceError.INVALID_STATE_TRANSITION);
    });
  });
  
  describe('SENT state', () => {
    
    it('should allow SENT → CONVERTED', async () => {
      const quoteId = await createQuote();
      await calculateQuote(quoteId);
      await quoteService.send(quoteId);
      
      const result = await quoteService.markConverted(quoteId);
      
      expect(result.success).toBe(true);
      expect(result.value.status).toBe(QuoteStatus.CONVERTED);
    });
    
    it('should allow SENT → REJECTED', async () => {
      const quoteId = await createQuote();
      await calculateQuote(quoteId);
      await quoteService.send(quoteId);
      
      const result = await quoteService.markRejected(quoteId);
      
      expect(result.success).toBe(true);
      expect(result.value.status).toBe(QuoteStatus.REJECTED);
    });
    
    it('should allow SENT → EXPIRED', async () => {
      const quoteId = await createQuote();
      await calculateQuote(quoteId);
      await quoteService.send(quoteId);
      
      const result = await quoteService.markExpired(quoteId);
      
      expect(result.success).toBe(true);
      expect(result.value.status).toBe(QuoteStatus.EXPIRED);
    });
    
    it('should allow SENT → DRAFT (revert)', async () => {
      const quoteId = await createQuote();
      await calculateQuote(quoteId);
      await quoteService.send(quoteId);
      
      const result = await quoteService.revertToDraft(quoteId);
      
      expect(result.success).toBe(true);
      expect(result.value.status).toBe(QuoteStatus.DRAFT);
    });
    
    it('should NOT allow SENT → SENT', async () => {
      const quoteId = await createQuote();
      await calculateQuote(quoteId);
      await quoteService.send(quoteId);
      
      const result = await quoteService.send(quoteId);
      
      expect(result.success).toBe(false);
      expect(result.error.code).toBe(QuoteServiceError.INVALID_STATE_TRANSITION);
    });
  });
  
  describe('CONVERTED state (terminal)', () => {
    
    it('should NOT allow CONVERTED → any state', async () => {
      const quoteId = await createQuote();
      await calculateQuote(quoteId);
      await quoteService.send(quoteId);
      await quoteService.markConverted(quoteId);
      
      // Try all transitions
      const toDraft = await quoteService.revertToDraft(quoteId);
      const toSent = await quoteService.send(quoteId);
      const toRejected = await quoteService.markRejected(quoteId);
      const toExpired = await quoteService.markExpired(quoteId);
      
      expect(toDraft.success).toBe(false);
      expect(toSent.success).toBe(false);
      expect(toRejected.success).toBe(false);
      expect(toExpired.success).toBe(false);
    });
  });
  
  describe('REJECTED state', () => {
    
    it('should allow REJECTED → DRAFT (revert)', async () => {
      const quoteId = await createQuote();
      await calculateQuote(quoteId);
      await quoteService.send(quoteId);
      await quoteService.markRejected(quoteId);
      
      const result = await quoteService.revertToDraft(quoteId);
      
      expect(result.success).toBe(true);
      expect(result.value.status).toBe(QuoteStatus.DRAFT);
    });
    
    it('should NOT allow REJECTED → CONVERTED', async () => {
      const quoteId = await createQuote();
      await calculateQuote(quoteId);
      await quoteService.send(quoteId);
      await quoteService.markRejected(quoteId);
      
      const result = await quoteService.markConverted(quoteId);
      
      expect(result.success).toBe(false);
    });
  });
  
  describe('EXPIRED state', () => {
    
    it('should allow EXPIRED → DRAFT (revert)', async () => {
      const quoteId = await createQuote();
      await calculateQuote(quoteId);
      await quoteService.send(quoteId);
      await quoteService.markExpired(quoteId);
      
      const result = await quoteService.revertToDraft(quoteId);
      
      expect(result.success).toBe(true);
      expect(result.value.status).toBe(QuoteStatus.DRAFT);
    });
    
    it('should NOT allow EXPIRED → CONVERTED', async () => {
      const quoteId = await createQuote();
      await calculateQuote(quoteId);
      await quoteService.send(quoteId);
      await quoteService.markExpired(quoteId);
      
      const result = await quoteService.markConverted(quoteId);
      
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================
// CALCULATION GUARDS
// ============================================================

describe('Calculation Guards', () => {
  
  it('should allow calculation only in DRAFT status', async () => {
    const quoteId = await createQuote();
    await calculateQuote(quoteId); // First calc OK
    await quoteService.send(quoteId);
    
    // Try to calculate in SENT status
    const result = await calculationService.calculate({
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
    
    expect(result.success).toBe(false);
  });
  
  it('should allow calculation after revert to DRAFT', async () => {
    const quoteId = await createQuote();
    await calculateQuote(quoteId);
    await quoteService.send(quoteId);
    await quoteService.revertToDraft(quoteId);
    
    // Calculation should now work
    const result = await calculationService.calculate({
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
    
    expect(result.success).toBe(true);
  });
});
