import { useMemo, useState } from 'react';
import { Tag } from 'lucide-react';
import { formatMoney, formatPercentage } from '../../utils/helpers';
import { summarizeExpensesByTag } from '../../domain/tagStats';
import type { Transaction } from '../../types';

const COLLAPSED_COUNT = 5;
const BAR_COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#F43F5E', '#14B8A6', '#F97316', '#6366F1'];

export default function TagStatsChart({
  transactions,
  year,
}: {
  transactions: Transaction[];
  year: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const stats = useMemo(() => summarizeExpensesByTag(transactions), [transactions]);

  // 没有标签数据时整块隐藏，不占用报表页篇幅。
  if (stats.length === 0) return null;

  const maxAmount = stats[0].amount;
  const totalAmount = stats.reduce((sum, item) => sum + item.amount, 0);
  const visible = expanded ? stats : stats.slice(0, COLLAPSED_COUNT);

  return (
    <div className="surface-card mb-4 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-semibold">
          <Tag size={16} className="text-amber-600 dark:text-amber-400" />
          {year} 年标签支出
        </div>
        <span className="text-xs text-slate-400">{stats.length} 个标签</span>
      </div>

      <div className="space-y-3">
        {visible.map((stat, index) => (
          <div key={stat.tag}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {stat.tag}
                <span className="ml-1.5 text-xs text-slate-400">{stat.count} 笔</span>
              </span>
              <span className="font-semibold">{formatMoney(stat.amount)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${maxAmount > 0 ? (stat.amount / maxAmount) * 100 : 0}%`,
                  backgroundColor: BAR_COLORS[index % BAR_COLORS.length],
                }}
              />
            </div>
            <div className="mt-0.5 text-right text-[11px] text-slate-400">
              占标签支出 {formatPercentage(totalAmount > 0 ? (stat.amount / totalAmount) * 100 : 0)}
            </div>
          </div>
        ))}
      </div>

      {stats.length > COLLAPSED_COUNT && (
        <button
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-600 active:bg-slate-200 dark:bg-slate-700/60 dark:text-slate-300 dark:active:bg-slate-700"
        >
          {expanded ? '收起' : `展开其余 ${stats.length - COLLAPSED_COUNT} 个标签`}
        </button>
      )}
    </div>
  );
}
