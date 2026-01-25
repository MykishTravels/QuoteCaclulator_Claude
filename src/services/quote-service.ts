/**
 * Quote Service
 * 
 * Handles Quote CRUD operations and state management.
 * 
 * Responsibilities:
 * - Create, read, update, delete quotes
 * - Enforce state machine rules
 * - Manage version references
 * - Orchestrate send workflow
 * 
 * Constraints:
 * - All state transitions go through state machine
 * - Updates only allowed in DRAFT state
 * - Delete only allowed in DRAFT state
 * - Send requires valid version
 */

import type {
  EntityId,
  DateTimeString,
  CurrencyCode,
  Result,
} from '../core/types';

import { success, failure } from '../core/types';
import { QuoteStatus } from '../core/types';

import type {
  Quote,
  QuoteVersion,
} from '../core/entities';

import type { DataContext, CreateQuoteInput } from '../data/repositories/interfaces';

import {
  validateTransition,
  canSend,
  canEdit,
  isModifiable,
  getAvailableActions,
  QuoteStateError,
  StateTransitionError,
  type AvailableActions,
} from './state-machine';

// Logging imports (observability only)
import {
  getLogger,
  generateCorrelationId,
  startTimer,
  Operations,
} from '../core/logging';

// ============================================================
// SERVICE ERRORS
// ============================================================

export enum QuoteServiceError {
  QUOTE_NOT_FOUND = 'QUOTE_NOT_FOUND',
  QUOTE_NOT_EDITABLE = 'QUOTE_NOT_EDITABLE',
  QUOTE_NOT_DELETABLE = 'QUOTE_NOT_DELETABLE',
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  MISSING_VERSION = 'MISSING_VERSION',
  VERSION_NOT_FOUND = 'VERSION_NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  PERSISTENCE_ERROR = 'PERSISTENCE_ERROR',
}

export class QuoteServiceException extends Error {
  constructor(
    public readonly code: QuoteServiceError,
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(`[${code}] ${message}`);
    this.name = 'QuoteServiceException';
  }

  /**
   * Create from state machine error.
   */
  static fromStateError(stateError: QuoteStateError): QuoteServiceException {
    const codeMap: Record<StateTransitionError, QuoteServiceError> = {
      [StateTransitionError.INVALID_TRANSITION]: QuoteServiceError.INVALID_STATE_TRANSITION,
      [StateTransitionError.MISSING_VERSION]: QuoteServiceError.MISSING_VERSION,
      [StateTransitionError.QUOTE_NOT_FOUND]: QuoteServiceError.QUOTE_NOT_FOUND,
      [StateTransitionError.TERMINAL_STATE]: QuoteServiceError.INVALID_STATE_TRANSITION,
    };

    return new QuoteServiceException(
      codeMap[stateError.code] ?? QuoteServiceError.INVALID_STATE_TRANSITION,
      stateError.message,
      stateError.context
    );
  }
}

// ============================================================
// SERVICE DTOs
// ============================================================

/**
 * Input for creating a new quote.
 */
export interface CreateQuoteDTO {
  client_name: string;
  client_email?: string;
  client_notes?: string;
  currency_code: CurrencyCode;
  validity_days: number;
}

/**
 * Input for updating a quote.
 */
export interface UpdateQuoteDTO {
  client_name?: string;
  client_email?: string;
  client_notes?: string;
  validity_days?: number;
}

/**
 * Quote with available actions.
 */
export interface QuoteWithActions {
  quote: Quote;
  actions: AvailableActions;
  current_version: QuoteVersion | null;
}

/**
 * Quote list filter options.
 */
export interface QuoteListFilter {
  status?: QuoteStatus;
  client_email?: string;
}

// ============================================================
// QUOTE SERVICE
// ============================================================

export class QuoteService {
  constructor(private readonly dataContext: DataContext) {}

  // ============================================================
  // CRUD OPERATIONS
  // ============================================================

  /**
   * Create a new quote.
   * Quote starts in DRAFT status with no version.
   */
  async create(dto: CreateQuoteDTO): Promise<Result<Quote, QuoteServiceException>> {
    // Validate input
    const validationErrors = this.validateCreateInput(dto);
    if (validationErrors.length > 0) {
      return failure(new QuoteServiceException(
        QuoteServiceError.VALIDATION_FAILED,
        `Validation failed: ${validationErrors.join(', ')}`,
        { errors: validationErrors }
      ));
    }

    const input: CreateQuoteInput = {
      client_name: dto.client_name,
      client_email: dto.client_email,
      client_notes: dto.client_notes,
      currency_code: dto.currency_code,
      validity_days: dto.validity_days,
    };

    const result = await this.dataContext.quotes.create(input);
    if (!result.success) {
      return failure(new QuoteServiceException(
        QuoteServiceError.PERSISTENCE_ERROR,
        `Failed to create quote: ${result.error.message}`,
        { error: result.error.message }
      ));
    }

    return success(result.value);
  }

