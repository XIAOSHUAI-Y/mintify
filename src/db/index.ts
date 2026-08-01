import { openDB, type DBSchema, type IDBPDatabase, type StoreNames } from 'idb';
import type { AppSettings, Budget, Category, Ledger, RecurringRule, Transaction } from '../types';
import { PRESET_TAGS } from '../data/seed';

interface MintifyDB extends DBSchema {
  ledgers: {
    key: string;
    value: Ledger;
  };
  categories: {
    key: string;
    value: Category;
  };
  transactions: {
    key: string;
    value: Transaction;
    indexes: {
      'by-ledger': string;
      'by-occurred': number;
    };
  };
  budgets: {
    key: string;
    value: Budget;
    indexes: {
      'by-ledger': string;
    };
  };
  recurringRules: {
    key: string;
    value: RecurringRule;
    indexes: {
      'by-ledger': string;
    };
  };
  settings: {
    key: string;
    value: AppSettings;
  };
}

export const DB_NAME = 'mintify-db';
export const DB_VERSION = 2;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'app-settings',
  reminderEnabled: false,
  reminderTime: '21:00',
  presetTags: PRESET_TAGS,
  legacySettingsMigrated: false,
  budgetRolloverMonthByLedger: {},
};

let dbPromise: Promise<IDBPDatabase<MintifyDB>> | null = null;

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<MintifyDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // 按旧版本逐级迁移，避免升级时重复创建已有 Store 而导致数据库无法打开。
        if (oldVersion < 1) {
          db.createObjectStore('ledgers', { keyPath: 'id' });
          db.createObjectStore('categories', { keyPath: 'id' });

          const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
          txStore.createIndex('by-ledger', 'ledgerId');
          txStore.createIndex('by-occurred', 'occurredAt');

          const budgetStore = db.createObjectStore('budgets', { keyPath: 'id' });
          budgetStore.createIndex('by-ledger', 'ledgerId');

          const ruleStore = db.createObjectStore('recurringRules', { keyPath: 'id' });
          ruleStore.createIndex('by-ledger', 'ledgerId');
        }

        if (oldVersion < 2) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

export async function closeDB(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  db.close();
  dbPromise = null;
}

// Generic CRUD helpers
export async function getAll<T>(storeName: StoreNames<MintifyDB>): Promise<T[]> {
  const db = await getDB();
  return db.getAll(storeName) as Promise<T[]>;
}

export async function getById<T>(storeName: StoreNames<MintifyDB>, id: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get(storeName, id) as Promise<T | undefined>;
}

export async function putItem<S extends StoreNames<MintifyDB>>(storeName: S, item: MintifyDB[S]['value']): Promise<void> {
  const db = await getDB();
  await db.put(storeName, item);
}

export async function deleteItem(storeName: StoreNames<MintifyDB>, id: string): Promise<void> {
  const db = await getDB();
  await db.delete(storeName, id);
}

export async function clearStore(storeName: StoreNames<MintifyDB>): Promise<void> {
  const db = await getDB();
  await db.clear(storeName);
}

export async function getAppSettings(): Promise<AppSettings> {
  const db = await getDB();
  const settings = await db.get('settings', DEFAULT_APP_SETTINGS.id);
  if (settings) {
    // 旧版设置对象没有预算继承游标，读取时补齐即可，无需升级整个数据库结构。
    return {
      ...DEFAULT_APP_SETTINGS,
      ...settings,
      budgetRolloverMonthByLedger: settings.budgetRolloverMonthByLedger ?? {},
    };
  }

  const defaults = { ...DEFAULT_APP_SETTINGS, presetTags: [...DEFAULT_APP_SETTINGS.presetTags] };
  await db.put('settings', defaults);
  return defaults;
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  const db = await getDB();
  await db.put('settings', settings);
}

export async function migrateLegacySettings(
  storage?: Pick<Storage, 'getItem'>,
): Promise<AppSettings> {
  const settings = await getAppSettings();
  if (settings.legacySettingsMigrated) return settings;

  const source = storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage);
  let presetTags = settings.presetTags;
  const legacyTags = source?.getItem('presetTags');
  if (legacyTags) {
    try {
      const parsed = JSON.parse(legacyTags) as unknown;
      if (Array.isArray(parsed) && parsed.every((tag) => typeof tag === 'string')) {
        presetTags = parsed;
      }
    } catch {
      // 旧数据损坏时保留默认标签，不能让一次迁移阻断整个应用启动。
    }
  }

  const migrated: AppSettings = {
    ...settings,
    reminderEnabled: source?.getItem('reminderEnabled') === 'true',
    reminderTime: source?.getItem('reminderTime') || settings.reminderTime,
    presetTags,
    legacySettingsMigrated: true,
  };
  await saveAppSettings(migrated);
  return migrated;
}

// Specific helpers
export async function getTransactionsByLedger(ledgerId: string): Promise<Transaction[]> {
  const db = await getDB();
  const index = db.transaction('transactions').store.index('by-ledger');
  return index.getAll(ledgerId);
}

export async function getBudgetsByLedger(ledgerId: string): Promise<Budget[]> {
  const db = await getDB();
  const index = db.transaction('budgets').store.index('by-ledger');
  return index.getAll(ledgerId);
}

export async function getRecurringRulesByLedger(ledgerId: string): Promise<RecurringRule[]> {
  const db = await getDB();
  const index = db.transaction('recurringRules').store.index('by-ledger');
  return index.getAll(ledgerId);
}

export async function getCategoriesByLedger(ledgerId: string): Promise<Category[]> {
  const all = await getAll<Category>('categories');
  return all.filter((c) => c.ledgerId === ledgerId).sort((a, b) => a.sortOrder - b.sortOrder);
}
