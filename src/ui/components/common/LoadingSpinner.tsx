/**
 * LoadingSpinner Component
 * 
 * Displays loading state indicator.
 */

import React from 'react';

export interface LoadingSpinnerProps {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Optional message */
  message?: string;
  /** Optional CSS class */
  className?: string;
}

/**
 * Loading spinner component.
 */
export function LoadingSpinner({
  size = 'md',
  message,
  className = '',
}: LoadingSpinnerProps): React.ReactElement {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };
  
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div
        className={`${sizeClasses[size]} border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin`}
      />
      {message && (
        <p className="mt-2 text-sm text-gray-500">{message}</p>
      )}
    </div>
  );
}

/**
 * Full-page loading overlay.
 */
export function LoadingOverlay({
  message = 'Loading...',
}: {
  message?: string;
}): React.ReactElement {
  return (
    <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
      <LoadingSpinner size="lg" message={message} />
    </div>
  );
}

/**
 * Inline loading indicator.
 */
export function LoadingInline({
  message,
}: {
  message?: string;
}): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-2 text-gray-500">
      <LoadingSpinner size="sm" />
      {message && <span className="text-sm">{message}</span>}
    </span>
  );
}
