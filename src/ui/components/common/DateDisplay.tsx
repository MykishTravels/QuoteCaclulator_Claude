/**
 * DateDisplay Component
 * 
 * Formats and displays dates.
 * 
 * GUARDRAIL: DISPLAY ONLY.
 * - Pure formatting
 * - No calculations
 */

import React from 'react';
import type { DateString, DateTimeString } from '../../types';

export interface DateDisplayProps {
  /** Date to display */
  date: DateString | DateTimeString | string;
  /** Format variant */
  format?: 'short' | 'medium' | 'long' | 'relative';
  /** Optional CSS class */
  className?: string;
  /** Include time (only for DateTimeString) */
  showTime?: boolean;
}

/**
 * Formats a date for display.
 */
function formatDate(
  date: string,
  format: 'short' | 'medium' | 'long' | 'relative',
  showTime: boolean
): string {
  const d = new Date(date);
  
  if (isNaN(d.getTime())) {
    return 'Invalid date';
  }
  
  let dateOptions: Intl.DateTimeFormatOptions;
  switch (format) {
    case 'short':
      dateOptions = { month: 'short', day: 'numeric' };
      break;
    case 'medium':
      dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };
      break;
    case 'long':
      dateOptions = { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' };
      break;
    case 'relative':
    default:
      dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };
      break;
  }
  
  if (showTime) {
    dateOptions.hour = '2-digit';
    dateOptions.minute = '2-digit';
  }
  
  return d.toLocaleDateString('en-US', dateOptions);
}

/**
 * Formats a date as relative time (e.g., "2 hours ago").
 */
function formatRelative(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return formatDate(date, 'medium', false);
}

/**
 * Date display component.
 */
export function DateDisplay({
  date,
  format = 'medium',
  className = '',
  showTime = false,
}: DateDisplayProps): React.ReactElement {
  const formatted = format === 'relative'
    ? formatRelative(date as string)
    : formatDate(date as string, format, showTime);
  
  return (
    <span className={`text-gray-600 ${className}`}>
      {formatted}
    </span>
  );
}

/**
 * DateTime display with time included.
 */
export function DateTimeDisplay({
  date,
  className = '',
}: Pick<DateDisplayProps, 'date' | 'className'>): React.ReactElement {
  return <DateDisplay date={date} format="medium" showTime className={className} />;
}

/**
 * Date range display (e.g., "Mar 1 - Mar 5, 2026").
 */
export function DateRangeDisplay({
  startDate,
  endDate,
  className = '',
}: {
  startDate: DateString | string;
  endDate: DateString | string;
  className?: string;
}): React.ReactElement {
  const start = new Date(startDate as string);
  const end = new Date(endDate as string);
  
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  
  const startStr = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  });
  
  const endStr = end.toLocaleDateString('en-US', {
    month: sameMonth ? undefined : 'short',
    day: 'numeric',
    year: 'numeric',
  });
  
  return (
    <span className={`text-gray-600 ${className}`}>
      {startStr} – {endStr}
    </span>
  );
}
