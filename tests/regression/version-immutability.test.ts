/**
 * Version Immutability Regression Test
 * 
 * Verifies QuoteVersion is IMMUTABLE after creation.
 * 
 * LOCKED INVARIANT:
 * - QuoteVersion cannot be modified after creation
 * - New calculations create new versions, never update existing
 * - Version number increments on each calculation
 * - Status transitions do not modify version content
 * 
 * Reference: Sprint 2 Freeze, Sprint 5 Lifecycle
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import { QuoteStatus, type EntityId } from '../../src/core/types';
import { QuoteService, CalculationService } from '../../src/services';
import { loadDataStore, type DataStore } from '../../src/core/calculation';
import { createJsonDataContext } from '../../src/data/repositories/json-repository';
import type { DataContext } from '../../src/data/repositories/interfaces';

// ============================================================
// TEST SETUP
// ============================================================

const TEST_DATA_PATH = '/tmp/version-immutability-test';

let dataContext: DataContext;
let referenceData: DataStore;
let quoteService: QuoteService;
let calculationService: CalculationService;

beforeEach(async () => {
  // Clean up any existing test data
  if (fs.existsSync(TEST_DATA_PATH)) {
    fs.rmSync(TEST_DATA_PATH, { recursive: true });
  }
  fs.mkdirSync(TEST_DATA_PATH, { recursive: true });
  
  // Load reference data
  const seedPath = path.join(__dirname, '../../src/data/seed/maldives.json');
  const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  referenceData = loadDataStore(seedData);
  
  // Create data context
  dataContext = createJsonDataContext(TEST_DATA_PATH);
  
  // Create services
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

async function createTestQuote(): Promise<EntityId> {
  const result = await quoteService.create({
    client_name: 'Immutability Test Client',
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
    throw new Error(`Failed to calculate quote: ${result.error.message}`);
  }
  
  return result.value.id;
}

// ============================================================
// REGRESSION TESTS
// ============================================================

describe('Version Immutability', () => {
  
  describe('V-IMM-001: Version content cannot change after creation', () => {
    
    it('should preserve version totals after status transitions', async () => {
      // Arrange: Create quote and calculate
      const quoteId = await createTestQuote();
      const versionId = await calculateQuote(quoteId);
      
      // Capture original version data
      const originalVersion = await dataContext.quoteVersions.findById(versionId);
      expect(originalVersion).not.toBeNull();
      
      const originalTotals = {
        cost: originalVersion!.summary.totals.total_cost,
        markup: originalVersion!.summary.totals.total_markup,
        sell: originalVersion!.summary.totals.total_sell,
      };
      
      // Act: Transition quote through states
      await quoteService.send(quoteId);
      await quoteService.revertToDraft(quoteId);
      await quoteService.send(quoteId);
      await quoteService.markConverted(quoteId);
      
      // Assert: Version totals unchanged
      const versionAfter = await dataContext.quoteVersions.findById(versionId);
      expect(versionAfter).not.toBeNull();
      
      expect(versionAfter!.summary.totals.total_cost).toBe(originalTotals.cost);
      expect(versionAfter!.summary.totals.total_markup).toBe(originalTotals.markup);
      expect(versionAfter!.summary.totals.total_sell).toBe(originalTotals.sell);
    });
    
    it('should preserve leg details after recalculation creates new version', async () => {
      // Arrange: Create quote and calculate first version
      const quoteId = await createTestQuote();
      const version1Id = await calculateQuote(quoteId);
      
      // Capture first version leg details
      const version1 = await dataContext.quoteVersions.findById(version1Id);
      expect(version1).not.toBeNull();
      
      const v1Legs = version1!.legs.map(leg => ({
        resort_id: leg.resort_id,
        room_type_id: leg.room_type_id,
        total_cost: leg.totals.cost_amount,
        total_sell: leg.totals.sell_amount,
      }));
      
      // Act: Recalculate (creates new version)
      const version2Id = await calculateQuote(quoteId);
      
      // Assert: First version unchanged
      const version1After = await dataContext.quoteVersions.findById(version1Id);
      expect(version1After).not.toBeNull();
      
      version1After!.legs.forEach((leg, index) => {
        expect(leg.resort_id).toBe(v1Legs[index].resort_id);
        expect(leg.room_type_id).toBe(v1Legs[index].room_type_id);
        expect(leg.totals.cost_amount).toBe(v1Legs[index].total_cost);
        expect(leg.totals.sell_amount).toBe(v1Legs[index].total_sell);
      });
      
      // Verify new version was created
      expect(version2Id).not.toBe(version1Id);
    });
    
    it('should preserve audit trail after version creation', async () => {
      // Arrange
      const quoteId = await createTestQuote();
      const versionId = await calculateQuote(quoteId);
      
      // Capture original audit
      const version = await dataContext.quoteVersions.findById(versionId);
      expect(version).not.toBeNull();
      
      const originalAuditLength = version!.audit?.steps?.length ?? 0;
      const originalFirstStep = version!.audit?.steps?.[0];
      
      // Act: Transition quote
      await quoteService.send(quoteId);
      await quoteService.revertToDraft(quoteId);
      
      // Assert: Audit unchanged
      const versionAfter = await dataContext.quoteVersions.findById(versionId);
      expect(versionAfter!.audit?.steps?.length).toBe(originalAuditLength);
      
      if (originalFirstStep && versionAfter!.audit?.steps?.[0]) {
        expect(versionAfter!.audit.steps[0].step_type).toBe(originalFirstStep.step_type);
        expect(versionAfter!.audit.steps[0].description).toBe(originalFirstStep.description);
      }
    });
  });
  
  describe('V-IMM-002: Version numbers increment monotonically', () => {
    
    it('should increment version number on each calculation', async () => {
      // Arrange
      const quoteId = await createTestQuote();
      
      // Act: Calculate multiple times
      const v1Id = await calculateQuote(quoteId);
      const v2Id = await calculateQuote(quoteId);
      const v3Id = await calculateQuote(quoteId);
      
      // Assert: Version numbers increment
      const v1 = await dataContext.quoteVersions.findById(v1Id);
      const v2 = await dataContext.quoteVersions.findById(v2Id);
      const v3 = await dataContext.quoteVersions.findById(v3Id);
      
      expect(v1!.version_number).toBe(1);
      expect(v2!.version_number).toBe(2);
      expect(v3!.version_number).toBe(3);
    });
    
    it('should never reuse version numbers', async () => {
      // Arrange
      const quoteId = await createTestQuote();
      
      // Calculate, send, revert, calculate again
      await calculateQuote(quoteId);  // v1
      await quoteService.send(quoteId);
      await quoteService.revertToDraft(quoteId);
      const v2Id = await calculateQuote(quoteId);  // v2
      
      // Assert: v2 is 2, not 1
      const v2 = await dataContext.quoteVersions.findById(v2Id);
      expect(v2!.version_number).toBe(2);
    });
  });
  
  describe('V-IMM-003: Quote.current_version_id updates correctly', () => {
    
    it('should update current_version_id on new calculation', async () => {
      // Arrange
      const quoteId = await createTestQuote();
      
      // Act
      const v1Id = await calculateQuote(quoteId);
      const quoteAfterV1 = await dataContext.quotes.findById(quoteId);
      
      const v2Id = await calculateQuote(quoteId);
      const quoteAfterV2 = await dataContext.quotes.findById(quoteId);
      
      // Assert
      expect(quoteAfterV1!.current_version_id).toBe(v1Id);
      expect(quoteAfterV2!.current_version_id).toBe(v2Id);
    });
    
    it('should NOT change current_version_id on status transition', async () => {
      // Arrange
      const quoteId = await createTestQuote();
      const versionId = await calculateQuote(quoteId);
      
      // Act: Transition through states
      await quoteService.send(quoteId);
      const quoteAfterSend = await dataContext.quotes.findById(quoteId);
      
      await quoteService.revertToDraft(quoteId);
      const quoteAfterRevert = await dataContext.quotes.findById(quoteId);
      
      // Assert: current_version_id unchanged
      expect(quoteAfterSend!.current_version_id).toBe(versionId);
      expect(quoteAfterRevert!.current_version_id).toBe(versionId);
    });
  });
});
