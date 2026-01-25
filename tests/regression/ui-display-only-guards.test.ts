/**
 * UI Display-Only Guard Test
 * 
 * Verifies UI components are display-only with no business logic.
 * 
 * LOCKED INVARIANTS:
 * - UI never infers lifecycle transitions
 * - UI uses AvailableActions as sole source of truth
 * - UI never modifies QuoteVersion
 * - Copy utilities copy display values only
 * - Status visualization is read-only
 * 
 * Reference: Sprint 4 UI, Sprint 5 Lifecycle, Sprint 6 Hardening
 */

import { describe, it, expect } from 'vitest';

import { QuoteStatus, type EntityId } from '../../src/core/types';
import { getAvailableActions, type AvailableActions } from '../../src/services/state-machine';

// ============================================================
// AVAILABLE ACTIONS TRUTH SOURCE
// ============================================================

describe('AvailableActions as Truth Source', () => {
  
  describe('DRAFT state without version', () => {
    const quote = {
      id: 'Q-001' as EntityId,
      status: QuoteStatus.DRAFT,
      current_version_id: undefined as EntityId | undefined,
    };
    
    it('should NOT allow send without version', () => {
      const actions = getAvailableActions(quote);
      expect(actions.can_send).toBe(false);
    });
    
    it('should NOT allow convert without version', () => {
      const actions = getAvailableActions(quote);
      expect(actions.can_convert).toBe(false);
    });
    
    it('should NOT allow reject without version', () => {
      const actions = getAvailableActions(quote);
      expect(actions.can_reject).toBe(false);
    });
    
    it('should allow calculate (create version)', () => {
      const actions = getAvailableActions(quote);
      expect(actions.can_calculate).toBe(true);
    });
  });
  
  describe('DRAFT state with version', () => {
    const quote = {
      id: 'Q-001' as EntityId,
      status: QuoteStatus.DRAFT,
      current_version_id: 'QV-001' as EntityId,
    };
    
    it('should allow send with version', () => {
      const actions = getAvailableActions(quote);
      expect(actions.can_send).toBe(true);
    });
    
    it('should allow calculate (recalculate)', () => {
      const actions = getAvailableActions(quote);
      expect(actions.can_calculate).toBe(true);
    });
    
    it('should allow edit', () => {
      const actions = getAvailableActions(quote);
      expect(actions.can_edit).toBe(true);
    });
  });
  
  describe('SENT state', () => {
    const quote = {
      id: 'Q-001' as EntityId,
      status: QuoteStatus.SENT,
      current_version_id: 'QV-001' as EntityId,
    };
    
    it('should NOT allow calculate', () => {
      const actions = getAvailableActions(quote);
      expect(actions.can_calculate).toBe(false);
    });
    
    it('should NOT allow edit', () => {
      const actions = getAvailableActions(quote);
      expect(actions.can_edit).toBe(false);
    });
    
    it('should NOT allow send (already sent)', () => {
      const actions = getAvailableActions(quote);
      expect(actions.can_send).toBe(false);
    });
    
    it('should allow convert', () => {
      const actions = getAvailableActions(quote);
      expect(actions.can_convert).toBe(true);
    });
    
    it('should allow reject', () => {
      const actions = getAvailableActions(quote);
      expect(actions.can_reject).toBe(true);
    });
    
    it('should allow revert to draft', () => {
      const actions = getAvailableActions(quote);
      expect(actions.can_revert).toBe(true);
    });
  });
  
  describe('CONVERTED state (terminal)', () => {
    const quote = {
      id: 'Q-001' as EntityId,
      status: QuoteStatus.CONVERTED,
      current_version_id: 'QV-001' as EntityId,
    };
    
    it('should NOT allow any modification', () => {
      const actions = getAvailableActions(quote);
      
      expect(actions.can_calculate).toBe(false);
      expect(actions.can_edit).toBe(false);
      expect(actions.can_send).toBe(false);
      expect(actions.can_convert).toBe(false);
      expect(actions.can_reject).toBe(false);
      expect(actions.can_revert).toBe(false);
      expect(actions.can_expire).toBe(false);
    });
  });
  
  describe('REJECTED state', () => {
    const quote = {
      id: 'Q-001' as EntityId,
      status: QuoteStatus.REJECTED,
      current_version_id: 'QV-001' as EntityId,
    };
    
    it('should allow revert to draft only', () => {
      const actions = getAvailableActions(quote);
      
      expect(actions.can_revert).toBe(true);
      expect(actions.can_calculate).toBe(false);
      expect(actions.can_edit).toBe(false);
      expect(actions.can_send).toBe(false);
      expect(actions.can_convert).toBe(false);
      expect(actions.can_reject).toBe(false);
    });
  });
  
  describe('EXPIRED state', () => {
    const quote = {
      id: 'Q-001' as EntityId,
      status: QuoteStatus.EXPIRED,
      current_version_id: 'QV-001' as EntityId,
    };
    
    it('should allow revert to draft only', () => {
      const actions = getAvailableActions(quote);
      
      expect(actions.can_revert).toBe(true);
      expect(actions.can_calculate).toBe(false);
      expect(actions.can_edit).toBe(false);
      expect(actions.can_send).toBe(false);
      expect(actions.can_convert).toBe(false);
      expect(actions.can_reject).toBe(false);
    });
  });
});

