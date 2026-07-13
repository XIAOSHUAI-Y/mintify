import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import MonthlyPieChart from '../components/charts/MonthlyPieChart';
import TrendChart from '../components/charts/TrendChart';
import AnnualSummary from '../components/charts/AnnualSummary';
import { getYearMonth } from '../utils/helpers';

export default function ReportsPage() {
  const { currentLedger, transactions, categories } = useApp();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const yearlyTransactions = useMemo(() => {
    if (!currentLedger) return [];
    return transactions.filter((t) => {
      const date = new Date(t.occurredAt);
      return date.getFullYear() === selectedYear && t.ledgerId === currentLedger.id;
    });
  }, [currentLedger, transactions, selectedYear]);

  return (
    <div className="min-h-screen p-4 pb-24 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setSelectedYear((y) => y - 1)}>
          <ChevronLeft size={24} />
        </button>
        <div className="text-lg font-bold">{selectedYear}年</div>
        <button onClick={() => setSelectedYear((y) => y + 1)}>
          <ChevronRight size={24} />
        </button>
      </div>

      <MonthlyPieChart
        transactions={yearlyTransactions.filter((t) => {
          const now = new Date();
          return getYearMonth(t.occurredAt) === getYearMonth(now.getTime());
        })}
        categories={categories}
      />

      <TrendChart transactions={yearlyTransactions} year={selectedYear} />

      <AnnualSummary transactions={yearlyTransactions} year={selectedYear} />
    </div>
  );
}
