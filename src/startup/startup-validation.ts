/**
 * Startup Validation
 * 
 * Validates all startup requirements before the system can run.
 * 
 * PHASE 5 GUARDRAILS:
 * - FAIL FAST: If anything is wrong, refuse to start
 * - NO DEFAULTS: Do not provide fallback values
 * - NO AUTO-REPAIR: Do not fix broken data
 * - NO SILENT FALLBACKS: Every failure must be loud
 * 
 * If validation fails, the system throws StartupValidationError.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { DataStore } from '../core/calculation';

// ============================================================
// STARTUP ERROR CODES
// ============================================================

export enum StartupErrorCode {
  // Directory errors
  DIR_NOT_FOUND = 'STARTUP_DIR_NOT_FOUND',
  DIR_NOT_WRITABLE = 'STARTUP_DIR_NOT_WRITABLE',
  DIR_CREATION_FAILED = 'STARTUP_DIR_CREATION_FAILED',
  
  // Seed data minimum errors
  NO_CURRENCIES = 'STARTUP_NO_CURRENCIES',
  NO_RESORTS = 'STARTUP_NO_RESORTS',
  NO_ROOM_TYPES = 'STARTUP_NO_ROOM_TYPES',
  NO_SEASONS = 'STARTUP_NO_SEASONS',
  NO_RATES = 'STARTUP_NO_RATES',
  
  // Referential integrity errors
  BROKEN_REFERENCE = 'STARTUP_BROKEN_REF',
  
  // Data validity errors
  INVALID_DATA = 'STARTUP_INVALID_DATA',
  
  // Tax configuration errors
  DUPLICATE_TAX_ORDER = 'STARTUP_DUPLICATE_TAX_ORDER',
  
  // Age band errors
  OVERLAPPING_AGE_BANDS = 'STARTUP_OVERLAPPING_AGE_BANDS',
}

// ============================================================
// STARTUP VALIDATION ERROR
// ============================================================

/**
 * Error thrown when startup validation fails.
 * Contains all validation errors found.
 */
export class StartupValidationError extends Error {
  constructor(
    public readonly code: StartupErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(`[${code}] ${message}`);
    this.name = 'StartupValidationError';
  }
}

/**
 * Aggregates multiple validation errors.
 */
export class StartupValidationErrors extends Error {
  constructor(
    public readonly errors: StartupValidationError[]
  ) {
    const messages = errors.map(e => e.message).join('\n  - ');
    super(`Startup validation failed with ${errors.length} error(s):\n  - ${messages}`);
    this.name = 'StartupValidationErrors';
  }
}

// ============================================================
// DIRECTORY VALIDATION
// ============================================================

/**
 * Validates that a directory exists and is writable.
 * Attempts to create the directory if it doesn't exist.
 * Throws StartupValidationError if validation fails.
 * 
 * NOTE: We DO create directories that don't exist (standard behavior).
 * We DO NOT repair or provide defaults for INVALID data.
 */
