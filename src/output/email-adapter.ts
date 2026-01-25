/**
 * Stub Email Adapter
 * 
 * v1 implementation of EmailPort.
 * Logs email sends but does not actually send.
 * Simulates success/failure for testing.
 */

import type { EmailPort } from './types';

/**
 * Email send log entry for debugging/testing.
 */
export interface EmailSendLog {
  timestamp: string;
  to: string;
  subject: string;
  bodyLength: number;
  attachmentCount: number;
  success: boolean;
  error?: string;
}

/**
 * Stub email implementation that logs but doesn't send.
 */
export class StubEmailAdapter implements EmailPort {
  private readonly sendLog: EmailSendLog[] = [];
  private simulateFailure = false;
  private failureReason = 'Simulated failure';

  async send(params: {
    to: string;
    subject: string;
    body: string;
    attachments?: Array<{
      filename: string;
      content: Buffer;
      contentType: string;
    }>;
  }): Promise<{ success: boolean; error?: string }> {
    const logEntry: EmailSendLog = {
      timestamp: new Date().toISOString(),
      to: params.to,
      subject: params.subject,
      bodyLength: params.body.length,
      attachmentCount: params.attachments?.length ?? 0,
      success: !this.simulateFailure,
      error: this.simulateFailure ? this.failureReason : undefined,
    };

    this.sendLog.push(logEntry);

    // Log to console in development
    console.log('[STUB EMAIL]', {
      to: params.to,
      subject: params.subject,
      bodyPreview: params.body.substring(0, 100) + (params.body.length > 100 ? '...' : ''),
      attachments: params.attachments?.map(a => a.filename) ?? [],
      success: logEntry.success,
    });

    if (this.simulateFailure) {
      return { success: false, error: this.failureReason };
    }

    return { success: true };
  }

  /**
   * Get all send logs (for testing).
   */
  getSendLog(): readonly EmailSendLog[] {
    return [...this.sendLog];
  }

  /**
   * Clear send logs (for testing).
   */
  clearSendLog(): void {
    this.sendLog.length = 0;
  }

  /**
   * Configure adapter to simulate failures (for testing).
   */
  setSimulateFailure(shouldFail: boolean, reason?: string): void {
    this.simulateFailure = shouldFail;
    if (reason) {
      this.failureReason = reason;
    }
  }

  /**
   * Get last sent email (for testing).
   */
  getLastSend(): EmailSendLog | undefined {
    return this.sendLog[this.sendLog.length - 1];
  }
}

/**
 * Factory function to create stub email adapter.
 */
export function createStubEmailAdapter(): StubEmailAdapter {
  return new StubEmailAdapter();
}
