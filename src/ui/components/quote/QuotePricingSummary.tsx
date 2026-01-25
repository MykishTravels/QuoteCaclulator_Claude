/**
 * QuotePricingSummary Component
 * 
 * Displays QuotePricingSummary exactly as returned from API.
 * 
 * GUARDRAIL: READ-ONLY DISPLAY.
 * - No calculations
 * - No transformations
 * - Values come directly from QuoteVersion
 * - PricingVisibility is a VIEW FILTER only
 */

import React from 'react';
import type {
  QuotePricingSummary as QuotePricingSummaryType,
  LegSummary,
  TaxesBreakdown,
  QuoteTotals,
  CurrencyCode,
  MoneyAmount,
} from '../../types';
import { PricingVisibility } from '../../types';
import { MoneyDisplay } from '../common';

export interface QuotePricingSummaryProps {
  /** Pricing summary from QuoteVersion */
  summary: QuotePricingSummaryType;
  /** Currency code */
  currency: CurrencyCode;
  /** Pricing visibility (runtime-only filter) */
  visibility: PricingVisibility;
  /** Optional CSS class */
  className?: string;
}

/**
 * Selects which amount to display based on visibility.
 * 
 * GUARDRAIL: This is a FILTER function.
 * It selects from existing values, never calculates.
 */
function selectAmount(
  cost: MoneyAmount,
  markup: MoneyAmount,
  sell: MoneyAmount,
  visibility: PricingVisibility
): MoneyAmount {
  switch (visibility) {
    case PricingVisibility.COST_ONLY:
      return cost;
    case PricingVisibility.SELL_ONLY:
      return sell;
    case PricingVisibility.FULL_BREAKDOWN:
      return sell; // Show sell as primary, but we'll show breakdown separately
    default:
      return sell;
  }
}

/**
 * Gets the label for the amount column.
 */
function getAmountLabel(visibility: PricingVisibility): string {
  switch (visibility) {
    case PricingVisibility.COST_ONLY:
      return 'Cost';
    case PricingVisibility.SELL_ONLY:
      return 'Total';
    case PricingVisibility.FULL_BREAKDOWN:
      return 'Sell';
    default:
      return 'Total';
  }
}

/**
 * Quote pricing summary component.
 */
