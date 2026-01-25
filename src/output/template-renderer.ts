/**
 * Template Renderer
 * 
 * Converts QuoteVersion to RenderedQuote for template consumption.
 * 
 * GUARDRAILS:
 * - QuoteVersion is READ-ONLY (never modified)
 * - No recalculation of any values
 * - Display modes are visibility FILTERS ONLY
 * - All pricing values come DIRECTLY from QuoteVersion
 */

import type {
  EntityId,
  CurrencyCode,
  MoneyAmount,
  DateString,
  DateTimeString,
} from '../core/types';

import { PDFDisplayMode, LineItemType } from '../core/types';

import type {
  Quote,
  QuoteVersion,
  QuoteLeg,
  QuoteLegLineItem,
  InterResortTransfer,
  TaxesBreakdown,
} from '../core/entities';

import {
  PricingVisibility,
  PDFSection,
  DEFAULT_PDF_SECTIONS,
  type PDFGenerationOptions,
  type RenderedQuote,
  type RenderedLeg,
  type RenderedLineItem,
  type RenderedTransfer,
  type RenderedTaxes,
  type RenderedPricing,
} from './types';

// ============================================================
// RENDERER
// ============================================================

/**
 * Renders a QuoteVersion to a RenderedQuote for template consumption.
 * 
 * This is a PURE function that:
 * - Reads from QuoteVersion (never modifies)
 * - Filters visibility based on options
 * - Returns a new RenderedQuote object
 */
export function renderQuote(
  quote: Quote,
  version: QuoteVersion,
  options: PDFGenerationOptions
): RenderedQuote {
  const { display_mode, pricing_visibility, sections = DEFAULT_PDF_SECTIONS } = options;

  // Calculate validity date (quote.validity_days from version creation)
  const createdAt = new Date(version.created_at);
  const validUntil = new Date(createdAt);
  validUntil.setDate(validUntil.getDate() + quote.validity_days);

  return {
    quote_id: quote.id,
    version_number: version.version_number,
    client_name: quote.client_name,
    client_email: quote.client_email,
    currency: version.currency_code,
    legs: renderLegs(version.legs, display_mode, pricing_visibility, version.currency_code),
    transfers: renderTransfers(version.inter_resort_transfers, pricing_visibility, version.currency_code),
    taxes: renderTaxes(version.pricing_summary.taxes_breakdown, pricing_visibility, version.currency_code),
    grand_total: renderGrandTotal(version, pricing_visibility),
    generated_at: new Date().toISOString(),
    valid_until: validUntil.toISOString().split('T')[0],
  };
}

// ============================================================
// LEG RENDERING
// ============================================================

function renderLegs(
  legs: readonly QuoteLeg[],
  displayMode: PDFDisplayMode,
  pricingVisibility: PricingVisibility,
  currency: CurrencyCode
): RenderedLeg[] {
  return legs.map(leg => renderLeg(leg, displayMode, pricingVisibility, currency));
}

function renderLeg(
  leg: QuoteLeg,
  displayMode: PDFDisplayMode,
  pricingVisibility: PricingVisibility,
  currency: CurrencyCode
): RenderedLeg {
  const rendered: RenderedLeg = {
    sequence: leg.sequence,
    resort_name: leg.resort_name,
    check_in: leg.check_in_date,
    check_out: leg.check_out_date,
    nights: leg.nights,
    adults: leg.adults_count,
    children: leg.children.length,
    room_type: leg.room.room_type_name,
    total: renderLegTotal(leg, pricingVisibility, currency),
  };

  // Include line items only in DETAILED mode
  if (displayMode === PDFDisplayMode.DETAILED) {
    rendered.line_items = renderLineItems(leg.line_items, pricingVisibility, currency);
  }

  return rendered;
}

function renderLegTotal(
  leg: QuoteLeg,
  pricingVisibility: PricingVisibility,
  currency: CurrencyCode
): RenderedPricing {
  return selectPricing(
    leg.leg_totals.cost_amount,
    leg.leg_totals.markup_amount,
    leg.leg_totals.sell_amount,
    pricingVisibility,
    currency
  );
}

// ============================================================
// LINE ITEM RENDERING
// ============================================================

function renderLineItems(
  items: readonly QuoteLegLineItem[],
  pricingVisibility: PricingVisibility,
  currency: CurrencyCode
): RenderedLineItem[] {
  return items.map(item => renderLineItem(item, pricingVisibility, currency));
}

function renderLineItem(
  item: QuoteLegLineItem,
  pricingVisibility: PricingVisibility,
  currency: CurrencyCode
): RenderedLineItem {
  return {
    description: item.description,
    quantity: formatQuantity(item),
    amount: selectPricing(
      item.cost_amount,
      item.markup_amount,
      item.sell_amount,
      pricingVisibility,
      currency
    ),
  };
}

