/**
 * PDF Service
 * 
 * Orchestrates PDF generation from QuoteVersion.
 * 
 * GUARDRAILS:
 * - QuoteVersion is READ-ONLY (fetched, never modified)
 * - No recalculation
 * - Display mode persisted in PDFRecord
 * - Pricing visibility is runtime-only (NOT persisted)
 */

import type {
  EntityId,
  DateTimeString,
  Result,
} from '../core/types';

import { success, failure, PDFDisplayMode } from '../core/types';

import type {
  Quote,
  QuoteVersion,
  PDFRecord,
} from '../core/entities';

import type { DataContext } from '../data/repositories/interfaces';

import {
  type PDFGenerationOptions,
  type StoragePort,
  PricingVisibility,
  DEFAULT_PDF_SECTIONS,
} from './types';

import { renderQuote } from './template-renderer';
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
// PDF SERVICE ERRORS
// ============================================================

export enum PDFServiceError {
  QUOTE_NOT_FOUND = 'QUOTE_NOT_FOUND',
  VERSION_NOT_FOUND = 'VERSION_NOT_FOUND',
  GENERATION_FAILED = 'GENERATION_FAILED',
  STORAGE_FAILED = 'STORAGE_FAILED',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
}

export class PDFServiceException extends Error {
  constructor(
    public readonly code: PDFServiceError,
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(`[${code}] ${message}`);
    this.name = 'PDFServiceException';
  }
}

// ============================================================
// PDF SERVICE
// ============================================================

/**
 * PDF generation service.
 */
export class PDFService {
  constructor(
    private readonly dataContext: DataContext,
    private readonly storage: StoragePort
  ) {}

  /**
   * Generate a PDF for a specific QuoteVersion.
   * 
   * Flow:
   * 1. Fetch Quote and QuoteVersion (read-only)
   * 2. Render quote to template format
   * 3. Generate PDF content
   * 4. Store PDF file
   * 5. Create PDFRecord
   * 6. Return PDFRecord
   * 
   * NOTE: Pricing visibility is runtime-only and NOT persisted.
   */
  async generate(
    quoteId: EntityId,
    versionId: EntityId,
    options: PDFGenerationOptions
  ): Promise<Result<PDFRecord, PDFServiceException>> {
    // LOGGING: Start operation tracking (observability only)
    const correlationId = generateCorrelationId();
    const timer = startTimer();
    const logger = getLogger().child({ 
      correlation_id: correlationId, 
      quote_id: quoteId,
      version_id: versionId,
    });
    
    logger.info({
      correlation_id: correlationId,
      operation: Operations.PDF_GENERATE,
      message: 'Starting PDF generation',
      quote_id: quoteId,
      version_id: versionId,
      context: { display_mode: options.display_mode },
    });

    // Step 1: Fetch Quote (read-only)
    const quote = await this.dataContext.quotes.findById(quoteId);
    if (!quote) {
      // LOGGING: Log failure (observability only)
      logger.error({
        correlation_id: correlationId,
        operation: Operations.PDF_GENERATE,
        message: 'Quote not found',
        quote_id: quoteId,
        error_code: PDFServiceError.QUOTE_NOT_FOUND,
        duration_ms: timer.stop(),
      });
      return failure(new PDFServiceException(
        PDFServiceError.QUOTE_NOT_FOUND,
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
        operation: Operations.PDF_GENERATE,
        message: 'Version not found',
        quote_id: quoteId,
        version_id: versionId,
        error_code: PDFServiceError.VERSION_NOT_FOUND,
        duration_ms: timer.stop(),
      });
      return failure(new PDFServiceException(
        PDFServiceError.VERSION_NOT_FOUND,
        `Version not found: ${versionId}`,
        { quote_id: quoteId, version_id: versionId }
      ));
    }

    // Verify version belongs to quote
    if (version.quote_id !== quoteId) {
      // LOGGING: Log failure (observability only)
      logger.error({
        correlation_id: correlationId,
        operation: Operations.PDF_GENERATE,
        message: 'Version does not belong to quote',
        quote_id: quoteId,
        version_id: versionId,
        error_code: PDFServiceError.VERSION_NOT_FOUND,
        duration_ms: timer.stop(),
      });
      return failure(new PDFServiceException(
        PDFServiceError.VERSION_NOT_FOUND,
        `Version ${versionId} does not belong to quote ${quoteId}`,
        { quote_id: quoteId, version_id: versionId }
      ));
    }

    try {
      // Step 3: Render quote (filtering by options)
      const rendered = renderQuote(quote, version, options);

      // Step 4: Generate PDF content
      const pdfBuffer = generatePDFContent(rendered, options);

      // Step 5: Store PDF file
      const filename = getPDFFilename(quoteId, version.version_number);
      const fileReference = await this.storage.store(filename, pdfBuffer);
      const fileSize = await this.storage.getSize(fileReference);

      // Step 6: Create PDFRecord
      // NOTE: Only display_mode is persisted, NOT pricing_visibility
      const now = new Date().toISOString() as DateTimeString;
      const recordId = generateId(ID_PREFIXES.PDF) as EntityId;

      const record: PDFRecord = {
        id: recordId,
        quote_id: quoteId,
        quote_version_id: versionId,
        generated_at: now,
        display_mode: options.display_mode, // Persisted
        sections_included: options.sections ?? DEFAULT_PDF_SECTIONS,
        file_reference: fileReference,
        file_size_bytes: fileSize,
      };

      // Step 7: Persist record
      const createResult = await this.dataContext.pdfRecords.create(record);
      if (!createResult.success) {
        // Clean up stored file on failure
        await this.storage.delete(fileReference).catch(() => {});
        // LOGGING: Log failure (observability only)
        logger.error({
          correlation_id: correlationId,
          operation: Operations.PDF_GENERATE,
          message: 'Failed to persist PDF record',
          quote_id: quoteId,
          version_id: versionId,
          error_code: PDFServiceError.STORAGE_FAILED,
          duration_ms: timer.stop(),
        });
        return failure(new PDFServiceException(
          PDFServiceError.STORAGE_FAILED,
          `Failed to persist PDF record: ${createResult.error.message}`,
          { quote_id: quoteId, version_id: versionId }
        ));
      }

      // LOGGING: Log success (observability only)
      logger.info({
        correlation_id: correlationId,
        operation: Operations.PDF_GENERATE,
        message: 'PDF generated successfully',
        quote_id: quoteId,
        version_id: versionId,
        duration_ms: timer.stop(),
        context: { 
          record_id: recordId, 
          file_size_bytes: fileSize,
        },
      });

      return success(createResult.value);
    } catch (error) {
      // LOGGING: Log failure (observability only)
      logger.error({
        correlation_id: correlationId,
        operation: Operations.PDF_GENERATE,
        message: `PDF generation failed: ${error instanceof Error ? error.message : String(error)}`,
        quote_id: quoteId,
        version_id: versionId,
        error_code: PDFServiceError.GENERATION_FAILED,
        duration_ms: timer.stop(),
      });
      return failure(new PDFServiceException(
        PDFServiceError.GENERATION_FAILED,
        `PDF generation failed: ${error instanceof Error ? error.message : String(error)}`,
        { quote_id: quoteId, version_id: versionId }
      ));
    }
  }

