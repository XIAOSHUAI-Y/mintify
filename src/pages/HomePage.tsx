import { useMemo, useState } from 'react';
import { CalendarClock, ChevronDown, ChevronLeft, ChevronRight, Shapes, Repeat2, WalletCards } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Icon } from '../components/Icon';
import TransactionDetail from '../components/TransactionDetail';
import CategoryPage from '../pages/CategoryPage';
import RecurringPage from '../pages/RecurringPage';
import FundPage from '../pages/FundPage';
import { formatMoney, formatDateHeader, getMonthStart, getMonthEnd } from '../utils/helpers';
import type { Transaction } from '../types';
import { isRefund, summarizeTransactions } from '../domain/transactionAccounting';

export default function HomePage() {
  const {
    currentLedger,
    ledgers,
    transactions,
    categories,
    isLoading,
    setCurrentLedger,
  } = useApp();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showCategory, setShowCategory] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [showFund, setShowFund] = useState(false);
  const [showLedgerSwitch, setShowLedgerSwitch] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const monthTransactions = useMemo(() => {
    if (!currentLedger) return [];
    const start = getMonthStart(selectedDate.getTime());
    const end = getMonthEnd(selectedDate.getTime());
    return transactions
      .filter((t) => t.ledgerId === currentLedger.id && t.occurredAt >= start && t.occurredAt <= end)
      .sort((a, b) => b.occurredAt - a.occurredAt);
  }, [currentLedger, transactions, selectedDate]);

  const summary = useMemo(() => summarizeTransactions(monthTransactions), [monthTransactions]);

  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    for (const t of monthTransactions) {
      const date = new Date(t.occurredAt);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return Object.entries(groups)
      .sort((a, b) => new Date(b[1][0].occurredAt).getTime() - new Date(a[1][0].occurredAt).getTime())
      .map(([_, items]) => ({
        date: items[0].occurredAt,
        transactions: items,
      }));
  }, [monthTransactions]);

  const goPrevYear = () => {
    const d = new Date(selectedDate);
    d.setFullYear(d.getFullYear() - 1);
    setSelectedDate(d);
  };

  const goNextYear = () => {
    const d = new Date(selectedDate);
    d.setFullYear(d.getFullYear() + 1);
    setSelectedDate(d);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!currentLedger) {
    return (
      <div className="flex items-center justify-center h-screen p-4">
        <div className="text-gray-500 text-center">请先创建一个账本</div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100svh-5.5rem)] bg-slate-50 pb-4">
      <header className="safe-top px-4 pb-3">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => setShowLedgerSwitch(true)}
            className="flex min-h-11 items-center gap-1 rounded-full px-2 text-slate-800 active:bg-slate-100"
          >
            <WalletCards size={18} className="text-amber-600" />
            <span className="font-semibold">{currentLedger.name}</span>
            <ChevronDown size={16} />
          </button>

          <div className="flex items-center rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-100">
            <button aria-label="上一年" onClick={goPrevYear} className="icon-button !h-9 !w-9"><ChevronLeft size={17} /></button>
            <span className="min-w-14 text-center text-sm font-medium">{selectedDate.getFullYear()}</span>
            <button aria-label="下一年" onClick={goNextYear} className="icon-button !h-9 !w-9"><ChevronRight size={17} /></button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[1.5rem] bg-primary p-5 shadow-[0_16px_36px_rgba(250,204,21,0.22)]">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <div className="mb-1 text-sm text-black/55">本月结余</div>
              <div className="text-3xl font-bold tracking-tight">{formatMoney(summary.balance)}</div>
            </div>
            <button
              onClick={() => setShowMonthPicker(true)}
              className="flex min-h-11 items-center gap-1 rounded-full bg-black/5 px-3 text-sm font-semibold active:bg-black/10"
            >
              {String(selectedDate.getMonth() + 1).padStart(2, '0')} 月
              <ChevronDown size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/55 px-3 py-2.5">
              <div className="text-xs text-black/50">收入</div>
              <div className="mt-0.5 font-semibold text-emerald-700">{formatMoney(summary.income)}</div>
            </div>
            <div className="rounded-2xl bg-white/55 px-3 py-2.5">
              <div className="text-xs text-black/50">净支出</div>
              <div className="mt-0.5 font-semibold text-rose-600">{formatMoney(summary.netExpense)}</div>
            </div>
          </div>
          {summary.refunds > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-white/45 px-3 py-2 text-xs">
              <span className="text-black/50">已冲减退款</span>
              <span className="font-semibold text-amber-800">+{formatMoney(summary.refunds)}</span>
            </div>
          )}
        </div>
      </header>

      <section aria-label="快捷功能" className="grid grid-cols-3 gap-2 px-4 py-3">
        <button onClick={() => setShowCategory(true)} className="surface-card flex min-h-20 flex-col items-center justify-center gap-1.5 text-slate-700 active:scale-[0.98]">
          <Shapes size={21} className="text-amber-600" />
          <span className="text-xs font-medium">分类</span>
        </button>
        <button onClick={() => setShowRecurring(true)} className="surface-card flex min-h-20 flex-col items-center justify-center gap-1.5 text-slate-700 active:scale-[0.98]">
          <Repeat2 size={21} className="text-amber-600" />
          <span className="text-xs font-medium">周期</span>
        </button>
        <button
          onClick={() => setShowFund(true)}
          className="surface-card flex min-h-20 flex-col items-center justify-center gap-1.5 text-slate-700 active:scale-[0.98]"
        >
          <CalendarClock size={21} className="text-amber-600" />
          <span className="text-xs font-medium">资金</span>
        </button>
      </section>

      <section className="px-4 pb-4">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-base font-bold text-slate-900">本月明细</h1>
          <span className="text-xs text-slate-400">{monthTransactions.length} 笔</span>
        </div>
        {groupedTransactions.length === 0 ? (
          <div className="surface-card py-12 text-center">
            <div className="text-sm font-medium text-slate-500">本月还没有账单</div>
            <div className="mt-1 text-xs text-slate-400">点击下方 + 开始第一笔记录</div>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedTransactions.map((group) => {
              const daySummary = summarizeTransactions(group.transactions);
              return (
              <div key={group.date}>
                <div className="flex justify-between text-sm text-gray-500 mb-2">
                  <span>{formatDateHeader(group.date)}</span>
                  <span>
                    {daySummary.income > 0 && <span className="text-emerald-600">收入 +{formatMoney(daySummary.income)}</span>}
                    {daySummary.income > 0 && (daySummary.grossExpense > 0 || daySummary.refunds > 0) && <span> · </span>}
                    {daySummary.grossExpense > 0 && <span>支出 {formatMoney(daySummary.grossExpense)}</span>}
                    {daySummary.grossExpense > 0 && daySummary.refunds > 0 && <span> · </span>}
                    {daySummary.refunds > 0 && <span className="text-amber-700">退款 +{formatMoney(daySummary.refunds)}</span>}
                  </span>
                </div>
                <div className="surface-card overflow-hidden">
                  {group.transactions.map((transaction) => {
                    const category = categories.find((c) => c.id === transaction.categoryId);
                    return (
                      <button
                        key={transaction.id}
                        onClick={() => setSelectedTransaction(transaction)}
                        className="flex min-h-16 w-full items-center gap-3 border-b border-slate-100 px-4 py-3 transition-colors last:border-0 active:bg-slate-50"
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                          style={{ backgroundColor: category?.color || '#9CA3AF' }}
                        >
                          <Icon name={category?.icon || 'more-horizontal'} size={18} />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-medium">{isRefund(transaction) ? '退款' : category?.name || '未分类'}</div>
                          {transaction.note && (
                            <div className="text-xs text-gray-400 truncate">{transaction.note}</div>
                          )}
                        </div>
                        <div
                          className={`font-semibold ${
                            isRefund(transaction)
                              ? 'text-amber-700'
                              : transaction.type === 'income'
                              ? 'text-green-600'
                              : transaction.type === 'expense'
                              ? 'text-red-500'
                              : 'text-blue-500'
                          }`}
                        >
                          {transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : ''}
                          {formatMoney(transaction.amount).replace('¥', '')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </section>

      {selectedTransaction && (
        <TransactionDetail
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      )}

      {showCategory && <CategoryPage onClose={() => setShowCategory(false)} />}
      {showRecurring && <RecurringPage onClose={() => setShowRecurring(false)} />}
      {showFund && <FundPage onClose={() => setShowFund(false)} />}

      {showLedgerSwitch && (
        <LedgerSwitch
          ledgers={ledgers}
          currentLedger={currentLedger}
          onSelect={async (ledgerId) => {
            await setCurrentLedger(ledgerId);
            setShowLedgerSwitch(false);
          }}
          onClose={() => setShowLedgerSwitch(false)}
        />
      )}
      {showMonthPicker && (
        <MonthPicker
          selectedDate={selectedDate}
          onSelect={(date) => {
            setSelectedDate(date);
            setShowMonthPicker(false);
          }}
          onClose={() => setShowMonthPicker(false)}
        />
      )}
    </div>
  );
}

function MonthPicker({
  selectedDate,
  onSelect,
  onClose,
}: {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
}) {
  const [year, setYear] = useState(selectedDate.getFullYear());
  const selectedMonth = selectedDate.getMonth();

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="text-center text-gray-500 text-sm mb-4">选择月份</div>

        <div className="flex items-center justify-between mb-4 px-4">
          <button onClick={() => setYear((y) => y - 1)}><ChevronLeft size={24} /></button>
          <span className="text-lg font-medium">{year}年</span>
          <button onClick={() => setYear((y) => y + 1)}><ChevronRight size={24} /></button>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-4">
          {Array.from({ length: 12 }, (_, i) => (
            <button
              key={i}
              onClick={() => onSelect(new Date(year, i, 1))}
              className={`py-3 rounded-xl text-sm font-medium ${
                year === selectedDate.getFullYear() && i === selectedMonth
                  ? 'bg-primary text-black'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {i + 1}月
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 text-gray-500 bg-gray-100 rounded-xl"
        >
          取消
        </button>
      </div>
    </div>
  );
}

function LedgerSwitch({
  ledgers,
  currentLedger,
  onSelect,
  onClose,
}: {
  ledgers: { id: string; name: string; icon: string; color: string }[];
  currentLedger: { id: string; name: string } | null;
  onSelect: (ledgerId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="text-center text-gray-500 text-sm mb-4">切换账本</div>
        <div className="space-y-2 mb-4">
          {ledgers.map((ledger) => (
            <button
              key={ledger.id}
              onClick={() => onSelect(ledger.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl ${
                currentLedger?.id === ledger.id ? 'bg-primary/10' : 'hover:bg-gray-50'
              }`}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                style={{ backgroundColor: ledger.color }}
              >
                <Icon name={ledger.icon} size={18} />
              </div>
              <span className="flex-1 text-left">{ledger.name}</span>
              {currentLedger?.id === ledger.id && (
                <span className="text-xs text-gray-500">当前</span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full py-3 text-gray-500 bg-gray-100 rounded-xl"
        >
          取消
        </button>
      </div>
    </div>
  );
}
