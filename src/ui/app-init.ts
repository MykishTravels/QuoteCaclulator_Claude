/**
 * App Initialization
 * 
 * Creates and wires all services for the UI.
 * Call initializeApp() before rendering any UI components.
 * 
 * GUARDRAIL: This is configuration only.
 * - No business logic
 * - No calculations
 * - Just dependency injection
 * 
 * PHASE 5: Startup validation added.
 * - Validates all requirements before starting
 * - Fails fast if anything is wrong
 * - No silent fallbacks
 */

import { setApiClient, createRealApiClient } from './services';
import type { QuoteApiClient } from './services';

// Backend service imports
import { createQuoteService } from '../services/quote-service';
import { createCalculationService } from '../services/calculation-service';
import { createPDFService } from '../output/pdf-service';
import { createEmailService } from '../output/email-service';
import { createLocalFileStorage, createStubEmailAdapter } from '../output';

// Data layer
import { createJsonDataContext } from '../data/repositories/json-repository';
import type { DataContext } from '../data/repositories/interfaces';
import { loadDataStore, type DataStore } from '../core/calculation';

// Startup validation (Phase 5)
import { validateStartupRequirements } from '../startup';

// ============================================================
// INITIALIZATION OPTIONS
// ============================================================

export interface AppInitOptions {
  /** Path to data storage directory */
  dataPath: string;
  
  /** Path to PDF storage directory */
  pdfStoragePath: string;
  
  /** Reference data (loaded from seed file) */
  referenceData: DataStore;
}

// ============================================================
// INITIALIZED APP CONTEXT
// ============================================================

export interface AppContext {
  /** Data context for repositories */
  dataContext: DataContext;
  
  /** API client for UI components */
  apiClient: QuoteApiClient;
  
  /** Reference data store */
  referenceData: DataStore;
}

// Global app context (set during initialization)
let appContext: AppContext | null = null;

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize the application.
 * Must be called before rendering any UI components.
 * 
 * PHASE 5: Validates all startup requirements before proceeding.
 * If validation fails, throws StartupValidationError or StartupValidationErrors.
 * The system will NOT start with invalid configuration.
 * 
 * @throws {StartupValidationError} If a single validation fails
 * @throws {StartupValidationErrors} If multiple validations fail
 */
export function initializeApp(options: AppInitOptions): AppContext {
  // PHASE 5: Validate startup requirements FIRST
  // If this fails, we throw and refuse to start.
  // No fallbacks. No defaults. No silent failures.
  validateStartupRequirements({
    dataPath: options.dataPath,
    pdfStoragePath: options.pdfStoragePath,
    seedData: options.referenceData,
  });
  
  // Create data context
  const dataContext = createJsonDataContext(options.dataPath);
  
  // Create storage and email adapters
  const storage = createLocalFileStorage(options.pdfStoragePath);
  const emailAdapter = createStubEmailAdapter();
  
  // Create backend services
  const quoteService = createQuoteService(dataContext);
  const calculationService = createCalculationService(dataContext, options.referenceData);
  const pdfService = createPDFService(dataContext, storage);
  const emailService = createEmailService(dataContext, emailAdapter, storage);
  
  // Create API client
  const apiClient = createRealApiClient({
    quoteService,
    pdfService,
    emailService,
  });
  
  // Set global API client for UI hooks
  setApiClient(apiClient);
  
  // Store app context
  appContext = {
    dataContext,
    apiClient,
    referenceData: options.referenceData,
  };
  
  return appContext;
}

/**
 * Get the initialized app context.
 * Throws if not initialized.
 */
export function getAppContext(): AppContext {
  if (!appContext) {
    throw new Error('App not initialized. Call initializeApp() first.');
  }
  return appContext;
}

/**
 * Check if app is initialized.
 */
export function isAppInitialized(): boolean {
  return appContext !== null;
}

// ============================================================
// CONVENIENCE: INITIALIZE WITH SEED DATA
// ============================================================

/**
 * Initialize app with seed data from a JSON file.
 * Convenience function for development/testing.
 */
export async function initializeAppWithSeed(
  seedData: Record<string, unknown>,
  dataPath: string = '/tmp/quote-engine-data',
  pdfStoragePath: string = '/tmp/quote-engine-pdfs'
): Promise<AppContext> {
  // Load reference data from seed
  const referenceData = loadDataStore(seedData as any);
  
  return initializeApp({
    dataPath,
    pdfStoragePath,
    referenceData,
  });
}
