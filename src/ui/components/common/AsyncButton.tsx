/**
 * AsyncButton Component
 * 
 * Button with built-in loading state and double-click prevention.
 * 
 * GUARDRAILS:
 * - UI-LEVEL GUARD ONLY - does not change business logic
 * - Does not affect backend behavior
 * - Backend still validates all requests
 * - Simply prevents re-submission during pending operations
 */

import React, { useState, useCallback } from 'react';

// ============================================================
// ASYNC BUTTON PROPS
// ============================================================

export interface AsyncButtonProps {
  /** Button label */
  children: React.ReactNode;
  /** Async click handler */
  onClick: () => Promise<void>;
  /** Whether button is disabled */
  disabled?: boolean;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Loading text (shown during async operation) */
  loadingText?: string;
  /** Optional CSS class */
  className?: string;
  /** Button type */
  type?: 'button' | 'submit';
}

// ============================================================
// VARIANT CLASSES
// ============================================================

const VARIANT_CLASSES = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600',
  secondary: 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300',
  success: 'bg-green-600 text-white hover:bg-green-700 border-green-600',
  danger: 'bg-red-600 text-white hover:bg-red-700 border-red-600',
  warning: 'bg-yellow-500 text-white hover:bg-yellow-600 border-yellow-500',
};

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

// ============================================================
// ASYNC BUTTON COMPONENT
// ============================================================

/**
 * Async button with loading state and double-click prevention.
 * 
 * GUARDRAIL: This is a UI-LEVEL guard only.
 * - Prevents re-submission during pending operations
 * - Does not change business logic
 * - Backend still validates all requests
 */
export function AsyncButton({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  size = 'md',
  loadingText = 'Processing...',
  className = '',
  type = 'button',
}: AsyncButtonProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = useCallback(async () => {
    // GUARDRAIL: Prevent double-click during pending operation
    if (isLoading || disabled) {
      return;
    }

    setIsLoading(true);
    try {
      await onClick();
    } finally {
      setIsLoading(false);
    }
  }, [onClick, isLoading, disabled]);

  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center gap-2 font-medium rounded-lg border
        transition-colors duration-150
        ${VARIANT_CLASSES[variant]}
        ${SIZE_CLASSES[size]}
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {isLoading ? (
        <>
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

// ============================================================
// CONFIRM BUTTON (with built-in confirmation)
// ============================================================

export interface ConfirmButtonProps extends Omit<AsyncButtonProps, 'onClick'> {
  /** Click handler (called after confirmation) */
  onConfirm: () => Promise<void>;
  /** Confirmation message */
  confirmMessage?: string;
}

/**
 * Button that requires confirmation before executing.
 * 
 * GUARDRAIL: UI-LEVEL guard only.
 * Uses native browser confirm() for simplicity.
 */
export function ConfirmButton({
  onConfirm,
  confirmMessage = 'Are you sure?',
  ...props
}: ConfirmButtonProps): React.ReactElement {
  const handleClick = useCallback(async () => {
    // Use native confirm for simplicity
    // GUARDRAIL: This is a UI-level guard only
    if (window.confirm(confirmMessage)) {
      await onConfirm();
    }
  }, [onConfirm, confirmMessage]);

  return <AsyncButton {...props} onClick={handleClick} />;
}

// ============================================================
// ICON BUTTON
// ============================================================

export interface IconButtonProps {
  /** Icon (emoji or component) */
  icon: React.ReactNode;
  /** Accessible label */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Whether button is disabled */
  disabled?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Optional CSS class */
  className?: string;
}

/**
 * Icon-only button with accessible label.
 * GUARDRAIL: DISPLAY ONLY - simple click handler.
 */
export function IconButton({
  icon,
  label,
  onClick,
  disabled = false,
  size = 'md',
  className = '',
}: IconButtonProps): React.ReactElement {
  const sizeClasses = {
    sm: 'p-1 text-sm',
    md: 'p-2 text-base',
    lg: 'p-3 text-lg',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`
        inline-flex items-center justify-center rounded-lg
        text-gray-500 hover:text-gray-700 hover:bg-gray-100
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors duration-150
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {icon}
    </button>
  );
}