export function validateDirectoryWritable(dirPath: string, purpose: string): void {
  // Attempt to create if not exists
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
    } catch (error) {
      throw new StartupValidationError(
        StartupErrorCode.DIR_CREATION_FAILED,
        `Failed to create ${purpose} directory: ${dirPath}`,
        { path: dirPath, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
  
  // Check if it's actually a directory using statSync
  try {
    const stats = fs.statSync(dirPath);
    const isDir = (stats as any).isDirectory ? (stats as any).isDirectory() : false;
    if (!isDir) {
      throw new StartupValidationError(
        StartupErrorCode.DIR_NOT_FOUND,
        `${purpose} path is not a directory: ${dirPath}`,
        { path: dirPath }
      );
    }
  } catch (error) {
    if (error instanceof StartupValidationError) {
      throw error;
    }
    throw new StartupValidationError(
      StartupErrorCode.DIR_NOT_FOUND,
      `Cannot access ${purpose} directory: ${dirPath}`,
      { path: dirPath, error: error instanceof Error ? error.message : String(error) }
    );
  }
  
  // Check writability by attempting to write a test file
  const testFile = path.join(dirPath, `.startup-test-${Date.now()}`);
  try {
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch (error) {
    throw new StartupValidationError(
      StartupErrorCode.DIR_NOT_WRITABLE,
      `${purpose} directory is not writable: ${dirPath}`,
      { path: dirPath, error: error instanceof Error ? error.message : String(error) }
    );
  }
}

// ============================================================
// SEED DATA MINIMUM VALIDATION
// ============================================================

/**
 * Validates that seed data contains minimum required collections.
 * Throws StartupValidationError if any required collection is empty.
 */
export function validateSeedDataMinimums(data: Partial<DataStore>): void {
  const errors: StartupValidationError[] = [];
  
  // P0 CRITICAL: These are required for the system to function
  if (!data.currencies || data.currencies.length === 0) {
    errors.push(new StartupValidationError(
      StartupErrorCode.NO_CURRENCIES,
      'Seed data contains no currencies. At least one currency is required.',
      { collection: 'currencies' }
    ));
  }
  
  if (!data.resorts || data.resorts.length === 0) {
    errors.push(new StartupValidationError(
      StartupErrorCode.NO_RESORTS,
      'Seed data contains no resorts. At least one resort is required.',
      { collection: 'resorts' }
    ));
  }
  
  if (!data.roomTypes || data.roomTypes.length === 0) {
    errors.push(new StartupValidationError(
      StartupErrorCode.NO_ROOM_TYPES,
      'Seed data contains no room types. At least one room type is required.',
      { collection: 'roomTypes' }
    ));
  }
  
  if (!data.seasons || data.seasons.length === 0) {
    errors.push(new StartupValidationError(
      StartupErrorCode.NO_SEASONS,
      'Seed data contains no seasons. At least one season is required.',
      { collection: 'seasons' }
    ));
  }
  
  if (!data.rates || data.rates.length === 0) {
    errors.push(new StartupValidationError(
      StartupErrorCode.NO_RATES,
      'Seed data contains no rates. At least one rate is required.',
      { collection: 'rates' }
    ));
  }
  
  if (errors.length > 0) {
    throw new StartupValidationErrors(errors);
  }
}

// ============================================================
// REFERENTIAL INTEGRITY VALIDATION
// ============================================================

/**
 * Validates referential integrity across seed data collections.
 * Throws StartupValidationErrors if any broken references found.
 */
export function validateReferentialIntegrity(data: Partial<DataStore>): void {
  const errors: StartupValidationError[] = [];
  
  // Build lookup sets
  const resortIds = new Set((data.resorts ?? []).map(r => r.id));
  const roomTypeIds = new Set((data.roomTypes ?? []).map(rt => rt.id));
  const seasonIds = new Set((data.seasons ?? []).map(s => s.id));
  
  // Validate roomTypes → resorts
  for (const roomType of data.roomTypes ?? []) {
    if (!resortIds.has(roomType.resort_id)) {
      errors.push(new StartupValidationError(
        StartupErrorCode.BROKEN_REFERENCE,
        `RoomType "${roomType.id}" references non-existent resort: ${roomType.resort_id}`,
        { entity: 'roomType', id: roomType.id, target: 'resort', targetId: roomType.resort_id }
      ));
    }
  }
  
  // Validate rates → roomTypes and seasons
  for (const rate of data.rates ?? []) {
    if (!roomTypeIds.has(rate.room_type_id)) {
      errors.push(new StartupValidationError(
        StartupErrorCode.BROKEN_REFERENCE,
        `Rate "${rate.id}" references non-existent room type: ${rate.room_type_id}`,
        { entity: 'rate', id: rate.id, target: 'roomType', targetId: rate.room_type_id }
      ));
    }
    
    if (!seasonIds.has(rate.season_id)) {
      errors.push(new StartupValidationError(
        StartupErrorCode.BROKEN_REFERENCE,
        `Rate "${rate.id}" references non-existent season: ${rate.season_id}`,
        { entity: 'rate', id: rate.id, target: 'season', targetId: rate.season_id }
      ));
    }
  }
  
  // Validate taxConfigurations → resorts
  for (const taxConfig of data.taxConfigurations ?? []) {
    if (!resortIds.has(taxConfig.resort_id)) {
      errors.push(new StartupValidationError(
        StartupErrorCode.BROKEN_REFERENCE,
        `TaxConfiguration "${taxConfig.id}" references non-existent resort: ${taxConfig.resort_id}`,
        { entity: 'taxConfiguration', id: taxConfig.id, target: 'resort', targetId: taxConfig.resort_id }
      ));
    }
  }
  
  // Validate markupConfigurations → resorts (resort_id is optional for GLOBAL scope)
  for (const markupConfig of data.markupConfigurations ?? []) {
    if (markupConfig.resort_id && !resortIds.has(markupConfig.resort_id)) {
      errors.push(new StartupValidationError(
        StartupErrorCode.BROKEN_REFERENCE,
        `MarkupConfiguration "${markupConfig.id}" references non-existent resort: ${markupConfig.resort_id}`,
        { entity: 'markupConfiguration', id: markupConfig.id, target: 'resort', targetId: markupConfig.resort_id }
      ));
    }
  }
  
  // Validate mealPlans → resorts
  for (const mealPlan of data.mealPlans ?? []) {
    if (!resortIds.has(mealPlan.resort_id)) {
      errors.push(new StartupValidationError(
        StartupErrorCode.BROKEN_REFERENCE,
        `MealPlan "${mealPlan.id}" references non-existent resort: ${mealPlan.resort_id}`,
        { entity: 'mealPlan', id: mealPlan.id, target: 'resort', targetId: mealPlan.resort_id }
      ));
    }
  }
  
  // Validate transferTypes → resorts
  for (const transferType of data.transferTypes ?? []) {
    if (!resortIds.has(transferType.resort_id)) {
      errors.push(new StartupValidationError(
        StartupErrorCode.BROKEN_REFERENCE,
        `TransferType "${transferType.id}" references non-existent resort: ${transferType.resort_id}`,
        { entity: 'transferType', id: transferType.id, target: 'resort', targetId: transferType.resort_id }
      ));
    }
  }
  
  // Validate activities → resorts
  for (const activity of data.activities ?? []) {
    if (!resortIds.has(activity.resort_id)) {
      errors.push(new StartupValidationError(
        StartupErrorCode.BROKEN_REFERENCE,
        `Activity "${activity.id}" references non-existent resort: ${activity.resort_id}`,
        { entity: 'activity', id: activity.id, target: 'resort', targetId: activity.resort_id }
      ));
    }
  }
  
  if (errors.length > 0) {
    throw new StartupValidationErrors(errors);
  }
}

// ============================================================
// DATA CONSTRAINT VALIDATION
// ============================================================

/**
 * Validates data constraints within seed data.
 * Throws StartupValidationErrors if any invalid data found.
 */
export function validateDataConstraints(data: Partial<DataStore>): void {
  const errors: StartupValidationError[] = [];
  
  // Validate currency codes (must be 3 characters)
  for (const currency of data.currencies ?? []) {
    if (!currency.code || currency.code.length !== 3) {
      errors.push(new StartupValidationError(
        StartupErrorCode.INVALID_DATA,
        `Currency "${currency.code}" has invalid code. Must be 3 characters.`,
        { entity: 'currency', id: currency.code, field: 'code', value: currency.code }
      ));
    }
    
    if (currency.decimal_places === undefined || currency.decimal_places < 0 || currency.decimal_places > 4) {
      errors.push(new StartupValidationError(
        StartupErrorCode.INVALID_DATA,
        `Currency "${currency.code}" has invalid decimal_places. Must be 0-4.`,
        { entity: 'currency', id: currency.code, field: 'decimal_places', value: currency.decimal_places }
      ));
    }
  }
  
  // Validate season date ranges
  for (const season of data.seasons ?? []) {
    // Season has date_ranges array, validate each range
    for (const range of season.date_ranges) {
      if (range.start_date > range.end_date) {
        errors.push(new StartupValidationError(
          StartupErrorCode.INVALID_DATA,
          `Season "${season.id}" has invalid date range: start_date (${range.start_date}) > end_date (${range.end_date})`,
          { entity: 'season', id: season.id, field: 'date_range', start: range.start_date, end: range.end_date }
        ));
      }
    }
  }
  
  // Validate rate amounts (must be > 0)
  for (const rate of data.rates ?? []) {
    if (rate.cost_amount <= 0) {
      errors.push(new StartupValidationError(
        StartupErrorCode.INVALID_DATA,
        `Rate "${rate.id}" has invalid cost_amount: ${rate.cost_amount}. Must be > 0.`,
        { entity: 'rate', id: rate.id, field: 'cost_amount', value: rate.cost_amount }
      ));
    }
  }
  
  // Validate tax calculation_order uniqueness per resort
  const taxOrdersByResort = new Map<string, Set<number>>();
  for (const taxConfig of data.taxConfigurations ?? []) {
    const resortId = taxConfig.resort_id;
    
    if (!taxOrdersByResort.has(resortId)) {
      taxOrdersByResort.set(resortId, new Set());
    }
    
    const orders = taxOrdersByResort.get(resortId)!;
    if (orders.has(taxConfig.calculation_order)) {
      errors.push(new StartupValidationError(
        StartupErrorCode.DUPLICATE_TAX_ORDER,
        `TaxConfiguration "${taxConfig.id}" has duplicate calculation_order ${taxConfig.calculation_order} for resort ${resortId}`,
        { entity: 'taxConfiguration', id: taxConfig.id, resort: resortId, order: taxConfig.calculation_order }
      ));
    }
    orders.add(taxConfig.calculation_order);
  }
  
  // Validate child age band non-overlap per resort
  const ageBandsByResort = new Map<string, Array<{ id: string; min: number; max: number }>>();
  for (const band of data.childAgeBands ?? []) {
    const resortId = band.resort_id;
    
    if (!ageBandsByResort.has(resortId)) {
      ageBandsByResort.set(resortId, []);
    }
    
    const bands = ageBandsByResort.get(resortId)!;
    
    // Check for overlap with existing bands
    for (const existing of bands) {
      const overlaps = !(band.max_age < existing.min || band.min_age > existing.max);
      if (overlaps) {
        errors.push(new StartupValidationError(
          StartupErrorCode.OVERLAPPING_AGE_BANDS,
          `ChildAgeBand "${band.id}" overlaps with "${existing.id}" for resort ${resortId}`,
          { 
            entity: 'childAgeBand', 
            id: band.id, 
            resort: resortId,
            thisRange: `${band.min_age}-${band.max_age}`,
            existingRange: `${existing.min}-${existing.max}`,
          }
        ));
      }
    }
    
    bands.push({ id: band.id, min: band.min_age, max: band.max_age });
  }
  
  if (errors.length > 0) {
    throw new StartupValidationErrors(errors);
  }
}

// ============================================================
// STARTUP VALIDATION ORCHESTRATOR
// ============================================================

/**
 * Options for startup validation.
 */
export interface StartupValidationOptions {
  /** Path to data storage directory */
  dataPath: string;
  
  /** Path to PDF storage directory */
  pdfStoragePath: string;
  
  /** Seed data to validate */
  seedData: Partial<DataStore>;
}

/**
 * Validates all startup requirements.
 * 
 * Order of validation:
 * 1. Directory validation (can we write?)
 * 2. Seed data minimums (do we have required data?)
 * 3. Referential integrity (is the data consistent?)
 * 4. Data constraints (is the data valid?)
 * 
 * If ANY validation fails, throws an error.
 * The system MUST NOT start with invalid configuration.
 */
export function validateStartupRequirements(options: StartupValidationOptions): void {
  // Phase 1: Directory validation
  validateDirectoryWritable(options.dataPath, 'Data');
  validateDirectoryWritable(options.pdfStoragePath, 'PDF storage');
  
  // Phase 2: Seed data minimums
  validateSeedDataMinimums(options.seedData);
  
  // Phase 3: Referential integrity
  validateReferentialIntegrity(options.seedData);
  
  // Phase 4: Data constraints
  validateDataConstraints(options.seedData);
  
  // If we reach here, all validations passed
}
