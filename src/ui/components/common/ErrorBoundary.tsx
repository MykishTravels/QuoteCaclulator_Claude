/**
 * ErrorBoundary Component
 * 
 * Catches React render errors and displays a fallback UI.
 * 
 * GUARDRAILS:
 * - DISPLAY ONLY - does not affect system behavior
 * - Does not modify state beyond error tracking
 * - Does not call backend
 * - Does not infer or trigger lifecycle transitions
 * - Logs errors for debugging only
 */

import React, { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

// ============================================================
// ERROR BOUNDARY STATE
// ============================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ============================================================
// ERROR BOUNDARY PROPS
// ============================================================

export interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Optional fallback component */
  fallback?: ReactNode;
  /** Optional error handler (for logging) */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Component name for error messages */
  componentName?: string;
}

// ============================================================
// ERROR BOUNDARY COMPONENT
// ============================================================

/**
 * Error boundary component.
 * 
 * GUARDRAIL: This is a DISPLAY-ONLY safety net.
 * It does not affect business logic or system behavior.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so next render shows fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error for debugging (DISPLAY-ONLY side effect)
    console.error('ErrorBoundary caught error:', error);
    console.error('Component stack:', errorInfo.componentStack);

    this.setState({ errorInfo });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = (): void => {
    // Reset error state to allow retry
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Render custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <ErrorFallback
          error={this.state.error}
          componentName={this.props.componentName}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================================
// ERROR FALLBACK UI
// ============================================================

interface ErrorFallbackProps {
  error: Error | null;
  componentName?: string;
  onReset: () => void;
}

/**
 * Default error fallback UI.
 * GUARDRAIL: DISPLAY ONLY - no system behavior changes.
 */
function ErrorFallback({
  error,
  componentName,
  onReset,
}: ErrorFallbackProps): React.ReactElement {
  const title = componentName
    ? `Error in ${componentName}`
    : 'Something went wrong';

  return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚠️</span>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-red-800">
            {title}
          </h3>
          <p className="mt-1 text-sm text-red-600">
            An unexpected error occurred. Please try again.
          </p>
          {error && (
            <details className="mt-3">
              <summary className="text-sm text-red-500 cursor-pointer hover:text-red-700">
                Technical details
              </summary>
              <pre className="mt-2 p-2 bg-red-100 rounded text-xs text-red-800 overflow-auto">
                {error.message}
              </pre>
            </details>
          )}
          <button
            type="button"
            onClick={onReset}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PAGE-LEVEL ERROR BOUNDARY
// ============================================================

/**
 * Page-level error boundary with full-page fallback.
 * GUARDRAIL: DISPLAY ONLY - wraps entire page for safety.
 */
export function PageErrorBoundary({
  children,
  pageName,
}: {
  children: ReactNode;
  pageName?: string;
}): React.ReactElement {
  return (
    <ErrorBoundary
      componentName={pageName}
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full p-6">
            <div className="text-center">
              <span className="text-6xl">😵</span>
              <h1 className="mt-4 text-2xl font-bold text-gray-900">
                Page Error
              </h1>
              <p className="mt-2 text-gray-600">
                This page encountered an unexpected error.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

// ============================================================
// SECTION-LEVEL ERROR BOUNDARY
// ============================================================

/**
 * Section-level error boundary with inline fallback.
 * GUARDRAIL: DISPLAY ONLY - isolates section errors.
 */
export function SectionErrorBoundary({
  children,
  sectionName,
}: {
  children: ReactNode;
  sectionName?: string;
}): React.ReactElement {
  return (
    <ErrorBoundary componentName={sectionName}>
      {children}
    </ErrorBoundary>
  );
}
