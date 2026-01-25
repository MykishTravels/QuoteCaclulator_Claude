/**
 * EmailSendPanel Component
 * 
 * Main email sending UI.
 * 
 * GUARDRAIL: Trigger-only.
 * - Calls API to send email
 * - Does NOT trigger state transitions
 * - Quote status remains unchanged
 */

import React, { useState, useCallback } from 'react';
import type { EntityId, EmailGenerationOptions, Quote } from '../../types';
import { PDFDisplayMode, PricingVisibility, DEFAULT_PDF_SECTIONS } from '../../types';
import { DisplayModeSelector } from '../pdf/DisplayModeSelector';
import { PricingVisibilitySelector } from '../pdf/PricingVisibilitySelector';
import { LoadingInline, ErrorInline } from '../common';
import { useEmailSend } from '../../state';

export interface EmailSendPanelProps {
  /** Quote data (for default recipient) */
  quote: Quote;
  /** Version ID */
  versionId: EntityId | null;
  /** Optional CSS class */
  className?: string;
  /** Callback when email is sent */
  onSent?: () => void;
}

/**
 * Email send panel component.
 * 
 * GUARDRAIL: Sending email does NOT change quote status.
 * Status transitions are explicit API actions.
 */
export function EmailSendPanel({
  quote,
  versionId,
  className = '',
  onSent,
}: EmailSendPanelProps): React.ReactElement {
  // Form state
  const [recipientEmail, setRecipientEmail] = useState<string>(quote.client_email ?? '');
  const [attachPdf, setAttachPdf] = useState<boolean>(true);
  const [displayMode, setDisplayMode] = useState<PDFDisplayMode>(PDFDisplayMode.DETAILED);
  const [pricingVisibility, setPricingVisibility] = useState<PricingVisibility>(
    PricingVisibility.SELL_ONLY
  );
  
  // Send hook
  const { state, error, send } = useEmailSend(quote.id, versionId);
  
  const handleSend = useCallback(async () => {
    if (!recipientEmail.trim()) {
      return;
    }
    
    const options: EmailGenerationOptions = {
      recipient_email: recipientEmail.trim(),
      attach_pdf: attachPdf,
      pdf_options: attachPdf
        ? {
            display_mode: displayMode,
            pricing_visibility: pricingVisibility,
            sections: [...DEFAULT_PDF_SECTIONS],
          }
        : undefined,
    };
    
    const record = await send(options);
    if (record && onSent) {
      onSent();
    }
  }, [recipientEmail, attachPdf, displayMode, pricingVisibility, send, onSent]);
  
  const isLoading = state === 'loading';
  const canSend = versionId !== null && recipientEmail.trim() !== '' && !isLoading;
  
  return (
    <div className={`space-y-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900">
        Send Email
      </h3>
      
      {/* GUARDRAIL: Explicit warning that email does NOT change status */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-800">
          ℹ️ Sending an email does not change the quote status.
          Use the status actions to transition the quote.
        </p>
      </div>
      
      {/* GUARDRAIL: Show warning if no version */}
      {!versionId && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            ⚠️ No version available. Calculate the quote first to send an email.
          </p>
        </div>
      )}
      
      {/* Recipient Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Recipient Email
        </label>
        <input
          type="email"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          placeholder="client@example.com"
          disabled={!versionId || isLoading}
          className={`
            w-full px-4 py-2 border rounded-lg
            ${!versionId ? 'bg-gray-100' : 'bg-white'}
            focus:outline-none focus:ring-2 focus:ring-blue-500
          `}
        />
      </div>
      
      {/* Attach PDF Toggle */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={attachPdf}
            onChange={(e) => setAttachPdf(e.target.checked)}
            disabled={!versionId || isLoading}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium text-gray-700">
            Attach PDF to email
          </span>
        </label>
      </div>
      
      {/* PDF Options (when attaching) */}
      {attachPdf && (
        <div className="pl-6 border-l-2 border-gray-200 space-y-4">
          <p className="text-sm text-gray-500">PDF Attachment Options</p>
          
          <DisplayModeSelector
            value={displayMode}
            onChange={setDisplayMode}
            disabled={!versionId || isLoading}
          />
          
          <PricingVisibilitySelector
            value={pricingVisibility}
            onChange={setPricingVisibility}
            disabled={!versionId || isLoading}
          />
        </div>
      )}
      
      {error && (
        <ErrorInline message={error} />
      )}
      
      <button
        type="button"
        onClick={handleSend}
        disabled={!canSend}
        className={`
          w-full py-3 px-4 rounded-lg font-medium
          ${canSend
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }
        `}
      >
        {isLoading ? (
          <LoadingInline message="Sending..." />
        ) : (
          '✉️ Send Email'
        )}
      </button>
      
      {state === 'success' && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">
            ✓ Email sent successfully!
          </p>
        </div>
      )}
    </div>
  );
}
