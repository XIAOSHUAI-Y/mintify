import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts';
import type { Transaction } from '../../types';

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

      return {
        month: `${month}月`,
        income: monthTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
        expense: monthTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      };
    });
  }, [transactions, year]);

  const hasData = data.some((d) => d.income > 0 || d.expense > 0);

  if (!hasData) {
    return (
      <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
        <div className="font-medium mb-4">月度收支趋势</div>
        <div className="h-48 flex items-center justify-center text-gray-400">暂无数据</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
      <div className="font-medium mb-4">月度收支趋势</div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
            <Legend />
            <Bar dataKey="income" name="收入" fill="#22C55E" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="支出" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
