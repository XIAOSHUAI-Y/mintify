import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteDB } from 'idb';
import type { Ledger, Project, Transaction } from '../types';
import { closeDB, DB_NAME } from './index';
import {
  deleteProject,
  exportData,
  getProjects,
  getTransactions,
  importData,
  inspectBackup,
  saveProject,
  saveTransaction,
} from './operations';

describe('项目归集持久化', () => {
  afterEach(async () => {
    await closeDB();
    await deleteDB(DB_NAME);
  });

  it('按账本保存和读取项目', async () => {
    await saveProject(project({ id: 'travel', ledgerId: 'daily-ledger' }));
    await saveProject(project({ id: 'wedding', ledgerId: 'daily-ledger' }));
    await saveProject(project({ id: 'other-ledger', ledgerId: 'fund-ledger' }));

    expect((await getProjects('daily-ledger')).map((item) => item.id).sort())
      .toEqual(['travel', 'wedding']);
  });

  it('删除项目只解绑归集关系，账单本身保留', async () => {
    const travel = project({ id: 'travel', ledgerId: 'daily-ledger' });
    await saveProject(travel);
    await saveTransaction(transaction({ id: 'tagged', projectId: 'travel' }));
    await saveTransaction(transaction({ id: 'untagged' }));

    await deleteProject('travel');

    expect(await getProjects('daily-ledger')).toEqual([]);
    const remaining = await getTransactions('daily-ledger');
    expect(remaining.map((item) => item.id).sort()).toEqual(['tagged', 'untagged']);
    expect(remaining.find((item) => item.id === 'tagged')?.projectId).toBeUndefined();
  });

  it('备份包含项目与归集关系，恢复后原样还原', async () => {
    const travel = project({ id: 'travel', ledgerId: 'daily-ledger' });
    await saveProject(travel);
    await saveTransaction(transaction({ id: 'tagged', projectId: 'travel' }));

    const backup = await exportData();
    expect(inspectBackup(backup)).toMatchObject({ schemaVersion: 8, projects: 1 });

    await deleteProject('travel');
    await importData(backup, { mode: 'replace' });

    expect(await getProjects('daily-ledger')).toEqual([travel]);
    expect((await getTransactions('daily-ledger'))[0].projectId).toBe('travel');
  });

  it('缺少 projects 字段的旧备份仍然可以导入', async () => {
    const legacyBackup = JSON.stringify({
      schemaVersion: 7,
      exportedAt: 1,
      appVersion: '1.6.0',
      data: {
        ledgers: [ledger()],
        categories: [],
        transactions: [],
        budgets: [],
        recurringRules: [],
        fundCategories: [],
        fundTransactions: [],
        savingsPlans: [],
        reserveEntries: [],
        settings: [],
      },
    });

    expect(inspectBackup(legacyBackup).projects).toBe(0);
    await importData(legacyBackup, { mode: 'replace' });

    expect(await getProjects('daily-ledger')).toEqual([]);
  });
});

function ledger(): Ledger {
  return {
    id: 'daily-ledger',
    name: '日常账本',
    icon: 'book',
    color: '#FACC15',
    isDefault: true,
    sortOrder: 0,
    createdAt: 1,
  };
}

function project(overrides: Partial<Project>): Project {
  return {
    id: 'project',
    ledgerId: 'daily-ledger',
    name: '项目',
    icon: 'plane',
    color: '#F59E0B',
    createdAt: 1,
    ...overrides,
  };
}

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'transaction',
    ledgerId: 'daily-ledger',
    categoryId: 'category',
    amount: 100,
    type: 'expense',
    note: '',
    tags: [],
    occurredAt: new Date(2026, 7, 2).getTime(),
    createdAt: 1,
    ...overrides,
  };
}
