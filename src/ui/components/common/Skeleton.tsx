/**
 * Skeleton Components
 * 
 * Placeholder UI shown while content is loading.
 * 
 * GUARDRAILS:
 * - DISPLAY ONLY - does not affect system behavior
 * - Does not fetch data or call backend
 * - Does not modify state
 * - No business logic
 */

import React from 'react';

// ============================================================
// BASE SKELETON
// ============================================================

export interface SkeletonProps {
  /** Width (CSS value or 'full') */
  width?: string | number;
  /** Height (CSS value) */
  height?: string | number;
  /** Border radius variant */
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  /** Optional CSS class */
  className?: string;
  /** React key for lists */
  key?: string | number;
}

/**
 * Base skeleton component.
 * GUARDRAIL: DISPLAY ONLY - animated placeholder.
 */
export function Skeleton({
  width = '100%',
  height = '1rem',
  rounded = 'md',
  className = '',
}: SkeletonProps): React.ReactElement {
  const roundedClasses = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };

  const widthStyle = typeof width === 'number' ? `${width}px` : width;
  const heightStyle = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`animate-pulse bg-gray-200 ${roundedClasses[rounded]} ${className}`}
      style={{ width: widthStyle, height: heightStyle }}
      aria-hidden="true"
    />
  );
}

// ============================================================
// TEXT SKELETON
// ============================================================

/**
 * Text line skeleton.
 * GUARDRAIL: DISPLAY ONLY.
 */
export function SkeletonText({
  lines = 1,
  className = '',
}: {
  lines?: number;
  className?: string;
}): React.ReactElement {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 && lines > 1 ? '75%' : '100%'}
          height="1rem"
        />
      ))}
    </div>
  );
}

// ============================================================
// QUOTE CARD SKELETON
// ============================================================

/**
 * Quote card skeleton for list views.
 * GUARDRAIL: DISPLAY ONLY - matches QuoteCard layout.
 */
export function SkeletonQuoteCard({
  className = '',
}: {
  className?: string;
}): React.ReactElement {
  return (
    <div className={`p-4 border border-gray-200 rounded-lg ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-2">
          <Skeleton width={120} height={20} />
          <Skeleton width={180} height={16} />
        </div>
        <Skeleton width={80} height={24} rounded="full" />
      </div>
      <div className="flex items-center gap-4 text-sm">
        <Skeleton width={100} height={14} />
        <Skeleton width={80} height={14} />
      </div>
    </div>
  );
}

// ============================================================
// QUOTE HEADER SKELETON
// ============================================================

/**
 * Quote header skeleton.
 * GUARDRAIL: DISPLAY ONLY - matches QuoteHeader layout.
 */
export function SkeletonQuoteHeader({
  className = '',
}: {
  className?: string;
}): React.ReactElement {
  return (
    <div className={`p-4 bg-white border border-gray-200 rounded-lg ${className}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton width={200} height={28} />
          <Skeleton width={250} height={18} />
          <Skeleton width={150} height={14} />
        </div>
        <Skeleton width={100} height={32} rounded="full" />
      </div>
    </div>
  );
}

// ============================================================
// VERSION BANNER SKELETON
// ============================================================

/**
 * Version banner skeleton.
 * GUARDRAIL: DISPLAY ONLY - matches QuoteVersionBanner layout.
 */
export function SkeletonVersionBanner({
  className = '',
}: {
  className?: string;
}): React.ReactElement {
  return (
    <div className={`p-3 bg-blue-50 border border-blue-200 rounded-lg ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton width={24} height={24} rounded="full" />
          <Skeleton width={120} height={18} />
        </div>
        <Skeleton width={150} height={14} />
      </div>
    </div>
  );
}

// ============================================================
// PRICING SUMMARY SKELETON
// ============================================================

/**
 * Pricing summary skeleton.
 * GUARDRAIL: DISPLAY ONLY - matches QuotePricingSummary layout.
 */
export function SkeletonPricingSummary({
  className = '',
}: {
  className?: string;
}): React.ReactElement {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Totals */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <Skeleton width={100} height={14} className="mb-2" />
        <Skeleton width={150} height={32} />
      </div>
      
      {/* Legs */}
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="p-4 border border-gray-200 rounded-lg">
            <div className="flex justify-between mb-3">
              <Skeleton width={180} height={20} />
              <Skeleton width={100} height={20} />
            </div>
            <div className="space-y-2">
              <Skeleton width="100%" height={14} />
              <Skeleton width="80%" height={14} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// ACTIONS BAR SKELETON
// ============================================================

/**
 * Actions bar skeleton.
 * GUARDRAIL: DISPLAY ONLY - matches QuoteActionsBar layout.
 */
export function SkeletonActionsBar({
  className = '',
}: {
  className?: string;
}): React.ReactElement {
  return (
    <div className={`flex gap-3 ${className}`}>
      <Skeleton width={140} height={40} rounded="lg" />
      <Skeleton width={120} height={40} rounded="lg" />
      <Skeleton width={130} height={40} rounded="lg" />
    </div>
  );
}

// ============================================================
// TABLE SKELETON
// ============================================================

/**
 * Table skeleton for history lists.
 * GUARDRAIL: DISPLAY ONLY.
 */
export function SkeletonTable({
  rows = 3,
  columns = 4,
  className = '',
}: {
  rows?: number;
  columns?: number;
  className?: string;
}): React.ReactElement {
  return (
    <div className={`border border-gray-200 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <div className="flex gap-4">
          {Array.from({ length: columns }, (_, i) => (
            <Skeleton key={i} width={80 + i * 20} height={14} />
          ))}
        </div>
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div
          key={rowIndex}
          className="px-4 py-3 border-b border-gray-200 last:border-b-0"
        >
          <div className="flex gap-4">
            {Array.from({ length: columns }, (_, colIndex) => (
              <Skeleton key={colIndex} width={60 + colIndex * 15} height={16} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
