import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts';
import type { Transaction } from '../../types';
import { summarizeTransactions } from '../../domain/transactionAccounting';

interface TrendChartProps {
  transactions: Transaction[];
  year: number;
}

export default function TrendChart({ transactions, year }: TrendChartProps) {
  const data = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const start = new Date(year, i, 1).getTime();
      const end = new Date(year, i + 1, 0, 23, 59, 59, 999).getTime();
      const monthTransactions = transactions.filter((t) => t.occurredAt >= start && t.occurredAt <= end);
      const summary = summarizeTransactions(monthTransactions);

      return {
        month: `${month}月`,
        income: summary.income,
        expense: summary.netExpense,
      };
    });
  }, [transactions, year]);

  const hasData = data.some((d) => d.income > 0 || d.expense > 0);

  if (!hasData) {
    return (
      <div className="surface-card mb-4 p-4">
        <div className="mb-4 font-semibold">月度收支趋势</div>
        <div className="flex h-40 items-center justify-center text-sm text-slate-400">暂无数据</div>
      </div>
    );
  }

  return (
    <div className="surface-card mb-4 p-4">
      <div className="mb-4 font-semibold">月度收支趋势</div>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 2, left: -24, bottom: 0 }} barGap={1}>
            <XAxis dataKey="month" axisLine={false} tickLine={false} interval={1} tick={{ fontSize: 11, fill: '#94A3B8' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} width={52} />
            <Legend />
            <Bar dataKey="income" name="收入" fill="#10B981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="支出" fill="#FB7185" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
