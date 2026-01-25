/**
 * QuoteActionsBar Component
 * 
 * Container for lifecycle action buttons.
 * 
 * GUARDRAILS:
 * - Actions derived from backend AvailableActions ONLY
 * - No computed/inferred actions
 * - Invalid actions are NOT rendered (not just disabled)
 * - All actions require confirmation
 */

import React, { useState, useCallback } from 'react';
import type { Quote, AvailableActions } from '../../types';
import { LifecycleAction, getAvailableLifecycleActions } from './types';
import { ActionButton } from './ActionButton';
import { ConfirmActionDialog } from './ConfirmActionDialog';
import { useLifecycleActions } from '../../state/useLifecycleActions';
import { ErrorBanner } from '../common';

export interface QuoteActionsBarProps {
  /** Quote being acted upon */
  quote: Quote;
  /** Available actions from backend */
  actions: AvailableActions;
  /** Callback when action completes successfully */
  onActionComplete: () => void;
  /** Optional CSS class */
  className?: string;
}

/**
 * Quote actions bar component.
 * 
 * GUARDRAIL: This component uses AvailableActions as the SOLE source of truth.
 * It never computes or infers which actions should be available.
 */
export function QuoteActionsBar({
  quote,
  actions,
  onActionComplete,
  className = '',
}: QuoteActionsBarProps): React.ReactElement {
  // Get available actions from backend (SOLE SOURCE OF TRUTH)
  const availableActions = getAvailableLifecycleActions(actions);
  
  // Dialog state
  const [dialogAction, setDialogAction] = useState<LifecycleAction | null>(null);
  
  // Lifecycle actions hook
  const {
    pendingAction,
    state,
    error,
    executeAction,
    clearError,
  } = useLifecycleActions(quote.id, () => {
    setDialogAction(null);
    onActionComplete();
  });

  // Handle action button click - show confirmation
  const handleActionClick = useCallback((action: LifecycleAction) => {
    setDialogAction(action);
  }, []);

  // Handle confirmation - execute action
  const handleConfirm = useCallback(async () => {
    if (dialogAction) {
      await executeAction(dialogAction);
    }
  }, [dialogAction, executeAction]);

  // Handle cancel - close dialog
  const handleCancel = useCallback(() => {
    setDialogAction(null);
    clearError();
  }, [clearError]);

  // No actions available
  if (availableActions.length === 0) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        No actions available for this quote.
      </div>
    );
  }

  const isLoading = state === 'loading';

  return (
    <div className={className}>
      {/* Error Banner */}
      {error && (
        <ErrorBanner
          variant="error"
          message={error}
          onDismiss={clearError}
          className="mb-4"
        />
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {availableActions.map((action) => (
          <ActionButton
            key={action}
            action={action}
            onClick={() => handleActionClick(action)}
            disabled={isLoading}
          />
        ))}
      </div>

      {/* Confirmation Dialog */}
      {dialogAction && (
        <ConfirmActionDialog
          action={dialogAction}
          quote={quote}
          isOpen={true}
          isLoading={isLoading && pendingAction === dialogAction}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}

/**
 * Compact version of QuoteActionsBar for smaller spaces.
 */
export function QuoteActionsBarCompact({
  quote,
  actions,
  onActionComplete,
  className = '',
}: QuoteActionsBarProps): React.ReactElement {
  const availableActions = getAvailableLifecycleActions(actions);
  
  const [dialogAction, setDialogAction] = useState<LifecycleAction | null>(null);
  
  const {
    pendingAction,
    state,
    error,
    executeAction,
    clearError,
  } = useLifecycleActions(quote.id, () => {
    setDialogAction(null);
    onActionComplete();
  });

  const handleActionClick = useCallback((action: LifecycleAction) => {
    setDialogAction(action);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (dialogAction) {
      await executeAction(dialogAction);
    }
  }, [dialogAction, executeAction]);

  const handleCancel = useCallback(() => {
    setDialogAction(null);
    clearError();
  }, [clearError]);

  if (availableActions.length === 0) {
    return <></>;
  }

  const isLoading = state === 'loading';

  return (
    <div className={className}>
      {error && (
        <ErrorBanner
          variant="error"
          message={error}
          onDismiss={clearError}
          className="mb-2"
        />
      )}

      <div className="flex flex-wrap gap-2">
        {availableActions.map((action) => (
          <ActionButton
            key={action}
            action={action}
            onClick={() => handleActionClick(action)}
            disabled={isLoading}
            size="sm"
          />
        ))}
      </div>

      {dialogAction && (
        <ConfirmActionDialog
          action={dialogAction}
          quote={quote}
          isOpen={true}
          isLoading={isLoading && pendingAction === dialogAction}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
