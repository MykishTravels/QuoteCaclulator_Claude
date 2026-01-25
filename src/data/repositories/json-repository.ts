/**
 * JSON File Repository Implementation
 * 
 * File-based storage for v1.
 * All data is loaded into memory on startup.
 * 
 * Reference: BRD v1.2 A-020 - JSON file storage for v1
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import type { EntityId, DateString } from '../../core/types';
import type { Result } from '../../core/types';
import { success, failure } from '../../core/types';

import type {
  ReadRepository,
  DataContext,
  UnitOfWork,
  CurrencyRepository,
  ResortRepository,
  ChildAgeBandRepository,
  RoomTypeRepository,
  SeasonRepository,
  RateRepository,
  ExtraPersonChargeRepository,
  MealPlanRepository,
  TransferTypeRepository,
  ActivityRepository,
  TaxConfigurationRepository,
  FestiveSupplementRepository,
  DiscountRepository,
  BlackoutDateRepository,
  MinimumStayRuleRepository,
  MarkupConfigurationRepository,
  HoneymoonPerkRepository,
  QuoteRepository,
  QuoteVersionRepository,
  EmailRecordRepository,
  PDFRecordRepository,
  CreateQuoteInput,
} from './interfaces';

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

import { QuoteStatus, MarkupScope } from '../../core/types';
import { isDateInSeason, findAgeBandForAge } from '../../core/entities';
import { isWithinRange, isBefore } from '../../core/utils';

// ============================================================
// JSON DATA STORE
// ============================================================

/**
 * In-memory data store loaded from JSON files.
 */
interface JsonDataStore {
  currencies: Currency[];
  resorts: Resort[];
  childAgeBands: ChildAgeBand[];
  roomTypes: RoomType[];
  seasons: Season[];
  rates: Rate[];
  extraPersonCharges: ExtraPersonCharge[];
  mealPlans: MealPlan[];
  transferTypes: TransferType[];
  activities: Activity[];
  taxConfigurations: TaxConfiguration[];
  festiveSupplements: FestiveSupplement[];
  discounts: Discount[];
  blackoutDates: BlackoutDate[];
  minimumStayRules: MinimumStayRule[];
  markupConfigurations: MarkupConfiguration[];
  honeymoonPerks: HoneymoonPerk[];
  quotes: Quote[];
  quoteVersions: QuoteVersion[];
  emailRecords: EmailRecord[];
  pdfRecords: PDFRecord[];
  sequences: {
    quotes: Record<number, number>; // year -> last sequence
  };
}

/**
 * Creates an empty data store.
 */
function createEmptyStore(): JsonDataStore {
  return {
    currencies: [],
    resorts: [],
    childAgeBands: [],
    roomTypes: [],
    seasons: [],
    rates: [],
    extraPersonCharges: [],
    mealPlans: [],
    transferTypes: [],
    activities: [],
    taxConfigurations: [],
    festiveSupplements: [],
    discounts: [],
    blackoutDates: [],
    minimumStayRules: [],
    markupConfigurations: [],
    honeymoonPerks: [],
    quotes: [],
    quoteVersions: [],
    emailRecords: [],
    pdfRecords: [],
    sequences: { quotes: {} },
  };
}

// ============================================================
// BASE JSON REPOSITORY
// ============================================================

/**
 * Base implementation for read operations.
 */
class BaseJsonRepository<T extends { id: EntityId }> implements ReadRepository<T> {
  constructor(protected getData: () => T[]) {}
  
  async findById(id: EntityId): Promise<T | null> {
    return this.getData().find(item => item.id === id) ?? null;
  }
  
  async findAll(): Promise<readonly T[]> {
    return [...this.getData()];
  }
  
  async exists(id: EntityId): Promise<boolean> {
    return this.getData().some(item => item.id === id);
  }
}

// ============================================================
// REFERENCE DATA REPOSITORIES
// ============================================================

