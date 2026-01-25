/**
 * Quote State Machine
 * 
 * Formal, enforced state machine for quote lifecycle.
 * 
 * States:
 *   DRAFT → SENT → (CONVERTED | REJECTED | EXPIRED)
 * 
 * Additional transitions:
 *   SENT → DRAFT (revert for editing)
 *   EXPIRED → DRAFT (reactivate)
 *   REJECTED → DRAFT (try again)
 * 
 * Terminal state: CONVERTED (no outbound transitions)
 * 
 * Reference: BRD v1.2 Section 3.3.2
 */

import type { EntityId, Result } from '../core/types';
import { QuoteStatus } from '../core/types';
import { success, failure } from '../core/types';
import type { Quote } from '../core/entities';

// ============================================================
// STATE MACHINE ERRORS
// ============================================================

/**
 * State machine error codes.
 */
export enum StateTransitionError {
  INVALID_TRANSITION = 'INVALID_TRANSITION',
  MISSING_VERSION = 'MISSING_VERSION',
  QUOTE_NOT_FOUND = 'QUOTE_NOT_FOUND',
  TERMINAL_STATE = 'TERMINAL_STATE',
}

/**
 * State transition error with context.
 */
export class QuoteStateError extends Error {
  constructor(
    public readonly code: StateTransitionError,
    message: string,
    public readonly context?: {
      quote_id?: EntityId;
      from_status?: QuoteStatus;
      to_status?: QuoteStatus;
    }
  ) {
    super(`[${code}] ${message}`);
    this.name = 'QuoteStateError';
  }
}

// ============================================================
// TRANSITION MATRIX
// ============================================================

/**
 * Valid transitions from each state.
 * Key: from state, Value: array of valid target states
 */
const VALID_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  [QuoteStatus.DRAFT]: [QuoteStatus.SENT],
  [QuoteStatus.SENT]: [
    QuoteStatus.DRAFT,      // Revert for editing
    QuoteStatus.CONVERTED,  // Client accepts
    QuoteStatus.REJECTED,   // Client declines
    QuoteStatus.EXPIRED,    // Time elapsed
  ],
  [QuoteStatus.EXPIRED]: [QuoteStatus.DRAFT],   // Reactivate
  [QuoteStatus.REJECTED]: [QuoteStatus.DRAFT],  // Try again
  [QuoteStatus.CONVERTED]: [],                   // Terminal state
};

/**
 * Human-readable state names.
 */
const STATE_NAMES: Record<QuoteStatus, string> = {
  [QuoteStatus.DRAFT]: 'Draft',
  [QuoteStatus.SENT]: 'Sent',
  [QuoteStatus.EXPIRED]: 'Expired',
  [QuoteStatus.REJECTED]: 'Rejected',
  [QuoteStatus.CONVERTED]: 'Converted',
};

// ============================================================
// TRANSITION VALIDATION
// ============================================================

/**
 * Check if a state transition is structurally valid.
 * Does NOT check guards (e.g., version required).
 */
export function isValidTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  const validTargets = VALID_TRANSITIONS[from];
  return validTargets.includes(to);
}

/**
 * Check if a state is terminal (no outbound transitions).
 */
export function isTerminalState(status: QuoteStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}

/**
 * Get all valid target states from a given state.
 */
export function getValidTargetStates(from: QuoteStatus): QuoteStatus[] {
  return [...VALID_TRANSITIONS[from]];
}

// ============================================================
// TRANSITION GUARDS
// ============================================================

/**
 * Guard: DRAFT → SENT requires a version.
 * Reference: A-021 - Quote cannot be sent without a QuoteVersion
 */
function guardDraftToSent(quote: Quote): Result<void, QuoteStateError> {
  if (quote.current_version_id === null) {
    return failure(new QuoteStateError(
      StateTransitionError.MISSING_VERSION,
      'Cannot send quote without a calculated version',
      { quote_id: quote.id, from_status: QuoteStatus.DRAFT, to_status: QuoteStatus.SENT }
    ));
  }
  return success(undefined);
}

/**
 * Guard registry: transition-specific validations.
 */
const TRANSITION_GUARDS: Partial<Record<string, (quote: Quote) => Result<void, QuoteStateError>>> = {
  [`${QuoteStatus.DRAFT}->${QuoteStatus.SENT}`]: guardDraftToSent,
};

/**
 * Get guard for a specific transition, if any.
 */
