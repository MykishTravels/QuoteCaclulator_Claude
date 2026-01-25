/**
 * API Types
 * 
 * Request and response contracts for the Quote API.
 * Framework-agnostic - can be adapted to Express, Fastify, etc.
 */

import type {
  EntityId,
  CurrencyCode,
  MoneyAmount,
  Child,
} from '../core/types';

import { QuoteStatus } from '../core/types';

import type {
  Quote,
  QuoteVersion,
} from '../core/entities';

import type { AvailableActions } from '../services';

// ============================================================
// COMMON TYPES
// ============================================================

/**
 * API error response.
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * API response wrapper.
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

// ============================================================
// QUOTE API
// ============================================================

/**
 * POST /quotes - Create quote request
 */
export interface CreateQuoteRequest {
  client_name: string;
  client_email?: string;
  client_notes?: string;
  currency_code: CurrencyCode;
  validity_days: number;
}

/**
 * POST /quotes - Create quote response
 */
export interface CreateQuoteResponse {
  quote: Quote;
}

/**
 * GET /quotes/:id - Get quote response
 */
export interface GetQuoteResponse {
  quote: Quote;
  actions: AvailableActions;
  current_version: QuoteVersion | null;
}

/**
 * GET /quotes - List quotes query params
 */
export interface ListQuotesQuery {
  status?: QuoteStatus;
  client_email?: string;
}

/**
 * GET /quotes - List quotes response
 */
export interface ListQuotesResponse {
  quotes: readonly Quote[];
}

/**
 * PATCH /quotes/:id - Update quote request
 */
export interface UpdateQuoteRequest {
  client_name?: string;
  client_email?: string;
  client_notes?: string;
  validity_days?: number;
}

/**
 * PATCH /quotes/:id - Update quote response
 */
export interface UpdateQuoteResponse {
  quote: Quote;
}

/**
 * DELETE /quotes/:id - Delete quote response
 */
export interface DeleteQuoteResponse {
  success: boolean;
}

// ============================================================
// QUOTE ACTIONS API
// ============================================================

/**
 * POST /quotes/:id/send - Send quote response
 */
export interface SendQuoteResponse {
  quote: Quote;
}

/**
 * POST /quotes/:id/revert - Revert to draft response
 */
export interface RevertQuoteResponse {
  quote: Quote;
}

/**
 * POST /quotes/:id/convert - Mark converted response
 */
export interface ConvertQuoteResponse {
  quote: Quote;
}

/**
 * POST /quotes/:id/reject - Mark rejected response
 */
export interface RejectQuoteResponse {
  quote: Quote;
}

/**
 * POST /quotes/:id/expire - Mark expired response
 */
export interface ExpireQuoteResponse {
  quote: Quote;
}

// ============================================================
// CALCULATION API
// ============================================================

/**
 * Leg input for calculation request.
 */
export interface LegRequest {
  resort_id: EntityId;
  room_type_id: EntityId;
  check_in_date: string;
  check_out_date: string;
  adults_count: number;
  children: Child[];
  meal_plan_id?: EntityId;
  transfer_type_id?: EntityId;
  activity_ids?: EntityId[];
  discount_codes?: string[];
}

/**
 * Inter-resort transfer input for calculation request.
 */
export interface InterResortTransferRequest {
  transfer_description: string;
  cost_amount: MoneyAmount;
  currency_code: CurrencyCode;
  notes?: string;
}

/**
 * POST /quotes/:id/calculate - Calculate quote request
 */
export interface CalculateQuoteRequest {
  legs: LegRequest[];
  inter_resort_transfers?: InterResortTransferRequest[];
  quote_level_markup?: {
    markup_value: MoneyAmount;
    override_reason?: string;
  };
}

/**
 * POST /quotes/:id/calculate - Calculate quote response
 */
export interface CalculateQuoteResponse {
  version: QuoteVersion;
}

// ============================================================
// VERSIONS API
// ============================================================

/**
 * GET /quotes/:id/versions - List versions response
 */
export interface ListVersionsResponse {
  versions: readonly QuoteVersion[];
}

/**
 * GET /quotes/:id/versions/:versionId - Get version response
 */
export interface GetVersionResponse {
  version: QuoteVersion;
}
