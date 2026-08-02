import { describe, expect, it } from 'vitest';
import type { Budget, Transaction } from '../types';
import { buildMonthlyBudgetOverview, calculateBudgetAllocationSummary } from './budgetAnalytics';

describe('月度预算图表数据', () => {
  it('识别超支，并同时给出预算配置与分类支出的环比变化', () => {
    const budgets: Budget[] = [
      budget('overall-jan', '2026-01', 1000, true),
      budget('food-jan', '2026-01', 400, false, 'food'),
      budget('overall-feb', '2026-02', 1200, true),
      budget('food-feb', '2026-02', 500, false, 'food'),
      budget('travel-feb', '2026-02', 200, false, 'travel'),
    ];
    const transactions: Transaction[] = [
      expense('food-jan', 'food', 300, new Date(2026, 0, 10).getTime()),
      expense('transport-jan', 'transport', 100, new Date(2026, 0, 12).getTime()),
      expense('food-feb', 'food', 700, new Date(2026, 1, 10).getTime()),
      expense('travel-feb', 'travel', 600, new Date(2026, 1, 12).getTime()),
    ];

    const february = buildMonthlyBudgetOverview({
      budgets,
      transactions,
      ledgerId: 'daily-ledger',
      year: 2026,
    })[1];

    expect(february).toMatchObject({
      yearMonth: '2026-02',
      budgetAmount: 1200,
      spentAmount: 1300,
      status: 'overspent',
    });
    expect(february.budgetChanges).toEqual([
      { key: 'overall', kind: 'amount_changed', previousAmount: 1000, currentAmount: 1200, delta: 200 },
      { key: 'food', kind: 'amount_changed', previousAmount: 400, currentAmount: 500, delta: 100 },
      { key: 'travel', kind: 'added', previousAmount: 0, currentAmount: 200, delta: 200 },
    ]);
    expect(february.spendingChanges).toEqual([
      { categoryId: 'food', previousAmount: 300, currentAmount: 700, delta: 400 },
      { categoryId: 'travel', previousAmount: 0, currentAmount: 600, delta: 600 },
      { categoryId: 'transport', previousAmount: 100, currentAmount: 0, delta: -100 },
    ]);
  });
});

describe('预算分配结余', () => {
  it('从总预算中扣除分类预算、分类超支和未分配分类支出', () => {
    const budgets: Budget[] = [
      budget('overall-aug', '2026-08', 6000, true),
      budget('food-aug', '2026-08', 500, false, 'food'),
      budget('travel-aug', '2026-08', 500, false, 'travel'),
    ];
    const transactions: Transaction[] = [
      expense('food-aug', 'food', 650, new Date(2026, 7, 10).getTime()),
      expense('travel-aug', 'travel', 400, new Date(2026, 7, 11).getTime()),
      expense('shopping-aug', 'shopping', 200, new Date(2026, 7, 12).getTime()),
    ];

    expect(calculateBudgetAllocationSummary({
      budgets,
      transactions,
      ledgerId: 'daily-ledger',
      yearMonth: '2026-08',
    })).toEqual({
      overallBudgetAmount: 6000,
      allocatedAmount: 1000,
      categoryOverspendAmount: 150,
      unbudgetedSpendingAmount: 200,
      balanceAmount: 4650,
    });
  });

  it('退款按原支出分类释放超支占用', () => {
    const budgets: Budget[] = [
      budget('overall-aug', '2026-08', 1000, true),
      budget('software-aug', '2026-08', 250, false, 'software'),
    ];
    const originalExpense = expense('ai-expense', 'software', 500, new Date(2026, 7, 2).getTime());
    const refund: Transaction = {
      ...expense('ai-refund', 'refund-category', 500, new Date(2026, 7, 5).getTime()),
      type: 'income',
      kind: 'refund',
      linkedExpenseTransactionId: originalExpense.id,
    };

    expect(calculateBudgetAllocationSummary({
      budgets,
      transactions: [refund, originalExpense],
      ledgerId: 'daily-ledger',
      yearMonth: '2026-08',
    })).toMatchObject({
      allocatedAmount: 250,
      categoryOverspendAmount: 0,
      balanceAmount: 750,
    });
  });
});

function budget(
  id: string,
  yearMonth: string,
  amount: number,
  includeOverall: boolean,
  categoryId?: string,
): Budget {
  return {
    id,
    ledgerId: 'daily-ledger',
    categoryId,
    amount,
    period: 'monthly',
    yearMonth,
    includeOverall,
    createdAt: 1,
  };
}

function expense(id: string, categoryId: string, amount: number, occurredAt: number): Transaction {
  return {
    id,
    ledgerId: 'daily-ledger',
    categoryId,
    amount,
    type: 'expense',
    note: '',
    tags: [],
    occurredAt,
    createdAt: occurredAt,
  };
}
