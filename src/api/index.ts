/**
 * API Layer - Barrel Export
 * 
 * Thin API handlers that delegate to services.
 */

// Types
export type {
  ApiError,
  ApiResponse,
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
  LegRequest,
  InterResortTransferRequest,
  CalculateQuoteRequest,
  CalculateQuoteResponse,
  ListVersionsResponse,
  GetVersionResponse,
} from './types';

// Handlers
export {
  QuoteApiHandler,
  createQuoteApiHandler,
  ERROR_STATUS_CODES,
  getStatusCode,
} from './handlers';
