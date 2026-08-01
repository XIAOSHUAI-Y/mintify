import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import MonthlyPieChart from '../components/charts/MonthlyPieChart';
import TrendChart from '../components/charts/TrendChart';
import AnnualSummary from '../components/charts/AnnualSummary';
import { formatMoney } from '../utils/helpers';

export default function ReportsPage() {
  const { currentLedger, transactions, categories } = useApp();
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
    const income = yearlyTransactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = yearlyTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, balance: income - expense };
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

      <section className="mb-4 overflow-hidden rounded-[1.5rem] bg-slate-900 p-5 text-white shadow-xl shadow-slate-200">
        <div className="text-xs text-white/60">{selectedYear} 年结余</div>
        <div className="mt-1 text-3xl font-bold tracking-tight">{formatMoney(summary.balance)}</div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 px-3 py-2.5">
            <div className="text-xs text-white/50">总收入</div>
            <div className="mt-0.5 font-semibold text-emerald-300">{formatMoney(summary.income)}</div>
          </div>
          <div className="rounded-2xl bg-white/10 px-3 py-2.5">
            <div className="text-xs text-white/50">总支出</div>
            <div className="mt-0.5 font-semibold text-rose-300">{formatMoney(summary.expense)}</div>
          </div>
        </div>
      </section>

      <MonthlyPieChart
        transactions={yearlyTransactions.filter((t) => {
          return new Date(t.occurredAt).getMonth() === selectedMonth;
        })}
        categories={categories}
        title={`${selectedMonth + 1} 月支出构成`}
      />

      <TrendChart transactions={yearlyTransactions} year={selectedYear} />

      <AnnualSummary transactions={yearlyTransactions} year={selectedYear} />
    </div>
  );
}
