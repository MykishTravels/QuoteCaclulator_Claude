/**
 * ActionButton Component
 * 
 * Individual lifecycle action button.
 * 
 * GUARDRAIL: This component only renders if the action is available.
 * Availability is determined by backend AvailableActions, not computed here.
 */

import React from 'react';
import { LifecycleAction, ACTION_METADATA } from './types';

export interface ActionButtonProps {
  /** Action identifier */
  action: LifecycleAction;
  /** Click handler */
  onClick: () => void;
  /** Whether button is disabled (action in progress) */
  disabled?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Key for React lists */
  key?: string | number;
}

/**
 * Lifecycle action button.
 */
export function ActionButton({
  action,
  onClick,
  disabled = false,
  size = 'md',
}: ActionButtonProps): React.ReactElement {
  const metadata = ACTION_METADATA[action];
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600',
    secondary: 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300',
    success: 'bg-green-600 text-white hover:bg-green-700 border-green-600',
    danger: 'bg-red-600 text-white hover:bg-red-700 border-red-600',
    warning: 'bg-yellow-500 text-white hover:bg-yellow-600 border-yellow-500',
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center gap-2 font-medium rounded-lg border
        ${variantClasses[metadata.variant]}
        ${sizeClasses[size]}
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      `}
    >
      <span>{metadata.icon}</span>
      <span>{metadata.label}</span>
    </button>
  );
}
