/**
 * Email Service
 * 
 * Orchestrates email sending for quotes.
 * 
 * GUARDRAILS:
 * - QuoteVersion is READ-ONLY (fetched, never modified)
 * - Email send does NOT trigger state transition
 * - State transitions remain explicit API actions
 * - No recalculation or validation
 */

import type {
  EntityId,
  DateTimeString,
  Result,
} from '../core/types';

import { success, failure, EmailStatus, PDFDisplayMode } from '../core/types';

import type {
  Quote,
  QuoteVersion,
  EmailRecord,
} from '../core/entities';

import type { DataContext } from '../data/repositories/interfaces';

import {
  type EmailGenerationOptions,
  type EmailPort,
  type PDFGenerationOptions,
  type StoragePort,
  PricingVisibility,
  DEFAULT_PDF_SECTIONS,
} from './types';

import { renderQuote, formatMoney, formatDate } from './template-renderer';
import { generatePDFContent, getPDFFilename } from './pdf-generator';
import { generateId, ID_PREFIXES } from '../core/utils';

// Logging imports (observability only)
import {
  getLogger,
  generateCorrelationId,
  startTimer,
  Operations,
} from '../core/logging';

// ============================================================
// EMAIL SERVICE ERRORS
// ============================================================

export enum EmailServiceError {
  QUOTE_NOT_FOUND = 'QUOTE_NOT_FOUND',
  VERSION_NOT_FOUND = 'VERSION_NOT_FOUND',
  SEND_FAILED = 'SEND_FAILED',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  ORIGINAL_NOT_FOUND = 'ORIGINAL_NOT_FOUND',
}

export class EmailServiceException extends Error {
  constructor(
    public readonly code: EmailServiceError,
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(`[${code}] ${message}`);
    this.name = 'EmailServiceException';
  }
}

// ============================================================
// EMAIL SERVICE
// ============================================================

/**
 * Email sending service.
 */
export class EmailService {
  constructor(
    private readonly dataContext: DataContext,
    private readonly emailPort: EmailPort,
    private readonly storage: StoragePort
  ) {}

