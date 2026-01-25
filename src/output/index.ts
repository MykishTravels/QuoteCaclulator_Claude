/**
 * Output Module - Barrel Export
 * 
 * PDF and Email generation services.
 * 
 * GUARDRAILS:
 * - All services read from QuoteVersion (never modify)
 * - No state transitions triggered by output generation
 * - PricingVisibility is runtime-only (not persisted)
 */

// Types
export {
  PricingVisibility,
  PDFSection,
  DEFAULT_PDF_SECTIONS,
  type PDFGenerationOptions,
  type EmailGenerationOptions,
  type RenderedQuote,
  type RenderedLeg,
  type RenderedLineItem,
  type RenderedTransfer,
  type RenderedTaxes,
  type RenderedPricing,
  type StoragePort,
  type EmailPort,
} from './types';

// Template Renderer
export {
  renderQuote,
  formatMoney,
  formatDate,
} from './template-renderer';

// PDF Generator
export {
  generatePDFContent,
  getPDFFilename,
} from './pdf-generator';

// PDF Service
export {
  PDFService,
  createPDFService,
  PDFServiceError,
  PDFServiceException,
  DEFAULT_PDF_OPTIONS,
} from './pdf-service';

// Email Service
export {
  EmailService,
  createEmailService,
  EmailServiceError,
  EmailServiceException,
} from './email-service';

// Adapters
export {
  LocalFileStorage,
  createLocalFileStorage,
} from './storage-adapter';

export {
  StubEmailAdapter,
  createStubEmailAdapter,
  type EmailSendLog,
} from './email-adapter';
