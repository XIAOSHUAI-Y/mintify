import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteDB } from 'idb';
import type { Category, FundCategory, FundTransaction, Ledger, Transaction } from '../types';
import {
  closeDB,
  DB_NAME,
  DEFAULT_APP_SETTINGS,
  getAppSettings,
  getCategoriesByLedger,
  saveAppSettings,
} from './index';
import {
  deleteCategory,
  deleteFundCategory,
  exportData,
  ensureFundCategories,
  getFundCategories,
  getFundTransactions,
  getLedgers,
  getTransactions,
  importData,
  inspectBackup,
  saveFundTransaction,
  saveFundCategory,
  saveCategory,
  saveBudgetViewPreference,
  saveLedger,
  saveTransaction,
} from './operations';

describe('预算浏览位置', () => {
  afterEach(async () => {
    await closeDB();
    await deleteDB(DB_NAME);
  });

  it('按账本把年/月视图与所选月份保存到 IndexedDB', async () => {
    await saveBudgetViewPreference('daily-ledger', { mode: 'year', yearMonth: '2025-08' });
    await saveBudgetViewPreference('travel-ledger', { mode: 'month', yearMonth: '2026-01' });

    expect((await getAppSettings()).budgetViewByLedger).toEqual({
      'daily-ledger': { mode: 'year', yearMonth: '2025-08' },
      'travel-ledger': { mode: 'month', yearMonth: '2026-01' },
    });
  });
});

describe('分类删除', () => {
  afterEach(async () => {
    await closeDB();
    await deleteDB(DB_NAME);
  });

  it('删除内置分类后保留历史元数据并标记为停用', async () => {
    const category: Category = {
      id: 'built-in-food',
      ledgerId: 'daily-ledger',
      name: '餐饮',
      icon: 'utensils',
      color: '#F87171',
      type: 'expense',
      sortOrder: 0,
      isBuiltIn: true,
    };
    await saveCategory(category);

    await deleteCategory(category.id);

    expect(await getCategoriesByLedger(category.ledgerId)).toEqual([
      expect.objectContaining({ id: category.id, deletedAt: expect.any(Number) }),
    ]);
  });
});

describe('资金分类', () => {
  afterEach(async () => {
    await closeDB();
    await deleteDB(DB_NAME);
  });

  it('为升级前的已有账本补齐资金收入和支出分类', async () => {
    const ledger: Ledger = {
      id: 'existing-ledger',
      name: '已有账本',
      icon: 'book',
      color: '#FACC15',
      isDefault: true,
      sortOrder: 0,
      createdAt: 1,
    };
    await saveLedger(ledger);

    await ensureFundCategories(ledger.id);

    const categories = await getFundCategories(ledger.id);
    expect(categories.some((item) => item.type === 'income' && item.name === '工资')).toBe(true);
    expect(categories.some((item) => item.type === 'expense' && item.name === '房租')).toBe(true);
  });

  it('删除资金分类后不再初始化同名内置项', async () => {
    await ensureFundCategories('existing-ledger');
    const salary = (await getFundCategories('existing-ledger'))
      .find((item) => item.name === '工资')!;

    await deleteFundCategory(salary.id);
    await ensureFundCategories('existing-ledger');

    const salaryCategories = (await getFundCategories('existing-ledger'))
      .filter((item) => item.name === '工资');
    expect(salaryCategories).toHaveLength(1);
    expect(salaryCategories[0].deletedAt).toEqual(expect.any(Number));
  });

  it('并发初始化时每个资金默认分类也只创建一次', async () => {
    await Promise.all([
      ensureFundCategories('concurrent-ledger'),
      ensureFundCategories('concurrent-ledger'),
    ]);

    const categories = await getFundCategories('concurrent-ledger');
    const keys = categories.map((item) => `${item.type}:${item.name}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('升级时自动停用早期并发产生的重复内置分类', async () => {
    const duplicateBase: FundCategory = {
      id: 'duplicate-rent-1',
      ledgerId: 'duplicate-ledger',
      type: 'expense',
      name: '房租',
      icon: 'home',
      color: '#8B5CF6',
      sortOrder: 0,
      isBuiltIn: true,
    };
    await saveFundCategory(duplicateBase);
    await saveFundCategory({ ...duplicateBase, id: 'duplicate-rent-2' });

    await ensureFundCategories(duplicateBase.ledgerId);

    const activeRentCategories = (await getFundCategories(duplicateBase.ledgerId))
      .filter((item) => item.name === '房租' && !item.deletedAt);
    expect(activeRentCategories).toHaveLength(1);
  });
});

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
      budgetViewByLedger: {
        [ledger.id]: { mode: 'year', yearMonth: '2026-08' },
      },
    });

    const backup = await exportData();
    expect(JSON.parse(backup)).toMatchObject({ schemaVersion: 6 });
    expect(inspectBackup(backup)).toMatchObject({
      schemaVersion: 6,
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
      budgetViewByLedger: {
        [ledger.id]: { mode: 'year', yearMonth: '2026-08' },
      },
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

  it('备份恢复包含独立的资金账本记录', async () => {
    const fundCategory: FundCategory = {
      id: 'fund-rent',
      ledgerId: 'daily-ledger',
      type: 'expense',
      name: '房租',
      icon: 'home',
      color: '#8B5CF6',
      sortOrder: 0,
      isBuiltIn: true,
    };
    const fundTransaction: FundTransaction = {
      id: 'rent-august',
      ledgerId: 'daily-ledger',
      type: 'expense',
      category: '房租',
      kind: 'record',
      amount: 12000,
      note: '第三季度房租',
      occurredAt: new Date(2026, 7, 1).getTime(),
      createdAt: 1,
      categoryId: fundCategory.id,
    };
    await saveFundCategory(fundCategory);
    await saveFundTransaction(fundTransaction);

    const backup = await exportData();
    expect(inspectBackup(backup)).toMatchObject({
      schemaVersion: 6,
      fundCategories: 1,
      fundTransactions: 1,
    });

    await importData(backup, { mode: 'replace' });
    expect(await getFundCategories(fundCategory.ledgerId)).toEqual([fundCategory]);
    expect(await getFundTransactions(fundTransaction.ledgerId)).toEqual([fundTransaction]);
  });
});