/**
 * Standalone currency repository.
 * 
 * NOTE: Currency uses `code` as identifier, not `id`.
 * Therefore it cannot extend BaseJsonRepository<T extends { id: EntityId }>.
 * This is the only reference entity that uses a non-EntityId primary key.
 * 
 * The findById and exists methods are implemented for interface compliance
 * but will always return null/false since Currency has no `id` field.
 * Use findByCode instead.
 */
class JsonCurrencyRepository implements CurrencyRepository {
  constructor(private getData: () => Currency[]) {}
  
  async findById(_id: EntityId): Promise<Currency | null> {
    // Currency doesn't have an id field - use findByCode instead
    // This method exists only for ReadRepository interface compliance
    return null;
  }
  
  async findAll(): Promise<readonly Currency[]> {
    return [...this.getData()];
  }
  
  async exists(_id: EntityId): Promise<boolean> {
    // Currency doesn't have an id field - use findByCode instead
    // This method exists only for ReadRepository interface compliance
    return false;
  }
  
  async findByCode(code: string): Promise<Currency | null> {
    return this.getData().find(c => c.code === code) ?? null;
  }
  
  async getSupported(): Promise<readonly Currency[]> {
    return this.findAll();
  }
}

class JsonResortRepository extends BaseJsonRepository<Resort> implements ResortRepository {
  async findByDestination(destination: string): Promise<readonly Resort[]> {
    return this.getData().filter(r => r.destination === destination);
  }
  
  async findActive(): Promise<readonly Resort[]> {
    return this.getData().filter(r => r.is_active);
  }
}

class JsonChildAgeBandRepository extends BaseJsonRepository<ChildAgeBand> implements ChildAgeBandRepository {
  async findByResort(resortId: EntityId): Promise<readonly ChildAgeBand[]> {
    return this.getData().filter(b => b.resort_id === resortId);
  }
  
  async findForAge(resortId: EntityId, age: number): Promise<ChildAgeBand | null> {
    const bands = this.getData().filter(b => b.resort_id === resortId);
    return findAgeBandForAge(bands, age) ?? null;
  }
}

class JsonRoomTypeRepository extends BaseJsonRepository<RoomType> implements RoomTypeRepository {
  async findByResort(resortId: EntityId): Promise<readonly RoomType[]> {
    return this.getData().filter(r => r.resort_id === resortId);
  }
  
  async findActiveByResort(resortId: EntityId): Promise<readonly RoomType[]> {
    return this.getData().filter(r => r.resort_id === resortId && r.is_active);
  }
}

class JsonSeasonRepository extends BaseJsonRepository<Season> implements SeasonRepository {
  async findByResort(resortId: EntityId): Promise<readonly Season[]> {
    return this.getData().filter(s => s.resort_id === resortId);
  }
  
  async findForDate(resortId: EntityId, date: DateString): Promise<Season | null> {
    const seasons = this.getData().filter(s => s.resort_id === resortId);
    return seasons.find(s => isDateInSeason(s, date)) ?? null;
  }
}

class JsonRateRepository extends BaseJsonRepository<Rate> implements RateRepository {
  async findByResort(resortId: EntityId): Promise<readonly Rate[]> {
    return this.getData().filter(r => r.resort_id === resortId);
  }
  
  async findRate(
    resortId: EntityId,
    roomTypeId: EntityId,
    seasonId: EntityId,
    date: DateString
  ): Promise<Rate | null> {
    return this.getData().find(r =>
      r.resort_id === resortId &&
      r.room_type_id === roomTypeId &&
      r.season_id === seasonId &&
      isWithinRange(date, r.valid_from, r.valid_to)
    ) ?? null;
  }
}

class JsonExtraPersonChargeRepository extends BaseJsonRepository<ExtraPersonCharge> implements ExtraPersonChargeRepository {
  async findByResort(resortId: EntityId): Promise<readonly ExtraPersonCharge[]> {
    return this.getData().filter(e => e.resort_id === resortId);
  }
  
  async findByRoomType(roomTypeId: EntityId): Promise<readonly ExtraPersonCharge[]> {
    return this.getData().filter(e => e.room_type_id === roomTypeId);
  }
}

