import { describe, expect, it } from 'vitest';
import type { Budget, ReserveEntry, SavingsPlan, Transaction } from '../types';
import { calculateMonthlyBudgetAvailability, calculateReserveBalances } from './reserveLedger';

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
      budgetAmount: 6000,
      spentAmount: 1200,
      reservedAmount: 500,
      availableAmount: 4300,
    });
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
