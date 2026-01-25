/**
 * PricingVisibilitySelector Component
 * 
 * Selects pricing visibility (COST_ONLY | SELL_ONLY | FULL_BREAKDOWN).
 * 
 * GUARDRAIL: This value is RUNTIME-ONLY.
 * - NOT persisted in PDFRecord
 * - Resets on navigation
 * - UI-controlled filter only
 */

import React from 'react';
import { PricingVisibility } from '../../types';

export interface PricingVisibilitySelectorProps {
  /** Current value */
  value: PricingVisibility;
  /** Change handler */
  onChange: (visibility: PricingVisibility) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Optional CSS class */
  className?: string;
}

/**
 * Pricing visibility options.
 */
const VISIBILITY_OPTIONS = [
  {
    value: PricingVisibility.COST_ONLY,
    label: 'Cost Only',
    description: 'Show cost amounts (internal view)',
  },
  {
    value: PricingVisibility.SELL_ONLY,
    label: 'Sell Only',
    description: 'Show sell prices (client view)',
  },
  {
    value: PricingVisibility.FULL_BREAKDOWN,
    label: 'Full Breakdown',
    description: 'Show cost, markup, and sell',
  },
];

/**
 * Pricing visibility selector component.
 * 
 * GUARDRAIL: This is a RUNTIME-ONLY setting.
 * Label clearly indicates this is not persisted.
 */
export function PricingVisibilitySelector({
  value,
  onChange,
  disabled = false,
  className = '',
}: PricingVisibilitySelectorProps): React.ReactElement {
  return (
    <div className={`${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Pricing Visibility
      </label>
      <p className="text-xs text-gray-500 mb-2">
        Display filter only • Not saved with PDF
      </p>
      <div className="space-y-2">
        {VISIBILITY_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`
              flex items-start gap-3 p-3 border rounded-lg cursor-pointer
              ${value === option.value
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input
              type="radio"
              name="pricingVisibility"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              disabled={disabled}
              className="mt-1"
            />
            <div>
              <span className="font-medium text-gray-900">{option.label}</span>
              <p className="text-sm text-gray-500">{option.description}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
