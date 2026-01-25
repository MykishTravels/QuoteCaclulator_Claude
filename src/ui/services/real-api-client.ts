/**
 * Real API Client Implementation
 * 
 * Connects UI to actual backend services.
 * 
 * GUARDRAIL: This is a pass-through layer.
 * - No calculations
 * - No lifecycle logic
 * - No state modifications beyond explicit actions
 */

import type {
  EntityId,
  Quote,
  QuoteVersion,
  PDFRecord,
  EmailRecord,
  QuoteDetailData,
  PDFGenerationOptions,
  EmailGenerationOptions,
  AvailableActions,
} from '../types';

import type { QuoteApiClient } from './api-client';

// Backend service imports
import type { QuoteService } from '../../services/quote-service';
import type { PDFService } from '../../output/pdf-service';
import type { EmailService } from '../../output/email-service';

// ============================================================
// REAL API CLIENT
// ============================================================

/**
 * Dependencies required by the real API client.
 */
export interface RealApiClientDependencies {
  quoteService: QuoteService;
  pdfService: PDFService;
  emailService: EmailService;
}

/**
 * Real API client that calls actual backend services.
 */
export class RealApiClient implements QuoteApiClient {
  constructor(private readonly deps: RealApiClientDependencies) {}

  // ============================================================
  // QUOTE OPERATIONS (READ-ONLY)
  // ============================================================

  async getQuoteDetail(quoteId: EntityId): Promise<QuoteDetailData> {
    const result = await this.deps.quoteService.getWithActions(quoteId);
    
    if (!result.success) {
      throw new Error(result.error.message);
    }
    
    return {
      quote: result.value.quote,
      currentVersion: result.value.current_version,
      actions: result.value.actions,
    };
  }

  async getQuoteVersions(quoteId: EntityId): Promise<readonly QuoteVersion[]> {
    const result = await this.deps.quoteService.getVersions(quoteId);
    
    if (!result.success) {
      throw new Error(result.error.message);
    }
    
    return result.value;
  }

  async getQuoteVersion(versionId: EntityId): Promise<QuoteVersion> {
    const result = await this.deps.quoteService.getVersion(versionId);
    
    if (!result.success) {
      throw new Error(result.error.message);
    }
    
    return result.value;
  }

  // ============================================================
  // PDF OPERATIONS
  // ============================================================

  async generatePdf(
    quoteId: EntityId,
    versionId: EntityId,
    options: PDFGenerationOptions
  ): Promise<PDFRecord> {
    const result = await this.deps.pdfService.generate(quoteId, versionId, options);
    
    if (!result.success) {
      throw new Error(result.error.message);
    }
    
    return result.value;
  }

  async getPdfRecords(quoteId: EntityId): Promise<readonly PDFRecord[]> {
    return this.deps.pdfService.listByQuote(quoteId);
  }

  async downloadPdf(recordId: EntityId): Promise<Blob> {
    const result = await this.deps.pdfService.retrieve(recordId);
    
    if (!result.success) {
      throw new Error(result.error.message);
    }
    
    // Convert Buffer to Blob via Uint8Array
    const buffer = result.value;
    const uint8Array = new Uint8Array(buffer);
    return new Blob([uint8Array], { type: 'application/pdf' });
  }

  // ============================================================
  // EMAIL OPERATIONS
  // ============================================================

  async sendEmail(
    quoteId: EntityId,
    versionId: EntityId,
    options: EmailGenerationOptions
  ): Promise<EmailRecord> {
    const result = await this.deps.emailService.send(quoteId, versionId, options);
    
    if (!result.success) {
      throw new Error(result.error.message);
    }
    
    return result.value;
  }

  async resendEmail(
    recordId: EntityId,
    recipientOverride?: string
  ): Promise<EmailRecord> {
    const result = await this.deps.emailService.resend(recordId, recipientOverride);
    
    if (!result.success) {
      throw new Error(result.error.message);
    }
    
    return result.value;
  }

  async getEmailRecords(quoteId: EntityId): Promise<readonly EmailRecord[]> {
    return this.deps.emailService.listByQuote(quoteId);
  }

  // ============================================================
  // STATUS TRANSITIONS (EXPLICIT ACTIONS ONLY)
  // ============================================================

  async sendQuote(quoteId: EntityId): Promise<Quote> {
    const result = await this.deps.quoteService.send(quoteId);
    
    if (!result.success) {
      throw new Error(result.error.message);
    }
    
    return result.value;
  }

  async revertQuote(quoteId: EntityId): Promise<Quote> {
    const result = await this.deps.quoteService.revertToDraft(quoteId);
    
    if (!result.success) {
      throw new Error(result.error.message);
    }
    
    return result.value;
  }

  async convertQuote(quoteId: EntityId): Promise<Quote> {
    const result = await this.deps.quoteService.markConverted(quoteId);
    
    if (!result.success) {
      throw new Error(result.error.message);
    }
    
    return result.value;
  }

  async rejectQuote(quoteId: EntityId): Promise<Quote> {
    const result = await this.deps.quoteService.markRejected(quoteId);
    
    if (!result.success) {
      throw new Error(result.error.message);
    }
    
    return result.value;
  }

  async expireQuote(quoteId: EntityId): Promise<Quote> {
    const result = await this.deps.quoteService.markExpired(quoteId);
    
    if (!result.success) {
      throw new Error(result.error.message);
    }
    
    return result.value;
  }
}

/**
 * Factory function to create a real API client.
 */
export function createRealApiClient(deps: RealApiClientDependencies): QuoteApiClient {
  return new RealApiClient(deps);
}
