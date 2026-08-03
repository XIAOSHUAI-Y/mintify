import { describe, expect, it } from 'vitest';
import type { Budget, ReserveEntry, SavingsPlan, Transaction } from '../types';
import {
  calculateMonthlyBudgetAvailability,
  calculateMonthlyPeriodSettlement,
  calculateMonthlyReserveDestinations,
  calculateReserveBalances,
  getSavingsAllocationProgress,
  getSavingsPlanProgress,
} from './reserveLedger';

describe('结余池流水', () => {
  const plans: SavingsPlan[] = [
    {
      id: 'travel',
      ledgerId: 'daily-ledger',
      name: '一起去旅行',
      targetAmount: 5000,
      icon: 'plane',
      color: '#F59E0B',
      createdAt: 1,
    },
  ];

  it('内部划转只改变资金分布，不重复增加总结余', () => {
    const entries: ReserveEntry[] = [
      entry('month-saving', 1000, 'budget', 'general'),
      entry('general-to-travel', 600, 'general', 'plan', 'travel'),
      entry('direct-to-travel', 200, 'budget', 'plan', 'travel'),
    ];

    const result = calculateReserveBalances(plans, entries);
    expect(result.general).toBe(400);
    expect(result.plans.get('travel')).toBe(800);
    expect(result.total).toBe(1200);
  });

  it('按当前去向展示某个月预算转入的攒钱金额', () => {
    const entries: ReserveEntry[] = [
      entry('august-saving', 1200, 'budget', 'general'),
      {
        ...entry('general-to-travel', 800, 'general', 'plan', 'travel'),
        occurredAt: 2,
        createdAt: 2,
      },
    ];

    expect(calculateMonthlyReserveDestinations(entries, 'daily-ledger', '2026-08')).toEqual([
      { targetType: 'general', amount: 400 },
      { targetType: 'plan', targetPlanId: 'travel', amount: 800 },
    ]);
  });

  it('通用结余池不展示没有目标含义的预算占比进度', () => {
    expect(getSavingsAllocationProgress('general', 400, 6000)).toBeNull();
    expect(getSavingsAllocationProgress('plan', 400, 6000)).toBeCloseTo(6.6667, 4);
  });

  it('攒钱计划同时给出完成度和剩余目标金额', () => {
    expect(getSavingsPlanProgress(800, 5000)).toEqual({
      percentage: 16,
      remainingAmount: 4200,
      completed: false,
    });
  });

  it('跨月划转按先进先出保留预算来源月份', () => {
    const entries: ReserveEntry[] = [
      entry('august-saving', 1200, 'budget', 'general'),
      {
        ...entry('september-saving', 500, 'budget', 'general'),
        sourceYearMonth: '2026-09',
        occurredAt: 2,
        createdAt: 2,
      },
      {
        ...entry('general-to-travel', 1400, 'general', 'plan', 'travel'),
        occurredAt: 3,
        createdAt: 3,
      },
    ];

    expect(calculateMonthlyReserveDestinations(entries, 'daily-ledger', '2026-08')).toEqual([
      { targetType: 'plan', targetPlanId: 'travel', amount: 1200 },
    ]);
    expect(calculateMonthlyReserveDestinations(entries, 'daily-ledger', '2026-09')).toEqual([
      { targetType: 'general', amount: 300 },
      { targetType: 'plan', targetPlanId: 'travel', amount: 200 },
    ]);
  });

  it('预算可用额同时扣除实际支出和已存金额', () => {
    const budgets: Budget[] = [{
      id: 'overall',
      ledgerId: 'daily-ledger',
      amount: 6000,
      period: 'monthly',
      yearMonth: '2026-08',
      includeOverall: true,
      createdAt: 1,
    }];
    const transactions: Transaction[] = [{
      id: 'food',
      ledgerId: 'daily-ledger',
      categoryId: 'food',
      amount: 1200,
      type: 'expense',
      note: '',
      tags: [],
      occurredAt: new Date(2026, 7, 2).getTime(),
      createdAt: 1,
    }];
    const reserveEntries = [entry('saving', 500, 'budget', 'general')];

    expect(calculateMonthlyBudgetAvailability({
      budgets,
      transactions,
      reserveEntries,
      ledgerId: 'daily-ledger',
      yearMonth: '2026-08',
    })).toEqual({
      baseBudgetAmount: 6000,
      supplementAmount: 0,
      budgetAmount: 6000,
      spentAmount: 1200,
      reservedAmount: 500,
      availableAmount: 4300,
    });
  });

  it('计划划回预算后减少总结余并增加目标月份可用预算', () => {
    const budgets: Budget[] = [{
      id: 'overall',
      ledgerId: 'daily-ledger',
      amount: 1000,
      period: 'monthly',
      yearMonth: '2026-08',
      includeOverall: true,
      createdAt: 1,
    }];
    const entries: ReserveEntry[] = [
      entry('saving', 800, 'budget', 'plan', 'travel'),
      {
        ...entry('withdrawal', 300, 'plan', 'budget', 'travel'),
        targetYearMonth: '2026-08',
        occurredAt: 2,
        createdAt: 2,
      },
    ];

    expect(calculateReserveBalances(plans, entries)).toEqual({
      general: 0,
      plans: new Map([['travel', 500]]),
      total: 500,
    });
    expect(calculateMonthlyReserveDestinations(entries, 'daily-ledger', '2026-08')).toEqual([
      { targetType: 'plan', targetPlanId: 'travel', amount: 500 },
    ]);
    expect(calculateMonthlyBudgetAvailability({
      budgets,
      transactions: [],
      reserveEntries: entries,
      ledgerId: 'daily-ledger',
      yearMonth: '2026-08',
    })).toEqual({
      baseBudgetAmount: 1000,
      supplementAmount: 300,
      budgetAmount: 1300,
      spentAmount: 0,
      reservedAmount: 800,
      availableAmount: 500,
    });
  });

  it('只允许转入总预算扣除分类预算后的未分配金额', () => {
    const budgets: Budget[] = [
      {
        id: 'overall',
        ledgerId: 'daily-ledger',
        amount: 6000,
        period: 'monthly',
        yearMonth: '2026-08',
        includeOverall: true,
        createdAt: 1,
      },
      {
        id: 'food-budget',
        ledgerId: 'daily-ledger',
        categoryId: 'food',
        amount: 2000,
        period: 'monthly',
        yearMonth: '2026-08',
        includeOverall: false,
        createdAt: 1,
      },
    ];
    const transactions: Transaction[] = [{
      id: 'food',
      ledgerId: 'daily-ledger',
      categoryId: 'food',
      amount: 200,
      type: 'expense',
      note: '',
      tags: [],
      occurredAt: new Date(2026, 7, 2).getTime(),
      createdAt: 1,
    }];

    expect(calculateMonthlyBudgetAvailability({
      budgets,
      transactions,
      reserveEntries: [entry('saving', 500, 'budget', 'general')],
      ledgerId: 'daily-ledger',
      yearMonth: '2026-08',
    })).toEqual({
      baseBudgetAmount: 6000,
      supplementAmount: 0,
      budgetAmount: 6000,
      spentAmount: 200,
      reservedAmount: 500,
      availableAmount: 3500,
    });

    expect(calculateMonthlyPeriodSettlement({
      budgets,
      transactions,
      reserveEntries: [entry('saving', 500, 'budget', 'general')],
      ledgerId: 'daily-ledger',
      yearMonth: '2026-08',
    }).availableAmount).toBe(5300);
  });
});

function entry(
  id: string,
  amount: number,
  sourceType: ReserveEntry['sourceType'],
  targetType: ReserveEntry['targetType'],
  planId?: string,
): ReserveEntry {
  return {
    id,
    ledgerId: 'daily-ledger',
    amount,
    sourceType,
    sourcePlanId: sourceType === 'plan' ? planId : undefined,
    targetType,
    targetPlanId: targetType === 'plan' ? planId : undefined,
    sourceYearMonth: sourceType === 'budget' ? '2026-08' : undefined,
    note: '',
    occurredAt: 1,
    createdAt: 1,
  };
}
