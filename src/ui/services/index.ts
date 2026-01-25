/**
 * UI Services - Barrel Export
 */

export {
  type QuoteApiClient,
  createMockApiClient,
  setApiClient,
  getApiClient,
} from './api-client';

export {
  RealApiClient,
  createRealApiClient,
  type RealApiClientDependencies,
} from './real-api-client';
