/**
 * StatusTimeline Component
 * 
 * Read-only visualization of quote lifecycle status.
 * 
 * GUARDRAILS:
 * - READ ONLY - does not trigger any state transitions
 * - Does not call backend
 * - Does not modify any data
 * - Displays current status position only
 * - No lifecycle inference (uses status from props)
 */

import React from 'react';
import { QuoteStatus } from '../../types';

// ============================================================
// TIMELINE TYPES
// ============================================================

interface StatusStep {
  status: QuoteStatus;
  label: string;
  description: string;
}

/**
 * Ordered steps in the primary lifecycle path.
 * GUARDRAIL: This is for DISPLAY ONLY - does not define allowed transitions.
 */
const PRIMARY_PATH: StatusStep[] = [
  {
    status: QuoteStatus.DRAFT,
    label: 'Draft',
    description: 'Quote is being prepared',
  },
  {
    status: QuoteStatus.SENT,
    label: 'Sent',
    description: 'Quote sent to client',
  },
  {
    status: QuoteStatus.CONVERTED,
    label: 'Converted',
    description: 'Client accepted the quote',
  },
];

/**
 * Alternative terminal states (branches from SENT).
 */
const TERMINAL_BRANCHES: StatusStep[] = [
  {
    status: QuoteStatus.REJECTED,
    label: 'Rejected',
    description: 'Client declined the quote',
  },
  {
    status: QuoteStatus.EXPIRED,
    label: 'Expired',
    description: 'Quote validity period ended',
  },
];

// ============================================================
// STATUS TIMELINE PROPS
// ============================================================

export interface StatusTimelineProps {
  /** Current status (from Quote entity) */
  currentStatus: QuoteStatus;
  /** Show branch statuses */
  showBranches?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Optional CSS class */
  className?: string;
}

// ============================================================
// STATUS TIMELINE COMPONENT
// ============================================================

/**
 * Status timeline component.
 * 
 * GUARDRAIL: This is a READ-ONLY visualization.
 * - Does not trigger state transitions
 * - Does not infer next states
 * - Simply shows where current status falls in lifecycle
 */
export function StatusTimeline({
  currentStatus,
  showBranches = true,
  compact = false,
  className = '',
}: StatusTimelineProps): React.ReactElement {
  // Check if current status is a branch (REJECTED or EXPIRED)
  const isBranchStatus = [QuoteStatus.REJECTED, QuoteStatus.EXPIRED].includes(currentStatus);

  return (
    <div className={className}>
      {/* Primary path */}
      <div className={`flex items-center ${compact ? 'gap-2' : 'gap-4'}`}>
        {PRIMARY_PATH.map((step, index) => (
          <div key={step.status} className="contents">
            <StatusNode
              step={step}
              isActive={step.status === currentStatus}
              isPast={getStepIndex(currentStatus) > index}
              compact={compact}
            />
            {index < PRIMARY_PATH.length - 1 && (
              <StatusConnector
                isActive={getStepIndex(currentStatus) > index}
                compact={compact}
              />
            )}
          </div>
        ))}
      </div>

      {/* Branch statuses */}
      {showBranches && !compact && (
        <div className="mt-4 ml-[calc(50%-1rem)] flex gap-8">
          {TERMINAL_BRANCHES.map((step) => (
            <StatusBranchNode
              key={step.status}
              step={step}
              isActive={step.status === currentStatus}
            />
          ))}
        </div>
      )}

      {/* Legend for compact mode */}
      {compact && isBranchStatus && (
        <div className="mt-2 text-xs text-gray-500">
          Status: {currentStatus}
        </div>
      )}
    </div>
  );
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getStepIndex(status: QuoteStatus): number {
  const index = PRIMARY_PATH.findIndex((s) => s.status === status);
  // Treat branch statuses as being after SENT
  if (index === -1 && [QuoteStatus.REJECTED, QuoteStatus.EXPIRED].includes(status)) {
    return 1; // After SENT
  }
  return index;
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function StatusNode({
  step,
  isActive,
  isPast,
  compact,
}: {
  step: StatusStep;
  isActive: boolean;
  isPast: boolean;
  compact: boolean;
}): React.ReactElement {
  const getColorClasses = () => {
    if (isActive) {
      return 'bg-blue-600 text-white border-blue-600';
    }
    if (isPast) {
      return 'bg-green-100 text-green-700 border-green-300';
    }
    return 'bg-gray-100 text-gray-400 border-gray-200';
  };

  if (compact) {
    return (
      <div
        className={`
          w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs
          ${getColorClasses()}
        `}
        title={step.label}
      >
        {isPast && !isActive ? '✓' : ''}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div
        className={`
          w-10 h-10 rounded-full border-2 flex items-center justify-center
          ${getColorClasses()}
        `}
      >
        {isPast && !isActive ? '✓' : ''}
      </div>
      <span className={`mt-2 text-sm font-medium ${isActive ? 'text-blue-600' : 'text-gray-600'}`}>
        {step.label}
      </span>
      {isActive && (
        <span className="text-xs text-gray-500 mt-0.5">
          {step.description}
        </span>
      )}
    </div>
  );
}

function StatusConnector({
  isActive,
  compact,
}: {
  isActive: boolean;
  compact: boolean;
}): React.ReactElement {
  return (
    <div
      className={`
        ${compact ? 'w-4' : 'flex-1'} h-0.5
        ${isActive ? 'bg-green-300' : 'bg-gray-200'}
      `}
    />
  );
}

function StatusBranchNode({
  step,
  isActive,
}: {
  step: StatusStep;
  isActive: boolean;
  key?: string | number;
}): React.ReactElement {
  const getColorClasses = () => {
    if (isActive && step.status === QuoteStatus.REJECTED) {
      return 'bg-red-100 text-red-700 border-red-300';
    }
    if (isActive && step.status === QuoteStatus.EXPIRED) {
      return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    }
    return 'bg-gray-50 text-gray-400 border-gray-200';
  };

  return (
    <div className="flex flex-col items-center">
      {/* Vertical connector */}
      <div className={`w-0.5 h-4 ${isActive ? 'bg-gray-400' : 'bg-gray-200'}`} />
      
      {/* Node */}
      <div
        className={`
          w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs
          ${getColorClasses()}
        `}
      >
        {step.status === QuoteStatus.REJECTED ? '✗' : '⏱'}
      </div>
      <span className={`mt-1 text-xs ${isActive ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
        {step.label}
      </span>
    </div>
  );
}

// ============================================================
// SIMPLE STATUS INDICATOR
// ============================================================

/**
 * Simple inline status indicator.
 * GUARDRAIL: READ ONLY - no transitions.
 */
export function StatusIndicator({
  status,
  size = 'md',
  className = '',
}: {
  status: QuoteStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}): React.ReactElement {
  const colorClasses = {
    [QuoteStatus.DRAFT]: 'bg-gray-100 text-gray-700',
    [QuoteStatus.SENT]: 'bg-blue-100 text-blue-700',
    [QuoteStatus.CONVERTED]: 'bg-green-100 text-green-700',
    [QuoteStatus.REJECTED]: 'bg-red-100 text-red-700',
    [QuoteStatus.EXPIRED]: 'bg-yellow-100 text-yellow-700',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        ${colorClasses[status]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {status}
    </span>
  );
}
