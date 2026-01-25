/**
 * QuoteHeader Component
 * 
 * Displays quote header information.
 * 
 * GUARDRAIL: DISPLAY ONLY.
 * - Shows quote ID, client, status
 * - Does not modify quote
 */

import React from 'react';
import type { Quote } from '../../types';
import { QuoteStatusBadge } from './QuoteStatusBadge';
import { DateDisplay } from '../common';

export interface QuoteHeaderProps {
  /** Quote to display */
  quote: Quote;
  /** Optional CSS class */
  className?: string;
}

/**
 * Quote header component.
 */
export function QuoteHeader({
  quote,
  className = '',
}: QuoteHeaderProps): React.ReactElement {
  return (
    <div className={`${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Quote {quote.id}
            </h1>
            <QuoteStatusBadge status={quote.status} />
          </div>
          <p className="mt-1 text-gray-600">
            Client: <span className="font-medium">{quote.client_name}</span>
            {quote.client_email && (
              <span className="ml-2 text-gray-400">({quote.client_email})</span>
            )}
          </p>
        </div>
        <div className="text-right text-sm text-gray-500">
          <p>Created: <DateDisplay date={quote.created_at} /></p>
          <p>Last updated: <DateDisplay date={quote.updated_at} /></p>
        </div>
      </div>
      {quote.client_notes && (
        <div className="mt-3 p-3 bg-gray-50 rounded-md text-sm text-gray-600">
          <span className="font-medium">Notes:</span> {quote.client_notes}
        </div>
      )}
    </div>
  );
}