  /**
   * Get a quote by ID.
   */
  async getById(id: EntityId): Promise<Result<Quote, QuoteServiceException>> {
    const quote = await this.dataContext.quotes.findById(id);
    if (!quote) {
      return failure(new QuoteServiceException(
        QuoteServiceError.QUOTE_NOT_FOUND,
        `Quote not found: ${id}`,
        { quote_id: id }
      ));
    }
    return success(quote);
  }

  /**
   * Get a quote with available actions and current version.
   */
  async getWithActions(id: EntityId): Promise<Result<QuoteWithActions, QuoteServiceException>> {
    const quoteResult = await this.getById(id);
    if (!quoteResult.success) {
      return quoteResult;
    }

    const quote = quoteResult.value;
    const actions = getAvailableActions(quote);

    let currentVersion: QuoteVersion | null = null;
    if (quote.current_version_id) {
      currentVersion = await this.dataContext.quoteVersions.findById(quote.current_version_id);
    }

    return success({
      quote,
      actions,
      current_version: currentVersion,
    });
  }

  /**
   * List quotes with optional filtering.
   */
  async list(filter?: QuoteListFilter): Promise<readonly Quote[]> {
    if (filter?.status) {
      return this.dataContext.quotes.findByStatus(filter.status);
    }
    if (filter?.client_email) {
      return this.dataContext.quotes.findByClientEmail(filter.client_email);
    }
    return this.dataContext.quotes.findAll();
  }

  /**
   * Update a quote.
   * Only allowed in DRAFT status.
   */
  async update(
    id: EntityId,
    dto: UpdateQuoteDTO
  ): Promise<Result<Quote, QuoteServiceException>> {
    // Get quote
    const quoteResult = await this.getById(id);
    if (!quoteResult.success) {
      return quoteResult;
    }

    const quote = quoteResult.value;

    // Check if editable
    if (!canEdit(quote)) {
      return failure(new QuoteServiceException(
        QuoteServiceError.QUOTE_NOT_EDITABLE,
        `Quote ${id} is in status ${quote.status}; updates only allowed in DRAFT`,
        { quote_id: id, status: quote.status }
      ));
    }

    // Validate input
    const validationErrors = this.validateUpdateInput(dto);
    if (validationErrors.length > 0) {
      return failure(new QuoteServiceException(
        QuoteServiceError.VALIDATION_FAILED,
        `Validation failed: ${validationErrors.join(', ')}`,
        { errors: validationErrors }
      ));
    }

    // Update
    const result = await this.dataContext.quotes.update(id, dto as any);
    if (!result.success) {
      return failure(new QuoteServiceException(
        QuoteServiceError.PERSISTENCE_ERROR,
        `Failed to update quote: ${result.error.message}`,
        { quote_id: id, error: result.error.message }
      ));
    }

    return success(result.value);
  }

  /**
   * Delete a quote.
   * Only allowed in DRAFT status.
   */
  async delete(id: EntityId): Promise<Result<void, QuoteServiceException>> {
    // Get quote
    const quoteResult = await this.getById(id);
    if (!quoteResult.success) {
      return quoteResult;
    }

    const quote = quoteResult.value;

    // Check if deletable (DRAFT only)
    if (!isModifiable(quote)) {
      return failure(new QuoteServiceException(
        QuoteServiceError.QUOTE_NOT_DELETABLE,
        `Quote ${id} is in status ${quote.status}; delete only allowed in DRAFT`,
        { quote_id: id, status: quote.status }
      ));
    }

    // Delete
    const result = await this.dataContext.quotes.delete(id);
    if (!result.success) {
      return failure(new QuoteServiceException(
        QuoteServiceError.PERSISTENCE_ERROR,
        `Failed to delete quote: ${result.error.message}`,
        { quote_id: id, error: result.error.message }
      ));
    }

    return success(undefined);
  }

  // ============================================================
  // STATE TRANSITIONS
  // ============================================================