class JsonMealPlanRepository extends BaseJsonRepository<MealPlan> implements MealPlanRepository {
  async findByResort(resortId: EntityId): Promise<readonly MealPlan[]> {
    return this.getData().filter(m => m.resort_id === resortId);
  }
  
  async findDefault(resortId: EntityId): Promise<MealPlan | null> {
    return this.getData().find(m => m.resort_id === resortId && m.is_default) ?? null;
  }
}

class JsonTransferTypeRepository extends BaseJsonRepository<TransferType> implements TransferTypeRepository {
  async findByResort(resortId: EntityId): Promise<readonly TransferType[]> {
    return this.getData().filter(t => t.resort_id === resortId);
  }
  
  async findDefault(resortId: EntityId): Promise<TransferType | null> {
    return this.getData().find(t => t.resort_id === resortId && t.is_default) ?? null;
  }
}

class JsonActivityRepository extends BaseJsonRepository<Activity> implements ActivityRepository {
  async findByResort(resortId: EntityId): Promise<readonly Activity[]> {
    return this.getData().filter(a => a.resort_id === resortId);
  }
  
  async findActiveByResort(resortId: EntityId): Promise<readonly Activity[]> {
    return this.getData().filter(a => a.resort_id === resortId && a.is_active);
  }
  
  async findAvailableOnDate(resortId: EntityId, date: DateString): Promise<readonly Activity[]> {
    return this.getData().filter(a => {
      if (a.resort_id !== resortId || !a.is_active) return false;
      if (!isWithinRange(date, a.valid_from, a.valid_to)) return false;
      if (!a.is_date_specific) return true;
      return a.available_dates?.some(d => d === date) ?? false;
    });
  }
}

class JsonTaxConfigurationRepository extends BaseJsonRepository<TaxConfiguration> implements TaxConfigurationRepository {
  async findByResort(resortId: EntityId): Promise<readonly TaxConfiguration[]> {
    return this.getData().filter(t => t.resort_id === resortId);
  }
  
  async findActiveByResort(resortId: EntityId, date: DateString): Promise<readonly TaxConfiguration[]> {
    return this.getData()
      .filter(t => t.resort_id === resortId && isWithinRange(date, t.valid_from, t.valid_to))
      .sort((a, b) => a.calculation_order - b.calculation_order);
  }
}

class JsonFestiveSupplementRepository extends BaseJsonRepository<FestiveSupplement> implements FestiveSupplementRepository {
  async findByResort(resortId: EntityId): Promise<readonly FestiveSupplement[]> {
    return this.getData().filter(f => f.resort_id === resortId);
  }
  
  async findTriggeredByStay(
    resortId: EntityId,
    checkIn: DateString,
    checkOut: DateString
  ): Promise<readonly FestiveSupplement[]> {
    return this.getData().filter(f => {
      if (f.resort_id !== resortId) return false;
      return f.trigger_dates.some(d => 
        (d as string) >= (checkIn as string) && (d as string) < (checkOut as string)
      );
    });
  }
}

class JsonDiscountRepository extends BaseJsonRepository<Discount> implements DiscountRepository {
  async findByResort(resortId: EntityId): Promise<readonly Discount[]> {
    return this.getData().filter(d => d.resort_id === resortId);
  }
  
  async findByCode(resortId: EntityId, code: string): Promise<Discount | null> {
    return this.getData().find(d => d.resort_id === resortId && d.code === code) ?? null;
  }
  
  async findEligible(
    resortId: EntityId,
    nights: number,
    checkIn: DateString,
    bookingDate: DateString
  ): Promise<readonly Discount[]> {
    return this.getData().filter(d => {
      if (d.resort_id !== resortId) return false;
      if (!isWithinRange(checkIn, d.valid_from, d.valid_to)) return false;
      if (d.minimum_nights && nights < d.minimum_nights) return false;
      if (d.maximum_nights && nights > d.maximum_nights) return false;
      // Note: booking_window_days check would need more complex date math
      return true;
    });
  }
}

