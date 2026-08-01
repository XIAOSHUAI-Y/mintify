import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteDB } from 'idb';
import type { Budget } from '../types';
import { closeDB, DB_NAME } from './index';
import { deleteBudget, ensureMonthlyBudgets, getBudgets, saveBudget } from './operations';

describe('月度预算自动继承', () => {
  afterEach(async () => {
    await closeDB();
    await deleteDB(DB_NAME);
  });

  it('跨月未打开时逐月补齐预算，重复执行不会生成重复记录', async () => {
    const januaryBudgets: Budget[] = [
      {
        id: 'overall-2026-01',
        ledgerId: 'daily-ledger',
        amount: 6000,
        period: 'monthly',
        yearMonth: '2026-01',
        includeOverall: true,
        createdAt: 1,
      },
      {
        id: 'food-2026-01',
        ledgerId: 'daily-ledger',
        categoryId: 'food',
        amount: 1800,
        period: 'monthly',
        yearMonth: '2026-01',
        includeOverall: false,
        createdAt: 1,
      },
    ];

    for (const budget of januaryBudgets) await saveBudget(budget);

    expect(await ensureMonthlyBudgets('daily-ledger', new Date(2026, 2, 1).getTime())).toBe(4);
    expect(await ensureMonthlyBudgets('daily-ledger', new Date(2026, 2, 15).getTime())).toBe(0);

    const budgets = await getBudgets('daily-ledger');
    expect(budgets).toHaveLength(6);
    const byOverallFirst = (left: Budget, right: Budget) => Number(right.includeOverall) - Number(left.includeOverall);
    expect(budgets.filter((budget) => budget.yearMonth === '2026-02').sort(byOverallFirst)).toMatchObject([
      { amount: 6000, includeOverall: true },
      { amount: 1800, categoryId: 'food', includeOverall: false },
    ]);
    expect(budgets.filter((budget) => budget.yearMonth === '2026-03').sort(byOverallFirst)).toMatchObject([
      { amount: 6000, includeOverall: true },
      { amount: 1800, categoryId: 'food', includeOverall: false },
    ]);
  });

  it('当月继承完成后尊重用户删除，不会在下次启动时恢复', async () => {
    await saveBudget({
      id: 'overall-2026-01',
      ledgerId: 'daily-ledger',
      amount: 6000,
      period: 'monthly',
      yearMonth: '2026-01',
      includeOverall: true,
      createdAt: 1,
    });

    await ensureMonthlyBudgets('daily-ledger', new Date(2026, 1, 1).getTime());
    const februaryBudget = (await getBudgets('daily-ledger')).find((budget) => budget.yearMonth === '2026-02');
    expect(februaryBudget).toBeDefined();

    await deleteBudget(februaryBudget!.id);

    expect(await ensureMonthlyBudgets('daily-ledger', new Date(2026, 1, 15).getTime())).toBe(0);
    expect((await getBudgets('daily-ledger')).filter((budget) => budget.yearMonth === '2026-02')).toEqual([]);
  });
});
