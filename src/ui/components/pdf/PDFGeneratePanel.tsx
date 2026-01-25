/**
 * PDFGeneratePanel Component
 * 
 * Main PDF generation UI.
 * 
 * GUARDRAIL: Trigger-only.
 * - Calls API to generate PDF
 * - Does not modify quote or version
 */

import React, { useState, useCallback } from 'react';
import type { EntityId, PDFGenerationOptions } from '../../types';
import { PDFDisplayMode, PricingVisibility, DEFAULT_PDF_SECTIONS } from '../../types';
import { DisplayModeSelector } from './DisplayModeSelector';
import { PricingVisibilitySelector } from './PricingVisibilitySelector';
import { LoadingInline, ErrorInline } from '../common';
import { usePDFGeneration } from '../../state';

export interface PDFGeneratePanelProps {
  /** Quote ID */
  quoteId: EntityId;
  /** Version ID */
  versionId: EntityId | null;
  /** Optional CSS class */
  className?: string;
  /** Callback when PDF is generated */
  onGenerated?: () => void;
}

/**
 * PDF generation panel component.
 */
export function PDFGeneratePanel({
  quoteId,
  versionId,
  className = '',
  onGenerated,
}: PDFGeneratePanelProps): React.ReactElement {
  // Form state
  const [displayMode, setDisplayMode] = useState<PDFDisplayMode>(PDFDisplayMode.DETAILED);
  const [pricingVisibility, setPricingVisibility] = useState<PricingVisibility>(
    PricingVisibility.SELL_ONLY
  );
  
  // Generation hook
  const { state, error, generate } = usePDFGeneration(quoteId, versionId);
  
  const handleGenerate = useCallback(async () => {
    const options: PDFGenerationOptions = {
      display_mode: displayMode,
      pricing_visibility: pricingVisibility,
      sections: [...DEFAULT_PDF_SECTIONS],
    };
    
    const record = await generate(options);
    if (record && onGenerated) {
      onGenerated();
    }
  }, [displayMode, pricingVisibility, generate, onGenerated]);
  
  const isLoading = state === 'loading';
  const canGenerate = versionId !== null && !isLoading;
  
  return (
    <div className={`space-y-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900">
        Generate PDF
      </h3>
      
      {/* GUARDRAIL: Show warning if no version */}
      {!versionId && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            ⚠️ No version available. Calculate the quote first to generate a PDF.
          </p>
        </div>
      )}
      
      <DisplayModeSelector
        value={displayMode}
        onChange={setDisplayMode}
        disabled={!canGenerate}
      />
      
      <PricingVisibilitySelector
        value={pricingVisibility}
        onChange={setPricingVisibility}
        disabled={!canGenerate}
      />
      
      {error && (
        <ErrorInline message={error} />
      )}
      
      <button
        type="button"
        onClick={handleGenerate}
        disabled={!canGenerate}
        className={`
          w-full py-3 px-4 rounded-lg font-medium
          ${canGenerate
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }
        `}
      >
        {isLoading ? (
          <LoadingInline message="Generating PDF..." />
        ) : (
          '📄 Generate PDF'
        )}
      </button>
      
      {state === 'success' && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">
            ✓ PDF generated successfully!
          </p>
        </div>
      )}
    </div>
  );
}
