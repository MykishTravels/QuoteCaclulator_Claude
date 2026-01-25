/**
 * Quote API Handlers
 * 
 * Thin handler layer that delegates to services.
 * Framework-agnostic - maps requests to service calls and formats responses.
 * 
 * Constraints:
 * - No business logic (all in services)
 * - No direct repository access
 * - Maps service errors to API errors
 */

import type { EntityId } from '../core/types';
import { QuoteStatus } from '../core/types';

import type {
  QuoteService,
  CalculationService,
  QuoteServiceException,
  CalculationServiceException,
} from '../services';

import type {
  ApiResponse,
  ApiError,
  CreateQuoteRequest,
  CreateQuoteResponse,
  GetQuoteResponse,
  ListQuotesQuery,
  ListQuotesResponse,
  UpdateQuoteRequest,
  UpdateQuoteResponse,
  DeleteQuoteResponse,
  SendQuoteResponse,
  RevertQuoteResponse,
  ConvertQuoteResponse,
  RejectQuoteResponse,
  ExpireQuoteResponse,
  CalculateQuoteRequest,
  CalculateQuoteResponse,
  ListVersionsResponse,
  GetVersionResponse,
} from './types';

// ============================================================
// ERROR MAPPING
// ============================================================

/**
 * HTTP status codes for API errors.
 */
export const ERROR_STATUS_CODES: Record<string, number> = {
  // Quote service errors
  'QUOTE_NOT_FOUND': 404,
  'QUOTE_NOT_EDITABLE': 409,
  'QUOTE_NOT_DELETABLE': 409,
  'INVALID_STATE_TRANSITION': 409,
  'MISSING_VERSION': 409,
  'VERSION_NOT_FOUND': 404,
  'VALIDATION_FAILED': 400,
  'PERSISTENCE_ERROR': 500,
  
  // Calculation service errors (use same mappings where applicable)
  'CALCULATION_FAILED': 422,
  'VERSION_CREATION_FAILED': 500,
  'DATA_LOAD_FAILED': 500,
};

/**
 * Maps service exception to API error.
 */
function mapServiceError(error: QuoteServiceException | CalculationServiceException): ApiError {
  return {
    code: error.code,
    message: error.message,
    details: error.context,
  };
}

/**
 * Gets HTTP status code for an error.
 */
export function getStatusCode(errorCode: string): number {
  return ERROR_STATUS_CODES[errorCode] ?? 500;
}

// ============================================================
// QUOTE HANDLERS
// ============================================================

/**
 * Quote API handler class.
 * Instantiate with services, call handlers with request data.
 */
export class QuoteApiHandler {
  constructor(
    private readonly quoteService: QuoteService,
    private readonly calculationService: CalculationService
  ) {}

  // ============================================================
  // CRUD OPERATIONS
  // ============================================================

  /**
   * POST /quotes
   */
  async createQuote(request: CreateQuoteRequest): Promise<ApiResponse<CreateQuoteResponse>> {
    const result = await this.quoteService.create({
      client_name: request.client_name,
      client_email: request.client_email,
      client_notes: request.client_notes,
      currency_code: request.currency_code,
      validity_days: request.validity_days,
    });

    if (!result.success) {
      return {
        success: false,
        error: mapServiceError(result.error),
      };
    }

    return {
      success: true,
      data: { quote: result.value },
    };
  }

  /**
   * GET /quotes/:id
   */
  async getQuote(quoteId: EntityId): Promise<ApiResponse<GetQuoteResponse>> {
    const result = await this.quoteService.getWithActions(quoteId);

    if (!result.success) {
      return {
        success: false,
        error: mapServiceError(result.error),
      };
    }

    return {
      success: true,
      data: {
        quote: result.value.quote,
        actions: result.value.actions,
        current_version: result.value.current_version,
      },
    };
  }

  /**
   * GET /quotes
   */
  async listQuotes(query?: ListQuotesQuery): Promise<ApiResponse<ListQuotesResponse>> {
    const quotes = await this.quoteService.list({
      status: query?.status,
      client_email: query?.client_email,
    });

    return {
      success: true,
      data: { quotes },
    };
  }

  /**
   * PATCH /quotes/:id
   */
  async updateQuote(
    quoteId: EntityId,
    request: UpdateQuoteRequest
  ): Promise<ApiResponse<UpdateQuoteResponse>> {
    const result = await this.quoteService.update(quoteId, {
      client_name: request.client_name,
      client_email: request.client_email,
      client_notes: request.client_notes,
      validity_days: request.validity_days,
    });

    if (!result.success) {
      return {
        success: false,
        error: mapServiceError(result.error),
      };
    }

    return {
      success: true,
      data: { quote: result.value },
    };
  }

  /**
   * DELETE /quotes/:id
   */
  async deleteQuote(quoteId: EntityId): Promise<ApiResponse<DeleteQuoteResponse>> {
    const result = await this.quoteService.delete(quoteId);

    if (!result.success) {
      return {
        success: false,
        error: mapServiceError(result.error),
      };
    }

    return {
      success: true,
      data: { success: true },
    };
  }

