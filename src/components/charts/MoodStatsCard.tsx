import { useMemo } from 'react';
import { HeartHandshake } from 'lucide-react';
import { formatMoney, formatPercentage } from '../../utils/helpers';
import { MOOD_OPTIONS } from '../../domain/mood';
import type { Transaction, TransactionMood } from '../../types';

/**
 * 只统计标记了心情的支出；后悔占比的分母是“已标记支出”，
 * 否则大量未标记账单会把占比稀释到失真。
 */
export default function MoodStatsCard({
  transactions,
  yearMonth,
}: {
  transactions: Transaction[];
  yearMonth: string;
}) {
  const stats = useMemo(() => {
    const byMood = new Map<TransactionMood, { count: number; amount: number }>();
    for (const transaction of transactions) {
      if (transaction.type !== 'expense' || !transaction.mood) continue;
      const date = new Date(transaction.occurredAt);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (month !== yearMonth) continue;
      const entry = byMood.get(transaction.mood) ?? { count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += transaction.amount;
      byMood.set(transaction.mood, entry);
    }
    return byMood;
  }, [transactions, yearMonth]);

  const markedTotal = [...stats.values()].reduce((sum, entry) => sum + entry.amount, 0);
  if (markedTotal <= 0) return null;

  const regretAmount = stats.get('regret')?.amount ?? 0;
  const regretShare = (regretAmount / markedTotal) * 100;

  return (
    <div className="surface-card mb-4 p-4">
      <div className="mb-4 flex items-center gap-1.5 font-semibold">
        <HeartHandshake size={16} className="text-amber-600 dark:text-amber-400" />
        {Number(yearMonth.slice(5))} 月心情账单
      </div>

      <div className="space-y-2.5">
        {MOOD_OPTIONS.map((option) => {
          const entry = stats.get(option.value);
          return (
            <div key={option.value} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <span className="text-base">{option.emoji}</span>
                {option.label}
                {entry && <span className="text-xs text-slate-400">{entry.count} 笔</span>}
              </span>
              <span className="font-semibold">{entry ? formatMoney(entry.amount) : '--'}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-700/50">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">后悔消费占比</span>
          <span className={`font-semibold ${regretShare > 20 ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {formatPercentage(regretShare)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
          <div
            className={`h-full rounded-full ${regretShare > 20 ? 'bg-rose-400' : 'bg-emerald-400'}`}
            style={{ width: `${Math.min(regretShare, 100)}%` }}
          />
        </div>
        <div className="mt-1.5 text-[11px] text-slate-400">
          {regretShare > 20 ? '后悔占比偏高，下次下单前先放一放' : '占比按标记了心情的支出计算'}
        </div>
      </div>
    </div>
  );
}
