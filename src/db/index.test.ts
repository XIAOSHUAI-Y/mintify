import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteDB, openDB } from 'idb';
import type { Ledger } from '../types';
import {
  closeDB,
  DB_NAME,
  getAll,
  getAppSettings,
  migrateLegacySettings,
} from './index';

async function createLegacyV1Database(ledger: Ledger): Promise<void> {
  const db = await openDB(DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore('ledgers', { keyPath: 'id' });
      database.createObjectStore('categories', { keyPath: 'id' });

      const transactionStore = database.createObjectStore('transactions', { keyPath: 'id' });
      transactionStore.createIndex('by-ledger', 'ledgerId');
      transactionStore.createIndex('by-occurred', 'occurredAt');

      const budgetStore = database.createObjectStore('budgets', { keyPath: 'id' });
      budgetStore.createIndex('by-ledger', 'ledgerId');

      const recurringRuleStore = database.createObjectStore('recurringRules', { keyPath: 'id' });
      recurringRuleStore.createIndex('by-ledger', 'ledgerId');
    },
  });

  await db.put('ledgers', ledger);
  db.close();
}

describe('Mintify 数据库升级', () => {
  afterEach(async () => {
    await closeDB();
    await deleteDB(DB_NAME);
  });

  it('从 V1 升级后保留已有账本并补齐默认设置', async () => {
    const legacyLedger: Ledger = {
      id: 'legacy-ledger',
      name: '旧账本',
      icon: 'book',
      color: '#FACC15',
      isDefault: true,
      sortOrder: 0,
      createdAt: 1,
    };
    await createLegacyV1Database(legacyLedger);

    const ledgers = await getAll<Ledger>('ledgers');
    const settings = await getAppSettings();

    expect(ledgers).toEqual([legacyLedger]);
    expect(settings).toMatchObject({
      id: 'app-settings',
      reminderEnabled: false,
      reminderTime: '21:00',
    });
  });

  it('把旧版本地设置迁入 IndexedDB', async () => {
    const legacyValues: Record<string, string> = {
      reminderEnabled: 'true',
      reminderTime: '08:30',
      presetTags: JSON.stringify(['通勤', '早餐']),
    };
    const legacyStorage = {
      getItem(key: string) {
        return legacyValues[key] ?? null;
      },
    };

    await migrateLegacySettings(legacyStorage);
    const settings = await getAppSettings();

    expect(settings).toMatchObject({
      reminderEnabled: true,
      reminderTime: '08:30',
      presetTags: ['通勤', '早餐'],
      legacySettingsMigrated: true,
    });
  });
});
