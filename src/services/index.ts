/**
 * Services Layer - Barrel Export
 * 
 * Business logic orchestration layer.
 * Services enforce domain rules and delegate to repositories.
 */

// State Machine
export {
  StateTransitionError,
  QuoteStateError,
  isValidTransition,
  isTerminalState,
  getValidTargetStates,
  validateTransition,
  canSend,
  canEdit,
  canCalculate,
  isModifiable,
  getAvailableActions,
  type TransitionResult,
  type AvailableActions,
} from './state-machine';

// Quote Service
export {
  QuoteServiceError,
  QuoteServiceException,
  QuoteService,
  createQuoteService,
  type CreateQuoteDTO,
  type UpdateQuoteDTO,
  type QuoteWithActions,
  type QuoteListFilter,
} from './quote-service';

// Calculation Service
export {
  CalculationServiceError,
  CalculationServiceException,
  CalculationService,
  createCalculationService,
  type LegInput,
  type InterResortTransferInputDTO,
  type CalculateQuoteRequest,
} from './calculation-service';
