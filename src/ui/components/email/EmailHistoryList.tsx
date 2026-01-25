/**
 * EmailHistoryList Component
 * 
 * Lists sent emails for a quote.
 * 
 * GUARDRAIL: READ-ONLY display.
 * - Shows EmailRecord data
 * - Does not modify records
 */

import React, { useEffect, useCallback } from 'react';
import type { EntityId, EmailRecord } from '../../types';
import { EmailStatus } from '../../types';
import { DateTimeDisplay, LoadingSpinner } from '../common';
import { useEmailSend } from '../../state';

export interface EmailHistoryListProps {
  /** Quote ID */
  quoteId: EntityId;
  /** Version ID (for resend) */
  versionId: EntityId | null;
  /** Optional CSS class */
  className?: string;
}

/**
 * Email history list component.
 */
export function EmailHistoryList({
  quoteId,
  versionId,
  className = '',
}: EmailHistoryListProps): React.ReactElement {
  const { records, recordsLoading, refreshRecords, resend, state } = useEmailSend(quoteId, versionId);
  
  // Load records on mount
  useEffect(() => {
    refreshRecords();
  }, [refreshRecords]);
  
  const handleResend = useCallback(async (recordId: EntityId) => {
    await resend(recordId);
  }, [resend]);
  
  if (recordsLoading) {
    return (
      <div className={`py-8 ${className}`}>
        <LoadingSpinner message="Loading email history..." />
      </div>
    );
  }
  
  if (records.length === 0) {
    return (
      <div className={`py-8 text-center text-gray-500 ${className}`}>
        <p>No emails sent yet.</p>
      </div>
    );
  }
  
  return (
    <div className={`${className}`}>
      <h4 className="text-md font-medium text-gray-900 mb-3">
        Email History ({records.length})
      </h4>
      <div className="space-y-2">
        {records.map((record) => (
          <EmailHistoryItem
            key={record.id}
            record={record}
            onResend={handleResend}
            isResending={state === 'loading'}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Single email history item.
 */
function EmailHistoryItem({
  record,
  onResend,
  isResending,
}: {
  record: EmailRecord;
  onResend: (recordId: EntityId) => void | Promise<void>;
  isResending: boolean;
  key?: string | number;
}): React.ReactElement {
  const isSuccess = record.status === EmailStatus.SENT;
  
  return (
    <div
      className={`
        flex items-center justify-between p-3 rounded-lg border
        ${isSuccess
          ? 'bg-green-50 border-green-200'
          : 'bg-red-50 border-red-200'
        }
      `}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">
          {isSuccess ? '✉️' : '⚠️'}
        </span>
        <div>
          <p className="text-sm font-medium text-gray-900">
            {record.recipient_email}
          </p>
          <p className="text-xs text-gray-500">
            <DateTimeDisplay date={record.sent_at} />
            {record.resend_of && (
              <span className="ml-2 text-blue-500">(Resend)</span>
            )}
          </p>
          {!isSuccess && record.failure_reason && (
            <p className="text-xs text-red-600 mt-1">
              {record.failure_reason}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <EmailStatusBadge status={record.status} />
        <button
          type="button"
          onClick={() => onResend(record.id)}
          disabled={isResending}
          className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded disabled:opacity-50"
        >
          Resend
        </button>
      </div>
    </div>
  );
}

/**
 * Email status badge.
 */
function EmailStatusBadge({
  status,
}: {
  status: EmailStatus;
}): React.ReactElement {
  const isSuccess = status === EmailStatus.SENT;
  
  return (
    <span
      className={`
        px-2 py-0.5 text-xs rounded-full font-medium
        ${isSuccess
          ? 'bg-green-100 text-green-700'
          : 'bg-red-100 text-red-700'
        }
      `}
    >
      {isSuccess ? 'Sent' : 'Failed'}
    </span>
  );
}
