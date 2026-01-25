/**
 * ErrorBanner Component
 * 
 * Displays error messages.
 */

import React from 'react';

export interface ErrorBannerProps {
  /** Error message */
  message: string;
  /** Error title (optional) */
  title?: string;
  /** Variant */
  variant?: 'error' | 'warning' | 'info';
  /** Dismiss callback (if dismissible) */
  onDismiss?: () => void;
  /** Optional CSS class */
  className?: string;
}

/**
 * Error/warning banner component.
 */
export function ErrorBanner({
  message,
  title,
  variant = 'error',
  onDismiss,
  className = '',
}: ErrorBannerProps): React.ReactElement {
  const variantClasses = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  
  const iconClasses = {
    error: '⚠️',
    warning: '⚡',
    info: 'ℹ️',
  };
  
  return (
    <div
      className={`p-4 border rounded-md ${variantClasses[variant]} ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span className="text-lg">{iconClasses[variant]}</span>
        <div className="flex-1">
          {title && (
            <h4 className="font-medium mb-1">{title}</h4>
          )}
          <p className="text-sm">{message}</p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Dismiss"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Inline error message.
 */
export function ErrorInline({
  message,
  className = '',
}: {
  message: string;
  className?: string;
}): React.ReactElement {
  return (
    <span className={`text-sm text-red-600 ${className}`}>
      {message}
    </span>
  );
}

/**
 * No version available error.
 * Used when attempting PDF/email without a version.
 */
export function NoVersionError(): React.ReactElement {
  return (
    <ErrorBanner
      variant="warning"
      title="No Version Available"
      message="This quote has not been calculated yet. Please calculate the quote first to generate PDFs or send emails."
    />
  );
}
