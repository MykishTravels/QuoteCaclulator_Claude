/**
 * PDF Generation Hook
 * 
 * Manages PDF generation state and triggers.
 * 
 * GUARDRAIL: Trigger-only.
 * - Calls API to generate PDF
 * - Does not modify quote or version
 * - PricingVisibility is passed through, not persisted
 */

import { useState, useCallback } from 'react';
import type {
  EntityId,
  PDFRecord,
  PDFGenerationOptions,
  LoadingState,
} from '../types';
import { PDFDisplayMode, PricingVisibility, DEFAULT_PDF_SECTIONS } from '../types';
import { getApiClient } from '../services/api-client';

/**
 * Return type for usePDFGeneration hook.
 */
export interface UsePDFGenerationReturn {
  /** Generation state */
  state: LoadingState;
  
  /** Last generated record */
  lastRecord: PDFRecord | null;
  
  /** Error message if failed */
  error: string | null;
  
  /** Generate PDF with options */
  generate: (options: PDFGenerationOptions) => Promise<PDFRecord | null>;
  
  /** Reset state */
  reset: () => void;
  
  /** PDF records for this quote */
  records: readonly PDFRecord[];
  
  /** Refresh records list */
  refreshRecords: () => Promise<void>;
  
  /** Records loading state */
  recordsLoading: boolean;
}

/**
 * Default PDF generation options.
 */
export const DEFAULT_PDF_OPTIONS: PDFGenerationOptions = {
  display_mode: PDFDisplayMode.DETAILED,
  pricing_visibility: PricingVisibility.SELL_ONLY,
  sections: [...DEFAULT_PDF_SECTIONS],
};

/**
 * Hook for managing PDF generation.
 * 
 * GUARDRAIL: This is a TRIGGER mechanism.
 * - Calls backend to generate PDF
 * - Does not perform any calculations
 * - PricingVisibility is runtime-only (not persisted in PDFRecord)
 */
export function usePDFGeneration(
  quoteId: EntityId | null,
  versionId: EntityId | null
): UsePDFGenerationReturn {
  const [state, setState] = useState<LoadingState>('idle');
  const [lastRecord, setLastRecord] = useState<PDFRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<readonly PDFRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const generate = useCallback(async (
    options: PDFGenerationOptions
  ): Promise<PDFRecord | null> => {
    // GUARDRAIL: Fail fast if no version
    if (!quoteId || !versionId) {
      setError('Cannot generate PDF: No quote version available');
      setState('error');
      return null;
    }

    setState('loading');
    setError(null);

    try {
      const api = getApiClient();
      const record = await api.generatePdf(quoteId, versionId, options);
      
      setLastRecord(record);
      setState('success');
      
      // Refresh records list
      await refreshRecords();
      
      return record;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate PDF';
      setError(message);
      setState('error');
      return null;
    }
  }, [quoteId, versionId]);

  const refreshRecords = useCallback(async () => {
    if (!quoteId) {
      setRecords([]);
      return;
    }

    setRecordsLoading(true);
    try {
      const api = getApiClient();
      const fetchedRecords = await api.getPdfRecords(quoteId);
      setRecords(fetchedRecords);
    } catch (err) {
      console.error('Failed to fetch PDF records:', err);
    } finally {
      setRecordsLoading(false);
    }
  }, [quoteId]);

  const reset = useCallback(() => {
    setState('idle');
    setLastRecord(null);
    setError(null);
  }, []);

  return {
    state,
    lastRecord,
    error,
    generate,
    reset,
    records,
    refreshRecords,
    recordsLoading,
  };
}
