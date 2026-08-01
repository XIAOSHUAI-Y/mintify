import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteDB } from 'idb';
import type { Ledger, Transaction } from '../types';
import {
  closeDB,
  DB_NAME,
  DEFAULT_APP_SETTINGS,
  getAppSettings,
  saveAppSettings,
} from './index';
import {
  exportData,
  getLedgers,
  getTransactions,
  importData,
  inspectBackup,
  saveLedger,
  saveTransaction,
} from './operations';

describe('Mintify 备份恢复', () => {
  afterEach(async () => {
    await closeDB();
    await deleteDB(DB_NAME);
  });

  it('用版本化备份覆盖恢复全部账本数据和设置', async () => {
    const ledger: Ledger = {
      id: 'daily-ledger',
      name: '日常账本',
      icon: 'book',
      color: '#FACC15',
      isDefault: true,
      sortOrder: 0,
      createdAt: 1,
    };
    const transaction: Transaction = {
      id: 'breakfast',
      ledgerId: ledger.id,
      categoryId: 'food',
      amount: 1800,
      type: 'expense',
      note: '早餐',
      tags: ['早餐'],
      occurredAt: 2,
      createdAt: 2,
    };
    await saveLedger(ledger);
    await saveTransaction(transaction);
    await saveAppSettings({
      ...DEFAULT_APP_SETTINGS,
      reminderEnabled: true,
      reminderTime: '08:30',
      legacySettingsMigrated: true,
    });

    const backup = await exportData();
    expect(JSON.parse(backup)).toMatchObject({ schemaVersion: 2 });
    expect(inspectBackup(backup)).toMatchObject({
      schemaVersion: 2,
      ledgers: 1,
      transactions: 1,
    });

    await saveLedger({
      ...ledger,
      id: 'stale-ledger',
      name: '不应保留的账本',
      isDefault: false,
    });
    await importData(backup, { mode: 'replace' });

    expect(await getLedgers()).toEqual([ledger]);
    expect(await getTransactions(ledger.id)).toEqual([transaction]);
    expect(await getAppSettings()).toMatchObject({
      reminderEnabled: true,
      reminderTime: '08:30',
    });
  });

  it('拒绝损坏的备份并完整保留原数据', async () => {
    const originalLedger: Ledger = {
      id: 'safe-ledger',
      name: '必须保留的账本',
      icon: 'book',
      color: '#FACC15',
      isDefault: true,
      sortOrder: 0,
      createdAt: 1,
    };
    await saveLedger(originalLedger);

    const brokenBackup = JSON.stringify({
      schemaVersion: 2,
      exportedAt: Date.now(),
      appVersion: '1.1.0',
      data: {
        ledgers: [{ ...originalLedger, id: 'new-ledger' }],
        categories: [],
        transactions: [{ note: '缺少主键的损坏记录' }],
        budgets: [],
        recurringRules: [],
        settings: [],
      },
    });

    await expect(importData(brokenBackup, { mode: 'replace' }))
      .rejects.toThrow('备份文件');
    expect(await getLedgers()).toEqual([originalLedger]);
  });
});
