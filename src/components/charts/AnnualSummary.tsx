import { useMemo } from 'react';
import { formatMoney } from '../../utils/helpers';
import type { Transaction } from '../../types';

interface AnnualSummaryProps {
  transactions: Transaction[];
  year: number;
}

export default function AnnualSummary({ transactions, year }: AnnualSummaryProps) {
  const summary = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      income,
      expense,
      net: income - expense,
      count: transactions.length,
    };
  }, [transactions]);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="font-medium mb-4">{year}年汇总</div>

      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-500">总收入</span>
          <span className="font-semibold text-green-600">{formatMoney(summary.income)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">总支出</span>
          <span className="font-semibold text-red-500">{formatMoney(summary.expense)}</span>
        </div>
        <div className="flex justify-between border-t border-gray-100 pt-3">
          <span className="text-gray-500">结余</span>
          <span className={`font-semibold ${summary.net >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {formatMoney(summary.net)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">记账笔数</span>
          <span className="font-semibold">{summary.count} 笔</span>
        </div>
      </div>
    </div>
  );
}