  /**
   * Generate PDF for the current version of a quote.
   * Convenience method that finds the current version first.
   */
  async generateForCurrentVersion(
    quoteId: EntityId,
    options: PDFGenerationOptions
  ): Promise<Result<PDFRecord, PDFServiceException>> {
    // Fetch quote to get current version
    const quote = await this.dataContext.quotes.findById(quoteId);
    if (!quote) {
      return failure(new PDFServiceException(
        PDFServiceError.QUOTE_NOT_FOUND,
        `Quote not found: ${quoteId}`,
        { quote_id: quoteId }
      ));
    }

    if (!quote.current_version_id) {
      return failure(new PDFServiceException(
        PDFServiceError.VERSION_NOT_FOUND,
        `Quote ${quoteId} has no current version`,
        { quote_id: quoteId }
      ));
    }

    return this.generate(quoteId, quote.current_version_id, options);
  }

  /**
   * Retrieve PDF content by record ID.
   */
  async retrieve(recordId: EntityId): Promise<Result<Buffer, PDFServiceException>> {
    const record = await this.dataContext.pdfRecords.findById(recordId);
    if (!record) {
      return failure(new PDFServiceException(
        PDFServiceError.RECORD_NOT_FOUND,
        `PDF record not found: ${recordId}`,
        { record_id: recordId }
      ));
    }

    try {
      const content = await this.storage.retrieve(record.file_reference);
      return success(content);
    } catch (error) {
      return failure(new PDFServiceException(
        PDFServiceError.STORAGE_FAILED,
        `Failed to retrieve PDF: ${error instanceof Error ? error.message : String(error)}`,
        { record_id: recordId, file_reference: record.file_reference }
      ));
    }
  }

  /**
   * List all PDFs for a quote.
   */
  async listByQuote(quoteId: EntityId): Promise<readonly PDFRecord[]> {
    return this.dataContext.pdfRecords.findByQuote(quoteId);
  }

  /**
   * List all PDFs for a specific version.
   */
  async listByVersion(versionId: EntityId): Promise<readonly PDFRecord[]> {
    return this.dataContext.pdfRecords.findByVersion(versionId);
  }

  /**
   * Get a PDF record by ID.
   */
  async getById(recordId: EntityId): Promise<Result<PDFRecord, PDFServiceException>> {
    const record = await this.dataContext.pdfRecords.findById(recordId);
    if (!record) {
      return failure(new PDFServiceException(
        PDFServiceError.RECORD_NOT_FOUND,
        `PDF record not found: ${recordId}`,
        { record_id: recordId }
      ));
    }
    return success(record);
  }
}

/**
 * Factory function to create PDFService.
 */
export function createPDFService(
  dataContext: DataContext,
  storage: StoragePort
): PDFService {
  return new PDFService(dataContext, storage);
}

// ============================================================
// DEFAULT OPTIONS
// ============================================================

/**
 * Default PDF generation options.
 */
export const DEFAULT_PDF_OPTIONS: PDFGenerationOptions = {
  display_mode: PDFDisplayMode.DETAILED,
  pricing_visibility: PricingVisibility.SELL_ONLY,
  sections: DEFAULT_PDF_SECTIONS,
};
