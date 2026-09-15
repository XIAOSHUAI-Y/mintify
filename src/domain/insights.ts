import type { Category, Transaction } from '../types';
import { formatMoney, getYearMonth } from '../utils/helpers';
import { getNetSpendingByCategory } from './transactionAccounting';

export interface Insight {
  id: string;
  emoji: string;
  text: string;
}

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WEEKDAY_PEAK_WINDOW_DAYS = 90;

interface BuildInsightsOptions {
  transactions: Transaction[];
  categories: Category[];
  /** 注入时间便于测试；生产环境传 Date.now()。 */
  now: number;
}

/**
 * 洞察只描述已发生的事实，不做财务建议；每条生成器数据不足时返回 null，
 * 因此卡片数量会随记账习惯自然增减。
 */
export function buildInsights({ transactions, categories, now }: BuildInsightsOptions): Insight[] {
  const insights: Insight[] = [];
  const currentMonth = getYearMonth(now);
  const monthExpenses = transactions.filter(
    (transaction) => transaction.type === 'expense' && getYearMonth(transaction.occurredAt) === currentMonth,
  );

  const frequent = frequentNoteInsight(monthExpenses);
  if (frequent) insights.push(frequent);

  const largest = largestExpenseInsight(monthExpenses, categories);
  if (largest) insights.push(largest);

  const weekday = weekdayPeakInsight(transactions, now);
  if (weekday) insights.push(weekday);

  const streak = streakInsight(transactions, now);
  if (streak) insights.push(streak);

  const regret = regretInsight(monthExpenses);
  if (regret) insights.push(regret);

  const trend = monthTrendInsight(transactions, currentMonth, now);
  if (trend) insights.push(trend);

  return insights;
}

/** 高频备注：同一备注本月记了 3 笔以上，往往是一个固定习惯（奶茶、咖啡、通勤）。 */
function frequentNoteInsight(monthExpenses: Transaction[]): Insight | null {
  const byNote = new Map<string, { count: number; amount: number }>();
  for (const transaction of monthExpenses) {
    const note = transaction.note.trim();
    if (!note) continue;
    const entry = byNote.get(note) ?? { count: 0, amount: 0 };
    entry.count += 1;
    entry.amount += transaction.amount;
    byNote.set(note, entry);
  }
  const top = [...byNote.entries()]
    .filter(([, entry]) => entry.count >= 3)
    .sort((a, b) => b[1].count - a[1].count || b[1].amount - a[1].amount)[0];
  if (!top) return null;
  return {
    id: 'frequent-note',
    emoji: '🔁',
    text: `本月「${top[0]}」已经记了 ${top[1].count} 笔，共 ${formatMoney(top[1].amount)}`,
  };
}

/** 本月最大单笔支出，帮助回忆大额消费去向。 */
function largestExpenseInsight(monthExpenses: Transaction[], categories: Category[]): Insight | null {
  const largest = monthExpenses.reduce<Transaction | null>(
    (max, transaction) => (max && max.amount >= transaction.amount ? max : transaction),
    null,
  );
  if (!largest) return null;
  const category = categories.find((item) => item.id === largest.categoryId);
  const name = largest.note.trim() || category?.name || '未分类';
  return {
    id: 'largest-expense',
    emoji: '🧨',
    text: `本月最大一笔支出是「${name}」的 ${formatMoney(largest.amount)}`,
  };
}

/** 星期峰值用近 90 天而不是本月，样本太小（不足 10 笔）时跳过。 */
function weekdayPeakInsight(transactions: Transaction[], now: number): Insight | null {
  const windowStart = now - WEEKDAY_PEAK_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const totals = new Array(7).fill(0) as number[];
  let count = 0;
  for (const transaction of transactions) {
    if (transaction.type !== 'expense' || transaction.occurredAt < windowStart) continue;
    totals[new Date(transaction.occurredAt).getDay()] += transaction.amount;
    count += 1;
  }
  if (count < 10) return null;
  const peakDay = totals.indexOf(Math.max(...totals));
  return {
    id: 'weekday-peak',
    emoji: '📅',
    text: `「${WEEKDAY_NAMES[peakDay]}」是你花钱最多的日子，近 ${WEEKDAY_PEAK_WINDOW_DAYS} 天共 ${formatMoney(totals[peakDay])}`,
  };
}

/** 连续记账天数：今天还没记时不算断签，从昨天往回数。 */
function streakInsight(transactions: Transaction[], now: number): Insight | null {
  const days = new Set(
    transactions.map((transaction) => {
      const date = new Date(transaction.occurredAt);
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    }),
  );
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  const keyOf = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  if (!days.has(keyOf(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (days.has(keyOf(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  if (streak < 3) return null;
  return {
    id: 'streak',
    emoji: '🔥',
    text: `已连续记账 ${streak} 天，继续保持`,
  };
}

/** 后悔消费：和记支出时的心情标记联动。 */
function regretInsight(monthExpenses: Transaction[]): Insight | null {
  const regrets = monthExpenses.filter((transaction) => transaction.mood === 'regret');
  if (regrets.length === 0) return null;
  const amount = regrets.reduce((sum, transaction) => sum + transaction.amount, 0);
  return {
    id: 'regret',
    emoji: '😮‍💨',
    text: `本月有 ${regrets.length} 笔支出被标记为后悔，共 ${formatMoney(amount)}`,
  };
}

/** 环比只提示 ≥10% 的变化，小波动没有信息量。 */
function monthTrendInsight(transactions: Transaction[], currentMonth: string, now: number): Insight | null {
  const previousMonth = getYearMonth(new Date(new Date(now).getFullYear(), new Date(now).getMonth() - 1, 1).getTime());
  const current = [...getNetSpendingByCategory(transactions, currentMonth).values()]
    .reduce((sum, amount) => sum + amount, 0);
  const previous = [...getNetSpendingByCategory(transactions, previousMonth).values()]
    .reduce((sum, amount) => sum + amount, 0);
  if (previous <= 0 || current <= 0) return null;
  const change = (current - previous) / previous;
  if (Math.abs(change) < 0.1) return null;
  const percentage = Math.round(Math.abs(change) * 100);
  return {
    id: 'month-trend',
    emoji: change < 0 ? '📉' : '📈',
    text: change < 0
      ? `本月净支出比上月少了 ${percentage}%，保持得不错`
      : `本月净支出比上月多了 ${percentage}%，留意一下`,
  };
}