class JsonBlackoutDateRepository extends BaseJsonRepository<BlackoutDate> implements BlackoutDateRepository {
  async findByResort(resortId: EntityId): Promise<readonly BlackoutDate[]> {
    return this.getData().filter(b => b.resort_id === resortId);
  }
  
  async findOverlapping(
    resortId: EntityId,
    checkIn: DateString,
    checkOut: DateString
  ): Promise<readonly BlackoutDate[]> {
    return this.getData().filter(b => {
      if (b.resort_id !== resortId || !b.is_active) return false;
      // Overlap check: blackout.start < checkOut AND blackout.end >= checkIn
      return (
        isBefore(b.start_date, checkOut) && 
        !isBefore(b.end_date, checkIn)
      );
    });
  }
}

class JsonMinimumStayRuleRepository extends BaseJsonRepository<MinimumStayRule> implements MinimumStayRuleRepository {
  async findByResort(resortId: EntityId): Promise<readonly MinimumStayRule[]> {
    return this.getData().filter(m => m.resort_id === resortId);
  }
  
  async findApplicable(
    resortId: EntityId,
    roomTypeId: EntityId,
    seasonId: EntityId,
    checkIn: DateString
  ): Promise<readonly MinimumStayRule[]> {
    return this.getData().filter(m => {
      if (m.resort_id !== resortId) return false;
      if (m.room_type_id !== null && m.room_type_id !== roomTypeId) return false;
      if (m.season_id !== null && m.season_id !== seasonId) return false;
      if (m.valid_from && m.valid_to) {
        if (!isWithinRange(checkIn, m.valid_from, m.valid_to)) return false;
      }
      return true;
    });
  }
}

class JsonMarkupConfigurationRepository extends BaseJsonRepository<MarkupConfiguration> implements MarkupConfigurationRepository {
  async findByResort(resortId: EntityId): Promise<MarkupConfiguration | null> {
    return this.getData().find(m => 
      m.scope === MarkupScope.RESORT && m.resort_id === resortId
    ) ?? null;
  }
  
  async findDefault(): Promise<MarkupConfiguration | null> {
    return this.getData().find(m => m.scope === MarkupScope.QUOTE) ?? null;
  }
}

class JsonHoneymoonPerkRepository extends BaseJsonRepository<HoneymoonPerk> implements HoneymoonPerkRepository {
  async findByResort(resortId: EntityId): Promise<readonly HoneymoonPerk[]> {
    return this.getData().filter(h => h.resort_id === resortId);
  }
}

// ============================================================
// QUOTE REPOSITORIES
// ============================================================

class JsonQuoteRepository extends BaseJsonRepository<Quote> implements QuoteRepository {
  constructor(
    getData: () => Quote[],
    private setData: (data: Quote[]) => void,
    private getSequences: () => Record<number, number>,
    private setSequences: (seq: Record<number, number>) => void
  ) {
    super(getData);
  }
  
  async findByStatus(status: string): Promise<readonly Quote[]> {
    return this.getData().filter(q => q.status === status);
  }
  
  async findByClientEmail(email: string): Promise<readonly Quote[]> {
    return this.getData().filter(q => q.client_email === email);
  }
  
  async create(input: CreateQuoteInput): Promise<Result<Quote, Error>> {
    try {
      const now = new Date().toISOString() as any;
      const year = new Date().getFullYear();
      const sequence = await this.getNextSequence(year);
      
      const id = `QT-${year}-${sequence.toString().padStart(5, '0')}` as EntityId;
      
      const quote: Quote = {
        id,
        client_name: input.client_name,
        client_email: input.client_email,
        client_notes: input.client_notes,
        currency_code: input.currency_code,
        validity_days: input.validity_days,
        status: QuoteStatus.DRAFT,
        current_version_id: null,
        created_at: now,
        updated_at: now,
      };
      
      const data = this.getData();
      data.push(quote);
      this.setData(data);
      
      return success(quote);
    } catch (e) {
      return failure(e instanceof Error ? e : new Error(String(e)));
    }
  }
  
