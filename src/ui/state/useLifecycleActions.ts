/**
 * Lifecycle Actions Hook
 * 
 * Manages lifecycle action execution.
 * 
 * GUARDRAILS:
 * - NO optimistic updates
 * - NO inferred state logic
 * - All transitions confirmed by backend response
 * - Refresh quote data after every action
 */

import { useState, useCallback } from 'react';
import type { EntityId, Quote, LoadingState } from '../types';
import { LifecycleAction } from '../components/lifecycle/types';
import { getApiClient } from '../services/api-client';

/**
 * Return type for useLifecycleActions hook.
 */
export interface UseLifecycleActionsReturn {
  /** Current action being executed (null if idle) */
  pendingAction: LifecycleAction | null;
  
  /** Loading state */
  state: LoadingState;
  
  /** Error message if action failed */
  error: string | null;
  
  /** Execute a lifecycle action */
  executeAction: (action: LifecycleAction) => Promise<Quote | null>;
  
  /** Clear error state */
  clearError: () => void;
}

/**
 * Hook for managing lifecycle actions.
 * 
 * GUARDRAIL: This hook calls backend explicitly.
 * - No state simulation
 * - No optimistic updates
 * - Waits for backend confirmation
 */
export function useLifecycleActions(
  quoteId: EntityId | null,
  onActionComplete?: (action: LifecycleAction, updatedQuote: Quote) => void
): UseLifecycleActionsReturn {
  const [pendingAction, setPendingAction] = useState<LifecycleAction | null>(null);
  const [state, setState] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);

  const executeAction = useCallback(async (
    action: LifecycleAction
  ): Promise<Quote | null> => {
    if (!quoteId) {
      setError('No quote ID provided');
      setState('error');
      return null;
    }

    setPendingAction(action);
    setState('loading');
    setError(null);

    try {
      const api = getApiClient();
      let updatedQuote: Quote;

      // GUARDRAIL: Each action calls a specific backend endpoint
      // No state inference, no optimistic updates
      switch (action) {
        case LifecycleAction.SEND:
          updatedQuote = await api.sendQuote(quoteId);
          break;
        
        case LifecycleAction.REVERT_TO_DRAFT:
          updatedQuote = await api.revertQuote(quoteId);
          break;
        
        case LifecycleAction.CONVERT:
          updatedQuote = await api.convertQuote(quoteId);
          break;
        
        case LifecycleAction.REJECT:
          updatedQuote = await api.rejectQuote(quoteId);
          break;
        
        case LifecycleAction.EXPIRE:
          updatedQuote = await api.expireQuote(quoteId);
          break;
        
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      // Action succeeded - backend confirmed the transition
      setState('success');
      setPendingAction(null);

      // Notify parent to refresh quote data
      if (onActionComplete) {
        onActionComplete(action, updatedQuote);
      }

      return updatedQuote;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed';
      setError(message);
      setState('error');
      setPendingAction(null);
      return null;
    }
  }, [quoteId, onActionComplete]);

  const clearError = useCallback(() => {
    setError(null);
    if (state === 'error') {
      setState('idle');
    }
  }, [state]);

  return {
    pendingAction,
    state,
    error,
    executeAction,
    clearError,
  };
}