  // ============================================================
  // STATE TRANSITION OPERATIONS
  // ============================================================

  /**
   * POST /quotes/:id/send
   */
  async sendQuote(quoteId: EntityId): Promise<ApiResponse<SendQuoteResponse>> {
    const result = await this.quoteService.send(quoteId);

    if (!result.success) {
      return {
        success: false,
        error: mapServiceError(result.error),
      };
    }

    return {
      success: true,
      data: { quote: result.value },
    };
  }

  /**
   * POST /quotes/:id/revert
   */
  async revertQuote(quoteId: EntityId): Promise<ApiResponse<RevertQuoteResponse>> {
    const result = await this.quoteService.revertToDraft(quoteId);

    if (!result.success) {
      return {
        success: false,
        error: mapServiceError(result.error),
      };
    }

    return {
      success: true,
      data: { quote: result.value },
    };
  }

  /**
   * POST /quotes/:id/convert
   */
  async convertQuote(quoteId: EntityId): Promise<ApiResponse<ConvertQuoteResponse>> {
    const result = await this.quoteService.markConverted(quoteId);

    if (!result.success) {
      return {
        success: false,
        error: mapServiceError(result.error),
      };
    }

    return {
      success: true,
      data: { quote: result.value },
    };
  }

  /**
   * POST /quotes/:id/reject
   */
  async rejectQuote(quoteId: EntityId): Promise<ApiResponse<RejectQuoteResponse>> {
    const result = await this.quoteService.markRejected(quoteId);

    if (!result.success) {
      return {
        success: false,
        error: mapServiceError(result.error),
      };
    }

    return {
      success: true,
      data: { quote: result.value },
    };
  }

  /**
   * POST /quotes/:id/expire
   */
  async expireQuote(quoteId: EntityId): Promise<ApiResponse<ExpireQuoteResponse>> {
    const result = await this.quoteService.markExpired(quoteId);

    if (!result.success) {
      return {
        success: false,
        error: mapServiceError(result.error),
      };
    }

    return {
      success: true,
      data: { quote: result.value },
    };
  }

  // ============================================================
  // CALCULATION OPERATIONS
  // ============================================================

  /**
   * POST /quotes/:id/calculate
   */
  async calculateQuote(
    quoteId: EntityId,
    request: CalculateQuoteRequest
  ): Promise<ApiResponse<CalculateQuoteResponse>> {
    const result = await this.calculationService.calculate({
      quote_id: quoteId,
      legs: request.legs.map(leg => ({
        resort_id: leg.resort_id,
        room_type_id: leg.room_type_id,
        check_in_date: leg.check_in_date,
        check_out_date: leg.check_out_date,
        adults_count: leg.adults_count,
        children: leg.children,
        meal_plan_id: leg.meal_plan_id,
        transfer_type_id: leg.transfer_type_id,
        activity_ids: leg.activity_ids,
        discount_codes: leg.discount_codes,
      })),
      inter_resort_transfers: request.inter_resort_transfers?.map(irt => ({
        transfer_description: irt.transfer_description,
        cost_amount: irt.cost_amount,
        currency_code: irt.currency_code,
        notes: irt.notes,
      })),
      quote_level_markup: request.quote_level_markup,
    });

    if (!result.success) {
      return {
        success: false,
        error: mapServiceError(result.error),
      };
    }

    return {
      success: true,
      data: { version: result.value },
    };
  }

  // ============================================================
  // VERSION OPERATIONS
  // ============================================================

  /**
   * GET /quotes/:id/versions
   */
  async listVersions(quoteId: EntityId): Promise<ApiResponse<ListVersionsResponse>> {
    const result = await this.quoteService.getVersions(quoteId);

    if (!result.success) {
      return {
        success: false,
        error: mapServiceError(result.error),
      };
    }

    return {
      success: true,
      data: { versions: result.value },
    };
  }

  /**
   * GET /quotes/:id/versions/:versionId
   */
  async getVersion(versionId: EntityId): Promise<ApiResponse<GetVersionResponse>> {
    const result = await this.quoteService.getVersion(versionId);

    if (!result.success) {
      return {
        success: false,
        error: mapServiceError(result.error),
      };
    }

    return {
      success: true,
      data: { version: result.value },
    };
  }

  /**
   * GET /quotes/:id/versions/current
   */
  async getCurrentVersion(quoteId: EntityId): Promise<ApiResponse<GetVersionResponse | null>> {
    const result = await this.quoteService.getCurrentVersion(quoteId);

    if (!result.success) {
      return {
        success: false,
        error: mapServiceError(result.error),
      };
    }

    if (!result.value) {
      return {
        success: true,
        data: null,
      };
    }

    return {
      success: true,
      data: { version: result.value },
    };
  }
}

/**
 * Factory function to create QuoteApiHandler.
 */
export function createQuoteApiHandler(
  quoteService: QuoteService,
  calculationService: CalculationService
): QuoteApiHandler {
  return new QuoteApiHandler(quoteService, calculationService);
}
