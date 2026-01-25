/**
 * EmptyState Component
 * 
 * Displays friendly messages when data is empty or unavailable.
 * 
 * GUARDRAILS:
 * - DISPLAY ONLY - does not affect system behavior
 * - Does not fetch data or call backend
 * - Does not modify state
 * - Does not infer or trigger lifecycle transitions
 */

import React from 'react';

// ============================================================
// EMPTY STATE PROPS
// ============================================================

export interface EmptyStateProps {
  /** Icon (emoji or component) */
  icon?: string;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Optional CSS class */
  className?: string;
}

// ============================================================
// EMPTY STATE COMPONENT
// ============================================================

/**
 * Empty state component.
 * GUARDRAIL: DISPLAY ONLY - provides visual guidance.
 */
export function EmptyState({
  icon = '📭',
  title,
  description,
  action,
  size = 'md',
  className = '',
}: EmptyStateProps): React.ReactElement {
  const sizeClasses = {
    sm: 'py-4',
    md: 'py-8',
    lg: 'py-12',
  };

  const iconSizes = {
    sm: 'text-3xl',
    md: 'text-4xl',
    lg: 'text-6xl',
  };

  const titleSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div className={`text-center ${sizeClasses[size]} ${className}`}>
      <span className={`block ${iconSizes[size]} mb-3`}>{icon}</span>
      <h3 className={`font-medium text-gray-900 ${titleSizes[size]}`}>
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-sm text-gray-500">
          {description}
        </p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ============================================================
// PRESET EMPTY STATES
// ============================================================

/**
 * Empty state for no quotes.
 * GUARDRAIL: DISPLAY ONLY.
 */
export function NoQuotesEmptyState({
  onCreateQuote,
}: {
  onCreateQuote?: () => void;
}): React.ReactElement {
  return (
    <EmptyState
      icon="📋"
      title="No quotes yet"
      description="Create your first quote to get started."
      action={onCreateQuote ? { label: 'Create Quote', onClick: onCreateQuote } : undefined}
      size="lg"
    />
  );
}

/**
 * Empty state for no version (quote not calculated).
 * GUARDRAIL: DISPLAY ONLY.
 */
export function NoVersionEmptyState(): React.ReactElement {
  return (
    <EmptyState
      icon="🧮"
      title="No pricing available"
      description="This quote has not been calculated yet. Calculate the quote to see pricing."
      size="md"
    />
  );
}

/**
 * Empty state for no PDF history.
 * GUARDRAIL: DISPLAY ONLY.
 */
export function NoPDFsEmptyState(): React.ReactElement {
  return (
    <EmptyState
      icon="📄"
      title="No PDFs generated"
      description="Generate a PDF to see it here."
      size="sm"
    />
  );
}

/**
 * Empty state for no email history.
 * GUARDRAIL: DISPLAY ONLY.
 */
export function NoEmailsEmptyState(): React.ReactElement {
  return (
    <EmptyState
      icon="✉️"
      title="No emails sent"
      description="Send an email to see it here."
      size="sm"
    />
  );
}

/**
 * Empty state for no actions available.
 * GUARDRAIL: DISPLAY ONLY.
 */
export function NoActionsEmptyState({
  status,
}: {
  status: string;
}): React.ReactElement {
  return (
    <EmptyState
      icon="🔒"
      title="No actions available"
      description={`This quote is ${status.toLowerCase()}. No further actions can be taken.`}
      size="sm"
    />
  );
}

/**
 * Empty state for search with no results.
 * GUARDRAIL: DISPLAY ONLY.
 */
export function NoSearchResultsEmptyState({
  query,
  onClear,
}: {
  query: string;
  onClear?: () => void;
}): React.ReactElement {
  return (
    <EmptyState
      icon="🔍"
      title="No results found"
      description={`No quotes match "${query}".`}
      action={onClear ? { label: 'Clear search', onClick: onClear } : undefined}
      size="md"
    />
  );
}
