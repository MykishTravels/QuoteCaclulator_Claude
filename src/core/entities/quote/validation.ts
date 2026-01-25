/**
 * Quote Domain Entities - Validation Result
 * 
 * Reference: Phase 5 - Section C.10
 */

import type {
  EntityId,
  DateTimeString,
  ValidationItem,
} from '../types';

import { ValidationSeverity } from '../types';

// ============================================================
// QUOTE VALIDATION RESULT
// Reference: Phase 5 - Section C.10
// ============================================================

/**
 * Result of quote validation.
 * Attached to every QuoteVersion.
 */
export interface QuoteValidationResult {
  readonly quote_version_id: EntityId;
  
  /** True if no blocking errors */
  readonly is_valid: boolean;
  
  /** True if valid OR only has warnings (can proceed to send) */
  readonly can_proceed: boolean;
  
  /** Blocking errors that prevent quote send */
  readonly blocking_errors: readonly ValidationItem[];
  
  /** Warnings that inform but do not block */
  readonly warnings: readonly ValidationItem[];
  
  readonly validated_at: DateTimeString;
}

/**
 * Creates a validation result from errors and warnings.
 */
export function createValidationResult(
  quoteVersionId: EntityId,
  errors: readonly ValidationItem[],
  warnings: readonly ValidationItem[],
  validatedAt: DateTimeString
): QuoteValidationResult {
  const blockingErrors = errors.filter(e => e.severity === ValidationSeverity.BLOCKING);
  const allWarnings = [
    ...errors.filter(e => e.severity === ValidationSeverity.WARNING),
    ...warnings,
  ];
  
  return {
    quote_version_id: quoteVersionId,
    is_valid: blockingErrors.length === 0,
    can_proceed: blockingErrors.length === 0,
    blocking_errors: blockingErrors,
    warnings: allWarnings,
    validated_at: validatedAt,
  };
}

/**
 * Merges multiple validation results.
 */
export function mergeValidationResults(
  quoteVersionId: EntityId,
  results: readonly QuoteValidationResult[],
  validatedAt: DateTimeString
): QuoteValidationResult {
  const allBlockingErrors: ValidationItem[] = [];
  const allWarnings: ValidationItem[] = [];
  
  for (const result of results) {
    allBlockingErrors.push(...result.blocking_errors);
    allWarnings.push(...result.warnings);
  }
  
  return {
    quote_version_id: quoteVersionId,
    is_valid: allBlockingErrors.length === 0,
    can_proceed: allBlockingErrors.length === 0,
    blocking_errors: allBlockingErrors,
    warnings: allWarnings,
    validated_at: validatedAt,
  };
}

/**
 * Checks if a validation result has a specific error code.
 */
export function hasErrorCode(result: QuoteValidationResult, code: string): boolean {
  return result.blocking_errors.some(e => e.code === code);
}

/**
 * Checks if a validation result has a specific warning code.
 */
export function hasWarningCode(result: QuoteValidationResult, code: string): boolean {
  return result.warnings.some(w => w.code === code);
}
