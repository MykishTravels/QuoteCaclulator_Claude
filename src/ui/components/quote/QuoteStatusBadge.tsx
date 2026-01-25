/**
 * QuoteStatusBadge Component
 * 
 * Displays quote status as a visual badge.
 * 
 * GUARDRAIL: DISPLAY ONLY.
 * - Does not trigger state changes
 * - Visual indicator only
 */

import React from 'react';
import { QuoteStatus } from '../../types';

export interface QuoteStatusBadgeProps {
  /** Quote status */
  status: QuoteStatus;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Optional CSS class */
  className?: string;
}

/**
 * Status colors and labels.
 */
const STATUS_CONFIG: Record<QuoteStatus, { label: string; color: string }> = {
  [QuoteStatus.DRAFT]: {
    label: 'Draft',
    color: 'bg-gray-100 text-gray-700 border-gray-300',
  },
  [QuoteStatus.SENT]: {
    label: 'Sent',
    color: 'bg-blue-100 text-blue-700 border-blue-300',
  },
  [QuoteStatus.CONVERTED]: {
    label: 'Converted',
    color: 'bg-green-100 text-green-700 border-green-300',
  },
  [QuoteStatus.REJECTED]: {
    label: 'Rejected',
    color: 'bg-red-100 text-red-700 border-red-300',
  },
  [QuoteStatus.EXPIRED]: {
    label: 'Expired',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  },
};

/**
 * Quote status badge component.
 */
export function QuoteStatusBadge({
  status,
  size = 'md',
  className = '',
}: QuoteStatusBadgeProps): React.ReactElement {
  const config = STATUS_CONFIG[status];
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };
  
  return (
    <span
      className={`
        inline-flex items-center rounded-full border font-medium
        ${config.color}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {config.label}
    </span>
  );
}
