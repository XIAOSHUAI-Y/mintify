import { useMemo } from 'react';
import { formatMoney } from '../../utils/helpers';
import type { Transaction } from '../../types';
import { summarizeTransactions } from '../../domain/transactionAccounting';

interface AnnualSummaryProps {
  transactions: Transaction[];
  year: number;
}

export default function AnnualSummary({ transactions, year }: AnnualSummaryProps) {
  const summary = useMemo(() => {
    const totals = summarizeTransactions(transactions);
    return {
      ...totals,
      net: totals.balance,
      count: transactions.length,
    };
  }, [transactions]);

  return (
    <div className="surface-card p-4">
      <div className="mb-4 font-semibold">{year} 年账单概览</div>

      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-500">总收入</span>
          <span className="font-semibold text-green-600">{formatMoney(summary.income)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">净支出</span>
          <span className="font-semibold text-red-500">{formatMoney(summary.netExpense)}</span>
        </div>
        {summary.refunds > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-500">退款冲减</span>
            <span className="font-semibold text-amber-600">+{formatMoney(summary.refunds)}</span>
          </div>
        )}
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
