/**
 * Quote Domain Entities - Calculation Audit
 * 
 * Reference: Phase 5 - Section C.11
 * Reference: Phase 4 - Section J Audit Trail Structure
 */

import type {
  EntityId,
  DateTimeString,
  MoneyAmount,
  AuditStep,
  AuditWarning,
} from '../types';

import { AuditStepType, ValidationSeverity } from '../types';

// ============================================================
// QUOTE CALCULATION AUDIT
// Reference: Phase 5 - Section C.11
// ============================================================

/**
 * Complete calculation audit trail for a quote version.
 * Every calculation step is recorded for full traceability.
 */
export interface QuoteCalculationAudit {
  readonly quote_version_id: EntityId;
  readonly calculated_at: DateTimeString;
  
  /** Ordered list of calculation steps */
  readonly calculation_steps: readonly AuditStep[];
  
  /** Warnings generated during calculation */
  readonly warnings: readonly AuditWarning[];
}

// ============================================================
// AUDIT BUILDER
// Helper class for constructing audit trail during calculation
// ============================================================

/**
 * Builder for constructing calculation audit during quote calculation.
 * Mutable during calculation, produces immutable result.
 */
export class AuditBuilder {
  private steps: AuditStep[] = [];
  private warnings: AuditWarning[] = [];
  private stepCounter = 0;
  
  constructor(
    private readonly quoteVersionId: EntityId,
    private readonly startTime: DateTimeString
  ) {}
  
  /**
   * Adds a calculation step.
   */
  addStep(params: {
    stepType: AuditStepType;
    legId?: EntityId;
    description: string;
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
    resultAmount: MoneyAmount;
  }): void {
    this.stepCounter++;
    
    this.steps.push({
      step_number: this.stepCounter,
      step_type: params.stepType,
      leg_id: params.legId,
      timestamp: new Date().toISOString() as DateTimeString,
      description: params.description,
      inputs: params.inputs,
      outputs: params.outputs,
      result_amount: params.resultAmount,
    });
  }
  
  /**
   * Adds a warning.
   */
  addWarning(code: string, message: string): void {
    this.warnings.push({
      code,
      severity: ValidationSeverity.WARNING,
      message,
    });
  }
  
  /**
   * Gets the current step count.
   */
  getStepCount(): number {
    return this.stepCounter;
  }
  
  /**
   * Builds the final immutable audit.
   */
  build(): QuoteCalculationAudit {
    return {
      quote_version_id: this.quoteVersionId,
      calculated_at: this.startTime,
      calculation_steps: [...this.steps],
      warnings: [...this.warnings],
    };
  }
}

// ============================================================
// AUDIT VERIFICATION
// ============================================================

/**
 * Verifies calculation audit against final totals.
 * Reference: Phase 6 - CALC_VERIFICATION_FAILED
 */
export function verifyAuditTotals(
  audit: QuoteCalculationAudit,
  expectedTotalSell: MoneyAmount
): { valid: boolean; discrepancy?: number } {
  // Sum all positive result amounts (excluding discount steps which are negative)
  let calculatedTotal = 0;
  
  for (const step of audit.calculation_steps) {
    if (step.step_type === AuditStepType.QUOTE_AGGREGATION) {
      // Use the final aggregation result
      const outputs = step.outputs as { total_sell?: number };
      if (outputs.total_sell !== undefined) {
        calculatedTotal = outputs.total_sell;
        break;
      }
    }
  }
  
  const expected = expectedTotalSell as number;
  const discrepancy = Math.abs(calculatedTotal - expected);
  
  // Allow for small rounding differences (up to 1 cent)
  return {
    valid: discrepancy <= 0.01,
    discrepancy: discrepancy > 0.01 ? discrepancy : undefined,
  };
}

/**
 * Extracts step-by-step breakdown from audit for debugging.
 */
export function extractAuditSummary(audit: QuoteCalculationAudit): string[] {
  return audit.calculation_steps.map(step => 
    `${step.step_number}. [${step.step_type}] ${step.description}: ${step.result_amount}`
  );
}
