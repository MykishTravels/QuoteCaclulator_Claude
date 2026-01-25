/**
 * UI Types
 * 
 * Re-exports domain types for UI consumption.
 * UI-specific types for component props and state.
 * 
 * GUARDRAIL: These are READ-ONLY types.
 * UI must not modify any domain entities.
 */

// Import types for use in this file
import type {
  Quote as QuoteType,
  QuoteVersion as QuoteVersionType,
} from '../core/entities';

import type { AvailableActions as AvailableActionsType } from '../services';

import type { PDFSection as PDFSectionType } from '../output';

import type { PricingVisibility as PricingVisibilityType } from '../output';

import type { PDFDisplayMode as PDFDisplayModeType } from '../core/types';

// Re-export domain types for UI consumption
export type {
  EntityId,
  CurrencyCode,
  MoneyAmount,
  DateString,
  DateTimeString,
} from '../core/types';

export {
  QuoteStatus,
  PDFDisplayMode,
  EmailStatus,
} from '../core/types';

export type {
  Quote,
  QuoteVersion,
  QuoteLeg,
  QuotePricingSummary,
  LegSummary,
  QuoteTotals,
  TaxesBreakdown,
  PDFRecord,
  EmailRecord,
} from '../core/entities';

// Re-export output types
export {
  PricingVisibility,
  PDFSection,
  DEFAULT_PDF_SECTIONS,
} from '../output';

export type {
  PDFGenerationOptions,
  EmailGenerationOptions,
} from '../output';

// Re-export service types
export type { AvailableActions } from '../services';

// ============================================================
// UI-SPECIFIC TYPES
// ============================================================

/**
 * Quote detail with version and available actions.
 * This is what the UI receives from the API.
 */
export interface QuoteDetailData {
  quote: QuoteType;
  currentVersion: QuoteVersionType | null;
  actions: AvailableActionsType;
}

/**
 * PDF generation form state.
 */
export interface PDFGenerationFormState {
  displayMode: PDFDisplayModeType;
  pricingVisibility: PricingVisibilityType;
  sections: PDFSectionType[];
}

/**
 * Email send form state.
 */
export interface EmailSendFormState {
  recipientEmail: string;
  attachPdf: boolean;
  pdfOptions: PDFGenerationFormState | null;
}

/**
 * Loading state for async operations.
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Async operation result.
 */
export interface AsyncResult<T> {
  state: LoadingState;
  data: T | null;
  error: string | null;
}
