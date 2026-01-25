/**
 * PDF Generator
 * 
 * Generates PDF content from a RenderedQuote.
 * 
 * v1: Simple text-based PDF generation.
 * Future: Could use pdfkit, puppeteer, etc.
 * 
 * GUARDRAIL: This is a PURE rendering function.
 * - Takes RenderedQuote (already filtered by visibility)
 * - Produces PDF bytes
 * - No access to QuoteVersion or any domain logic
 */

import {
  PricingVisibility,
  PDFSection,
  type RenderedQuote,
  type RenderedLeg,
  type RenderedLineItem,
  type RenderedTransfer,
  type RenderedPricing,
  type PDFGenerationOptions,
} from './types';

import { formatMoney, formatDate } from './template-renderer';

// ============================================================
// PDF CONTENT GENERATION
// ============================================================

/**
 * Generates PDF content as a Buffer.
 * 
 * v1: Generates a simple text-based PDF structure.
 * This can be replaced with proper PDF library in future.
 */
export function generatePDFContent(
  rendered: RenderedQuote,
  options: PDFGenerationOptions
): Buffer {
  const sections = options.sections ?? Object.values(PDFSection);
  const lines: string[] = [];

  // Header
  if (sections.includes(PDFSection.HEADER)) {
    lines.push(...generateHeader(rendered));
  }

  // Client Info
  if (sections.includes(PDFSection.CLIENT_INFO)) {
    lines.push(...generateClientInfo(rendered));
  }

  // Legs
  if (sections.includes(PDFSection.LEGS)) {
    lines.push(...generateLegs(rendered, options.pricing_visibility));
  }

  // Inter-Resort Transfers
  if (sections.includes(PDFSection.INTER_RESORT_TRANSFERS) && rendered.transfers.length > 0) {
    lines.push(...generateTransfers(rendered, options.pricing_visibility));
  }

  // Pricing Summary
  if (sections.includes(PDFSection.PRICING_SUMMARY)) {
    lines.push(...generatePricingSummary(rendered, options.pricing_visibility));
  }

  // Taxes Breakdown
  if (sections.includes(PDFSection.TAXES_BREAKDOWN)) {
    lines.push(...generateTaxesBreakdown(rendered));
  }

  // Footer
  if (sections.includes(PDFSection.FOOTER)) {
    lines.push(...generateFooter(rendered));
  }

  // Convert to PDF format
  // v1: Simple text content wrapped in minimal PDF structure
  return createPDFBuffer(lines.join('\n'));
}

// ============================================================
// SECTION GENERATORS
// ============================================================

function generateHeader(rendered: RenderedQuote): string[] {
  return [
    '=' .repeat(60),
    'TRAVEL QUOTE',
    '=' .repeat(60),
    '',
    `Quote Reference: ${rendered.quote_id}`,
    `Version: ${rendered.version_number}`,
    `Generated: ${formatDate(rendered.generated_at)}`,
    `Valid Until: ${formatDate(rendered.valid_until)}`,
    `Currency: ${rendered.currency}`,
    '',
  ];
}

function generateClientInfo(rendered: RenderedQuote): string[] {
  const lines = [
    '-'.repeat(60),
    'CLIENT INFORMATION',
    '-'.repeat(60),
    '',
    `Name: ${rendered.client_name}`,
  ];

  if (rendered.client_email) {
    lines.push(`Email: ${rendered.client_email}`);
  }

  lines.push('');
  return lines;
}

function generateLegs(rendered: RenderedQuote, visibility: PricingVisibility): string[] {
  const lines: string[] = [
    '-'.repeat(60),
    'ITINERARY',
    '-'.repeat(60),
    '',
  ];

  for (const leg of rendered.legs) {
    lines.push(...generateLeg(leg, visibility, rendered.currency));
  }

  return lines;
}

function generateLeg(leg: RenderedLeg, visibility: PricingVisibility, currency: string): string[] {
  const lines = [
    `LEG ${leg.sequence}: ${leg.resort_name}`,
    `  Check-in:  ${formatDate(leg.check_in)}`,
    `  Check-out: ${formatDate(leg.check_out)}`,
    `  Nights:    ${leg.nights}`,
    `  Guests:    ${leg.adults} adults${leg.children > 0 ? `, ${leg.children} children` : ''}`,
    `  Room:      ${leg.room_type}`,
    '',
  ];

  // Line items (if present - only in DETAILED mode)
  if (leg.line_items && leg.line_items.length > 0) {
    lines.push('  Line Items:');
    for (const item of leg.line_items) {
      lines.push(`    - ${item.description}`);
      lines.push(`      Qty: ${item.quantity}`);
      lines.push(`      ${item.amount.label}: ${formatMoney(item.amount.amount, currency as any)}`);
    }
    lines.push('');
  }

  // Leg total
  lines.push(`  Leg ${leg.total.label}: ${formatMoney(leg.total.amount, currency as any)}`);
  lines.push('');

  return lines;
}