  async update(id: EntityId, input: Partial<CreateQuoteInput>): Promise<Result<Quote, Error>> {
    try {
      const data = this.getData();
      const index = data.findIndex(q => q.id === id);
      if (index === -1) {
        return failure(new Error(`Quote not found: ${id}`));
      }
      
      const now = new Date().toISOString() as any;
      const updated: Quote = {
        ...data[index],
        ...input,
        updated_at: now,
      };
      
      data[index] = updated;
      this.setData(data);
      
      return success(updated);
    } catch (e) {
      return failure(e instanceof Error ? e : new Error(String(e)));
    }
  }
  
  async updateStatus(id: EntityId, status: string): Promise<Result<Quote, Error>> {
    const data = this.getData();
    const index = data.findIndex(q => q.id === id);
    if (index === -1) {
      return failure(new Error(`Quote not found: ${id}`));
    }
    
    const now = new Date().toISOString() as any;
    const updated: Quote = {
      ...data[index],
      status: status as QuoteStatus,
      updated_at: now,
    };
    
    data[index] = updated;
    this.setData(data);
    
    return success(updated);
  }
  
  async delete(id: EntityId): Promise<Result<void, Error>> {
    const data = this.getData();
    const index = data.findIndex(q => q.id === id);
    if (index === -1) {
      return failure(new Error(`Quote not found: ${id}`));
    }
    
    data.splice(index, 1);
    this.setData(data);
    
    return success(undefined);
  }
  
  async getNextSequence(year: number): Promise<number> {
    const sequences = this.getSequences();
    const current = sequences[year] ?? 0;
    const next = current + 1;
    sequences[year] = next;
    this.setSequences(sequences);
    return next;
  }
}

class JsonQuoteVersionRepository extends BaseJsonRepository<QuoteVersion> implements QuoteVersionRepository {
  constructor(
    getData: () => QuoteVersion[],
    private setData: (data: QuoteVersion[]) => void
  ) {
    super(getData);
  }
  
  async findByQuote(quoteId: EntityId): Promise<readonly QuoteVersion[]> {
    return this.getData()
      .filter(v => v.quote_id === quoteId)
      .sort((a, b) => a.version_number - b.version_number);
  }
  
  async findLatest(quoteId: EntityId): Promise<QuoteVersion | null> {
    const versions = await this.findByQuote(quoteId);
    return versions.length > 0 ? versions[versions.length - 1] : null;
  }
  
  async getNextVersionNumber(quoteId: EntityId): Promise<number> {
    const versions = await this.findByQuote(quoteId);
    return versions.length + 1;
  }
  
