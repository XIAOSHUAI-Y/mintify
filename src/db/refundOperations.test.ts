import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteDB } from 'idb';
import type { Transaction } from '../types';
import { closeDB, DB_NAME } from './index';
import { deleteTransaction, getTransactions, saveTransaction } from './operations';

describe('退款交易持久化边界', () => {
  afterEach(async () => {
    await closeDB();
    await deleteDB(DB_NAME);
  });

  it('只允许绑定同账本支出且累计退款不能超过原金额', async () => {
    const expense = transaction({ id: 'ai-expense', amount: 500 });
    await saveTransaction(expense);
    await saveTransaction(refund({ id: 'refund-200', linkedExpenseTransactionId: expense.id, amount: 200 }));

    await expect(saveTransaction(refund({
      id: 'refund-301',
      linkedExpenseTransactionId: expense.id,
      amount: 301,
    }))).rejects.toThrow('超过原支出可退金额');

    expect(await getTransactions(expense.ledgerId)).toHaveLength(2);
  });

  it('有退款时保护原支出，删除退款后恢复正常编辑和删除', async () => {
    const expense = transaction({ id: 'protected-expense', amount: 500 });
    const linkedRefund = refund({
      id: 'linked-refund',
      linkedExpenseTransactionId: expense.id,
      amount: 200,
    });
    await saveTransaction(expense);
    await saveTransaction(linkedRefund);

    await expect(deleteTransaction(expense.id)).rejects.toThrow('请先删除关联退款');
    await expect(saveTransaction({ ...expense, amount: 199 })).rejects.toThrow('小于累计退款金额');

    await deleteTransaction(linkedRefund.id);
    await deleteTransaction(expense.id);
    expect(await getTransactions(expense.ledgerId)).toEqual([]);
  });
});

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'expense',
    ledgerId: 'daily-ledger',
    categoryId: 'software',
    amount: 100,
    type: 'expense',
    note: 'AI 订阅',
    tags: [],
    occurredAt: new Date(2026, 7, 2).getTime(),
    createdAt: 1,
    ...overrides,
  };
}

function refund(overrides: Partial<Transaction>): Transaction {
  return transaction({
    type: 'income',
    categoryId: 'refund-category',
    kind: 'refund',
    ...overrides,
  });
}
