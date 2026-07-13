import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useMemo } from 'react';
import { formatMoney } from '../../utils/helpers';
import type { Transaction, Category } from '../../types';

interface MonthlyPieChartProps {
  transactions: Transaction[];
  categories: Category[];
}

export default function MonthlyPieChart({ transactions, categories }: MonthlyPieChartProps) {
  const data = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === 'expense');
    const grouped: Record<string, { name: string; value: number; color: string }> = {};

    for (const t of expenses) {
      const category = categories.find((c) => c.id === t.categoryId);
      const key = category?.name || '未分类';
      if (!grouped[key]) {
        grouped[key] = { name: key, value: 0, color: category?.color || '#9CA3AF' };
      }
      grouped[key].value += t.amount;
    }

    return Object.values(grouped)
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [transactions, categories]);

  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
        <div className="font-medium mb-4">本月支出构成</div>
        <div className="h-48 flex items-center justify-center text-gray-400">暂无支出数据</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
      <div className="font-medium mb-4">本月支出构成</div>

      <div className="h-56 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-xs text-gray-500">总支出</div>
          <div className="text-lg font-bold">{formatMoney(total)}</div>
        </div>
      </div>

      <div className="space-y-2 mt-2">
        {data.slice(0, 6).map((item) => (
          <div key={item.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-sm">{item.name}</span>
            </div>
            <span className="text-sm text-gray-500">{formatMoney(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
