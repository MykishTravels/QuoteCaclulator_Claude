/**
 * QuoteVersionBanner Component
 * 
 * Displays current version information.
 * 
 * GUARDRAIL: MANDATORY component.
 * - Always visible when viewing a quote
 * - Prevents confusion between versions
 * - Non-collapsible
 */

import React from 'react';
import type { QuoteVersion } from '../../types';
import { DateTimeDisplay } from '../common';

export interface QuoteVersionBannerProps {
  /** Current version being displayed */
  version: QuoteVersion;
  /** Total number of versions (optional) */
  totalVersions?: number;
  /** Optional CSS class */
  className?: string;
}

/**
 * Quote version banner.
 * GUARDRAIL: This component is MANDATORY when displaying quote pricing.
 */
export function QuoteVersionBanner({
  version,
  totalVersions,
  className = '',
}: QuoteVersionBannerProps): React.ReactElement {
  return (
    <div
      className={`
        flex items-center justify-between
        px-4 py-2
        bg-blue-50 border border-blue-200 rounded-md
        ${className}
      `}
    >
      <div className="flex items-center gap-3">
        <span className="text-blue-700 font-medium">
          Version {version.version_number}
          {totalVersions && totalVersions > 1 && (
            <span className="text-blue-500 font-normal">
              {' '}of {totalVersions}
            </span>
          )}
        </span>
        <span className="text-blue-400">•</span>
        <span className="text-blue-600 text-sm">
          Created <DateTimeDisplay date={version.created_at} />
        </span>
      </div>
      <div className="text-sm text-blue-500">
        Currency: {version.currency_code}
      </div>
    </div>
  );
}

/**
 * No version banner - shown when quote has no calculated version.
 */
export function NoVersionBanner({
  className = '',
}: {
  className?: string;
}): React.ReactElement {
  return (
    <div
      className={`
        flex items-center justify-between
        px-4 py-2
        bg-yellow-50 border border-yellow-200 rounded-md
        ${className}
      `}
    >
      <div className="flex items-center gap-2">
        <span className="text-yellow-700">⚠️</span>
        <span className="text-yellow-800 font-medium">
          No version calculated
        </span>
      </div>
      <span className="text-sm text-yellow-600">
        Calculate quote to generate pricing
      </span>
    </div>
  );
}
