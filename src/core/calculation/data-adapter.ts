/**
 * In-Memory Data Adapter
 * 
 * Implements CalculationDataAccess for testing and JSON-based storage.
 */

import type { EntityId, DateString } from '../types';
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
  MarkupConfiguration,
} from '../entities';

import { isDateInSeason } from '../entities';
import { isWithinRange } from '../utils';
import type { CalculationDataAccess } from './types';

/**
 * Data store for reference data.
 */
export interface DataStore {
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
  markupConfigurations: MarkupConfiguration[];
}

/**
 * Create a CalculationDataAccess implementation from a DataStore.
 */
export function createDataAccess(store: DataStore): CalculationDataAccess {
  return {
    getResort(id: EntityId): Resort | null {
      return store.resorts.find(r => r.id === id) ?? null;
    },
    
    getRoomType(id: EntityId): RoomType | null {
      return store.roomTypes.find(r => r.id === id) ?? null;
    },
    
    getChildAgeBands(resortId: EntityId): readonly ChildAgeBand[] {
      return store.childAgeBands.filter(b => b.resort_id === resortId);
    },
    
    getSeasonForDate(resortId: EntityId, date: DateString): Season | null {
      const seasons = store.seasons.filter(s => s.resort_id === resortId);
      return seasons.find(s => isDateInSeason(s, date)) ?? null;
    },
    
    getRate(resortId: EntityId, roomTypeId: EntityId, seasonId: EntityId, date: DateString): Rate | null {
      return store.rates.find(r =>
        r.resort_id === resortId &&
        r.room_type_id === roomTypeId &&
        r.season_id === seasonId &&
        isWithinRange(date, r.valid_from, r.valid_to)
      ) ?? null;
    },
    
    getExtraPersonCharges(resortId: EntityId, roomTypeId: EntityId): readonly ExtraPersonCharge[] {
      return store.extraPersonCharges.filter(e =>
        e.resort_id === resortId &&
        e.room_type_id === roomTypeId
      );
    },
    
    getMealPlan(id: EntityId): MealPlan | null {
      return store.mealPlans.find(m => m.id === id) ?? null;
    },
    
    getDefaultMealPlan(resortId: EntityId): MealPlan | null {
      return store.mealPlans.find(m => m.resort_id === resortId && m.is_default) ?? null;
    },
    
    getTransferType(id: EntityId): TransferType | null {
      return store.transferTypes.find(t => t.id === id) ?? null;
    },
    
    getDefaultTransferType(resortId: EntityId): TransferType | null {
      return store.transferTypes.find(t => t.resort_id === resortId && t.is_default) ?? null;
    },
    
    getActivity(id: EntityId): Activity | null {
      return store.activities.find(a => a.id === id) ?? null;
    },
    
    getTaxConfigurations(resortId: EntityId, date: DateString): readonly TaxConfiguration[] {
      return store.taxConfigurations
        .filter(t =>
          t.resort_id === resortId &&
          isWithinRange(date, t.valid_from, t.valid_to)
        )
        .sort((a, b) => a.calculation_order - b.calculation_order);
    },
    
    getFestiveSupplements(resortId: EntityId, checkIn: DateString, checkOut: DateString): readonly FestiveSupplement[] {
      return store.festiveSupplements.filter(f => {
        if (f.resort_id !== resortId) return false;
        // Check if any trigger date falls within the stay
        return f.trigger_dates.some(d =>
          (d as string) >= (checkIn as string) && (d as string) < (checkOut as string)
        );
      });
    },
    
    getDiscountByCode(resortId: EntityId, code: string): Discount | null {
      return store.discounts.find(d =>
        d.resort_id === resortId && d.code === code
      ) ?? null;
    },
    
    getMarkupConfiguration(resortId: EntityId): MarkupConfiguration | null {
      return store.markupConfigurations.find(m =>
        m.resort_id === resortId
      ) ?? null;
    },
  };
}

/**
 * Load data store from JSON objects.
 */
export function loadDataStore(data: Partial<DataStore>): DataStore {
  return {
    currencies: data.currencies ?? [],
    resorts: data.resorts ?? [],
    childAgeBands: data.childAgeBands ?? [],
    roomTypes: data.roomTypes ?? [],
    seasons: data.seasons ?? [],
    rates: data.rates ?? [],
    extraPersonCharges: data.extraPersonCharges ?? [],
    mealPlans: data.mealPlans ?? [],
    transferTypes: data.transferTypes ?? [],
    activities: data.activities ?? [],
    taxConfigurations: data.taxConfigurations ?? [],
    festiveSupplements: data.festiveSupplements ?? [],
    discounts: data.discounts ?? [],
    markupConfigurations: data.markupConfigurations ?? [],
  };
}