  async create(version: QuoteVersion): Promise<Result<QuoteVersion, Error>> {
    try {
      const data = this.getData();
      data.push(version);
      this.setData(data);
      return success(version);
    } catch (e) {
      return failure(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

class JsonEmailRecordRepository extends BaseJsonRepository<EmailRecord> implements EmailRecordRepository {
  constructor(
    getData: () => EmailRecord[],
    private setData: (data: EmailRecord[]) => void
  ) {
    super(getData);
  }
  
  async findByQuote(quoteId: EntityId): Promise<readonly EmailRecord[]> {
    return this.getData().filter(e => e.quote_id === quoteId);
  }
  
  async create(record: EmailRecord): Promise<Result<EmailRecord, Error>> {
    try {
      const data = this.getData();
      data.push(record);
      this.setData(data);
      return success(record);
    } catch (e) {
      return failure(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

class JsonPDFRecordRepository extends BaseJsonRepository<PDFRecord> implements PDFRecordRepository {
  constructor(
    getData: () => PDFRecord[],
    private setData: (data: PDFRecord[]) => void
  ) {
    super(getData);
  }
  
  async findByQuote(quoteId: EntityId): Promise<readonly PDFRecord[]> {
    return this.getData().filter(p => p.quote_id === quoteId);
  }
  
  async findByVersion(versionId: EntityId): Promise<readonly PDFRecord[]> {
    return this.getData().filter(p => p.quote_version_id === versionId);
  }
  
  async create(record: PDFRecord): Promise<Result<PDFRecord, Error>> {
    try {
      const data = this.getData();
      data.push(record);
      this.setData(data);
      return success(record);
    } catch (e) {
      return failure(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

// ============================================================
// JSON UNIT OF WORK
// ============================================================

class JsonUnitOfWork implements UnitOfWork {
  private inTransaction = false;
  private snapshotData: string | null = null;
  
  constructor(
    private getData: () => JsonDataStore,
    private setData: (store: JsonDataStore) => void
  ) {}
  
  async begin(): Promise<void> {
    if (this.inTransaction) {
      throw new Error('Transaction already in progress');
    }
    this.snapshotData = JSON.stringify(this.getData());
    this.inTransaction = true;
  }
  
  async commit(): Promise<void> {
    if (!this.inTransaction) {
      throw new Error('No transaction in progress');
    }
    this.snapshotData = null;
    this.inTransaction = false;
  }
  
  async rollback(): Promise<void> {
    if (!this.inTransaction) {
      throw new Error('No transaction in progress');
    }
    if (this.snapshotData) {
      this.setData(JSON.parse(this.snapshotData));
    }
    this.snapshotData = null;
    this.inTransaction = false;
  }
  
  async executeInTransaction<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
    await this.begin();
    try {
      const result = await fn();
      await this.commit();
      return success(result);
    } catch (e) {
      await this.rollback();
      return failure(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

// ============================================================
// JSON DATA CONTEXT FACTORY
// ============================================================

/**
 * Creates a JSON-based data context.
 */
export function createJsonDataContext(dataDir: string): DataContext {
  let store = createEmptyStore();
  
  const getStore = () => store;
  const setStore = (s: JsonDataStore) => { store = s; };
  
  return {
    currencies: new JsonCurrencyRepository(() => store.currencies),
    resorts: new JsonResortRepository(() => store.resorts),
    childAgeBands: new JsonChildAgeBandRepository(() => store.childAgeBands),
    roomTypes: new JsonRoomTypeRepository(() => store.roomTypes),
    seasons: new JsonSeasonRepository(() => store.seasons),
    rates: new JsonRateRepository(() => store.rates),
    extraPersonCharges: new JsonExtraPersonChargeRepository(() => store.extraPersonCharges),
    mealPlans: new JsonMealPlanRepository(() => store.mealPlans),
    transferTypes: new JsonTransferTypeRepository(() => store.transferTypes),
    activities: new JsonActivityRepository(() => store.activities),
    taxConfigurations: new JsonTaxConfigurationRepository(() => store.taxConfigurations),
    festiveSupplements: new JsonFestiveSupplementRepository(() => store.festiveSupplements),
    discounts: new JsonDiscountRepository(() => store.discounts),
    blackoutDates: new JsonBlackoutDateRepository(() => store.blackoutDates),
    minimumStayRules: new JsonMinimumStayRuleRepository(() => store.minimumStayRules),
    markupConfigurations: new JsonMarkupConfigurationRepository(() => store.markupConfigurations),
    honeymoonPerks: new JsonHoneymoonPerkRepository(() => store.honeymoonPerks),
    quotes: new JsonQuoteRepository(
      () => store.quotes,
      (data) => { store.quotes = data; },
      () => store.sequences.quotes,
      (seq) => { store.sequences.quotes = seq; }
    ),
    quoteVersions: new JsonQuoteVersionRepository(
      () => store.quoteVersions,
      (data) => { store.quoteVersions = data; }
    ),
    emailRecords: new JsonEmailRecordRepository(
      () => store.emailRecords,
      (data) => { store.emailRecords = data; }
    ),
    pdfRecords: new JsonPDFRecordRepository(
      () => store.pdfRecords,
      (data) => { store.pdfRecords = data; }
    ),
    unitOfWork: new JsonUnitOfWork(getStore, setStore),
  };
}

/**
 * Loads seed data into the data context.
 */
export async function loadSeedData(
  dataDir: string,
  context: DataContext
): Promise<void> {
  // Implementation would load JSON files from dataDir
  // For now, this is a placeholder
  console.log(`Loading seed data from ${dataDir}`);
}