  /**
   * Transition quote to a new status.
   * Validates transition using state machine.
   */
  async transitionTo(
    id: EntityId,
    targetStatus: QuoteStatus
  ): Promise<Result<Quote, QuoteServiceException>> {
    // LOGGING: Start operation tracking (observability only)
    const correlationId = generateCorrelationId();
    const timer = startTimer();
    const logger = getLogger().child({ correlation_id: correlationId, quote_id: id });
    
    const operationName = this.getTransitionOperationName(targetStatus);
    logger.info({
      correlation_id: correlationId,
      operation: operationName,
      message: `Starting quote transition to ${targetStatus}`,
      quote_id: id,
    });

    // Get quote
    const quoteResult = await this.getById(id);
    if (!quoteResult.success) {
      // LOGGING: Log failure (observability only)
      logger.error({
        correlation_id: correlationId,
        operation: operationName,
        message: 'Quote not found for transition',
        quote_id: id,
        error_code: QuoteServiceError.QUOTE_NOT_FOUND,
        duration_ms: timer.stop(),
      });
      return quoteResult;
    }

    const quote = quoteResult.value;

    // Validate transition
    const transitionResult = validateTransition(quote, targetStatus);
    if (!transitionResult.success) {
      // LOGGING: Log failure (observability only)
      logger.error({
        correlation_id: correlationId,
        operation: operationName,
        message: `Invalid state transition from ${quote.status} to ${targetStatus}`,
        quote_id: id,
        error_code: QuoteServiceError.INVALID_STATE_TRANSITION,
        duration_ms: timer.stop(),
        context: { from_status: quote.status, to_status: targetStatus },
      });
      return failure(QuoteServiceException.fromStateError(transitionResult.error));
    }

    // Apply transition
    const updateResult = await this.dataContext.quotes.updateStatus(id, targetStatus);
    if (!updateResult.success) {
      // LOGGING: Log failure (observability only)
      logger.error({
        correlation_id: correlationId,
        operation: operationName,
        message: 'Failed to persist status change',
        quote_id: id,
        error_code: QuoteServiceError.PERSISTENCE_ERROR,
        duration_ms: timer.stop(),
      });
      return failure(new QuoteServiceException(
        QuoteServiceError.PERSISTENCE_ERROR,
        `Failed to update status: ${updateResult.error.message}`,
        { quote_id: id, target_status: targetStatus }
      ));
    }

    // LOGGING: Log success (observability only)
    logger.info({
      correlation_id: correlationId,
      operation: operationName,
      message: `Quote transitioned from ${quote.status} to ${targetStatus}`,
      quote_id: id,
      duration_ms: timer.stop(),
      context: { from_status: quote.status, to_status: targetStatus },
    });

    return success(updateResult.value);
  }

  /**
   * Get operation name for a target status transition.
   * LOGGING HELPER - does not affect behavior.
   */
  private getTransitionOperationName(targetStatus: QuoteStatus): string {
    switch (targetStatus) {
      case QuoteStatus.SENT: return Operations.QUOTE_SEND;
      case QuoteStatus.DRAFT: return Operations.QUOTE_REVERT;
      case QuoteStatus.CONVERTED: return Operations.QUOTE_CONVERT;
      case QuoteStatus.REJECTED: return Operations.QUOTE_REJECT;
      case QuoteStatus.EXPIRED: return Operations.QUOTE_EXPIRE;
      default: return 'quote.transition';
    }
  }

  /**
   * Send a quote to client.
   * Validates version exists, transitions to SENT.
   */
  async send(id: EntityId): Promise<Result<Quote, QuoteServiceException>> {
    // LOGGING: Start operation tracking (observability only)
    const correlationId = generateCorrelationId();
    const timer = startTimer();
    const logger = getLogger().child({ correlation_id: correlationId, quote_id: id });
    
    logger.info({
      correlation_id: correlationId,
      operation: Operations.QUOTE_SEND,
      message: 'Starting quote send workflow',
      quote_id: id,
    });

    // Get quote
    const quoteResult = await this.getById(id);
    if (!quoteResult.success) {
      // LOGGING: Log failure (observability only)
      logger.error({
        correlation_id: correlationId,
        operation: Operations.QUOTE_SEND,
        message: 'Quote not found for send',
        quote_id: id,
        error_code: QuoteServiceError.QUOTE_NOT_FOUND,
        duration_ms: timer.stop(),
      });
      return quoteResult;
    }

    const quote = quoteResult.value;

    // Check can send (DRAFT + has version)
    if (!canSend(quote)) {
      if (quote.status !== QuoteStatus.DRAFT) {
        // LOGGING: Log failure (observability only)
        logger.error({
          correlation_id: correlationId,
          operation: Operations.QUOTE_SEND,
          message: 'Quote not in DRAFT status',
          quote_id: id,
          error_code: QuoteServiceError.INVALID_STATE_TRANSITION,
          duration_ms: timer.stop(),
          context: { status: quote.status },
        });
        return failure(new QuoteServiceException(
          QuoteServiceError.INVALID_STATE_TRANSITION,
          `Quote ${id} is in status ${quote.status}; send only allowed from DRAFT`,
          { quote_id: id, status: quote.status }
        ));
      }
      // LOGGING: Log failure (observability only)
      logger.error({
        correlation_id: correlationId,
        operation: Operations.QUOTE_SEND,
        message: 'Quote has no calculated version',
        quote_id: id,
        error_code: QuoteServiceError.MISSING_VERSION,
        duration_ms: timer.stop(),
      });
      return failure(new QuoteServiceException(
        QuoteServiceError.MISSING_VERSION,
        `Quote ${id} has no calculated version; calculate before sending`,
        { quote_id: id }
      ));
    }

    // Transition to SENT (logging handled by transitionTo)
    return this.transitionTo(id, QuoteStatus.SENT);
  }

