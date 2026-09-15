import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import MonthlyPieChart from '../components/charts/MonthlyPieChart';
import TrendChart from '../components/charts/TrendChart';
import AnnualSummary from '../components/charts/AnnualSummary';
import BudgetUsageChart from '../components/charts/BudgetUsageChart';
import TagStatsChart from '../components/charts/TagStatsChart';
import InsightsCarousel from '../components/charts/InsightsCarousel';
import MoodStatsCard from '../components/charts/MoodStatsCard';
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

  const currentYear = new Date().getFullYear();
  const pieYearMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-slate-50 px-4 pb-28 dark:bg-slate-900">
      <header className="safe-top mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight dark:text-slate-50">收支图表</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">看清每一笔钱的去向</p>
        </div>
        <div className="flex items-center rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700">
          <button aria-label="上一年" onClick={() => setSelectedYear((y) => y - 1)} className="icon-button !h-9 !w-9">
            <ChevronLeft size={17} />
          </button>
          <div className="min-w-16 text-center text-sm font-semibold">{selectedYear}</div>
          <button aria-label="下一年" onClick={() => setSelectedYear((y) => y + 1)} className="icon-button !h-9 !w-9">
            <ChevronRight size={17} />
          </button>
        </div>
      </header>

      <section className="mb-4 overflow-hidden rounded-[1.5rem] border border-amber-100 bg-gradient-to-br from-amber-100 via-amber-50 to-white p-5 shadow-[0_14px_34px_rgba(245,158,11,0.10)] dark:border-amber-400/20 dark:from-amber-400/15 dark:via-amber-400/5 dark:to-slate-800">
        <div className="text-xs font-medium text-amber-800/70 dark:text-amber-300/80">{selectedYear} 年结余</div>
        <div className={`mt-1 text-3xl font-bold tracking-tight ${summary.balance >= 0 ? 'text-slate-900 dark:text-slate-50' : 'text-rose-600 dark:text-rose-400'}`}>
          {formatMoney(summary.balance)}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-emerald-100 bg-white/80 px-3 py-2.5 shadow-sm dark:border-emerald-400/20 dark:bg-slate-800/80">
            <div className="text-xs text-slate-500 dark:text-slate-400">总收入</div>
            <div className="mt-0.5 font-semibold text-emerald-600 dark:text-emerald-400">{formatMoney(summary.income)}</div>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-white/80 px-3 py-2.5 shadow-sm dark:border-rose-400/20 dark:bg-slate-800/80">
            <div className="text-xs text-slate-500 dark:text-slate-400">净支出</div>
            <div className="mt-0.5 font-semibold text-rose-500 dark:text-rose-400">{formatMoney(summary.netExpense)}</div>
          </div>
        </div>
      </section>

      {selectedYear === currentYear && currentLedger && (
        <InsightsCarousel
          transactions={transactions.filter((transaction) => transaction.ledgerId === currentLedger.id)}
          categories={categories}
        />
      )}

      <MonthlyPieChart
        transactions={transactions.filter((transaction) => transaction.ledgerId === currentLedger?.id)}
        categories={categories}
        yearMonth={pieYearMonth}
        title={`${selectedMonth + 1} 月支出构成`}
      />

      <MoodStatsCard
        transactions={transactions.filter((transaction) => transaction.ledgerId === currentLedger?.id)}
        yearMonth={pieYearMonth}
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

      <TagStatsChart transactions={yearlyTransactions} year={selectedYear} />
    </div>
  );
}
