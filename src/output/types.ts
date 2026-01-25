/**
 * Output Types
 * 
 * Runtime-only types for PDF and Email generation.
 * These are NOT persisted and do NOT modify existing entity schemas.
 * 
 * GUARDRAIL: PricingVisibility is runtime-only, not stored in PDFRecord.
 */

import type {
  EntityId,
  CurrencyCode,
  MoneyAmount,
  DateString,
} from '../core/types';

import { PDFDisplayMode } from '../core/types';

// ============================================================
// PRICING VISIBILITY (RUNTIME-ONLY)
// ============================================================

/**
 * Runtime-only pricing visibility option.
 * Controls which pricing columns are rendered.
 * 
 * NOT persisted in PDFRecord (schema locked).
 */
export enum PricingVisibility {
  /** Show cost amounts only */
  COST_ONLY = 'COST_ONLY',
  /** Show sell amounts only */
  SELL_ONLY = 'SELL_ONLY',
  /** Show cost, markup, and sell amounts */
  FULL_BREAKDOWN = 'FULL_BREAKDOWN',
}

// ============================================================
// PDF GENERATION OPTIONS
// ============================================================

/**
 * Options for PDF generation.
 */
export interface PDFGenerationOptions {
  /** Detail level (persisted in PDFRecord) */
  display_mode: PDFDisplayMode;
  
  /** Pricing visibility (runtime-only, NOT persisted) */
  pricing_visibility: PricingVisibility;
  
  /** Sections to include */
  sections?: PDFSection[];
}

/**
 * PDF sections that can be included/excluded.
 */
export enum PDFSection {
  HEADER = 'HEADER',
  CLIENT_INFO = 'CLIENT_INFO',
  LEGS = 'LEGS',
  INTER_RESORT_TRANSFERS = 'INTER_RESORT_TRANSFERS',
  PRICING_SUMMARY = 'PRICING_SUMMARY',
  TAXES_BREAKDOWN = 'TAXES_BREAKDOWN',
  TERMS_AND_CONDITIONS = 'TERMS_AND_CONDITIONS',
  FOOTER = 'FOOTER',
}

/**
 * Default sections included in PDF.
 */
export const DEFAULT_PDF_SECTIONS: PDFSection[] = [
  PDFSection.HEADER,
  PDFSection.CLIENT_INFO,
  PDFSection.LEGS,
  PDFSection.INTER_RESORT_TRANSFERS,
  PDFSection.PRICING_SUMMARY,
  PDFSection.TAXES_BREAKDOWN,
  PDFSection.FOOTER,
];

// ============================================================
// EMAIL GENERATION OPTIONS
// ============================================================

/**
 * Options for email generation.
 */
export interface EmailGenerationOptions {
  /** Recipient email address */
  recipient_email: string;
  
  /** Custom subject (optional, will use default if not provided) */
  custom_subject?: string;
  
  /** Whether to attach PDF */
  attach_pdf: boolean;
  
  /** PDF options if attaching */
  pdf_options?: PDFGenerationOptions;
  
  /** If this is a resend, link to original EmailRecord */
  resend_of?: EntityId;
}

// ============================================================
// RENDERED OUTPUT STRUCTURES
// ============================================================

/**
 * Rendered pricing values based on visibility setting.
 * Used by templates to display appropriate values.
 */
export interface RenderedPricing {
  /** Display label (e.g., "Total", "Cost", "Sell Price") */
  label: string;
  /** Amount to display */
  amount: MoneyAmount;
  /** Currency code */
  currency: CurrencyCode;
}

/**
 * Rendered leg for template consumption.
 */
export interface RenderedLeg {
  sequence: number;
  resort_name: string;
  check_in: DateString;
  check_out: DateString;
  nights: number;
  adults: number;
  children: number;
  room_type: string;
  
  /** Line items (only in DETAILED mode) */
  line_items?: RenderedLineItem[];
  
  /** Leg total based on pricing visibility */
  total: RenderedPricing;
}

/**
 * Rendered line item for template consumption.
 */
export interface RenderedLineItem {
  description: string;
  quantity: string;
  amount: RenderedPricing;
}

/**
 * Rendered inter-resort transfer.
 */
export interface RenderedTransfer {
  from_resort: string;
  to_resort: string;
  description: string;
  amount: RenderedPricing;
}

/**
 * Rendered taxes breakdown.
 */
export interface RenderedTaxes {
  green_tax?: RenderedPricing;
  service_charge?: RenderedPricing;
  gst?: RenderedPricing;
  vat?: RenderedPricing;
  total: RenderedPricing;
}

/**
 * Complete rendered quote for template consumption.
 */
export interface RenderedQuote {
  /** Quote reference */
  quote_id: EntityId;
  version_number: number;
  
  /** Client info */
  client_name: string;
  client_email?: string;
  
  /** Currency */
  currency: CurrencyCode;
  
  /** Rendered legs */
  legs: RenderedLeg[];
  
  /** Rendered transfers */
  transfers: RenderedTransfer[];
  
  /** Rendered taxes (based on pricing visibility) */
  taxes: RenderedTaxes;
  
  /** Grand total */
  grand_total: RenderedPricing;
  
  /** Quote metadata */
  generated_at: string;
  valid_until: string;
}

// ============================================================
// STORAGE PORT
// ============================================================

/**
 * Minimal storage port for PDF file storage.
 * v1: Local filesystem implementation.
 */
export interface StoragePort {
  /**
   * Store a file and return reference.
   */
  store(filename: string, content: Buffer): Promise<string>;
  
  /**
   * Retrieve a file by reference.
   */
  retrieve(reference: string): Promise<Buffer>;
  
  /**
   * Delete a file by reference.
   */
  delete(reference: string): Promise<void>;
  
  /**
   * Get file size in bytes.
   */
  getSize(reference: string): Promise<number>;
}

// ============================================================
// EMAIL PORT
// ============================================================

/**
 * Minimal email port for sending emails.
 * v1: Stub implementation (logs only).
 */
export interface EmailPort {
  /**
   * Send an email.
   * Returns true if sent successfully, false otherwise.
   */
  send(params: {
    to: string;
    subject: string;
    body: string;
    attachments?: Array<{
      filename: string;
      content: Buffer;
      contentType: string;
    }>;
  }): Promise<{ success: boolean; error?: string }>;
}
