import { describe, expect, it } from 'vitest';
import { buildBudgetReserveTransfer } from './budgetReserveTransfer';

describe('预算转入攒钱', () => {
  it('把所选攒钱计划记录为预算资金的直接去向', () => {
    expect(buildBudgetReserveTransfer({
      id: 'reserve-1',
      ledgerId: 'daily-ledger',
      yearMonth: '2026-08',
      amount: 300,
      destination: { type: 'plan', planId: 'travel', name: '一起去旅行' },
      now: 123,
    })).toEqual({
      id: 'reserve-1',
      ledgerId: 'daily-ledger',
      amount: 300,
      sourceType: 'budget',
      sourceYearMonth: '2026-08',
      targetType: 'plan',
      targetPlanId: 'travel',
      note: '8 月预算转入一起去旅行',
      occurredAt: 123,
      createdAt: 123,
    });
  });

  it('选择通用结余池时不写入不存在的计划编号', () => {
    expect(buildBudgetReserveTransfer({
      id: 'reserve-2',
      ledgerId: 'daily-ledger',
      yearMonth: '2026-08',
      amount: 100,
      destination: { type: 'general', name: '通用结余池' },
      now: 456,
    })).not.toHaveProperty('targetPlanId');
  });
});
