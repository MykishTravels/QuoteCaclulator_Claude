/**
 * Error Module - Barrel Export
 * 
 * Error categorization and metadata for all system errors.
 */

export {
  // Categories
  ErrorCategory,
  
  // Metadata type
  type ErrorMetadata,
  
  // Per-service metadata registries
  CALCULATION_ERROR_METADATA,
  QUOTE_SERVICE_ERROR_METADATA,
  CALCULATION_SERVICE_ERROR_METADATA,
  PDF_SERVICE_ERROR_METADATA,
  EMAIL_SERVICE_ERROR_METADATA,
  STATE_MACHINE_ERROR_METADATA,
  
  // Unified registry
  ERROR_REGISTRY,
  
  // Lookup functions (metadata only)
  getServiceErrorMetadata,
  isServiceErrorRetryable,
  getServiceErrorCategory,
  isServiceErrorUserVisible,
  getServiceErrorResolution,
  
  // Service constants
  ErrorService,
  type ErrorServiceName,
} from './error-categorization';
