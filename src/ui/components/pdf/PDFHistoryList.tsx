/**
 * PDFHistoryList Component
 * 
 * Lists generated PDFs for a quote.
 * 
 * GUARDRAIL: READ-ONLY display.
 * - Shows PDFRecord data
 * - Does not modify records
 */

import React, { useEffect } from 'react';
import type { EntityId, PDFRecord } from '../../types';
import { PDFDisplayMode } from '../../types';
import { DateTimeDisplay, LoadingSpinner } from '../common';
import { usePDFGeneration } from '../../state';

export interface PDFHistoryListProps {
  /** Quote ID */
  quoteId: EntityId;
  /** Version ID (optional - filter by version) */
  versionId?: EntityId | null;
  /** Optional CSS class */
  className?: string;
}

/**
 * PDF history list component.
 */
export function PDFHistoryList({
  quoteId,
  versionId = null,
  className = '',
}: PDFHistoryListProps): React.ReactElement {
  const { records, recordsLoading, refreshRecords } = usePDFGeneration(quoteId, versionId);
  
  // Load records on mount
  useEffect(() => {
    refreshRecords();
  }, [refreshRecords]);
  
  if (recordsLoading) {
    return (
      <div className={`py-8 ${className}`}>
        <LoadingSpinner message="Loading PDF history..." />
      </div>
    );
  }
  
  if (records.length === 0) {
    return (
      <div className={`py-8 text-center text-gray-500 ${className}`}>
        <p>No PDFs generated yet.</p>
      </div>
    );
  }
  
  return (
    <div className={`${className}`}>
      <h4 className="text-md font-medium text-gray-900 mb-3">
        Generated PDFs ({records.length})
      </h4>
      <div className="space-y-2">
        {records.map((record) => (
          <PDFHistoryItem key={record.id} record={record} />
        ))}
      </div>
    </div>
  );
}

/**
 * Single PDF history item.
 */
function PDFHistoryItem({
  record,
}: {
  record: PDFRecord;
  key?: string | number;
}): React.ReactElement {
  const displayModeLabel = record.display_mode === PDFDisplayMode.DETAILED
    ? 'Detailed'
    : 'Simplified';
  
  const fileSizeKB = Math.round(record.file_size_bytes / 1024);
  
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center gap-3">
        <span className="text-2xl">📄</span>
        <div>
          <p className="text-sm font-medium text-gray-900">
            {displayModeLabel} PDF
          </p>
          <p className="text-xs text-gray-500">
            <DateTimeDisplay date={record.generated_at} /> • {fileSizeKB} KB
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 px-2 py-1 bg-gray-100 rounded">
          v{record.quote_version_id.split('-').pop()}
        </span>
        <PDFDownloadButton recordId={record.id} />
      </div>
    </div>
  );
}

/**
 * PDF download button.
 */
function PDFDownloadButton({
  recordId,
}: {
  recordId: EntityId;
}): React.ReactElement {
  const handleDownload = () => {
    // TODO: Implement download via API
    console.log('Download PDF:', recordId);
  };
  
  return (
    <button
      type="button"
      onClick={handleDownload}
      className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
    >
      Download
    </button>
  );
}
