import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteDB } from 'idb';
import type { Category, FundTransaction, Transaction } from '../types';
import { closeDB, DB_NAME } from './index';
import {
  allocateLivingExpense,
  deleteFundTransaction,
  getFundTransactions,
  getTransactions,
  linkExistingLivingExpenseIncome,
  saveFundTransaction,
  saveTransaction,
} from './operations';

describe('资金账本持久化边界', () => {
  afterEach(async () => {
    await closeDB();
    await deleteDB(DB_NAME);
  });

  it('手动记录工资或固定支出时不会写入生活费主账本', async () => {
    const salary: FundTransaction = {
      id: 'salary-august',
      ledgerId: 'daily-ledger',
      type: 'income',
      category: '工资',
      kind: 'record',
      amount: 24777,
      note: '',
      occurredAt: new Date(2026, 7, 31).getTime(),
      createdAt: 1,
    };

    await saveFundTransaction(salary);

    expect(await getFundTransactions(salary.ledgerId)).toEqual([salary]);
    expect(await getTransactions(salary.ledgerId)).toEqual([]);
  });

  it('划拨生活费时原子写入资金支出和主账本收入', async () => {
    const incomeCategory: Category = {
      id: 'living-expense-income',
      ledgerId: 'daily-ledger',
      name: '生活费',
      icon: 'wallet-cards',
      color: '#F59E0B',
      type: 'income',
      sortOrder: 100,
      isBuiltIn: true,
    };
    const mainIncome: Transaction = {
      id: 'living-income-august',
      ledgerId: incomeCategory.ledgerId,
      categoryId: incomeCategory.id,
      amount: 6000,
      type: 'income',
      note: '8月生活费',
      tags: ['资金划拨'],
      occurredAt: new Date(2026, 7, 1).getTime(),
      createdAt: 2,
    };
    const allocation: FundTransaction = {
      id: 'living-allocation-august',
      ledgerId: incomeCategory.ledgerId,
      type: 'expense',
      category: '生活费',
      kind: 'living-expense-allocation',
      amount: mainIncome.amount,
      note: mainIncome.note,
      occurredAt: mainIncome.occurredAt,
      createdAt: 2,
      linkedTransactionId: mainIncome.id,
      mainIncomeOrigin: 'auto-created',
    };

    await allocateLivingExpense(allocation, mainIncome, incomeCategory);

    expect(await getFundTransactions(allocation.ledgerId)).toEqual([allocation]);
    expect(await getTransactions(allocation.ledgerId)).toEqual([mainIncome]);

    await expect(allocateLivingExpense(
      { ...allocation, id: 'second-allocation', linkedTransactionId: 'second-income' },
      { ...mainIncome, id: 'second-income' },
      incomeCategory,
    )).rejects.toThrow('每月只能划拨一次生活费');

    await deleteFundTransaction(allocation.id);

    expect(await getFundTransactions(allocation.ledgerId)).toEqual([]);
    expect(await getTransactions(allocation.ledgerId)).toEqual([]);
  });

  it('关联已有生活费收入时不重复创建主账本交易', async () => {
    const existingIncome: Transaction = {
      id: 'existing-living-income',
      ledgerId: 'daily-ledger',
      categoryId: 'other-income',
      amount: 3500,
      type: 'income',
      note: '8月生活费',
      tags: [],
      occurredAt: new Date(2026, 7, 1).getTime(),
      createdAt: 1,
    };
    const allocation: FundTransaction = {
      id: 'linked-living-allocation',
      ledgerId: existingIncome.ledgerId,
      type: 'expense',
      category: '生活费',
      kind: 'living-expense-allocation',
      amount: existingIncome.amount,
      note: existingIncome.note,
      occurredAt: existingIncome.occurredAt,
      createdAt: 2,
      linkedTransactionId: existingIncome.id,
      mainIncomeOrigin: 'existing',
    };
    await saveTransaction(existingIncome);

    await linkExistingLivingExpenseIncome(allocation, existingIncome);

    expect(await getFundTransactions(allocation.ledgerId)).toEqual([allocation]);
    expect(await getTransactions(allocation.ledgerId)).toEqual([existingIncome]);

    await deleteFundTransaction(allocation.id);

    expect(await getFundTransactions(allocation.ledgerId)).toEqual([]);
    expect(await getTransactions(allocation.ledgerId)).toEqual([existingIncome]);
  });

  it('退款不能被误绑定为资金页生活费收入', async () => {
    const refund: Transaction = {
      id: 'refund-income',
      ledgerId: 'daily-ledger',
      categoryId: 'refund-category',
      amount: 500,
      type: 'income',
      kind: 'refund',
      linkedExpenseTransactionId: 'original-expense',
      note: '',
      tags: [],
      occurredAt: new Date(2026, 7, 2).getTime(),
      createdAt: 1,
    };
    const allocation: FundTransaction = {
      id: 'invalid-allocation',
      ledgerId: refund.ledgerId,
      type: 'expense',
      category: '生活费',
      kind: 'living-expense-allocation',
      amount: refund.amount,
      note: '',
      occurredAt: refund.occurredAt,
      createdAt: 2,
      linkedTransactionId: refund.id,
      mainIncomeOrigin: 'existing',
    };
    // 直接写入模拟恢复后的关联候选，验证资金桥接层仍会拒绝退款。
    const originalExpense: Transaction = { ...refund, id: 'original-expense', type: 'expense', kind: undefined, linkedExpenseTransactionId: undefined };
    await saveTransaction(originalExpense);
    await saveTransaction(refund);

    await expect(linkExistingLivingExpenseIncome(allocation, refund))
      .rejects.toThrow('已有生活费收入与资金划拨不一致');
  });
});
