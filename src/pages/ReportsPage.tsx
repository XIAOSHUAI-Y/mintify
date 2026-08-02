import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import MonthlyPieChart from '../components/charts/MonthlyPieChart';
import TrendChart from '../components/charts/TrendChart';
import AnnualSummary from '../components/charts/AnnualSummary';
import BudgetUsageChart from '../components/charts/BudgetUsageChart';
import { formatMoney } from '../utils/helpers';
import { summarizeTransactions } from '../domain/transactionAccounting';

export default function ReportsPage() {
  const { currentLedger, transactions, categories, budgets } = useApp();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const selectedMonth = new Date().getMonth();

  const yearlyTransactions = useMemo(() => {
    if (!currentLedger) return [];
    return transactions.filter((t) => {
      const date = new Date(t.occurredAt);
      return date.getFullYear() === selectedYear && t.ledgerId === currentLedger.id;
    });
  }, [currentLedger, transactions, selectedYear]);

  const summary = useMemo(() => {
    return summarizeTransactions(yearlyTransactions);
  }, [yearlyTransactions]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 pb-28">
      <header className="safe-top mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">收支图表</h1>
          <p className="mt-1 text-sm text-slate-500">看清每一笔钱的去向</p>
        </div>
        <div className="flex items-center rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-100">
          <button aria-label="上一年" onClick={() => setSelectedYear((y) => y - 1)} className="icon-button !h-9 !w-9">
            <ChevronLeft size={17} />
          </button>
          <div className="min-w-16 text-center text-sm font-semibold">{selectedYear}</div>
          <button aria-label="下一年" onClick={() => setSelectedYear((y) => y + 1)} className="icon-button !h-9 !w-9">
            <ChevronRight size={17} />
          </button>
        </div>
      </header>

      <section className="mb-4 overflow-hidden rounded-[1.5rem] border border-amber-100 bg-gradient-to-br from-amber-100 via-amber-50 to-white p-5 shadow-[0_14px_34px_rgba(245,158,11,0.10)]">
        <div className="text-xs font-medium text-amber-800/70">{selectedYear} 年结余</div>
        <div className={`mt-1 text-3xl font-bold tracking-tight ${summary.balance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
          {formatMoney(summary.balance)}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-emerald-100 bg-white/80 px-3 py-2.5 shadow-sm">
            <div className="text-xs text-slate-500">总收入</div>
            <div className="mt-0.5 font-semibold text-emerald-600">{formatMoney(summary.income)}</div>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-white/80 px-3 py-2.5 shadow-sm">
            <div className="text-xs text-slate-500">净支出</div>
            <div className="mt-0.5 font-semibold text-rose-500">{formatMoney(summary.netExpense)}</div>
          </div>
        </div>
      </section>

      <MonthlyPieChart
        transactions={transactions.filter((transaction) => transaction.ledgerId === currentLedger?.id)}
        categories={categories}
        yearMonth={`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`}
        title={`${selectedMonth + 1} 月支出构成`}
      />

      <TrendChart transactions={yearlyTransactions} year={selectedYear} />

      {currentLedger && (
        <BudgetUsageChart
          budgets={budgets}
          transactions={transactions}
          categories={categories}
          ledgerId={currentLedger.id}
          year={selectedYear}
        />
      )}

      <AnnualSummary transactions={yearlyTransactions} year={selectedYear} />
    </div>
  );
}
