/**
 * UI Module - Barrel Export
 * 
 * React components for Quote PDF and Email generation.
 * 
 * GUARDRAILS ENFORCED:
 * - All data is read-only from backend
 * - PricingVisibility is runtime-only (local state)
 * - Email send does NOT trigger state transitions
 * - Version is always clearly displayed
 */

// Types (excluding component-conflicting names)
export {
  QuoteStatus,
  PDFDisplayMode,
  EmailStatus,
  PricingVisibility,
  PDFSection,
  DEFAULT_PDF_SECTIONS,
  type EntityId,
  type CurrencyCode,
  type MoneyAmount,
  type DateString,
  type DateTimeString,
  type Quote,
  type QuoteVersion,
  type QuoteLeg,
  type QuotePricingSummary,
  type LegSummary,
  type QuoteTotals,
  type TaxesBreakdown,
  type PDFRecord,
  type EmailRecord,
  type PDFGenerationOptions,
  type EmailGenerationOptions,
  type AvailableActions,
  type QuoteDetailData,
  type PDFGenerationFormState,
  type EmailSendFormState,
  type LoadingState,
  type AsyncResult,
} from './types';

// App initialization
export {
  initializeApp,
  initializeAppWithSeed,
  getAppContext,
  isAppInitialized,
  type AppInitOptions,
  type AppContext,
} from './app-init';

// State hooks
export * from './state';

// Services
export * from './services';

// Components
export * from './components';