  /**
   * Send a quote email.
   * 
   * Flow:
   * 1. Fetch Quote and QuoteVersion (read-only)
   * 2. Generate email body
   * 3. Optionally generate PDF attachment
   * 4. Send email via port
   * 5. Create EmailRecord
   * 6. Return EmailRecord
   * 
   * NOTE: This does NOT trigger any state transition.
   * State transitions are explicit API actions.
   */
  async send(
    quoteId: EntityId,
    versionId: EntityId,
    options: EmailGenerationOptions
  ): Promise<Result<EmailRecord, EmailServiceException>> {
    // LOGGING: Start operation tracking (observability only)
    const correlationId = generateCorrelationId();
    const timer = startTimer();
    const operationName = options.resend_of ? Operations.EMAIL_RESEND : Operations.EMAIL_SEND;
    const logger = getLogger().child({ 
      correlation_id: correlationId, 
      quote_id: quoteId,
      version_id: versionId,
    });
    
    logger.info({
      correlation_id: correlationId,
      operation: operationName,
      message: options.resend_of ? 'Starting email resend' : 'Starting email send',
      quote_id: quoteId,
      version_id: versionId,
      context: { 
        recipient: options.recipient_email,
        attach_pdf: options.attach_pdf,
        resend_of: options.resend_of,
      },
    });

    // Step 1: Fetch Quote (read-only)
    const quote = await this.dataContext.quotes.findById(quoteId);
    if (!quote) {
      // LOGGING: Log failure (observability only)
      logger.error({
        correlation_id: correlationId,
        operation: operationName,
        message: 'Quote not found',
        quote_id: quoteId,
        error_code: EmailServiceError.QUOTE_NOT_FOUND,
        duration_ms: timer.stop(),
      });
      return failure(new EmailServiceException(
        EmailServiceError.QUOTE_NOT_FOUND,
        `Quote not found: ${quoteId}`,
        { quote_id: quoteId }
      ));
    }

    // Step 2: Fetch QuoteVersion (read-only)
    const version = await this.dataContext.quoteVersions.findById(versionId);
    if (!version) {
      // LOGGING: Log failure (observability only)
      logger.error({
        correlation_id: correlationId,
        operation: operationName,
        message: 'Version not found',
        quote_id: quoteId,
        version_id: versionId,
        error_code: EmailServiceError.VERSION_NOT_FOUND,
        duration_ms: timer.stop(),
      });
      return failure(new EmailServiceException(
        EmailServiceError.VERSION_NOT_FOUND,
        `Version not found: ${versionId}`,
        { quote_id: quoteId, version_id: versionId }
      ));
    }

    // Verify version belongs to quote
    if (version.quote_id !== quoteId) {
      // LOGGING: Log failure (observability only)
      logger.error({
        correlation_id: correlationId,
        operation: operationName,
        message: 'Version does not belong to quote',
        quote_id: quoteId,
        version_id: versionId,
        error_code: EmailServiceError.VERSION_NOT_FOUND,
        duration_ms: timer.stop(),
      });
      return failure(new EmailServiceException(
        EmailServiceError.VERSION_NOT_FOUND,
        `Version ${versionId} does not belong to quote ${quoteId}`,
        { quote_id: quoteId, version_id: versionId }
      ));
    }

    // Validate resend_of if provided
    if (options.resend_of) {
      const originalRecord = await this.dataContext.emailRecords.findById(options.resend_of);
      if (!originalRecord) {
        // LOGGING: Log failure (observability only)
        logger.error({
          correlation_id: correlationId,
          operation: operationName,
          message: 'Original email record not found for resend',
          quote_id: quoteId,
          error_code: EmailServiceError.ORIGINAL_NOT_FOUND,
          duration_ms: timer.stop(),
          context: { resend_of: options.resend_of },
        });
        return failure(new EmailServiceException(
          EmailServiceError.ORIGINAL_NOT_FOUND,
          `Original email record not found: ${options.resend_of}`,
          { resend_of: options.resend_of }
        ));
      }
    }

    // Step 3: Generate email content
    const subject = options.custom_subject ?? this.generateSubject(quote, version);
    const body = this.generateBody(quote, version);
    const bodyPreview = body.substring(0, 200);

    // Step 4: Prepare attachments
    const attachments: Array<{
      filename: string;
      content: Buffer;
      contentType: string;
    }> = [];

    if (options.attach_pdf) {
      const pdfOptions = options.pdf_options ?? {
        display_mode: PDFDisplayMode.DETAILED,
        pricing_visibility: PricingVisibility.SELL_ONLY,
        sections: DEFAULT_PDF_SECTIONS,
      };

      const rendered = renderQuote(quote, version, pdfOptions);
      const pdfContent = generatePDFContent(rendered, pdfOptions);
      const pdfFilename = getPDFFilename(quoteId, version.version_number);

      attachments.push({
        filename: pdfFilename,
        content: pdfContent,
        contentType: 'application/pdf',
      });
    }

    // Step 5: Send email
    const now = new Date().toISOString() as DateTimeString;
    const sendResult = await this.emailPort.send({
      to: options.recipient_email,
      subject,
      body,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    // Step 6: Create EmailRecord
    const recordId = generateId(ID_PREFIXES.EMAIL) as EntityId;

    const record: EmailRecord = {
      id: recordId,
      quote_id: quoteId,
      quote_version_id: versionId,
      recipient_email: options.recipient_email,
      subject,
      body_preview: bodyPreview,
      sent_at: now,
      status: sendResult.success ? EmailStatus.SENT : EmailStatus.FAILED,
      failure_reason: sendResult.error,
      resend_of: options.resend_of,
    };

    // Step 7: Persist record
    const createResult = await this.dataContext.emailRecords.create(record);
    if (!createResult.success) {
      // Still return the record info even if persistence failed
      // The email was sent (or failed to send), we just couldn't record it
      // LOGGING: Log warning (observability only - not a failure of the send itself)
      logger.warn({
        correlation_id: correlationId,
        operation: operationName,
        message: 'Failed to persist email record (email was still sent)',
        quote_id: quoteId,
        version_id: versionId,
      });
    }

    // Return result
    if (!sendResult.success) {
      // LOGGING: Log failure (observability only)
      logger.error({
        correlation_id: correlationId,
        operation: operationName,
        message: `Email send failed: ${sendResult.error}`,
        quote_id: quoteId,
        version_id: versionId,
        error_code: EmailServiceError.SEND_FAILED,
        duration_ms: timer.stop(),
        context: { recipient: options.recipient_email },
      });
      return failure(new EmailServiceException(
        EmailServiceError.SEND_FAILED,
        `Email send failed: ${sendResult.error}`,
        { quote_id: quoteId, version_id: versionId, recipient: options.recipient_email }
      ));
    }

    // LOGGING: Log success (observability only)
    logger.info({
      correlation_id: correlationId,
      operation: operationName,
      message: 'Email sent successfully',
      quote_id: quoteId,
      version_id: versionId,
      duration_ms: timer.stop(),
      context: { 
        record_id: recordId, 
        recipient: options.recipient_email,
        has_attachment: attachments.length > 0,
      },
    });

    return success(createResult.success ? createResult.value : record);
  }

  /**
   * Send email for the current version of a quote.
   * Convenience method that finds the current version first.
   */
  async sendForCurrentVersion(
    quoteId: EntityId,
    options: EmailGenerationOptions
  ): Promise<Result<EmailRecord, EmailServiceException>> {
    // Fetch quote to get current version
    const quote = await this.dataContext.quotes.findById(quoteId);
    if (!quote) {
      return failure(new EmailServiceException(
        EmailServiceError.QUOTE_NOT_FOUND,
        `Quote not found: ${quoteId}`,
        { quote_id: quoteId }
      ));
    }

    if (!quote.current_version_id) {
      return failure(new EmailServiceException(
        EmailServiceError.VERSION_NOT_FOUND,
        `Quote ${quoteId} has no current version`,
        { quote_id: quoteId }
      ));
    }

    return this.send(quoteId, quote.current_version_id, options);
  }

  /**
   * Resend an email.
   * Creates a new EmailRecord linked to the original via resend_of.
   */
  async resend(
    originalRecordId: EntityId,
    recipientOverride?: string
  ): Promise<Result<EmailRecord, EmailServiceException>> {
    // Fetch original record
    const original = await this.dataContext.emailRecords.findById(originalRecordId);
    if (!original) {
      return failure(new EmailServiceException(
        EmailServiceError.ORIGINAL_NOT_FOUND,
        `Original email record not found: ${originalRecordId}`,
        { record_id: originalRecordId }
      ));
    }

    // Send new email linked to original
    return this.send(original.quote_id, original.quote_version_id, {
      recipient_email: recipientOverride ?? original.recipient_email,
      custom_subject: original.subject,
      attach_pdf: true, // Always attach PDF on resend
      resend_of: originalRecordId,
    });
  }

  /**
   * List all emails for a quote.
   */
  async listByQuote(quoteId: EntityId): Promise<readonly EmailRecord[]> {
    return this.dataContext.emailRecords.findByQuote(quoteId);
  }

  /**
   * Get an email record by ID.
   */
  async getById(recordId: EntityId): Promise<Result<EmailRecord, EmailServiceException>> {
    const record = await this.dataContext.emailRecords.findById(recordId);
    if (!record) {
      return failure(new EmailServiceException(
        EmailServiceError.RECORD_NOT_FOUND,
        `Email record not found: ${recordId}`,
        { record_id: recordId }
      ));
    }
    return success(record);
  }

  // ============================================================
  // EMAIL CONTENT GENERATION
  // ============================================================

  private generateSubject(quote: Quote, version: QuoteVersion): string {
    return `Your Travel Quote - ${quote.id} (v${version.version_number})`;
  }

  private generateBody(quote: Quote, version: QuoteVersion): string {
    const totals = version.pricing_summary.quote_totals;
    const validUntil = new Date(version.created_at);
    validUntil.setDate(validUntil.getDate() + quote.validity_days);

    const lines = [
      `Dear ${quote.client_name},`,
      '',
      'Thank you for your interest in our travel services.',
      '',
      'Please find attached your personalized travel quote.',
      '',
      '--- QUOTE SUMMARY ---',
      '',
      `Quote Reference: ${quote.id}`,
      `Version: ${version.version_number}`,
      `Currency: ${version.currency_code}`,
      '',
      'Itinerary:',
    ];

    // Add leg summaries
    for (const leg of version.legs) {
      lines.push(`  • ${leg.resort_name}`);
      lines.push(`    ${formatDate(leg.check_in_date)} - ${formatDate(leg.check_out_date)} (${leg.nights} nights)`);
      lines.push(`    ${leg.adults_count} adults${leg.children.length > 0 ? `, ${leg.children.length} children` : ''}`);
    }

    lines.push('');
    lines.push(`Total: ${formatMoney(totals.total_sell, version.currency_code)}`);
    lines.push('');
    lines.push(`This quote is valid until ${formatDate(validUntil.toISOString())}.`);
    lines.push('');
    lines.push('Please review the attached PDF for full details.');
    lines.push('');
    lines.push('If you have any questions, please don\'t hesitate to contact us.');
    lines.push('');
    lines.push('Best regards,');
    lines.push('Your Travel Team');

    return lines.join('\n');
  }
}

/**
 * Factory function to create EmailService.
 */
export function createEmailService(
  dataContext: DataContext,
  emailPort: EmailPort,
  storage: StoragePort
): EmailService {
  return new EmailService(dataContext, emailPort, storage);
}
