import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import { buildInsights } from './insights';

const NOW = new Date(2026, 8, 15, 12, 0, 0).getTime(); // 2026-09-15 周三

function makeExpense(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    ledgerId: 'ledger',
    categoryId: 'food',
    amount: 10,
    type: 'expense',
    note: '',
    tags: [],
    occurredAt: NOW,
    createdAt: 1,
    ...partial,
  };
}

function onDay(monthOffset: number, day: number): number {
  return new Date(2026, 8 + monthOffset, day, 10, 0, 0).getTime();
}

describe('buildInsights', () => {
  it('高频备注满 3 笔才出现', () => {
    const two = [makeExpense({ note: '奶茶' }), makeExpense({ note: '奶茶' })];
    expect(buildInsights({ transactions: two, categories: [], now: NOW })
      .some((insight) => insight.id === 'frequent-note')).toBe(false);

    const three = [...two, makeExpense({ note: '奶茶', amount: 20 })];
    const insight = buildInsights({ transactions: three, categories: [], now: NOW })
      .find((item) => item.id === 'frequent-note');
    expect(insight?.text).toContain('奶茶');
    expect(insight?.text).toContain('3 笔');
  });

  it('本月最大单笔支出', () => {
    const insight = buildInsights({
      transactions: [makeExpense({ amount: 5 }), makeExpense({ amount: 500, note: '机票' })],
      categories: [],
      now: NOW,
    }).find((item) => item.id === 'largest-expense');
    expect(insight?.text).toContain('机票');
    expect(insight?.text).toContain('500');
  });

  it('星期峰值需要至少 10 笔样本', () => {
    const few = [makeExpense({ amount: 100 })];
    expect(buildInsights({ transactions: few, categories: [], now: NOW })
      .some((insight) => insight.id === 'weekday-peak')).toBe(false);

    // 近 90 天每个周五各来一笔大额的，周日一笔小额的
    const many: Transaction[] = [];
    for (let week = 0; week < 12; week += 1) {
      many.push(makeExpense({ amount: 200, occurredAt: onDay(0, 4) - week * 7 * 86400000 }));
      many.push(makeExpense({ amount: 10, occurredAt: onDay(0, 4) - week * 7 * 86400000 + 2 * 86400000 }));
    }
    const insight = buildInsights({ transactions: many, categories: [], now: NOW })
      .find((item) => item.id === 'weekday-peak');
    expect(insight?.text).toContain('周五');
  });

  it('连续记账从今天或昨天起算，不足 3 天不显示', () => {
    const twoDays = [
      makeExpense({ occurredAt: onDay(0, 14) }),
      makeExpense({ occurredAt: onDay(0, 13) }),
    ];
    expect(buildInsights({ transactions: twoDays, categories: [], now: NOW })
      .some((insight) => insight.id === 'streak')).toBe(false);

    const fourDays = [...twoDays, makeExpense({ occurredAt: onDay(0, 12) }), makeExpense({ occurredAt: onDay(0, 11) })];
    const insight = buildInsights({ transactions: fourDays, categories: [], now: NOW })
      .find((item) => item.id === 'streak');
    expect(insight?.text).toContain('4 天');
  });

  it('后悔消费洞察与心情标记联动', () => {
    const withRegret = [
      makeExpense({ mood: 'regret', amount: 66 }),
      makeExpense({ mood: 'happy', amount: 10 }),
    ];
    const insight = buildInsights({ transactions: withRegret, categories: [], now: NOW })
      .find((item) => item.id === 'regret');
    expect(insight?.text).toContain('1 笔');
    expect(insight?.text).toContain('66');
  });

  it('环比变化超过 10% 才提示', () => {
    const stable = [
      makeExpense({ amount: 100, occurredAt: onDay(-1, 10) }),
      makeExpense({ amount: 105 }),
    ];
    expect(buildInsights({ transactions: stable, categories: [], now: NOW })
      .some((insight) => insight.id === 'month-trend')).toBe(false);

    const surging = [
      makeExpense({ amount: 100, occurredAt: onDay(-1, 10) }),
      makeExpense({ amount: 150 }),
    ];
    const insight = buildInsights({ transactions: surging, categories: [], now: NOW })
      .find((item) => item.id === 'month-trend');
    expect(insight?.text).toContain('多了 50%');
  });

  it('没有任何数据时返回空数组', () => {
    expect(buildInsights({ transactions: [], categories: [], now: NOW })).toEqual([]);
  });
});
