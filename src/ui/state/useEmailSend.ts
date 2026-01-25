/**
 * Email Send Hook
 * 
 * Manages email sending state and triggers.
 * 
 * GUARDRAIL: Trigger-only.
 * - Calls API to send email
 * - Does NOT trigger state transitions
 * - Quote status remains unchanged after email send
 */

import { useState, useCallback } from 'react';
import type {
  EntityId,
  EmailRecord,
  EmailGenerationOptions,
  LoadingState,
} from '../types';
import { getApiClient } from '../services/api-client';

/**
 * Return type for useEmailSend hook.
 */
export interface UseEmailSendReturn {
  /** Send state */
  state: LoadingState;
  
  /** Last sent record */
  lastRecord: EmailRecord | null;
  
  /** Error message if failed */
  error: string | null;
  
  /** Send email with options */
  send: (options: EmailGenerationOptions) => Promise<EmailRecord | null>;
  
  /** Resend a previous email */
  resend: (recordId: EntityId, recipientOverride?: string) => Promise<EmailRecord | null>;
  
  /** Reset state */
  reset: () => void;
  
  /** Email records for this quote */
  records: readonly EmailRecord[];
  
  /** Refresh records list */
  refreshRecords: () => Promise<void>;
  
  /** Records loading state */
  recordsLoading: boolean;
}

/**
 * Hook for managing email sending.
 * 
 * GUARDRAIL: This is a TRIGGER mechanism.
 * - Calls backend to send email
 * - Does NOT change quote status
 * - Status transitions are explicit API actions
 */
export function useEmailSend(
  quoteId: EntityId | null,
  versionId: EntityId | null
): UseEmailSendReturn {
  const [state, setState] = useState<LoadingState>('idle');
  const [lastRecord, setLastRecord] = useState<EmailRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<readonly EmailRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const send = useCallback(async (
    options: EmailGenerationOptions
  ): Promise<EmailRecord | null> => {
    // GUARDRAIL: Fail fast if no version
    if (!quoteId || !versionId) {
      setError('Cannot send email: No quote version available');
      setState('error');
      return null;
    }

    setState('loading');
    setError(null);

    try {
      const api = getApiClient();
      
      // GUARDRAIL: This API call does NOT trigger state transition
      // Quote status remains unchanged
      const record = await api.sendEmail(quoteId, versionId, options);
      
      setLastRecord(record);
      setState('success');
      
      // Refresh records list
      await refreshRecords();
      
      return record;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send email';
      setError(message);
      setState('error');
      return null;
    }
  }, [quoteId, versionId]);

  const resend = useCallback(async (
    recordId: EntityId,
    recipientOverride?: string
  ): Promise<EmailRecord | null> => {
    setState('loading');
    setError(null);

    try {
      const api = getApiClient();
      const record = await api.resendEmail(recordId, recipientOverride);
      
      setLastRecord(record);
      setState('success');
      
      // Refresh records list
      await refreshRecords();
      
      return record;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resend email';
      setError(message);
      setState('error');
      return null;
    }
  }, []);

  const refreshRecords = useCallback(async () => {
    if (!quoteId) {
      setRecords([]);
      return;
    }

    setRecordsLoading(true);
    try {
      const api = getApiClient();
      const fetchedRecords = await api.getEmailRecords(quoteId);
      setRecords(fetchedRecords);
    } catch (err) {
      console.error('Failed to fetch email records:', err);
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
    send,
    resend,
    reset,
    records,
    refreshRecords,
    recordsLoading,
  };
}
