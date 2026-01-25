/**
 * TimeoutFeedback Component
 * 
 * Displays feedback for long-running operations.
 * 
 * GUARDRAILS:
 * - DISPLAY ONLY - does not cancel or retry operations
 * - Does not alter system behavior
 * - No business logic
 */

import React from 'react';
import type { TimeoutState } from '../../state/useTimeoutFeedback';

// ============================================================
// TIMEOUT FEEDBACK PROPS
// ============================================================

export interface TimeoutFeedbackProps {
  /** Timeout state */
  state: TimeoutState;
  /** Message to display */
  message: string | null;
  /** Elapsed seconds */
  elapsed: number;
  /** Optional CSS class */
  className?: string;
}

// ============================================================
// TIMEOUT FEEDBACK COMPONENT
// ============================================================

/**
 * Component to display timeout feedback.
 * GUARDRAIL: DISPLAY ONLY.
 */
export function TimeoutFeedback({
  state,
  message,
  elapsed,
  className = '',
}: TimeoutFeedbackProps): React.ReactElement | null {
  if (state === 'idle' || state === 'running') {
    return null;
  }

  const colorClasses: Record<string, string> = {
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    critical: 'bg-orange-50 border-orange-200 text-orange-700',
  };

  return (
    <div className={`p-3 rounded-lg border ${colorClasses[state] || ''} ${className}`}>
      <div className="flex items-center gap-2">
        <span className="animate-pulse">⏳</span>
        <span className="text-sm">{message}</span>
        <span className="text-xs opacity-75">({elapsed}s)</span>
      </div>
    </div>
  );
}

// ============================================================
// INLINE TIMEOUT INDICATOR
// ============================================================

/**
 * Small inline indicator for long-running operations.
 * GUARDRAIL: DISPLAY ONLY.
 */
export function TimeoutIndicator({
  elapsed,
  isLongRunning,
}: {
  elapsed: number;
  isLongRunning: boolean;
}): React.ReactElement | null {
  if (!isLongRunning) {
    return null;
  }

  return (
    <span className="text-xs text-yellow-600 animate-pulse">
      ({elapsed}s)
    </span>
  );
}
