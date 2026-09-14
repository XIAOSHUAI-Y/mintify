import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import { summarizeExpensesByTag } from './tagStats';

function makeTransaction(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? 'txn',
    ledgerId: 'ledger',
    categoryId: 'food',
    amount: 100,
    type: 'expense',
    note: '',
    tags: [],
    occurredAt: 1,
    createdAt: 1,
    ...partial,
  };
}

describe('summarizeExpensesByTag', () => {
  it('按标签汇总支出金额与笔数', () => {
    const stats = summarizeExpensesByTag([
      makeTransaction({ id: '1', amount: 50, tags: ['聚餐'] }),
      makeTransaction({ id: '2', amount: 30, tags: ['聚餐', '工作餐'] }),
      makeTransaction({ id: '3', amount: 20, tags: ['工作餐'] }),
    ]);
    expect(stats).toEqual([
      { tag: '聚餐', amount: 80, count: 2 },
      { tag: '工作餐', amount: 50, count: 2 },
    ]);
  });

  it('忽略收入与无标签支出', () => {
    const stats = summarizeExpensesByTag([
      makeTransaction({ id: '1', type: 'income', amount: 500, tags: ['工资'] }),
      makeTransaction({ id: '2', amount: 100 }),
      makeTransaction({ id: '3', amount: 40, tags: ['打车'] }),
    ]);
    expect(stats).toEqual([{ tag: '打车', amount: 40, count: 1 }]);
  });

  it('没有标签时返回空数组', () => {
    expect(summarizeExpensesByTag([makeTransaction({ amount: 100 })])).toEqual([]);
  });
});
