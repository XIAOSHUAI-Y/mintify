import { describe, expect, it } from 'vitest';
import type { FundTransaction } from '../types';
import {
  buildFundExpenseBreakdown,
  buildFundMonthlyTrend,
  shouldRemoveLinkedMainIncome,
  summarizeFundMonth,
} from './fundLedger';

describe('资金账本统计', () => {
  it('月度汇总只计算目标月份的实际资金记录', () => {
    const records: FundTransaction[] = [
      makeFundTransaction('工资', 'income', 24777, new Date(2026, 7, 31)),
      makeFundTransaction('车贷', 'expense', 4560, new Date(2026, 7, 20)),
      makeFundTransaction('房租', 'expense', 12000, new Date(2026, 6, 1)),
    ];

    expect(summarizeFundMonth(records, '2026-08')).toEqual({
      income: 24777,
      expense: 4560,
      balance: 20217,
      livingExpenseAllocation: 0,
    });
  });

  it('独立图表按月汇总趋势并按支出类别聚合', () => {
    const records: FundTransaction[] = [
      makeFundTransaction('工资', 'income', 24777, new Date(2026, 7, 31)),
      makeFundTransaction('车贷', 'expense', 4560, new Date(2026, 7, 20)),
      makeFundTransaction('花呗', 'expense', 1200, new Date(2026, 7, 10)),
      makeFundTransaction('工资', 'income', 22456, new Date(2026, 8, 30)),
    ];

    expect(buildFundMonthlyTrend(records, 2026)[7]).toEqual({
      month: '8月',
      income: 24777,
      expense: 5760,
    });
    expect(buildFundExpenseBreakdown(records, '2026-08')).toEqual([
      { category: '车贷', amount: 4560 },
      { category: '花呗', amount: 1200 },
    ]);
  });

  it('只有自动创建的生活费收入会随资金记录一起删除', () => {
    const allocation = {
      ...makeFundTransaction('生活费', 'expense', 4200, new Date(2026, 8, 1)),
      linkedTransactionId: 'main-income',
    };

    expect(shouldRemoveLinkedMainIncome({ ...allocation, mainIncomeOrigin: 'auto-created' })).toBe(true);
    expect(shouldRemoveLinkedMainIncome({ ...allocation, mainIncomeOrigin: 'existing' })).toBe(false);
    expect(shouldRemoveLinkedMainIncome({ ...allocation, kind: 'record' })).toBe(false);
  });
});

function makeFundTransaction(
  category: string,
  type: FundTransaction['type'],
  amount: number,
  occurredAt: Date,
): FundTransaction {
  return {
    id: `${category}-${occurredAt.getTime()}`,
    ledgerId: 'daily-ledger',
    type,
    category,
    kind: category === '生活费' ? 'living-expense-allocation' : 'record',
    amount,
    note: '',
    occurredAt: occurredAt.getTime(),
    createdAt: occurredAt.getTime(),
  };
}
