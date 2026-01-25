/**
 * Lifecycle Action Types
 * 
 * Types for quote lifecycle actions in the UI.
 * 
 * GUARDRAIL: These are UI display types only.
 * Action availability is determined by backend AvailableActions.
 */

import { QuoteStatus } from '../../types';

/**
 * Lifecycle action identifiers.
 */
export enum LifecycleAction {
  SEND = 'SEND',
  REVERT_TO_DRAFT = 'REVERT_TO_DRAFT',
  CONVERT = 'CONVERT',
  REJECT = 'REJECT',
  EXPIRE = 'EXPIRE',
}

/**
 * Action metadata for UI display.
 */
export interface ActionMetadata {
  /** Action identifier */
  action: LifecycleAction;
  /** Button label */
  label: string;
  /** Confirmation dialog title */
  confirmTitle: string;
  /** Confirmation dialog message */
  confirmMessage: string;
  /** Button style variant */
  variant: 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
  /** Icon (emoji for v1) */
  icon: string;
  /** Target status after action */
  targetStatus: QuoteStatus;
}

/**
 * Action metadata registry.
 */
export const ACTION_METADATA: Record<LifecycleAction, ActionMetadata> = {
  [LifecycleAction.SEND]: {
    action: LifecycleAction.SEND,
    label: 'Send to Client',
    confirmTitle: 'Send Quote?',
    confirmMessage: 'This will mark the quote as sent. The client will be able to review it.',
    variant: 'primary',
    icon: '📤',
    targetStatus: QuoteStatus.SENT,
  },
  [LifecycleAction.REVERT_TO_DRAFT]: {
    action: LifecycleAction.REVERT_TO_DRAFT,
    label: 'Revert to Draft',
    confirmTitle: 'Revert to Draft?',
    confirmMessage: 'This will return the quote to draft status for editing.',
    variant: 'secondary',
    icon: '↩️',
    targetStatus: QuoteStatus.DRAFT,
  },
  [LifecycleAction.CONVERT]: {
    action: LifecycleAction.CONVERT,
    label: 'Mark Converted',
    confirmTitle: 'Mark as Converted?',
    confirmMessage: 'This will mark the quote as converted (client accepted). This action cannot be undone.',
    variant: 'success',
    icon: '✅',
    targetStatus: QuoteStatus.CONVERTED,
  },
  [LifecycleAction.REJECT]: {
    action: LifecycleAction.REJECT,
    label: 'Mark Rejected',
    confirmTitle: 'Mark as Rejected?',
    confirmMessage: 'This will mark the quote as rejected (client declined). You can revert to draft later.',
    variant: 'danger',
    icon: '❌',
    targetStatus: QuoteStatus.REJECTED,
  },
  [LifecycleAction.EXPIRE]: {
    action: LifecycleAction.EXPIRE,
    label: 'Mark Expired',
    confirmTitle: 'Mark as Expired?',
    confirmMessage: 'This will mark the quote as expired. You can revert to draft later.',
    variant: 'warning',
    icon: '⏰',
    targetStatus: QuoteStatus.EXPIRED,
  },
};

/**
 * Maps AvailableActions flags to LifecycleAction.
 * 
 * GUARDRAIL: This is the ONLY place that determines which actions are available.
 * It reads from backend AvailableActions, never computes independently.
 */
export function getAvailableLifecycleActions(
  actions: {
    can_send: boolean;
    can_revert_to_draft: boolean;
    can_convert: boolean;
    can_reject: boolean;
    can_expire: boolean;
  }
): LifecycleAction[] {
  const available: LifecycleAction[] = [];
  
  if (actions.can_send) {
    available.push(LifecycleAction.SEND);
  }
  if (actions.can_revert_to_draft) {
    available.push(LifecycleAction.REVERT_TO_DRAFT);
  }
  if (actions.can_convert) {
    available.push(LifecycleAction.CONVERT);
  }
  if (actions.can_reject) {
    available.push(LifecycleAction.REJECT);
  }
  if (actions.can_expire) {
    available.push(LifecycleAction.EXPIRE);
  }
  
  return available;
}
