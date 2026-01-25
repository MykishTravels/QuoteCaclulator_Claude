/**
 * Repository Interfaces
 * 
 * Defines the data access contract for all entities.
 * Implementation can be JSON file-based (v1) or database-backed (future).
 * 
 * Design principles:
 * - Read operations return readonly types
 * - Write operations are explicit (create, update, delete)
 * - All operations are async for future DB compatibility
 */

import type { EntityId, DateString, CurrencyCode } from '../../core/types';
import type {
  Currency,
  Resort,
  ChildAgeBand,
  RoomType,
  Season,
  Rate,
  ExtraPersonCharge,
  MealPlan,
  TransferType,
  Activity,
  TaxConfiguration,
  FestiveSupplement,
  Discount,
  BlackoutDate,
  MinimumStayRule,
  MarkupConfiguration,
  HoneymoonPerk,
  Quote,
  QuoteVersion,
  EmailRecord,
  PDFRecord,
} from '../../core/entities';

import type { Result } from '../../core/types';

// ============================================================
// BASE REPOSITORY INTERFACE
// ============================================================

/**
 * Base repository interface with common operations.
 */
export interface ReadRepository<T> {
  /** Find entity by ID */
  findById(id: EntityId): Promise<T | null>;
  
  /** Get all entities */
  findAll(): Promise<readonly T[]>;
  
  /** Check if entity exists */
  exists(id: EntityId): Promise<boolean>;
}

export interface WriteRepository<T, CreateInput, UpdateInput = Partial<CreateInput>> {
  /** Create a new entity */
  create(input: CreateInput): Promise<Result<T, Error>>;
  
  /** Update an existing entity */
  update(id: EntityId, input: UpdateInput): Promise<Result<T, Error>>;
  
  /** Delete an entity */
  delete(id: EntityId): Promise<Result<void, Error>>;
}

// ============================================================
// REFERENCE DATA REPOSITORIES (Read-only in production)
// ============================================================

/**
 * Currency repository.
 */
export interface CurrencyRepository extends ReadRepository<Currency> {
  findByCode(code: CurrencyCode): Promise<Currency | null>;
  getSupported(): Promise<readonly Currency[]>;
}

/**
 * Resort repository.
 */
export interface ResortRepository extends ReadRepository<Resort> {
  findByDestination(destination: string): Promise<readonly Resort[]>;
  findActive(): Promise<readonly Resort[]>;
}

/**
 * Child age band repository.
 */
export interface ChildAgeBandRepository extends ReadRepository<ChildAgeBand> {
  findByResort(resortId: EntityId): Promise<readonly ChildAgeBand[]>;
  findForAge(resortId: EntityId, age: number): Promise<ChildAgeBand | null>;
}

/**
 * Room type repository.
 */
export interface RoomTypeRepository extends ReadRepository<RoomType> {
  findByResort(resortId: EntityId): Promise<readonly RoomType[]>;
  findActiveByResort(resortId: EntityId): Promise<readonly RoomType[]>;
}

/**
 * Season repository.
 */
export interface SeasonRepository extends ReadRepository<Season> {
  findByResort(resortId: EntityId): Promise<readonly Season[]>;
  findForDate(resortId: EntityId, date: DateString): Promise<Season | null>;
}

/**
 * Rate repository.
 */
export interface RateRepository extends ReadRepository<Rate> {
  findByResort(resortId: EntityId): Promise<readonly Rate[]>;
  findRate(
    resortId: EntityId,
    roomTypeId: EntityId,
    seasonId: EntityId,
    date: DateString
  ): Promise<Rate | null>;
}

/**
 * Extra person charge repository.
 */
export interface ExtraPersonChargeRepository extends ReadRepository<ExtraPersonCharge> {
  findByResort(resortId: EntityId): Promise<readonly ExtraPersonCharge[]>;
  findByRoomType(roomTypeId: EntityId): Promise<readonly ExtraPersonCharge[]>;
}

/**
 * Meal plan repository.
 */
export interface MealPlanRepository extends ReadRepository<MealPlan> {
  findByResort(resortId: EntityId): Promise<readonly MealPlan[]>;
  findDefault(resortId: EntityId): Promise<MealPlan | null>;
}

/**
 * Transfer type repository.
 */
export interface TransferTypeRepository extends ReadRepository<TransferType> {
  findByResort(resortId: EntityId): Promise<readonly TransferType[]>;
  findDefault(resortId: EntityId): Promise<TransferType | null>;
}

/**
 * Activity repository.
 */
export interface ActivityRepository extends ReadRepository<Activity> {
  findByResort(resortId: EntityId): Promise<readonly Activity[]>;
  findActiveByResort(resortId: EntityId): Promise<readonly Activity[]>;
  findAvailableOnDate(resortId: EntityId, date: DateString): Promise<readonly Activity[]>;
}

/**
 * Tax configuration repository.
 */
export interface TaxConfigurationRepository extends ReadRepository<TaxConfiguration> {
  findByResort(resortId: EntityId): Promise<readonly TaxConfiguration[]>;
  findActiveByResort(resortId: EntityId, date: DateString): Promise<readonly TaxConfiguration[]>;
}

/**
 * Festive supplement repository.
 */
export interface FestiveSupplementRepository extends ReadRepository<FestiveSupplement> {
  findByResort(resortId: EntityId): Promise<readonly FestiveSupplement[]>;
  findTriggeredByStay(
    resortId: EntityId,
    checkIn: DateString,
    checkOut: DateString
  ): Promise<readonly FestiveSupplement[]>;
}

/**
 * Discount repository.
 */