function generateTransfers(rendered: RenderedQuote, visibility: PricingVisibility): string[] {
  const lines = [
    '-'.repeat(60),
    'INTER-RESORT TRANSFERS',
    '-'.repeat(60),
    '',
  ];

  for (const transfer of rendered.transfers) {
    lines.push(`  ${transfer.description}`);
    lines.push(`    ${transfer.amount.label}: ${formatMoney(transfer.amount.amount, rendered.currency as any)}`);
    lines.push('');
  }

  return lines;
}

function generatePricingSummary(rendered: RenderedQuote, visibility: PricingVisibility): string[] {
  const lines = [
    '-'.repeat(60),
    'PRICING SUMMARY',
    '-'.repeat(60),
    '',
  ];

  // Leg totals
  for (const leg of rendered.legs) {
    lines.push(`  ${leg.resort_name} (${leg.nights} nights): ${formatMoney(leg.total.amount, rendered.currency as any)}`);
  }

  // Transfer total (if any)
  if (rendered.transfers.length > 0) {
    const transferTotal = rendered.transfers.reduce(
      (sum, t) => sum + (t.amount.amount as number),
      0
    );
    lines.push(`  Transfers: ${formatMoney(transferTotal as any, rendered.currency as any)}`);
  }

  lines.push('');
  lines.push(`  Taxes: ${formatMoney(rendered.taxes.total.amount, rendered.currency as any)}`);
  lines.push('');
  lines.push('  ' + '='.repeat(40));
  lines.push(`  GRAND ${rendered.grand_total.label.toUpperCase()}: ${formatMoney(rendered.grand_total.amount, rendered.currency as any)}`);
  lines.push('');

  return lines;
}

function generateTaxesBreakdown(rendered: RenderedQuote): string[] {
  const lines = [
    '-'.repeat(60),
    'TAXES BREAKDOWN',
    '-'.repeat(60),
    '',
  ];

  const taxes = rendered.taxes;

  if (taxes.green_tax) {
    lines.push(`  ${taxes.green_tax.label}: ${formatMoney(taxes.green_tax.amount, rendered.currency as any)}`);
  }
  if (taxes.service_charge) {
    lines.push(`  ${taxes.service_charge.label}: ${formatMoney(taxes.service_charge.amount, rendered.currency as any)}`);
  }
  if (taxes.gst) {
    lines.push(`  ${taxes.gst.label}: ${formatMoney(taxes.gst.amount, rendered.currency as any)}`);
  }
  if (taxes.vat) {
    lines.push(`  ${taxes.vat.label}: ${formatMoney(taxes.vat.amount, rendered.currency as any)}`);
  }

  lines.push('  ' + '-'.repeat(30));
  lines.push(`  Total Taxes: ${formatMoney(taxes.total.amount, rendered.currency as any)}`);
  lines.push('');

  return lines;
}

function generateFooter(rendered: RenderedQuote): string[] {
  return [
    '-'.repeat(60),
    '',
    'This quote is valid until ' + formatDate(rendered.valid_until) + '.',
    'Prices are subject to availability at time of booking.',
    '',
    '=' .repeat(60),
    `Generated on ${new Date().toISOString()}`,
    '=' .repeat(60),
  ];
}

// ============================================================
// PDF BUFFER CREATION
// ============================================================

/**
 * Creates a minimal PDF buffer from text content.
 * 
 * v1: Creates a simple PDF with embedded text.
 * This is a minimal PDF 1.4 structure.
 */
function createPDFBuffer(textContent: string): Buffer {
  // Escape special PDF characters
  const escapedText = textContent
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\n/g, ') Tj\nT* (');

  // Build minimal PDF structure
  const objects: string[] = [];
  
  // PDF Header
  const header = '%PDF-1.4\n';
  
  // Object 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  
  // Object 2: Pages
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  
  // Object 3: Page
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n');
  
  // Object 4: Content stream
  const contentStream = `BT\n/F1 10 Tf\n50 742 Td\n12 TL\n(${escapedText}) Tj\nET`;
  const streamLength = contentStream.length;
  objects.push(`4 0 obj\n<< /Length ${streamLength} >>\nstream\n${contentStream}\nendstream\nendobj\n`);
  
  // Object 5: Font
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n');
  
  // Build xref table
  let offset = header.length;
  const xrefEntries: string[] = ['0000000000 65535 f \n'];
  
  for (const obj of objects) {
    xrefEntries.push(`${offset.toString().padStart(10, '0')} 00000 n \n`);
    offset += obj.length;
  }
  
  const xrefOffset = offset;
  const xref = `xref\n0 ${objects.length + 1}\n${xrefEntries.join('')}`;
  
  // Trailer
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  
  // Combine all parts
  const pdfContent = header + objects.join('') + xref + trailer;
  
  return Buffer.from(pdfContent, 'utf-8');
}

/**
 * Gets the filename for a PDF.
 */
export function getPDFFilename(quoteId: string, versionNumber: number): string {
  const sanitizedId = quoteId.replace(/[^a-zA-Z0-9-]/g, '_');
  return `quote_${sanitizedId}_v${versionNumber}.pdf`;
}
