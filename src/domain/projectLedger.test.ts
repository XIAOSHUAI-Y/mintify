import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import {
  buildProjectCategoryBreakdown,
  getProjectTransactions,
  summarizeProject,
} from './projectLedger';

describe('项目归集口径', () => {
  it('只归集指定项目的流水，并按时间倒序', () => {
    const early = transaction({
      id: 'early',
      projectId: 'travel',
      occurredAt: new Date(2026, 6, 1).getTime(),
    });
    const late = transaction({
      id: 'late',
      projectId: 'travel',
      occurredAt: new Date(2026, 7, 1).getTime(),
    });
    const otherProject = transaction({ id: 'other-project', projectId: 'wedding' });
    const noProject = transaction({ id: 'no-project' });

    expect(getProjectTransactions([early, otherProject, late, noProject], 'travel').map((item) => item.id))
      .toEqual(['late', 'early']);
  });

  it('项目总账区分普通收入与退款冲减', () => {
    const expense = transaction({ id: 'hotel', projectId: 'travel', amount: 2000 });
    const refund = transaction({
      id: 'hotel-refund',
      projectId: 'travel',
      type: 'income',
      amount: 500,
      kind: 'refund',
      linkedExpenseTransactionId: expense.id,
    });
    const subsidy = transaction({ id: 'subsidy', projectId: 'travel', type: 'income', amount: 300 });

    expect(summarizeProject([expense, refund, subsidy], 'travel')).toEqual({
      count: 3,
      income: 300,
      grossExpense: 2000,
      refunds: 500,
      netExpense: 1500,
      balance: -1200,
    });
  });

  it('没有流水的项目返回零汇总', () => {
    expect(summarizeProject([transaction({ id: 'other', projectId: 'wedding' })], 'travel')).toEqual({
      count: 0,
      income: 0,
      grossExpense: 0,
      refunds: 0,
      netExpense: 0,
      balance: 0,
    });
  });

  it('分类构成按净支出统计，退款冲减原支出分类', () => {
    const hotel = transaction({ id: 'hotel', projectId: 'travel', categoryId: 'stay', amount: 2000 });
    const ticket = transaction({ id: 'ticket', projectId: 'travel', categoryId: 'traffic', amount: 800 });
    const refund = transaction({
      id: 'hotel-refund',
      projectId: 'travel',
      categoryId: 'refund',
      type: 'income',
      amount: 500,
      kind: 'refund',
      linkedExpenseTransactionId: hotel.id,
    });

    expect(buildProjectCategoryBreakdown([hotel, ticket, refund], 'travel')).toEqual([
      { categoryId: 'stay', amount: 1500 },
      { categoryId: 'traffic', amount: 800 },
    ]);
  });

  it('原支出不在项目内时，退款不凭空生成分类构成', () => {
    const outsideExpense = transaction({ id: 'outside', categoryId: 'stay', amount: 2000 });
    const refund = transaction({
      id: 'stray-refund',
      projectId: 'travel',
      categoryId: 'refund',
      type: 'income',
      amount: 500,
      kind: 'refund',
      linkedExpenseTransactionId: outsideExpense.id,
    });

    expect(buildProjectCategoryBreakdown([outsideExpense, refund], 'travel')).toEqual([]);
  });
});

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
