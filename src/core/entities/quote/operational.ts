/**
 * Quote Domain Entities - Operational
 * 
 * EmailRecord and PDFRecord entities.
 * 
 * Reference: Phase 5 - Section D.1, D.2
 */

import type {
  EntityId,
  DateTimeString,
} from '../types';

import { EmailStatus, PDFDisplayMode } from '../types';

// ============================================================
// EMAIL RECORD
// Reference: Phase 5 - Section D.1
// ============================================================

/**
 * Record of an email send attempt.
 * Reference: FR-051 - System shall track all email sends
 */
export interface EmailRecord {
  readonly id: EntityId;
  readonly quote_id: EntityId;
  readonly quote_version_id: EntityId;
  
  readonly recipient_email: string;
  readonly subject: string;
  readonly body_preview?: string;
  
  readonly sent_at: DateTimeString;
  readonly status: EmailStatus;
  readonly failure_reason?: string;
  
  /** If this is a resend, link to original EmailRecord */
  readonly resend_of?: EntityId;
}

// ============================================================
// PDF RECORD
// Reference: Phase 5 - Section D.2
// ============================================================

/**
 * Record of a PDF generation.
 */
export interface PDFRecord {
  readonly id: EntityId;
  readonly quote_id: EntityId;
  readonly quote_version_id: EntityId;
  
  readonly generated_at: DateTimeString;
  
  /**
   * Display mode used.
   * Reference: BRD v1.2 FR-041a
   */
  readonly display_mode: PDFDisplayMode;
  
  /** Sections included in the PDF */
  readonly sections_included: readonly string[];
  
  /** File storage reference (S3 key or file path) */
  readonly file_reference: string;
  readonly file_size_bytes: number;
}
