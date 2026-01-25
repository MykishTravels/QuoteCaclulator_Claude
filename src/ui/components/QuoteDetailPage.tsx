/**
 * QuoteDetailPage Component
 * 
 * Main quote detail page with tabs for pricing and output.
 * 
 * GUARDRAILS ENFORCED:
 * - QuoteVersion is read-only
 * - PricingVisibility is runtime-only (local state)
 * - Email send does NOT trigger state transitions
 * - Version is always clearly displayed
 * - Fail-fast when no version available
 * - Lifecycle actions use AvailableActions as sole source of truth (Sprint 5)
 * - No optimistic updates for lifecycle actions (Sprint 5)
 */

import React, { useState, useCallback } from 'react';
import type { EntityId } from '../types';
import { PricingVisibility } from '../types';
import { useQuoteDetail, usePricingVisibility } from '../state';

// Common components
import { LoadingOverlay, ErrorBanner, NoVersionError } from './common';

// Quote components
import { QuoteHeader, QuoteVersionBanner, NoVersionBanner, QuotePricingSummary } from './quote';

// PDF components
import { PDFGeneratePanel, PDFHistoryList } from './pdf';

// Email components
import { EmailSendPanel, EmailHistoryList } from './email';

// Lifecycle components (Sprint 5)
import { QuoteActionsBar } from './lifecycle';

export interface QuoteDetailPageProps {
  /** Quote ID to display */
  quoteId: EntityId;
}

/**
 * Tab options.
 */
type TabId = 'pricing' | 'output' | 'history';

/**
 * Quote detail page component.
 */
export function QuoteDetailPage({
  quoteId,
}: QuoteDetailPageProps): React.ReactElement {
  // Fetch quote data
  const {
    state: loadState,
    quote,
    currentVersion,
    actions,
    error,
    refresh,
    hasVersion,
  } = useQuoteDetail(quoteId);
  
  // Local pricing visibility state (runtime-only, NOT persisted)
  const { visibility, setVisibility } = usePricingVisibility();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('pricing');

  // Handle lifecycle action completion - refresh quote data
  // GUARDRAIL: No optimistic updates. Always refresh from backend.
  const handleActionComplete = useCallback(() => {
    refresh();
  }, [refresh]);
  
  // Loading state
  if (loadState === 'loading') {
    return <LoadingOverlay message="Loading quote..." />;
  }
  
  // Error state
  if (loadState === 'error' || !quote) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <ErrorBanner
          title="Failed to load quote"
          message={error ?? 'Unknown error occurred'}
        />
      </div>
    );
  }
  
  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Quote Header */}
      <QuoteHeader quote={quote} className="mb-4" />

      {/* Lifecycle Actions Bar (Sprint 5) */}
      {/* GUARDRAIL: Uses AvailableActions from backend as sole source of truth */}
      {actions && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Actions</h3>
          <QuoteActionsBar
            quote={quote}
            actions={actions}
            onActionComplete={handleActionComplete}
          />
        </div>
      )}
      
      {/* Version Banner (MANDATORY) */}
      {currentVersion ? (
        <QuoteVersionBanner
          version={currentVersion}
          className="mb-6"
        />
      ) : (
        <NoVersionBanner className="mb-6" />
      )}
      
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          <TabButton
            label="Pricing"
            isActive={activeTab === 'pricing'}
            onClick={() => setActiveTab('pricing')}
          />
          <TabButton
            label="PDF & Email"
            isActive={activeTab === 'output'}
            onClick={() => setActiveTab('output')}
          />
          <TabButton
            label="History"
            isActive={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
          />
        </nav>
      </div>
      
      {/* Tab Content */}
      {activeTab === 'pricing' && (
        <PricingTab
          quote={quote}
          version={currentVersion}
          visibility={visibility}
          onVisibilityChange={setVisibility}
        />
      )}
      
      {activeTab === 'output' && (
        <OutputTab
          quote={quote}
          versionId={currentVersion?.id ?? null}
          hasVersion={hasVersion}
        />
      )}
      
      {activeTab === 'history' && (
        <HistoryTab
          quoteId={quote.id}
          versionId={currentVersion?.id ?? null}
        />
      )}
    </div>
  );
}

/**
 * Tab button component.
 */
function TabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        pb-3 px-1 text-sm font-medium border-b-2 transition-colors
        ${isActive
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700'
        }
      `}
    >
      {label}
    </button>
  );
}

/**
 * Pricing tab content.
 */
function PricingTab({
  quote,
  version,
  visibility,
  onVisibilityChange,
}: {
  quote: ReturnType<typeof useQuoteDetail>['quote'];
  version: ReturnType<typeof useQuoteDetail>['currentVersion'];
  visibility: ReturnType<typeof usePricingVisibility>['visibility'];
  onVisibilityChange: ReturnType<typeof usePricingVisibility>['setVisibility'];
}): React.ReactElement {
  if (!version) {
    return <NoVersionError />;
  }
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Pricing Summary (3 columns) */}
      <div className="lg:col-span-3">
        <QuotePricingSummary
          summary={version.pricing_summary}
          currency={version.currency_code}
          visibility={visibility}
        />
      </div>
      
      {/* Visibility Filter Sidebar (1 column) */}
      <div className="lg:col-span-1">
        <div className="sticky top-6 bg-gray-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            View Options
          </h4>
          <div className="space-y-2">
            {[
              { value: PricingVisibility.COST_ONLY, label: 'Cost Only' },
              { value: PricingVisibility.SELL_ONLY, label: 'Sell Only' },
              { value: PricingVisibility.FULL_BREAKDOWN, label: 'Full Breakdown' },
            ].map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name="visibility"
                  checked={visibility === option.value}
                  onChange={() => onVisibilityChange(option.value)}
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Display filter only — not saved
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Output tab content (PDF & Email).
 */
function OutputTab({
  quote,
  versionId,
  hasVersion,
}: {
  quote: NonNullable<ReturnType<typeof useQuoteDetail>['quote']>;
  versionId: EntityId | null;
  hasVersion: boolean;
}): React.ReactElement {
  if (!hasVersion) {
    return <NoVersionError />;
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* PDF Generation */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <PDFGeneratePanel
          quoteId={quote.id}
          versionId={versionId}
        />
      </div>
      
      {/* Email Send */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <EmailSendPanel
          quote={quote}
          versionId={versionId}
        />
      </div>
    </div>
  );
}

/**
 * History tab content.
 */
function HistoryTab({
  quoteId,
  versionId,
}: {
  quoteId: EntityId;
  versionId: EntityId | null;
}): React.ReactElement {
  const [historyTab, setHistoryTab] = useState<'pdfs' | 'emails'>('pdfs');
  
  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-4 mb-6">
        <button
          type="button"
          onClick={() => setHistoryTab('pdfs')}
          className={`
            px-4 py-2 rounded-lg text-sm font-medium
            ${historyTab === 'pdfs'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }
          `}
        >
          📄 PDFs
        </button>
        <button
          type="button"
          onClick={() => setHistoryTab('emails')}
          className={`
            px-4 py-2 rounded-lg text-sm font-medium
            ${historyTab === 'emails'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }
          `}
        >
          ✉️ Emails
        </button>
      </div>
      
      {/* History Content */}
      {historyTab === 'pdfs' && (
        <PDFHistoryList quoteId={quoteId} />
      )}
      {historyTab === 'emails' && (
        <EmailHistoryList quoteId={quoteId} versionId={versionId} />
      )}
    </div>
  );
}
