/**
 * Pricing Visibility Hook
 * 
 * Manages runtime-only pricing visibility state.
 * 
 * GUARDRAIL: This is LOCAL STATE ONLY.
 * - Never persisted to backend
 * - Never saved to PDFRecord
 * - Resets on page navigation
 */

import { useState, useCallback } from 'react';
import { PricingVisibility } from '../types';

/**
 * Return type for usePricingVisibility hook.
 */
export interface UsePricingVisibilityReturn {
  /** Current visibility setting */
  visibility: PricingVisibility;
  
  /** Update visibility setting */
  setVisibility: (v: PricingVisibility) => void;
  
  /** Reset to default (SELL_ONLY) */
  resetVisibility: () => void;
  
  /** Check if showing cost */
  showsCost: boolean;
  
  /** Check if showing sell */
  showsSell: boolean;
  
  /** Check if showing full breakdown */
  showsFullBreakdown: boolean;
}

/**
 * Default pricing visibility.
 * SELL_ONLY is the safest default for client-facing views.
 */
const DEFAULT_VISIBILITY = PricingVisibility.SELL_ONLY;

/**
 * Hook for managing pricing visibility.
 * 
 * GUARDRAIL: This state is NEVER persisted.
 * It controls UI display only.
 */
export function usePricingVisibility(
  initialVisibility: PricingVisibility = DEFAULT_VISIBILITY
): UsePricingVisibilityReturn {
  const [visibility, setVisibilityState] = useState<PricingVisibility>(initialVisibility);

  const setVisibility = useCallback((v: PricingVisibility) => {
    setVisibilityState(v);
  }, []);

  const resetVisibility = useCallback(() => {
    setVisibilityState(DEFAULT_VISIBILITY);
  }, []);

  // Derived state for convenience
  const showsCost = visibility === PricingVisibility.COST_ONLY || 
                    visibility === PricingVisibility.FULL_BREAKDOWN;
  
  const showsSell = visibility === PricingVisibility.SELL_ONLY || 
                    visibility === PricingVisibility.FULL_BREAKDOWN;
  
  const showsFullBreakdown = visibility === PricingVisibility.FULL_BREAKDOWN;

  return {
    visibility,
    setVisibility,
    resetVisibility,
    showsCost,
    showsSell,
    showsFullBreakdown,
  };
}