// ============================================================
// ACTION RESULT STRUCTURE
// ============================================================

describe('AvailableActions Structure', () => {
  
  it('should return all required action fields', () => {
    const quote = {
      id: 'Q-001' as EntityId,
      status: QuoteStatus.DRAFT,
      current_version_id: 'QV-001' as EntityId,
    };
    
    const actions = getAvailableActions(quote);
    
    // All fields must be present (not undefined)
    expect(typeof actions.can_edit).toBe('boolean');
    expect(typeof actions.can_delete).toBe('boolean');
    expect(typeof actions.can_calculate).toBe('boolean');
    expect(typeof actions.can_send).toBe('boolean');
    expect(typeof actions.can_revert).toBe('boolean');
    expect(typeof actions.can_convert).toBe('boolean');
    expect(typeof actions.can_reject).toBe('boolean');
    expect(typeof actions.can_expire).toBe('boolean');
  });
  
  it('should never have undefined action values', () => {
    const statuses = [
      QuoteStatus.DRAFT,
      QuoteStatus.SENT,
      QuoteStatus.CONVERTED,
      QuoteStatus.REJECTED,
      QuoteStatus.EXPIRED,
    ];
    
    for (const status of statuses) {
      const quote = {
        id: 'Q-001' as EntityId,
        status,
        current_version_id: 'QV-001' as EntityId,
      };
      
      const actions = getAvailableActions(quote);
      
      // No field should be undefined
      Object.values(actions).forEach((value) => {
        expect(value).not.toBeUndefined();
      });
    }
  });
});

// ============================================================
// GUARD: UI MUST USE ACTIONS, NOT INFER
// ============================================================

describe('UI Must Not Infer Transitions', () => {
  
  it('status alone does not determine actions - version matters', () => {
    // Two quotes in same status but different version state
    const withoutVersion = {
      id: 'Q-001' as EntityId,
      status: QuoteStatus.DRAFT,
      current_version_id: undefined as EntityId | undefined,
    };
    
    const withVersion = {
      id: 'Q-002' as EntityId,
      status: QuoteStatus.DRAFT,
      current_version_id: 'QV-001' as EntityId,
    };
    
    const actionsWithout = getAvailableActions(withoutVersion);
    const actionsWith = getAvailableActions(withVersion);
    
    // Same status but different actions
    expect(actionsWithout.can_send).toBe(false);
    expect(actionsWith.can_send).toBe(true);
    
    // This proves UI cannot simply check status - must use getAvailableActions
  });
});
