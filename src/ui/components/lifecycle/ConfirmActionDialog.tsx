/**
 * ConfirmActionDialog Component
 * 
 * Confirmation modal for lifecycle actions.
 * All destructive/irreversible actions require confirmation.
 */

import React from 'react';
import type { Quote } from '../../types';
import { LifecycleAction, ACTION_METADATA } from './types';
import { QuoteStatusBadge } from '../quote';

export interface ConfirmActionDialogProps {
  /** Action to confirm */
  action: LifecycleAction;
  /** Quote being acted upon */
  quote: Quote;
  /** Whether dialog is open */
  isOpen: boolean;
  /** Whether action is in progress */
  isLoading: boolean;
  /** Confirm callback */
  onConfirm: () => void;
  /** Cancel callback */
  onCancel: () => void;
}

/**
 * Confirmation dialog for lifecycle actions.
 */
export function ConfirmActionDialog({
  action,
  quote,
  isOpen,
  isLoading,
  onConfirm,
  onCancel,
}: ConfirmActionDialogProps): React.ReactElement | null {
  if (!isOpen) {
    return null;
  }

  const metadata = ACTION_METADATA[action];
  const isTerminal = action === LifecycleAction.CONVERT;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={isLoading ? undefined : onCancel}
      />
      
      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{metadata.icon}</span>
          <h2 className="text-xl font-semibold text-gray-900">
            {metadata.confirmTitle}
          </h2>
        </div>

        {/* Quote Info */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Quote</span>
            <span className="font-medium">{quote.id}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm text-gray-600">Client</span>
            <span className="font-medium">{quote.client_name}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm text-gray-600">Current Status</span>
            <QuoteStatusBadge status={quote.status} size="sm" />
          </div>
        </div>

        {/* Message */}
        <p className="text-gray-600 mb-4">
          {metadata.confirmMessage}
        </p>

        {/* Terminal Warning */}
        {isTerminal && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ <strong>Warning:</strong> This action is permanent and cannot be undone.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <ConfirmButton
            action={action}
            isLoading={isLoading}
            onClick={onConfirm}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Confirm button with variant styling.
 */
function ConfirmButton({
  action,
  isLoading,
  onClick,
}: {
  action: LifecycleAction;
  isLoading: boolean;
  onClick: () => void;
}): React.ReactElement {
  const metadata = ACTION_METADATA[action];
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700',
    success: 'bg-green-600 text-white hover:bg-green-700',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    warning: 'bg-yellow-600 text-white hover:bg-yellow-700',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className={`
        px-4 py-2 rounded-lg font-medium
        ${variantClasses[metadata.variant]}
        disabled:opacity-50
      `}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Processing...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <span>{metadata.icon}</span>
          {metadata.label}
        </span>
      )}
    </button>
  );
}
