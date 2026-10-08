import { describe, expect, it } from 'vitest';
import type { Budget, Transaction } from '../types';
import { buildBudgetAlerts } from './budgetAlerts';
import { getYearMonth } from '../utils/helpers';

const now = Date.now();
const yearMonth = getYearMonth(now);

function makeBudget(partial: Partial<Budget>): Budget {
  return {
    id: partial.id ?? 'budget',
    ledgerId: 'ledger',
    amount: 1000,
    period: 'monthly',
    yearMonth,
    includeOverall: false,
    createdAt: 1,
    ...partial,
  };
}

function makeExpense(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? 'txn',
    ledgerId: 'ledger',
    categoryId: 'food',
    amount: 100,
    type: 'expense',
    note: '',
    tags: [],
    occurredAt: now,
    createdAt: 1,
    ...partial,
  };
}

describe('buildBudgetAlerts', () => {
  it('收入和转账不触发提醒', () => {
    const budgets = [makeBudget({ id: 'b1', includeOverall: true })];
    const saved = makeExpense({ type: 'income', amount: 2000 });
    expect(buildBudgetAlerts({
      budgets,
      transactions: [saved],
      ledgerId: 'ledger',
      savedTransaction: saved,
    })).toEqual([]);
  });

  it('跨过 80% 阈值时给出 warning', () => {
    const budgets = [makeBudget({ id: 'b1', categoryId: 'food', amount: 1000 })];
    const existing = makeExpense({ id: 'old', amount: 750 });
    const saved = makeExpense({ id: 'new', amount: 100 });
    const alerts = buildBudgetAlerts({
      budgets,
      transactions: [existing, saved],
      ledgerId: 'ledger',
      savedTransaction: saved,
      categoryName: '餐饮',
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ severity: 'warning', label: '「餐饮」预算' });
    expect(alerts[0].percentage).toBeCloseTo(85);
  });

  it('跨过 100% 时给出 exceeded', () => {
    const budgets = [makeBudget({ id: 'b1', includeOverall: true, amount: 1000 })];
    const existing = makeExpense({ id: 'old', amount: 950 });
    const saved = makeExpense({ id: 'new', amount: 100 });
    const alerts = buildBudgetAlerts({
      budgets,
      transactions: [existing, saved],
      ledgerId: 'ledger',
      savedTransaction: saved,
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('exceeded');
  });

  it('已经在阈值之上时不重复提醒', () => {
    const budgets = [makeBudget({ id: 'b1', includeOverall: true, amount: 1000 })];
    const existing = makeExpense({ id: 'old', amount: 900 });
    const saved = makeExpense({ id: 'new', amount: 10 });
    expect(buildBudgetAlerts({
      budgets,
      transactions: [existing, saved],
      ledgerId: 'ledger',
      savedTransaction: saved,
    })).toEqual([]);
  });

  it('编辑账单时按差额判断跨越', () => {
    const budgets = [makeBudget({ id: 'b1', includeOverall: true, amount: 1000 })];
    const previous = makeExpense({ id: 'same', amount: 100 });
    const saved = makeExpense({ id: 'same', amount: 850 });
    // transactions 是保存后的状态：只有新金额
    const alerts = buildBudgetAlerts({
      budgets,
      transactions: [saved],
      ledgerId: 'ledger',
      savedTransaction: saved,
      previousTransaction: previous,
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('warning');
  });

  it('编辑金额变小时不提醒', () => {
    const budgets = [makeBudget({ id: 'b1', includeOverall: true, amount: 1000 })];
    const previous = makeExpense({ id: 'same', amount: 900 });
    const saved = makeExpense({ id: 'same', amount: 100 });
    expect(buildBudgetAlerts({
      budgets,
      transactions: [saved],
      ledgerId: 'ledger',
      savedTransaction: saved,
      previousTransaction: previous,
    })).toEqual([]);
  });

  it('分类预算和总预算同时跨阈时分类在前', () => {
    const budgets = [
      makeBudget({ id: 'b1', includeOverall: true, amount: 1000 }),
      makeBudget({ id: 'b2', categoryId: 'food', amount: 100 }),
    ];
    const saved = makeExpense({ id: 'new', amount: 850 });
    const alerts = buildBudgetAlerts({
      budgets,
      transactions: [saved],
      ledgerId: 'ledger',
      savedTransaction: saved,
      categoryName: '餐饮',
    });
    expect(alerts.map((alert) => alert.key)).toEqual(['category:food', 'overall']);
    expect(alerts[0].severity).toBe('exceeded');
    expect(alerts[1].severity).toBe('warning');
  });

  it('没有当月预算时不提醒', () => {
    const budgets = [makeBudget({ id: 'b1', includeOverall: true, yearMonth: '2000-01' })];
    const saved = makeExpense({ amount: 2000 });
    expect(buildBudgetAlerts({
      budgets,
      transactions: [saved],
      ledgerId: 'ledger',
      savedTransaction: saved,
    })).toEqual([]);
  });

  it('给二级分类记账时，一级预算跨过阈值同样提醒，并报一级的名字', () => {
    const budgets = [makeBudget({ id: 'b1', categoryId: 'food', amount: 1000 })];
    const saved = makeExpense({ id: 'new', categoryId: 'takeout', amount: 850 });

    const alerts = buildBudgetAlerts({
      budgets,
      transactions: [saved],
      ledgerId: 'ledger',
      savedTransaction: saved,
      categoryName: '外卖',
      parentIdByCategoryId: new Map([['takeout', 'food']]),
      categoryNameByCategoryId: new Map([['food', '餐饮'], ['takeout', '外卖']]),
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ key: 'category:food', label: '「餐饮」预算', severity: 'warning' });
  });

  it('二级分类自己有预算时只看它，不再叠加到一级', () => {
    const budgets = [
      makeBudget({ id: 'parent', categoryId: 'food', amount: 1000 }),
      makeBudget({ id: 'child', categoryId: 'takeout', amount: 100 }),
    ];
    const saved = makeExpense({ id: 'new', categoryId: 'takeout', amount: 90 });

    const alerts = buildBudgetAlerts({
      budgets,
      transactions: [saved],
      ledgerId: 'ledger',
      savedTransaction: saved,
      categoryName: '外卖',
      parentIdByCategoryId: new Map([['takeout', 'food']]),
      categoryNameByCategoryId: new Map([['food', '餐饮'], ['takeout', '外卖']]),
    });

    expect(alerts.map((alert) => alert.key)).toEqual(['category:takeout']);
    expect(alerts[0].label).toBe('「外卖」预算');
  });

  it('不传父级映射时不会用一级预算去管二级支出', () => {
    const budgets = [makeBudget({ id: 'b1', categoryId: 'food', amount: 1000 })];
    const saved = makeExpense({ id: 'new', categoryId: 'takeout', amount: 850 });

    expect(buildBudgetAlerts({
      budgets,
      transactions: [saved],
      ledgerId: 'ledger',
      savedTransaction: saved,
      categoryName: '外卖',
    })).toEqual([]);
  });
});
