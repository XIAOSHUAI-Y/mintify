import type { Transaction, TransactionMood, TransactionType } from '../types';
import { getDayEnd, getDayStart, getMonthEnd, getMonthStart } from '../utils/helpers';

export type DatePreset = 'all' | 'today' | 'last7' | 'thisMonth' | 'lastMonth' | 'thisYear';
export type PhotoFilter = 'any' | 'with' | 'without';
export type MoodFilterValue = TransactionMood | 'none';

export interface TransactionFilter {
  keyword: string;
  type: TransactionType | 'all';
  categoryId: string;
  datePreset: DatePreset;
  amountMin?: number;
  amountMax?: number;
  /** 多选标签取交集：必须同时带上所有选中的标签。 */
  tags: string[];
  photo: PhotoFilter;
  /** 选中的心情集合；'none' 表示未标记心情。 */
  moods: MoodFilterValue[];
}

export const EMPTY_FILTER: TransactionFilter = {
  keyword: '',
  type: 'all',
  categoryId: '',
  datePreset: 'all',
  tags: [],
  photo: 'any',
  moods: [],
};

export const DATE_PRESET_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'today', label: '今天' },
  { value: 'last7', label: '近 7 天' },
  { value: 'thisMonth', label: '本月' },
  { value: 'lastMonth', label: '上月' },
  { value: 'thisYear', label: '今年' },
];

/**
 * 账单筛选：所有维度之间取交集，结果按发生时间倒序。
 * `now` 由调用方注入，日期预设才能和"当前时间"解耦并被测试固定。
 */
export function filterTransactions(
  transactions: Transaction[],
  filter: TransactionFilter,
  categories: { id: string; name: string }[],
  now: number = Date.now(),
): Transaction[] {
  const range = resolveDateRange(filter.datePreset, now);
  const query = filter.keyword.trim().toLowerCase();
  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name.toLowerCase()]),
  );

  return transactions
    .filter((transaction) => {
      if (filter.type !== 'all' && transaction.type !== filter.type) return false;
      if (filter.categoryId && transaction.categoryId !== filter.categoryId) return false;
      if (range && (transaction.occurredAt < range.start || transaction.occurredAt > range.end)) return false;
      if (filter.amountMin !== undefined && transaction.amount < filter.amountMin) return false;
      if (filter.amountMax !== undefined && transaction.amount > filter.amountMax) return false;
      if (filter.tags.length > 0 && !filter.tags.every((tag) => transaction.tags.includes(tag))) return false;
      if (filter.photo === 'with' && !transaction.photo) return false;
      if (filter.photo === 'without' && transaction.photo) return false;
      if (filter.moods.length > 0 && !matchesMood(transaction, filter.moods)) return false;
      if (!query) return true;

      return (
        transaction.note.toLowerCase().includes(query)
        || (categoryNames.get(transaction.categoryId)?.includes(query) ?? false)
        || transaction.tags.some((tag) => tag.toLowerCase().includes(query))
        || String(transaction.amount).includes(query)
      );
    })
    .sort((a, b) => b.occurredAt - a.occurredAt);
}

/** 按"维度"计数，标签多选和金额上下限各自只算一项，用于筛选按钮上的角标。 */
export function countActiveFilters(filter: TransactionFilter): number {
  let count = 0;
  if (filter.keyword.trim()) count += 1;
  if (filter.type !== 'all') count += 1;
  if (filter.categoryId) count += 1;
  if (filter.datePreset !== 'all') count += 1;
  if (filter.amountMin !== undefined || filter.amountMax !== undefined) count += 1;
  if (filter.tags.length > 0) count += 1;
  if (filter.photo !== 'any') count += 1;
  if (filter.moods.length > 0) count += 1;
  return count;
}

function matchesMood(transaction: Transaction, moods: MoodFilterValue[]): boolean {
  if (!transaction.mood) return moods.includes('none');
  return moods.includes(transaction.mood);
}

function resolveDateRange(
  preset: DatePreset,
  now: number,
): { start: number; end: number } | null {
  switch (preset) {
    case 'today':
      return { start: getDayStart(now), end: getDayEnd(now) };
    case 'last7': {
      const start = new Date(now);
      // 含今天在内的 7 天：往前数 6 天。
      start.setDate(start.getDate() - 6);
      return { start: getDayStart(start.getTime()), end: getDayEnd(now) };
    }
    case 'thisMonth':
      return { start: getMonthStart(now), end: getMonthEnd(now) };
    case 'lastMonth': {
      const previous = new Date(now);
      // 先把日期落到 1 号再回退月份，避免 31 号在短月份里溢出到错误的月份。
      previous.setDate(1);
      previous.setMonth(previous.getMonth() - 1);
      return { start: getMonthStart(previous.getTime()), end: getMonthEnd(previous.getTime()) };
    }
    case 'thisYear': {
      const year = new Date(now).getFullYear();
      return {
        start: new Date(year, 0, 1).getTime(),
        end: new Date(year, 11, 31, 23, 59, 59, 999).getTime(),
      };
    }
    default:
      return null;
  }
}