function getGuard(from: QuoteStatus, to: QuoteStatus): ((quote: Quote) => Result<void, QuoteStateError>) | null {
  const key = `${from}->${to}`;
  return TRANSITION_GUARDS[key] ?? null;
}

// ============================================================
// MAIN TRANSITION FUNCTION
// ============================================================

/**
 * Result of a successful transition.
 */
export interface TransitionResult {
  from_status: QuoteStatus;
  to_status: QuoteStatus;
  transitioned_at: string;
}

/**
 * Validate and execute a state transition.
 * 
 * Checks:
 * 1. Transition is structurally valid
 * 2. Any guards pass
 * 
 * Returns the transition result or an error.
 */
export function validateTransition(
  quote: Quote,
  targetStatus: QuoteStatus
): Result<TransitionResult, QuoteStateError> {
  const currentStatus = quote.status;
  
  // Check: not a no-op
  if (currentStatus === targetStatus) {
    // Same state is allowed (idempotent)
    return success({
      from_status: currentStatus,
      to_status: targetStatus,
      transitioned_at: new Date().toISOString(),
    });
  }
  
  // Check: terminal state
  if (isTerminalState(currentStatus)) {
    return failure(new QuoteStateError(
      StateTransitionError.TERMINAL_STATE,
      `Quote is in terminal state ${STATE_NAMES[currentStatus]}; no transitions allowed`,
      { quote_id: quote.id, from_status: currentStatus, to_status: targetStatus }
    ));
  }
  
  // Check: transition is valid
  if (!isValidTransition(currentStatus, targetStatus)) {
    const validTargets = getValidTargetStates(currentStatus)
      .map(s => STATE_NAMES[s])
      .join(', ');
    
    return failure(new QuoteStateError(
      StateTransitionError.INVALID_TRANSITION,
      `Cannot transition from ${STATE_NAMES[currentStatus]} to ${STATE_NAMES[targetStatus]}. ` +
      `Valid targets: ${validTargets || 'none'}`,
      { quote_id: quote.id, from_status: currentStatus, to_status: targetStatus }
    ));
  }
  
  // Check: guards pass
  const guard = getGuard(currentStatus, targetStatus);
  if (guard) {
    const guardResult = guard(quote);
    if (!guardResult.success) {
      return guardResult;
    }
  }
  
  // Transition is valid
  return success({
    from_status: currentStatus,
    to_status: targetStatus,
    transitioned_at: new Date().toISOString(),
  });
}

// ============================================================
// STATE MACHINE QUERIES
// ============================================================

/**
 * Check if quote can be sent (DRAFT with version).
 */
export function canSend(quote: Quote): boolean {
  if (quote.status !== QuoteStatus.DRAFT) {
    return false;
  }
  if (quote.current_version_id === null) {
    return false;
  }
  return true;
}

/**
 * Check if quote can be edited (DRAFT only for v1).
 */
export function canEdit(quote: Quote): boolean {
  return quote.status === QuoteStatus.DRAFT;
}

/**
 * Check if quote can be calculated.
 * A quote can be calculated if it's in DRAFT status.
 */
export function canCalculate(quote: Quote): boolean {
  return quote.status === QuoteStatus.DRAFT;
}

/**
 * Check if quote is in a modifiable state.
 * DRAFT is the only modifiable state.
 */
export function isModifiable(quote: Quote): boolean {
  return quote.status === QuoteStatus.DRAFT;
}

/**
 * Get available actions for a quote.
 */
export interface AvailableActions {
  can_edit: boolean;
  can_calculate: boolean;
  can_send: boolean;
  can_revert_to_draft: boolean;
  can_convert: boolean;
  can_reject: boolean;
  can_expire: boolean;
}

export function getAvailableActions(quote: Quote): AvailableActions {
  const status = quote.status;
  const hasVersion = quote.current_version_id !== null;
  
  return {
    can_edit: status === QuoteStatus.DRAFT,
    can_calculate: status === QuoteStatus.DRAFT,
    can_send: status === QuoteStatus.DRAFT && hasVersion,
    can_revert_to_draft: [QuoteStatus.SENT, QuoteStatus.EXPIRED, QuoteStatus.REJECTED].includes(status),
    can_convert: status === QuoteStatus.SENT,
    can_reject: status === QuoteStatus.SENT,
    can_expire: status === QuoteStatus.SENT,
  };
}
