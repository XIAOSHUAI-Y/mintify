import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, Cell, Legend, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { buildMonthlyBudgetOverview, type BudgetChange, type SpendingChange } from '../../domain/budgetAnalytics';
import { formatMoney } from '../../utils/helpers';
import type { Budget, Category, Transaction } from '../../types';
import HorizontalScrollArea from '../HorizontalScrollArea';

interface BudgetUsageChartProps {
  budgets: Budget[];
  transactions: Transaction[];
  categories: Category[];
  ledgerId: string;
  year: number;
}

export default function BudgetUsageChart({
  budgets,
  transactions,
  categories,
  ledgerId,
  year,
}: BudgetUsageChartProps) {
  const overview = useMemo(() => buildMonthlyBudgetOverview({ budgets, transactions, ledgerId, year }), [
    budgets,
    transactions,
    ledgerId,
    year,
  ]);
  const [selectedMonth, setSelectedMonth] = useState(() => getDefaultMonth(year, overview));

  useEffect(() => {
    setSelectedMonth(getDefaultMonth(year, overview));
  }, [year, overview]);

  const selected = overview[selectedMonth - 1];
  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const chartData = overview.map((month) => ({
    ...month,
    label: `${month.month}月`,
  }));
  const hasData = overview.some((month) => month.budgetAmount > 0 || month.spentAmount > 0);

  return (
    <section className="surface-card mb-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">月度预算使用</div>
          <div className="mt-1 text-xs text-slate-400">对比预算与实际支出，红色表示超支</div>
        </div>
        <YearStatus overview={overview} />
      </div>

      {hasData ? (
        <>
          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 0, left: -28, bottom: 0 }} barGap={1}>
                <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} tick={{ fontSize: 9, fill: '#94A3B8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} width={48} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="budgetAmount" name="预算" fill="#FBBF24" radius={[4, 4, 0, 0]} maxBarSize={9} />
                <Bar dataKey="spentAmount" name="支出" radius={[4, 4, 0, 0]} maxBarSize={9}>
                  {chartData.map((entry) => (
                    <Cell key={entry.yearMonth} fill={entry.status === 'overspent' ? '#F43F5E' : '#10B981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <HorizontalScrollArea className="mt-2 flex gap-1.5 overflow-x-auto pb-1 pr-8">
            {overview.map((month) => (
              <button
                key={month.yearMonth}
                onClick={() => setSelectedMonth(month.month)}
                className={`shrink-0 rounded-full px-2.5 py-1.5 text-xs font-medium ${
                  selectedMonth === month.month
                    ? 'bg-slate-900 text-white'
                    : month.status === 'overspent'
                      ? 'bg-rose-50 text-rose-600'
                      : 'bg-slate-50 text-slate-500'
                }`}
              >
                {month.month}月
              </button>
            ))}
          </HorizontalScrollArea>

          <MonthDetail month={selected} categoryNames={categoryNames} />
        </>
      ) : (
        <div className="flex h-40 items-center justify-center text-sm text-slate-400">暂无预算数据</div>
      )}
    </section>
  );
}

function YearStatus({ overview }: { overview: ReturnType<typeof buildMonthlyBudgetOverview> }) {
  const overspentCount = overview.filter((month) => month.status === 'overspent').length;
  const changedCount = overview.filter((month) => month.budgetChanges.length > 0).length;
  return (
    <div className="shrink-0 text-right text-[11px] leading-5 text-slate-400">
      <div className={overspentCount > 0 ? 'text-rose-500' : 'text-emerald-600'}>
        {overspentCount > 0 ? `超支 ${overspentCount} 个月` : '暂无超支'}
      </div>
      <div>调整 {changedCount} 个月</div>
    </div>
  );
}

function MonthDetail({
  month,
  categoryNames,
}: {
  month: ReturnType<typeof buildMonthlyBudgetOverview>[number];
  categoryNames: Map<string, string>;
}) {
  const spendingChanges = [...month.spendingChanges]
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));
  const visibleSpendingChanges = spendingChanges.slice(0, 3);
  const usage = month.utilization === null ? 0 : Math.min(month.utilization, 100);

  return (
    <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{month.month} 月预算</div>
          <div className="mt-1 text-xs text-slate-500">
            已用 {formatMoney(month.spentAmount)} / {formatMoney(month.budgetAmount)}
          </div>
        </div>
        <StatusBadge status={month.status} utilization={month.utilization} />
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div
          className={`h-full rounded-full ${month.status === 'overspent' ? 'bg-rose-500' : 'bg-emerald-500'}`}
          style={{ width: `${usage}%` }}
        />
      </div>

      <ChangeGroup
        title="预算配置"
        emptyText="与上月一致"
        items={month.budgetChanges}
        renderItem={(change) => formatBudgetChange(change, categoryNames)}
      />
      <ChangeGroup
        title="支出环比"
        emptyText="与上月一致"
        items={visibleSpendingChanges}
        extraCount={spendingChanges.length - visibleSpendingChanges.length}
        renderItem={(change) => formatSpendingChange(change, categoryNames)}
      />
    </div>
  );
}

function StatusBadge({ status, utilization }: { status: 'no-budget' | 'on-track' | 'overspent'; utilization: number | null }) {
  if (status === 'no-budget') {
    return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">未设置</span>;
  }
  if (status === 'overspent') {
    return <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-600">超支 {Math.round(utilization ?? 0)}%</span>;
  }
  return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">已用 {Math.round(utilization ?? 0)}%</span>;
}

function ChangeGroup<T>({
  title,
  emptyText,
  items,
  extraCount = 0,
  renderItem,
}: {
  title: string;
  emptyText: string;
  items: T[];
  extraCount?: number;
  renderItem: (item: T) => string;
}) {
  return (
    <div className="mt-3 border-t border-slate-200/70 pt-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600">{title}</span>
        {items.length === 0 && <span className="text-slate-400">{emptyText}</span>}
      </div>
      {items.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item, index) => (
            <span key={`${title}-${index}`} className="rounded-lg bg-white px-2 py-1 text-[11px] leading-4 text-slate-600 shadow-sm">
              {renderItem(item)}
            </span>
          ))}
          {extraCount > 0 && (
            <span className="rounded-lg bg-white px-2 py-1 text-[11px] text-slate-400 shadow-sm">另 {extraCount} 项</span>
          )}
        </div>
      )}
    </div>
  );
}

function formatBudgetChange(change: BudgetChange, categoryNames: Map<string, string>): string {
  const name = change.key === 'overall' ? '总预算' : categoryNames.get(change.key) ?? '已删除分类';
  if (change.kind === 'added') return `${name} 新增 ${formatMoney(change.currentAmount)}`;
  if (change.kind === 'removed') return `${name} 已取消`;
  return `${name} ${formatSignedMoney(change.delta)}`;
}

function formatSpendingChange(change: SpendingChange, categoryNames: Map<string, string>): string {
  const name = categoryNames.get(change.categoryId) ?? '已删除分类';
  return `${name} ${formatSignedMoney(change.delta)}`;
}

function formatSignedMoney(amount: number): string {
  return `${amount > 0 ? '+' : ''}${formatMoney(amount)}`;
}

function getDefaultMonth(year: number, overview: ReturnType<typeof buildMonthlyBudgetOverview>): number {
  if (year === new Date().getFullYear()) return new Date().getMonth() + 1;
  return [...overview].reverse().find((month) => month.budgetAmount > 0 || month.spentAmount > 0)?.month ?? 12;
}
