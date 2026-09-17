import { describe, expect, it } from 'vitest';
import type { Category, Transaction } from '../types';
import {
  EMPTY_FILTER,
  countActiveFilters,
  filterTransactions,
  type TransactionFilter,
} from './transactionFilter';

/** 固定"当前时间"，日期预设必须按注入的时间算，否则跨月跑测试会飘。 */
const NOW = new Date(2026, 8, 17, 12, 0, 0).getTime();

const CATEGORIES: Category[] = [
  category({ id: 'food', name: '餐饮', type: 'expense' }),
  category({ id: 'traffic', name: '交通', type: 'expense' }),
  category({ id: 'salary', name: '工资', type: 'income' }),
];

describe('账单筛选', () => {
  it('按关键词匹配备注、分类名、标签和金额', () => {
    const rows = [
      transaction({ id: 'note', note: '星巴克咖啡', occurredAt: day(2026, 9, 17) }),
      transaction({ id: 'category-name', categoryId: 'traffic', occurredAt: day(2026, 9, 16) }),
      transaction({ id: 'tag', tags: ['报销'], occurredAt: day(2026, 9, 15) }),
      transaction({ id: 'amount', amount: 1234, occurredAt: day(2026, 9, 14) }),
      transaction({ id: 'miss', note: '超市', occurredAt: day(2026, 9, 13) }),
    ];

    const ids = (keyword: string) => filterTransactions(
      rows,
      { ...EMPTY_FILTER, keyword },
      CATEGORIES,
      NOW,
    ).map((item) => item.id);

    expect(ids('咖啡')).toEqual(['note']);
    expect(ids('交通')).toEqual(['category-name']);
    expect(ids('报销')).toEqual(['tag']);
    expect(ids('1234')).toEqual(['amount']);
    expect(ids('')).toEqual(['note', 'category-name', 'tag', 'amount', 'miss']);
  });

  it('关键词忽略大小写', () => {
    const rows = [transaction({ id: 'latte', note: 'Latte' })];

    expect(filterTransactions(rows, { ...EMPTY_FILTER, keyword: 'latte' }, CATEGORIES, NOW))
      .toHaveLength(1);
  });

  it('按类型筛选，包含转账', () => {
    const rows = [
      transaction({ id: 'expense', type: 'expense', occurredAt: day(2026, 9, 17) }),
      transaction({ id: 'income', type: 'income', occurredAt: day(2026, 9, 16) }),
      transaction({ id: 'transfer', type: 'transfer', occurredAt: day(2026, 9, 15) }),
    ];

    expect(filterTransactions(rows, { ...EMPTY_FILTER, type: 'transfer' }, CATEGORIES, NOW)
      .map((item) => item.id)).toEqual(['transfer']);
    expect(filterTransactions(rows, { ...EMPTY_FILTER, type: 'all' }, CATEGORIES, NOW)).toHaveLength(3);
  });

  it('按分类筛选', () => {
    const rows = [
      transaction({ id: 'food', categoryId: 'food', occurredAt: day(2026, 9, 17) }),
      transaction({ id: 'traffic', categoryId: 'traffic', occurredAt: day(2026, 9, 16) }),
    ];

    expect(filterTransactions(rows, { ...EMPTY_FILTER, categoryId: 'food' }, CATEGORIES, NOW)
      .map((item) => item.id)).toEqual(['food']);
  });

  it('日期预设按当前时间计算，且包含首尾当天', () => {
    const rows = [
      transaction({ id: 'today', occurredAt: day(2026, 9, 17) }),
      transaction({ id: 'yesterday', occurredAt: day(2026, 9, 16) }),
      transaction({ id: 'six-days-ago', occurredAt: day(2026, 9, 11) }),
      transaction({ id: 'seven-days-ago', occurredAt: day(2026, 9, 10) }),
      transaction({ id: 'month-start', occurredAt: day(2026, 9, 1) }),
      transaction({ id: 'last-month', occurredAt: day(2026, 8, 31) }),
      transaction({ id: 'this-year', occurredAt: day(2026, 1, 5) }),
      transaction({ id: 'last-year', occurredAt: day(2025, 12, 31) }),
    ];
    const ids = (datePreset: TransactionFilter['datePreset']) => filterTransactions(
      rows,
      { ...EMPTY_FILTER, datePreset },
      CATEGORIES,
      NOW,
    ).map((item) => item.id);

    expect(ids('today')).toEqual(['today']);
    expect(ids('last7')).toEqual(['today', 'yesterday', 'six-days-ago']);
    expect(ids('thisMonth')).toEqual(['today', 'yesterday', 'six-days-ago', 'seven-days-ago', 'month-start']);
    expect(ids('lastMonth')).toEqual(['last-month']);
    expect(ids('thisYear')).toEqual([
      'today', 'yesterday', 'six-days-ago', 'seven-days-ago', 'month-start', 'last-month', 'this-year',
    ]);
    expect(ids('all')).toHaveLength(8);
  });

  it('金额区间包含边界值', () => {
    const rows = [
      transaction({ id: 'small', amount: 50, occurredAt: day(2026, 9, 17) }),
      transaction({ id: 'min', amount: 100, occurredAt: day(2026, 9, 16) }),
      transaction({ id: 'max', amount: 200, occurredAt: day(2026, 9, 15) }),
      transaction({ id: 'big', amount: 201, occurredAt: day(2026, 9, 14) }),
    ];
    const ids = (patch: Partial<TransactionFilter>) => filterTransactions(
      rows,
      { ...EMPTY_FILTER, ...patch },
      CATEGORIES,
      NOW,
    ).map((item) => item.id);

    // 结果始终按发生时间倒序，与金额大小无关。
    expect(ids({ amountMin: 100 })).toEqual(['min', 'max', 'big']);
    expect(ids({ amountMax: 200 })).toEqual(['small', 'min', 'max']);
    expect(ids({ amountMin: 100, amountMax: 200 })).toEqual(['min', 'max']);
  });

  it('多选标签要求全部命中', () => {
    const rows = [
      transaction({ id: 'both', tags: ['旅行', '报销'], occurredAt: day(2026, 9, 17) }),
      transaction({ id: 'travel-only', tags: ['旅行'], occurredAt: day(2026, 9, 16) }),
      transaction({ id: 'refund-only', tags: ['报销'], occurredAt: day(2026, 9, 15) }),
      transaction({ id: 'none', tags: [], occurredAt: day(2026, 9, 14) }),
    ];
    const ids = (tags: string[]) => filterTransactions(
      rows,
      { ...EMPTY_FILTER, tags },
      CATEGORIES,
      NOW,
    ).map((item) => item.id);

    expect(ids(['旅行', '报销'])).toEqual(['both']);
    expect(ids(['旅行'])).toEqual(['both', 'travel-only']);
    expect(ids([])).toHaveLength(4);
  });

  it('按有无照片筛选，空串视为没有照片', () => {
    const rows = [
      transaction({ id: 'with-photo', photo: 'data:image/jpeg;base64,xxx', occurredAt: day(2026, 9, 17) }),
      transaction({ id: 'empty-photo', photo: '', occurredAt: day(2026, 9, 16) }),
      transaction({ id: 'no-photo', occurredAt: day(2026, 9, 15) }),
    ];
    const ids = (photo: TransactionFilter['photo']) => filterTransactions(
      rows,
      { ...EMPTY_FILTER, photo },
      CATEGORIES,
      NOW,
    ).map((item) => item.id);

    expect(ids('with')).toEqual(['with-photo']);
    expect(ids('without')).toEqual(['empty-photo', 'no-photo']);
    expect(ids('any')).toHaveLength(3);
  });

  it('按心情筛选，含未标记', () => {
    const rows = [
      transaction({ id: 'regret', mood: 'regret', occurredAt: day(2026, 9, 17) }),
      transaction({ id: 'happy', mood: 'happy', occurredAt: day(2026, 9, 16) }),
      transaction({ id: 'necessary', mood: 'necessary', occurredAt: day(2026, 9, 15) }),
      transaction({ id: 'unmarked', occurredAt: day(2026, 9, 14) }),
    ];
    const ids = (moods: TransactionFilter['moods']) => filterTransactions(
      rows,
      { ...EMPTY_FILTER, moods },
      CATEGORIES,
      NOW,
    ).map((item) => item.id);

    expect(ids(['regret', 'none'])).toEqual(['regret', 'unmarked']);
    expect(ids(['happy'])).toEqual(['happy']);
    expect(ids([])).toHaveLength(4);
  });

  it('多个条件叠加时取交集', () => {
    const rows = [
      transaction({ id: 'match', categoryId: 'food', amount: 120, tags: ['聚餐'], mood: 'happy', occurredAt: day(2026, 9, 10) }),
      transaction({ id: 'wrong-category', categoryId: 'traffic', amount: 120, tags: ['聚餐'], mood: 'happy', occurredAt: day(2026, 9, 10) }),
      transaction({ id: 'too-cheap', categoryId: 'food', amount: 20, tags: ['聚餐'], mood: 'happy', occurredAt: day(2026, 9, 10) }),
      transaction({ id: 'wrong-tag', categoryId: 'food', amount: 120, tags: ['外卖'], mood: 'happy', occurredAt: day(2026, 9, 10) }),
      transaction({ id: 'wrong-mood', categoryId: 'food', amount: 120, tags: ['聚餐'], mood: 'regret', occurredAt: day(2026, 9, 10) }),
      transaction({ id: 'last-month', categoryId: 'food', amount: 120, tags: ['聚餐'], mood: 'happy', occurredAt: day(2026, 8, 10) }),
    ];

    const results = filterTransactions(rows, {
      ...EMPTY_FILTER,
      type: 'expense',
      categoryId: 'food',
      datePreset: 'thisMonth',
      amountMin: 100,
      tags: ['聚餐'],
      moods: ['happy'],
    }, CATEGORIES, NOW);

    expect(results.map((item) => item.id)).toEqual(['match']);
  });

  it('结果按发生时间倒序', () => {
    const rows = [
      transaction({ id: 'old', occurredAt: day(2026, 9, 1) }),
      transaction({ id: 'new', occurredAt: day(2026, 9, 17) }),
      transaction({ id: 'middle', occurredAt: day(2026, 9, 10) }),
    ];

    expect(filterTransactions(rows, EMPTY_FILTER, CATEGORIES, NOW).map((item) => item.id))
      .toEqual(['new', 'middle', 'old']);
  });

  it('统计生效的筛选维度数量', () => {
    expect(countActiveFilters(EMPTY_FILTER)).toBe(0);
    expect(countActiveFilters({
      ...EMPTY_FILTER,
      keyword: '咖啡',
      categoryId: 'food',
      datePreset: 'thisMonth',
      amountMin: 100,
      tags: ['聚餐', '旅行'],
      photo: 'with',
      moods: ['happy', 'none'],
    })).toBe(7);
    // 类型与金额上下限都只算一个维度。
    expect(countActiveFilters({ ...EMPTY_FILTER, type: 'expense', amountMin: 1, amountMax: 9 })).toBe(2);
    // 空串关键词、全角空格不该算生效。
    expect(countActiveFilters({ ...EMPTY_FILTER, keyword: '   ' })).toBe(0);
  });
});

function day(year: number, month: number, dayOfMonth: number): number {
  return new Date(year, month - 1, dayOfMonth, 10, 0, 0).getTime();
}

function category(overrides: Partial<Category>): Category {
  return {
    id: 'category',
    ledgerId: 'daily-ledger',
    name: '分类',
    icon: 'utensils',
    color: '#F59E0B',
    type: 'expense',
    sortOrder: 0,
    isBuiltIn: false,
    ...overrides,
  };
}

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'transaction',
    ledgerId: 'daily-ledger',
    categoryId: 'food',
    amount: 100,
    type: 'expense',
    note: '',
    tags: [],
    occurredAt: day(2026, 9, 17),
    createdAt: 1,
    ...overrides,
  };
}
