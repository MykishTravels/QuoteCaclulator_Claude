/**
 * DisplayModeSelector Component
 * 
 * Selects PDF display mode (DETAILED | SIMPLIFIED).
 * This value IS persisted in PDFRecord.
 */

import React from 'react';
import { PDFDisplayMode } from '../../types';

export interface DisplayModeSelectorProps {
  /** Current value */
  value: PDFDisplayMode;
  /** Change handler */
  onChange: (mode: PDFDisplayMode) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Optional CSS class */
  className?: string;
}

/**
 * Display mode options.
 */
const DISPLAY_MODE_OPTIONS = [
  {
    value: PDFDisplayMode.DETAILED,
    label: 'Detailed',
    description: 'Full breakdown with line items',
  },
  {
    value: PDFDisplayMode.SIMPLIFIED,
    label: 'Simplified',
    description: 'Summary totals only',
  },
];

/**
 * Display mode selector component.
 */
export function DisplayModeSelector({
  value,
  onChange,
  disabled = false,
  className = '',
}: DisplayModeSelectorProps): React.ReactElement {
  return (
    <div className={`${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Display Mode
      </label>
      <div className="space-y-2">
        {DISPLAY_MODE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`
              flex items-start gap-3 p-3 border rounded-lg cursor-pointer
              ${value === option.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input
              type="radio"
              name="displayMode"
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