function formatQuantity(item: QuoteLegLineItem): string {
  const detail = item.quantity_detail;
  
  // Format based on available quantity info
  if (detail.nights && detail.guests) {
    return `${detail.guests} × ${detail.nights} nights`;
  }
  if (detail.nights && detail.adults !== undefined) {
    const people = (detail.adults ?? 0) + (detail.children ?? 0);
    return `${people} pax × ${detail.nights} nights`;
  }
  if (detail.nights) {
    return `${detail.nights} nights`;
  }
  if (detail.bookings) {
    return `${detail.bookings} booking(s)`;
  }
  if (detail.trips) {
    return `${detail.trips} trip(s)`;
  }
  
  return '1';
}

// ============================================================
// TRANSFER RENDERING
// ============================================================

function renderTransfers(
  transfers: readonly InterResortTransfer[],
  pricingVisibility: PricingVisibility,
  currency: CurrencyCode
): RenderedTransfer[] {
  return transfers.map(transfer => renderTransfer(transfer, pricingVisibility, currency));
}

function renderTransfer(
  transfer: InterResortTransfer,
  pricingVisibility: PricingVisibility,
  currency: CurrencyCode
): RenderedTransfer {
  return {
    from_resort: transfer.from_leg_id, // Will be resolved by caller if needed
    to_resort: transfer.to_leg_id,
    description: transfer.transfer_description,
    amount: selectPricing(
      transfer.cost_amount,
      transfer.markup_amount,
      transfer.sell_amount,
      pricingVisibility,
      currency
    ),
  };
}

// ============================================================
// TAXES RENDERING
// ============================================================

function renderTaxes(
  taxes: TaxesBreakdown,
  pricingVisibility: PricingVisibility,
  currency: CurrencyCode
): RenderedTaxes {
  // Taxes don't have markup, so cost = sell
  // We render based on visibility but taxes are always at cost
  const rendered: RenderedTaxes = {
    total: {
      label: getTaxLabel(pricingVisibility),
      amount: taxes.total_taxes,
      currency,
    },
  };

  // Add individual tax components if non-zero
  if (taxes.green_tax_total > 0) {
    rendered.green_tax = {
      label: 'Green Tax',
      amount: taxes.green_tax_total,
      currency,
    };
  }

  if (taxes.service_charge_total > 0) {
    rendered.service_charge = {
      label: 'Service Charge',
      amount: taxes.service_charge_total,
      currency,
    };
  }

  if (taxes.gst_total > 0) {
    rendered.gst = {
      label: 'GST',
      amount: taxes.gst_total,
      currency,
    };
  }

  if (taxes.vat_total && taxes.vat_total > 0) {
    rendered.vat = {
      label: 'VAT',
      amount: taxes.vat_total,
      currency,
    };
  }

  return rendered;
}

function getTaxLabel(pricingVisibility: PricingVisibility): string {
  // Taxes are always shown as-is (no markup component)
  return 'Total Taxes';
}

// ============================================================
// GRAND TOTAL RENDERING
// ============================================================

function renderGrandTotal(
  version: QuoteVersion,
  pricingVisibility: PricingVisibility
): RenderedPricing {
  const totals = version.pricing_summary.quote_totals;
  
  return selectPricing(
    totals.total_cost,
    totals.total_markup,
    totals.total_sell,
    pricingVisibility,
    version.currency_code
  );
}

// ============================================================
// PRICING VISIBILITY SELECTION
// ============================================================

/**
 * Selects which pricing value to display based on visibility setting.
 * 
 * CRITICAL: This is a FILTER function. It selects from existing values.
 * It does NOT recalculate anything.
 */
function selectPricing(
  cost: MoneyAmount,
  markup: MoneyAmount,
  sell: MoneyAmount,
  visibility: PricingVisibility,
  currency: CurrencyCode
): RenderedPricing {
  switch (visibility) {
    case PricingVisibility.COST_ONLY:
      return {
        label: 'Cost',
        amount: cost,
        currency,
      };

    case PricingVisibility.SELL_ONLY:
      return {
        label: 'Total',
        amount: sell,
        currency,
      };

    case PricingVisibility.FULL_BREAKDOWN:
      // For full breakdown, we show sell but the template can access all values
      // through the line items. The "amount" here is the primary display value.
      return {
        label: 'Total',
        amount: sell,
        currency,
      };

    default:
      // Default to sell price
      return {
        label: 'Total',
        amount: sell,
        currency,
      };
  }
}

// ============================================================
// CURRENCY FORMATTING
// ============================================================

/**
 * Formats a money amount for display.
 */
export function formatMoney(amount: MoneyAmount, currency: CurrencyCode): string {
  const numAmount = amount as number;
  
  // Currency symbols
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    MVR: 'MVR ',
    AED: 'AED ',
  };
  
  const symbol = symbols[currency] ?? `${currency} `;
  
  return `${symbol}${numAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formats a date for display.
 */
export function formatDate(date: DateString | string): string {
  const d = new Date(date as string);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
