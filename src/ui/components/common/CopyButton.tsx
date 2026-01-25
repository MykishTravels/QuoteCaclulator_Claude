/**
 * Copy to Clipboard Components
 * 
 * Provides copy-to-clipboard functionality for IDs and values.
 * 
 * GUARDRAILS:
 * - DISPLAY/UTILITY ONLY - does not affect system behavior
 * - Does not modify any data
 * - Uses browser Clipboard API only
 * - No business logic
 * - Only copies display values (IDs, formatted amounts)
 */

import React, { useState, useCallback } from 'react';

// ============================================================
// COPY BUTTON PROPS
// ============================================================

export interface CopyButtonProps {
  /** Value to copy */
  value: string;
  /** Label for accessibility */
  label?: string;
  /** Show the copied value inline */
  showValue?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Optional CSS class */
  className?: string;
}

// ============================================================
// COPY BUTTON COMPONENT
// ============================================================

/**
 * Button that copies a value to clipboard.
 * 
 * GUARDRAIL: This is a UTILITY component only.
 * - Does not modify any system state
 * - Does not call backend
 * - Only copies display values
 */
export function CopyButton({
  value,
  label = 'Copy',
  showValue = false,
  size = 'sm',
  className = '',
}: CopyButtonProps): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      
      // Reset after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [value]);

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`
        inline-flex items-center gap-1.5 rounded border
        transition-colors duration-150
        ${copied
          ? 'bg-green-50 border-green-300 text-green-700'
          : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
        }
        ${sizeClasses[size]}
        ${className}
      `}
      title={`Copy ${label}`}
    >
      {copied ? (
        <>
          <span>✓</span>
          <span>Copied</span>
        </>
      ) : (
        <>
          <span>📋</span>
          {showValue ? (
            <span className="font-mono">{value}</span>
          ) : (
            <span>{label}</span>
          )}
        </>
      )}
    </button>
  );
}

// ============================================================
// COPY VALUE DISPLAY
// ============================================================

export interface CopyValueProps {
  /** Label for the value */
  label: string;
  /** Value to display and copy */
  value: string;
  /** Optional CSS class */
  className?: string;
}

/**
 * Displays a value with a copy button.
 * 
 * GUARDRAIL: DISPLAY ONLY - shows value with copy option.
 */
export function CopyValue({
  label,
  value,
  className = '',
}: CopyValueProps): React.ReactElement {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div>
        <span className="text-sm text-gray-500">{label}</span>
        <span className="ml-2 font-medium">{value}</span>
      </div>
      <CopyButton value={value} label={label} size="sm" />
    </div>
  );
}

// ============================================================
// COPY ID DISPLAY
// ============================================================

/**
 * Displays an entity ID with copy button.
 * 
 * GUARDRAIL: DISPLAY ONLY - for copying IDs.
 */
export function CopyId({
  id,
  label = 'ID',
  className = '',
}: {
  id: string;
  label?: string;
  className?: string;
}): React.ReactElement {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className="text-xs text-gray-400">{label}:</span>
      <code className="text-xs font-mono text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
        {id}
      </code>
      <CopyButton value={id} label={label} size="sm" />
    </div>
  );
}

// ============================================================
// COPY AMOUNT DISPLAY
// ============================================================

/**
 * Displays a formatted amount with copy button.
 * 
 * GUARDRAIL: DISPLAY ONLY - copies the raw numeric value.
 */
export function CopyAmount({
  amount,
  currency,
  label = 'Amount',
  className = '',
}: {
  amount: number;
  currency: string;
  label?: string;
  className?: string;
}): React.ReactElement {
  // Format for display
  const displayValue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);

  // Copy raw number for spreadsheets
  const copyValue = amount.toFixed(2);

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className="font-medium">{displayValue}</span>
      <CopyButton
        value={copyValue}
        label={`${label} (${copyValue})`}
        size="sm"
      />
    </div>
  );
}

// ============================================================
// USE COPY HOOK
// ============================================================

/**
 * Hook for copy-to-clipboard functionality.
 * 
 * GUARDRAIL: UTILITY ONLY - no system state changes.
 */
export function useCopy(): {
  copied: boolean;
  copy: (value: string) => Promise<boolean>;
  reset: () => void;
} {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (value: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch (err) {
      console.error('Failed to copy:', err);
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    setCopied(false);
  }, []);

  return { copied, copy, reset };
}
