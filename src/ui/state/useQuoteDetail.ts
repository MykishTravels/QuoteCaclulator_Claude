/**
 * Quote Detail Hook
 * 
 * Fetches and manages quote detail state.
 * 
 * GUARDRAIL: READ-ONLY data fetching.
 * - Never modifies quote or version
 * - Only reads from API
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  EntityId,
  Quote,
  QuoteVersion,
  AvailableActions,
  QuoteDetailData,
  LoadingState,
} from '../types';
import { getApiClient } from '../services/api-client';

/**
 * Return type for useQuoteDetail hook.
 */
export interface UseQuoteDetailReturn {
  /** Loading state */
  state: LoadingState;
  
  /** Quote data (null if not loaded) */
  quote: Quote | null;
  
  /** Current version (null if no version exists) */
  currentVersion: QuoteVersion | null;
  
  /** Available actions for current state */
  actions: AvailableActions | null;
  
  /** Error message if failed */
  error: string | null;
  
  /** Refresh quote data */
  refresh: () => Promise<void>;
  
  /** Whether quote has a version (safe to generate PDF/email) */
  hasVersion: boolean;
}

/**
 * Default available actions (all false).
 */
const NO_ACTIONS: AvailableActions = {
  can_edit: false,
  can_calculate: false,
  can_send: false,
  can_revert_to_draft: false,
  can_convert: false,
  can_reject: false,
  can_expire: false,
};

/**
 * Hook for fetching and managing quote detail.
 * 
 * GUARDRAIL: This is READ-ONLY.
 * Use explicit action methods for state changes.
 */
export function useQuoteDetail(quoteId: EntityId | null): UseQuoteDetailReturn {
  const [state, setState] = useState<LoadingState>('idle');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [currentVersion, setCurrentVersion] = useState<QuoteVersion | null>(null);
  const [actions, setActions] = useState<AvailableActions | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!quoteId) {
      setState('idle');
      setQuote(null);
      setCurrentVersion(null);
      setActions(null);
      setError(null);
      return;
    }

    setState('loading');
    setError(null);

    try {
      const api = getApiClient();
      const data = await api.getQuoteDetail(quoteId);
      
      setQuote(data.quote);
      setCurrentVersion(data.currentVersion);
      setActions(data.actions);
      setState('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load quote';
      setError(message);
      setState('error');
    }
  }, [quoteId]);

  // Load on mount and when quoteId changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Derived state
  const hasVersion = currentVersion !== null;

  return {
    state,
    quote,
    currentVersion,
    actions,
    error,
    refresh,
    hasVersion,
  };
}
