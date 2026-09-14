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
          <span className="text-gray-500 dark:text-slate-400">总收入</span>
          <span className="font-semibold text-green-600 dark:text-green-400">{formatMoney(summary.income)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-slate-400">净支出</span>
          <span className="font-semibold text-red-500 dark:text-red-400">{formatMoney(summary.netExpense)}</span>
        </div>
        {summary.refunds > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-slate-400">退款冲减</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">+{formatMoney(summary.refunds)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-gray-100 pt-3 dark:border-slate-700/50">
          <span className="text-gray-500 dark:text-slate-400">结余</span>
          <span className={`font-semibold ${summary.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
            {formatMoney(summary.net)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-slate-400">记账笔数</span>
          <span className="font-semibold">{summary.count} 笔</span>
        </div>
      </div>
    </div>
  );
}
