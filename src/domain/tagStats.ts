import type { Transaction } from '../types';

export interface TagStat {
  tag: string;
  amount: number;
  count: number;
}

/**
 * 支出按标签归集：一笔账单挂了多个标签时，金额分别计入每个标签，
 * 因此各标签合计可能大于总支出——标签是“视角”，不是瓜分。
 */
export function summarizeExpensesByTag(transactions: Transaction[]): TagStat[] {
  const stats = new Map<string, TagStat>();
  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;
    for (const tag of transaction.tags) {
      const stat = stats.get(tag) ?? { tag, amount: 0, count: 0 };
      stat.amount += transaction.amount;
      stat.count += 1;
      stats.set(tag, stat);
    }
  }
  return [...stats.values()].sort((a, b) => b.amount - a.amount);
}
