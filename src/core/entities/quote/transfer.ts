/**
 * Quote Domain Entities - Inter-Resort Transfer
 * 
 * Reference: Phase 5 - Section C.8
 */

import type {
  EntityId,
  CurrencyCode,
  MoneyAmount,
} from '../types';

import { InterResortTransferMarkupSource } from '../types';

// ============================================================
// INTER-RESORT TRANSFER
// Reference: Phase 5 - Section C.8
// ============================================================

/**
 * Transfer between resort legs.
 * Reference: Phase 4 Locked Refinement #4 - Markup from destination resort
 */
export interface InterResortTransfer {
  readonly id: EntityId;
  readonly quote_version_id: EntityId;
  
  /**
   * Leg references by ID (not by index).
   * Reference: Phase 1 - IRT references from_leg_id and to_leg_id (not indexes)
   */
  readonly from_leg_id: EntityId;
  readonly to_leg_id: EntityId;
  
  // Transfer Details
  /** Optional link to TransferType entity if using predefined transfer */
  readonly transfer_type_id?: EntityId;
  readonly transfer_description: string;
  readonly passenger_count: number;
  
  // Three-layer pricing
  readonly cost_amount: MoneyAmount;
  readonly markup_amount: MoneyAmount;
  readonly sell_amount: MoneyAmount;
  readonly currency_code: CurrencyCode;
  
  /**
   * Markup source indicator.
   * v1: Always DESTINATION_RESORT per Phase 4 Locked Refinement #4
   */
  readonly markup_source: InterResortTransferMarkupSource;
  
  /** Reference to the markup configuration used */
  readonly markup_config_id: EntityId;
  
  readonly notes?: string;
}

/**
 * Input for creating an inter-resort transfer.
 */
export interface InterResortTransferInput {
  /** From leg ID */
  readonly from_leg_id: EntityId;
  /** To leg ID */
  readonly to_leg_id: EntityId;
  
  /** If using predefined transfer type */
  readonly transfer_type_id?: EntityId;
  
  /** For custom transfers */
  readonly custom_cost_amount?: MoneyAmount;
  readonly description?: string;
  readonly currency_code?: CurrencyCode;
}

/**
 * Validates inter-resort transfer input.
 * Reference: Phase 3 - MLT-003, MLT-004
 */
export function validateInterResortTransferInput(
  input: InterResortTransferInput,
  legIds: readonly EntityId[]
): string[] {
  const errors: string[] = [];
  
  // MLT-004: Leg IDs must exist
  if (!legIds.includes(input.from_leg_id)) {
    errors.push(`from_leg_id "${input.from_leg_id}" does not exist`);
  }
  if (!legIds.includes(input.to_leg_id)) {
    errors.push(`to_leg_id "${input.to_leg_id}" does not exist`);
  }
  
  // MLT-003: from_leg must precede to_leg (checked by sequence, not here)
  // This is validated during quote validation with sequence information
  
  // Must have either transfer_type_id or custom cost
  if (!input.transfer_type_id && input.custom_cost_amount === undefined) {
    errors.push('Either transfer_type_id or custom_cost_amount must be provided');
  }
  
  if (input.custom_cost_amount !== undefined && (input.custom_cost_amount as number) < 0) {
    errors.push('custom_cost_amount cannot be negative');
  }
  
  return errors;
}