export interface DiscountRepository extends ReadRepository<Discount> {
  findByResort(resortId: EntityId): Promise<readonly Discount[]>;
  findByCode(resortId: EntityId, code: string): Promise<Discount | null>;
  findEligible(
    resortId: EntityId,
    nights: number,
    checkIn: DateString,
    bookingDate: DateString
  ): Promise<readonly Discount[]>;
}

/**
 * Blackout date repository.
 */
export interface BlackoutDateRepository extends ReadRepository<BlackoutDate> {
  findByResort(resortId: EntityId): Promise<readonly BlackoutDate[]>;
  findOverlapping(
    resortId: EntityId,
    checkIn: DateString,
    checkOut: DateString
  ): Promise<readonly BlackoutDate[]>;
}

/**
 * Minimum stay rule repository.
 */
export interface MinimumStayRuleRepository extends ReadRepository<MinimumStayRule> {
  findByResort(resortId: EntityId): Promise<readonly MinimumStayRule[]>;
  findApplicable(
    resortId: EntityId,
    roomTypeId: EntityId,
    seasonId: EntityId,
    checkIn: DateString
  ): Promise<readonly MinimumStayRule[]>;
}

/**
 * Markup configuration repository.
 */
export interface MarkupConfigurationRepository extends ReadRepository<MarkupConfiguration> {
  findByResort(resortId: EntityId): Promise<MarkupConfiguration | null>;
  findDefault(): Promise<MarkupConfiguration | null>;
}

/**
 * Honeymoon perk repository.
 */
export interface HoneymoonPerkRepository extends ReadRepository<HoneymoonPerk> {
  findByResort(resortId: EntityId): Promise<readonly HoneymoonPerk[]>;
}

// ============================================================
// QUOTE REPOSITORIES (Read-Write)
// ============================================================

/**
 * Input for creating a quote.
 */
export interface CreateQuoteInput {
  client_name: string;
  client_email?: string;
  client_notes?: string;
  currency_code: CurrencyCode;
  validity_days: number;
}

/**
 * Quote repository.
 */
export interface QuoteRepository 
  extends ReadRepository<Quote>, WriteRepository<Quote, CreateQuoteInput> {
  
  /** Find quotes by status */
  findByStatus(status: string): Promise<readonly Quote[]>;
  
  /** Find quotes by client email */
  findByClientEmail(email: string): Promise<readonly Quote[]>;
  
  /** Update quote status */
  updateStatus(id: EntityId, status: string): Promise<Result<Quote, Error>>;
  
  /** Get next quote sequence number for a year */
  getNextSequence(year: number): Promise<number>;
}

/**
 * Quote version repository.
 */
export interface QuoteVersionRepository extends ReadRepository<QuoteVersion> {
  /** Find all versions for a quote */
  findByQuote(quoteId: EntityId): Promise<readonly QuoteVersion[]>;
  
  /** Find latest version for a quote */
  findLatest(quoteId: EntityId): Promise<QuoteVersion | null>;
  
  /** Get next version number for a quote */
  getNextVersionNumber(quoteId: EntityId): Promise<number>;
  
  /** Create a new version (versions are immutable, no update) */
  create(version: QuoteVersion): Promise<Result<QuoteVersion, Error>>;
}

/**
 * Email record repository.
 */
export interface EmailRecordRepository extends ReadRepository<EmailRecord> {
  findByQuote(quoteId: EntityId): Promise<readonly EmailRecord[]>;
  create(record: EmailRecord): Promise<Result<EmailRecord, Error>>;
}

/**
 * PDF record repository.
 */
export interface PDFRecordRepository extends ReadRepository<PDFRecord> {
  findByQuote(quoteId: EntityId): Promise<readonly PDFRecord[]>;
  findByVersion(versionId: EntityId): Promise<readonly PDFRecord[]>;
  create(record: PDFRecord): Promise<Result<PDFRecord, Error>>;
}

// ============================================================
// UNIT OF WORK PATTERN
// ============================================================

/**
 * Unit of Work for transactional operations.
 * Ensures atomicity across multiple repository operations.
 */
export interface UnitOfWork {
  /** Begin a transaction */
  begin(): Promise<void>;
  
  /** Commit the transaction */
  commit(): Promise<void>;
  
  /** Rollback the transaction */
  rollback(): Promise<void>;
  
  /** Execute a function within a transaction */
  executeInTransaction<T>(fn: () => Promise<T>): Promise<Result<T, Error>>;
}

// ============================================================
// DATA CONTEXT (Aggregate Access)
// ============================================================

/**
 * Data context providing access to all repositories.
 * This is the main entry point for data access.
 */
export interface DataContext {
  // Reference data (read-only)
  readonly currencies: CurrencyRepository;
  readonly resorts: ResortRepository;
  readonly childAgeBands: ChildAgeBandRepository;
  readonly roomTypes: RoomTypeRepository;
  readonly seasons: SeasonRepository;
  readonly rates: RateRepository;
  readonly extraPersonCharges: ExtraPersonChargeRepository;
  readonly mealPlans: MealPlanRepository;
  readonly transferTypes: TransferTypeRepository;
  readonly activities: ActivityRepository;
  readonly taxConfigurations: TaxConfigurationRepository;
  readonly festiveSupplements: FestiveSupplementRepository;
  readonly discounts: DiscountRepository;
  readonly blackoutDates: BlackoutDateRepository;
  readonly minimumStayRules: MinimumStayRuleRepository;
  readonly markupConfigurations: MarkupConfigurationRepository;
  readonly honeymoonPerks: HoneymoonPerkRepository;
  
  // Quote data (read-write)
  readonly quotes: QuoteRepository;
  readonly quoteVersions: QuoteVersionRepository;
  readonly emailRecords: EmailRecordRepository;
  readonly pdfRecords: PDFRecordRepository;
  
  // Unit of work
  readonly unitOfWork: UnitOfWork;
}
