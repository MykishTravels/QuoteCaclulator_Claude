/**
 * UI API Client
 * 
 * Wraps backend services for UI consumption.
 * UI components call these methods, never the services directly.
 * 
 * GUARDRAIL: All methods are read-only or trigger-only.
 * No pricing calculations. No entity modifications.
 */

import type {
  EntityId,
  Quote,
  QuoteVersion,
  PDFRecord,
  EmailRecord,
  AvailableActions,
  QuoteDetailData,
  PDFGenerationOptions,
  EmailGenerationOptions,
} from '../types';

import { PDFDisplayMode, PricingVisibility, DEFAULT_PDF_SECTIONS } from '../types';

// ============================================================
// API CLIENT INTERFACE
// ============================================================

/**
 * API client for quote operations.
 * This is what UI components use to interact with backend.
 */
export interface QuoteApiClient {
  // Quote operations (read-only from UI perspective)
  getQuoteDetail(quoteId: EntityId): Promise<QuoteDetailData>;
  getQuoteVersions(quoteId: EntityId): Promise<readonly QuoteVersion[]>;
  getQuoteVersion(versionId: EntityId): Promise<QuoteVersion>;
  
  // PDF operations
  generatePdf(
    quoteId: EntityId,
    versionId: EntityId,
    options: PDFGenerationOptions
  ): Promise<PDFRecord>;
  getPdfRecords(quoteId: EntityId): Promise<readonly PDFRecord[]>;
  downloadPdf(recordId: EntityId): Promise<Blob>;
  
  // Email operations
  sendEmail(
    quoteId: EntityId,
    versionId: EntityId,
    options: EmailGenerationOptions
  ): Promise<EmailRecord>;
  resendEmail(recordId: EntityId, recipientOverride?: string): Promise<EmailRecord>;
  getEmailRecords(quoteId: EntityId): Promise<readonly EmailRecord[]>;
  
  // Status transitions (explicit actions only)
  sendQuote(quoteId: EntityId): Promise<Quote>;
  revertQuote(quoteId: EntityId): Promise<Quote>;
  convertQuote(quoteId: EntityId): Promise<Quote>;
  rejectQuote(quoteId: EntityId): Promise<Quote>;
  expireQuote(quoteId: EntityId): Promise<Quote>;
}

// ============================================================
// MOCK API CLIENT (for development/testing)
// ============================================================

/**
 * Creates a mock API client for UI development.
 * Replace with real implementation when backend is connected.
 */
export function createMockApiClient(): QuoteApiClient {
  // Mock data storage
  const pdfRecords: PDFRecord[] = [];
  const emailRecords: EmailRecord[] = [];
  
  return {
    async getQuoteDetail(quoteId: EntityId): Promise<QuoteDetailData> {
      // Mock implementation - would fetch from real API
      throw new Error('Connect to real API: getQuoteDetail');
    },
    
    async getQuoteVersions(quoteId: EntityId): Promise<readonly QuoteVersion[]> {
      throw new Error('Connect to real API: getQuoteVersions');
    },
    
    async getQuoteVersion(versionId: EntityId): Promise<QuoteVersion> {
      throw new Error('Connect to real API: getQuoteVersion');
    },
    
    async generatePdf(
      quoteId: EntityId,
      versionId: EntityId,
      options: PDFGenerationOptions
    ): Promise<PDFRecord> {
      throw new Error('Connect to real API: generatePdf');
    },
    
    async getPdfRecords(quoteId: EntityId): Promise<readonly PDFRecord[]> {
      return pdfRecords.filter(r => r.quote_id === quoteId);
    },
    
    async downloadPdf(recordId: EntityId): Promise<Blob> {
      throw new Error('Connect to real API: downloadPdf');
    },
    
    async sendEmail(
      quoteId: EntityId,
      versionId: EntityId,
      options: EmailGenerationOptions
    ): Promise<EmailRecord> {
      throw new Error('Connect to real API: sendEmail');
    },
    
    async resendEmail(recordId: EntityId, recipientOverride?: string): Promise<EmailRecord> {
      throw new Error('Connect to real API: resendEmail');
    },
    
    async getEmailRecords(quoteId: EntityId): Promise<readonly EmailRecord[]> {
      return emailRecords.filter(r => r.quote_id === quoteId);
    },
    
    async sendQuote(quoteId: EntityId): Promise<Quote> {
      throw new Error('Connect to real API: sendQuote');
    },
    
    async revertQuote(quoteId: EntityId): Promise<Quote> {
      throw new Error('Connect to real API: revertQuote');
    },
    
    async convertQuote(quoteId: EntityId): Promise<Quote> {
      throw new Error('Connect to real API: convertQuote');
    },
    
    async rejectQuote(quoteId: EntityId): Promise<Quote> {
      throw new Error('Connect to real API: rejectQuote');
    },
    
    async expireQuote(quoteId: EntityId): Promise<Quote> {
      throw new Error('Connect to real API: expireQuote');
    },
  };
}

// ============================================================
// API CLIENT CONTEXT
// ============================================================

// Global API client instance (set during app initialization)
let apiClientInstance: QuoteApiClient | null = null;

/**
 * Sets the global API client instance.
 * Call this during app initialization.
 */
export function setApiClient(client: QuoteApiClient): void {
  apiClientInstance = client;
}

/**
 * Gets the global API client instance.
 * Throws if not initialized.
 */
export function getApiClient(): QuoteApiClient {
  if (!apiClientInstance) {
    throw new Error('API client not initialized. Call setApiClient() first.');
  }
  return apiClientInstance;
}
