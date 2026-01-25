/**
 * Timeout Feedback Hook
 * 
 * Provides user feedback when operations take longer than expected.
 * 
 * GUARDRAILS:
 * - Does NOT cancel or retry operations
 * - Does NOT alter system behavior
 * - Display-only feedback mechanism
 * - No business logic
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================
// TIMEOUT STATES
// ============================================================

export type TimeoutState = 'idle' | 'running' | 'warning' | 'critical';

// ============================================================
// USE TIMEOUT FEEDBACK HOOK
// ============================================================

export interface UseTimeoutFeedbackReturn {
  /** Current timeout state */
  state: TimeoutState;
  /** Seconds elapsed since operation started */
  elapsed: number;
  /** Start tracking an operation */
  start: () => void;
  /** Stop tracking */
  stop: () => void;
  /** Reset to idle */
  reset: () => void;
  /** Whether in warning or critical state */
  isLongRunning: boolean;
  /** Feedback message for display */
  message: string | null;
}

export interface UseTimeoutFeedbackOptions {
  /** Seconds before warning state (default: 5) */
  warningThreshold?: number;
  /** Seconds before critical state (default: 15) */
  criticalThreshold?: number;
  /** Warning message */
  warningMessage?: string;
  /** Critical message */
  criticalMessage?: string;
}

/**
 * Hook for providing feedback on long-running operations.
 * 
 * GUARDRAIL: This is DISPLAY-ONLY feedback.
 * - Does not cancel operations
 * - Does not trigger retries
 * - Only provides user feedback
 */
export function useTimeoutFeedback(
  options: UseTimeoutFeedbackOptions = {}
): UseTimeoutFeedbackReturn {
  const {
    warningThreshold = 5,
    criticalThreshold = 15,
    warningMessage = 'This is taking longer than expected...',
    criticalMessage = 'Still working. Please wait...',
  } = options;

  const [state, setState] = useState<TimeoutState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const start = useCallback(() => {
    // Reset state
    setState('running');
    setElapsed(0);
    startTimeRef.current = Date.now();

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Start tracking elapsed time
    intervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsed(elapsedSeconds);

        // Update state based on thresholds
        if (elapsedSeconds >= criticalThreshold) {
          setState('critical');
        } else if (elapsedSeconds >= warningThreshold) {
          setState('warning');
        }
      }
    }, 1000);
  }, [warningThreshold, criticalThreshold]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setState('idle');
    startTimeRef.current = null;
  }, []);

  const reset = useCallback(() => {
    stop();
    setElapsed(0);
  }, [stop]);

  // Compute derived values
  const isLongRunning = state === 'warning' || state === 'critical';
  
  const message = (() => {
    switch (state) {
      case 'critical':
        return criticalMessage;
      case 'warning':
        return warningMessage;
      default:
        return null;
    }
  })();

  return {
    state,
    elapsed,
    start,
    stop,
    reset,
    isLongRunning,
    message,
  };
}