export function QuotePricingSummary({
  summary,
  currency,
  visibility,
  className = '',
}: QuotePricingSummaryProps): React.ReactElement {
  const showFullBreakdown = visibility === PricingVisibility.FULL_BREAKDOWN;
  const amountLabel = getAmountLabel(visibility);
  
  return (
    <div className={`${className}`}>
      {/* Leg Summaries */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Itinerary Summary
        </h3>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">
                Resort
              </th>
              <th className="px-4 py-2 text-center text-sm font-medium text-gray-600">
                Nights
              </th>
              {showFullBreakdown && (
                <>
                  <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">
                    Cost
                  </th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">
                    Markup
                  </th>
                </>
              )}
              <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">
                {amountLabel}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {summary.leg_summaries.map((leg) => (
              <LegSummaryRow
                key={leg.leg_id}
                leg={leg}
                currency={currency}
                visibility={visibility}
                showFullBreakdown={showFullBreakdown}
              />
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Transfers */}
      {(summary.inter_resort_transfer_total.cost_amount as number) > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Inter-Resort Transfers
          </h3>
          <div className="flex justify-between items-center py-2 px-4 bg-gray-50 rounded">
            <span className="text-gray-700">Transfers Total</span>
            <div className="flex items-center gap-4">
              {showFullBreakdown && (
                <>
                  <MoneyDisplay
                    amount={summary.inter_resort_transfer_total.cost_amount}
                    currency={currency}
                    size="sm"
                    className="text-gray-500"
                  />
                  <MoneyDisplay
                    amount={summary.inter_resort_transfer_total.markup_amount}
                    currency={currency}
                    size="sm"
                    className="text-gray-500"
                  />
                </>
              )}
              <MoneyDisplay
                amount={selectAmount(
                  summary.inter_resort_transfer_total.cost_amount,
                  summary.inter_resort_transfer_total.markup_amount,
                  summary.inter_resort_transfer_total.sell_amount,
                  visibility
                )}
                currency={currency}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Taxes Breakdown */}
      <TaxesBreakdownDisplay
        taxes={summary.taxes_breakdown}
        currency={currency}
      />
      
      {/* Grand Totals */}
      <QuoteTotalsDisplay
        totals={summary.quote_totals}
        currency={currency}
        visibility={visibility}
      />
    </div>
  );
}

/**
 * Leg summary row.
 */
function LegSummaryRow({
  leg,
  currency,
  visibility,
  showFullBreakdown,
}: {
  leg: LegSummary;
  currency: CurrencyCode;
  visibility: PricingVisibility;
  showFullBreakdown: boolean;
  key?: string | number;
}): React.ReactElement {
  return (
    <tr>
      <td className="px-4 py-3">
        <span className="font-medium text-gray-900">{leg.resort_name}</span>
      </td>
      <td className="px-4 py-3 text-center text-gray-600">
        {leg.nights}
      </td>
      {showFullBreakdown && (
        <>
          <td className="px-4 py-3 text-right">
            <MoneyDisplay amount={leg.cost_amount} currency={currency} size="sm" />
          </td>
          <td className="px-4 py-3 text-right">
            <MoneyDisplay amount={leg.markup_amount} currency={currency} size="sm" />
          </td>
        </>
      )}
      <td className="px-4 py-3 text-right">
        <MoneyDisplay
          amount={selectAmount(leg.cost_amount, leg.markup_amount, leg.sell_amount, visibility)}
          currency={currency}
        />
      </td>
    </tr>
  );
}

/**
 * Taxes breakdown display.
 */
function TaxesBreakdownDisplay({
  taxes,
  currency,
}: {
  taxes: TaxesBreakdown;
  currency: CurrencyCode;
}): React.ReactElement {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">
        Taxes
      </h3>
      <div className="space-y-2">
        {(taxes.green_tax_total as number) > 0 && (
          <div className="flex justify-between px-4 py-1">
            <span className="text-gray-600">Green Tax</span>
            <MoneyDisplay amount={taxes.green_tax_total} currency={currency} size="sm" />
          </div>
        )}
        {(taxes.service_charge_total as number) > 0 && (
          <div className="flex justify-between px-4 py-1">
            <span className="text-gray-600">Service Charge</span>
            <MoneyDisplay amount={taxes.service_charge_total} currency={currency} size="sm" />
          </div>
        )}
        {(taxes.gst_total as number) > 0 && (
          <div className="flex justify-between px-4 py-1">
            <span className="text-gray-600">GST</span>
            <MoneyDisplay amount={taxes.gst_total} currency={currency} size="sm" />
          </div>
        )}
        {taxes.vat_total && (taxes.vat_total as number) > 0 && (
          <div className="flex justify-between px-4 py-1">
            <span className="text-gray-600">VAT</span>
            <MoneyDisplay amount={taxes.vat_total} currency={currency} size="sm" />
          </div>
        )}
        <div className="flex justify-between px-4 py-2 bg-gray-50 rounded font-medium">
          <span className="text-gray-700">Total Taxes</span>
          <MoneyDisplay amount={taxes.total_taxes} currency={currency} />
        </div>
      </div>
    </div>
  );
}

/**
 * Quote totals display.
 */
function QuoteTotalsDisplay({
  totals,
  currency,
  visibility,
}: {
  totals: QuoteTotals;
  currency: CurrencyCode;
  visibility: PricingVisibility;
}): React.ReactElement {
  const showFullBreakdown = visibility === PricingVisibility.FULL_BREAKDOWN;
  
  return (
    <div className="border-t-2 border-gray-300 pt-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">
        Quote Totals
      </h3>
      
      {showFullBreakdown && (
        <div className="space-y-2 mb-4">
          <div className="flex justify-between px-4 py-1">
            <span className="text-gray-600">Total Cost</span>
            <MoneyDisplay amount={totals.total_cost} currency={currency} size="sm" />
          </div>
          <div className="flex justify-between px-4 py-1">
            <span className="text-gray-600">Total Markup</span>
            <MoneyDisplay amount={totals.total_markup} currency={currency} size="sm" />
          </div>
          <div className="flex justify-between px-4 py-1 text-gray-500 text-sm">
            <span>Markup %</span>
            <span>{(totals.markup_percentage as number).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between px-4 py-1 text-gray-500 text-sm">
            <span>Margin %</span>
            <span>{(totals.margin_percentage as number).toFixed(1)}%</span>
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-center px-4 py-3 bg-blue-50 rounded-lg">
        <span className="text-lg font-semibold text-blue-900">
          Grand Total
        </span>
        <MoneyDisplay
          amount={selectAmount(totals.total_cost, totals.total_markup, totals.total_sell, visibility)}
          currency={currency}
          size="lg"
          className="text-blue-900"
        />
      </div>
    </div>
  );
}
