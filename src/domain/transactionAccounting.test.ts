import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import {
  getNetSpendingByCategory,
  getRemainingRefundableAmount,
  summarizeTransactions,
} from './transactionAccounting';

describe('退款账务口径', () => {
  it('退款冲减原支出而不重复计入普通收入', () => {
    const expense = transaction({ id: 'ai-expense', type: 'expense', categoryId: 'software', amount: 500 });
    const refund = transaction({
      id: 'ai-refund',
      type: 'income',
      categoryId: 'refund',
      amount: 500,
      kind: 'refund',
      linkedExpenseTransactionId: expense.id,
    });

    expect(summarizeTransactions([expense, refund])).toEqual({
      income: 0,
      grossExpense: 500,
      refunds: 500,
      netExpense: 0,
      balance: 0,
    });
  });

  it('按退款发生月份冲减原支出分类，预算使用额最低为零', () => {
    const expense = transaction({
      id: 'july-ai-expense',
      categoryId: 'software',
      amount: 500,
      occurredAt: new Date(2026, 6, 30).getTime(),
    });
    const refund = transaction({
      id: 'august-refund',
      type: 'income',
      categoryId: 'refund',
      amount: 500,
      occurredAt: new Date(2026, 7, 2).getTime(),
      kind: 'refund',
      linkedExpenseTransactionId: expense.id,
    });

    // 实际交易列表通常按日期倒序，计算不能依赖数组顺序。
    expect(getNetSpendingByCategory([refund, expense], '2026-07').get('software')).toBe(500);
    expect(getNetSpendingByCategory([refund, expense], '2026-08').get('software')).toBe(0);
  });

  it('同月部分退款得到稳定的分类净支出，不依赖账单排序', () => {
    const expense = transaction({ id: 'expense', categoryId: 'software', amount: 500 });
    const refund = transaction({
      id: 'refund',
      type: 'income',
      categoryId: 'refund-category',
      amount: 200,
      kind: 'refund',
      linkedExpenseTransactionId: expense.id,
    });

    expect(getNetSpendingByCategory([refund, expense], '2026-08').get('software')).toBe(300);
  });

  it('计算原支出还可以退款的金额，编辑时排除退款自身', () => {
    const expense = transaction({ id: 'expense', amount: 500 });
    const refund = transaction({
      id: 'refund',
      type: 'income',
      amount: 200,
      kind: 'refund',
      linkedExpenseTransactionId: expense.id,
    });

    expect(getRemainingRefundableAmount([expense, refund], expense.id)).toBe(300);
    expect(getRemainingRefundableAmount([expense, refund], expense.id, refund.id)).toBe(500);
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