  /**
   * Revert quote to DRAFT for editing.
   * Allowed from SENT, EXPIRED, or REJECTED.
   */
  async revertToDraft(id: EntityId): Promise<Result<Quote, QuoteServiceException>> {
    return this.transitionTo(id, QuoteStatus.DRAFT);
  }

  /**
   * Mark quote as converted (client accepted).
   * Only allowed from SENT status.
   */
  async markConverted(id: EntityId): Promise<Result<Quote, QuoteServiceException>> {
    return this.transitionTo(id, QuoteStatus.CONVERTED);
  }

  /**
   * Mark quote as rejected (client declined).
   * Only allowed from SENT status.
   */
  async markRejected(id: EntityId): Promise<Result<Quote, QuoteServiceException>> {
    return this.transitionTo(id, QuoteStatus.REJECTED);
  }

  /**
   * Mark quote as expired.
   * Only allowed from SENT status.
   */
  async markExpired(id: EntityId): Promise<Result<Quote, QuoteServiceException>> {
    return this.transitionTo(id, QuoteStatus.EXPIRED);
  }

  // ============================================================
  // VERSION OPERATIONS
  // ============================================================

  /**
   * Get all versions for a quote.
   */
  async getVersions(quoteId: EntityId): Promise<Result<readonly QuoteVersion[], QuoteServiceException>> {
    // Verify quote exists
    const quoteResult = await this.getById(quoteId);
    if (!quoteResult.success) {
      return quoteResult;
    }

    const versions = await this.dataContext.quoteVersions.findByQuote(quoteId);
    return success(versions);
  }

  /**
   * Get a specific version.
   */
  async getVersion(versionId: EntityId): Promise<Result<QuoteVersion, QuoteServiceException>> {
    const version = await this.dataContext.quoteVersions.findById(versionId);
    if (!version) {
      return failure(new QuoteServiceException(
        QuoteServiceError.VERSION_NOT_FOUND,
        `Version not found: ${versionId}`,
        { version_id: versionId }
      ));
    }
    return success(version);
  }

  /**
   * Get the current (latest) version for a quote.
   */
  async getCurrentVersion(quoteId: EntityId): Promise<Result<QuoteVersion | null, QuoteServiceException>> {
    // Verify quote exists
    const quoteResult = await this.getById(quoteId);
    if (!quoteResult.success) {
      return quoteResult;
    }

    const quote = quoteResult.value;
    if (!quote.current_version_id) {
      return success(null);
    }

    const version = await this.dataContext.quoteVersions.findById(quote.current_version_id);
    return success(version);
  }

  // ============================================================
  // VALIDATION HELPERS
  // ============================================================

  private validateCreateInput(dto: CreateQuoteDTO): string[] {
    const errors: string[] = [];

    if (!dto.client_name || dto.client_name.trim().length === 0) {
      errors.push('client_name is required');
    }

    if (!dto.currency_code) {
      errors.push('currency_code is required');
    }

    if (dto.validity_days === undefined || dto.validity_days === null) {
      errors.push('validity_days is required');
    } else if (dto.validity_days < 1 || dto.validity_days > 90) {
      errors.push('validity_days must be between 1 and 90');
    }

    if (dto.client_email && !this.isValidEmail(dto.client_email)) {
      errors.push('client_email is not a valid email address');
    }

    return errors;
  }

  private validateUpdateInput(dto: UpdateQuoteDTO): string[] {
    const errors: string[] = [];

    if (dto.client_name !== undefined && dto.client_name.trim().length === 0) {
      errors.push('client_name cannot be empty');
    }

    if (dto.validity_days !== undefined) {
      if (dto.validity_days < 1 || dto.validity_days > 90) {
        errors.push('validity_days must be between 1 and 90');
      }
    }

    if (dto.client_email !== undefined && dto.client_email !== '' && !this.isValidEmail(dto.client_email)) {
      errors.push('client_email is not a valid email address');
    }

    return errors;
  }

  private isValidEmail(email: string): boolean {
    // Simple email validation
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

/**
 * Factory function to create QuoteService.
 */
export function createQuoteService(dataContext: DataContext): QuoteService {
  return new QuoteService(dataContext);
}
