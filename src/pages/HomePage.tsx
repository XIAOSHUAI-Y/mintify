import { useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, FileText, BarChart3, MoreHorizontal } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Icon } from '../components/Icon';
import TransactionDetail from '../components/TransactionDetail';
import BudgetPage from '../pages/BudgetPage';
import CategoryPage from '../pages/CategoryPage';
import RecurringPage from '../pages/RecurringPage';
import { formatMoney, formatDateHeader, getMonthStart, getMonthEnd } from '../utils/helpers';
import type { Transaction } from '../types';

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
  const [showBudget, setShowBudget] = useState(false);
  const [showCategory, setShowCategory] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showLedgerSwitch, setShowLedgerSwitch] = useState(false);
  const monthInputRef = useRef<HTMLInputElement>(null);

  const monthTransactions = useMemo(() => {
    if (!currentLedger) return [];
    const start = getMonthStart(selectedDate.getTime());
    const end = getMonthEnd(selectedDate.getTime());
    return transactions
      .filter((t) => t.ledgerId === currentLedger.id && t.occurredAt >= start && t.occurredAt <= end)
      .sort((a, b) => b.occurredAt - a.occurredAt);
  }, [currentLedger, transactions, selectedDate]);

  const income = useMemo(
    () => monthTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    [monthTransactions]
  );
  const expense = useMemo(
    () => monthTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    [monthTransactions]
  );

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
    <div className="h-[calc(100vh-5rem)] flex flex-col">
      {/* Header */}
      <div className="bg-primary px-4 pt-4 pb-6 rounded-b-3xl shrink-0">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowLedgerSwitch(true)}
            className="flex items-center gap-1 text-black/80"
          >
            <span className="font-medium">{currentLedger.name}</span>
            <ChevronDown size={16} />
          </button>

          <div className="flex items-center gap-3">
            <button onClick={goPrevYear}><ChevronLeft size={18} className="text-black/60" /></button>
            <span className="text-sm">{selectedDate.getFullYear()}年</span>
            <button onClick={goNextYear}><ChevronRight size={18} className="text-black/60" /></button>
          </div>
        </div>

        <label
          htmlFor="month-picker"
          className="flex items-baseline gap-2 mb-4 cursor-pointer"
        >
          <span className="text-6xl font-bold">{String(selectedDate.getMonth() + 1).padStart(2, '0')}</span>
          <span className="text-lg">月</span>
          <ChevronDown size={20} className="text-black/60" />
          <input
            id="month-picker"
            ref={monthInputRef}
            type="month"
            value={`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`}
            onChange={(e) => {
              if (e.target.value) {
                const [year, month] = e.target.value.split('-').map(Number);
                setSelectedDate(new Date(year, month - 1, 1));
              }
            }}
            className="sr-only"
          />
        </label>

        <div className="flex">
          <div className="flex-1 text-center">
            <div className="text-sm text-black/60 mb-1">收入</div>
            <div className="text-xl font-semibold text-green-700">{formatMoney(income)}</div>
          </div>
          <div className="w-px bg-black/10"></div>
          <div className="flex-1 text-center">
            <div className="text-sm text-black/60 mb-1">支出</div>
            <div className="text-xl font-semibold text-red-600">{formatMoney(expense)}</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex py-4 bg-white shrink-0">
        <button className="flex-1 flex flex-col items-center gap-1 text-gray-700">
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50">
            <FileText size={22} className="text-yellow-600" />
          </div>
          <span className="text-xs">账单</span>
        </button>
        <button
          onClick={() => setShowBudget(true)}
          className="flex-1 flex flex-col items-center gap-1 text-gray-700"
        >
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50">
            <BarChart3 size={22} className="text-yellow-600" />
          </div>
          <span className="text-xs">预算</span>
        </button>
        <button
          onClick={() => setShowMore(true)}
          className="flex-1 flex flex-col items-center gap-1 text-gray-700"
        >
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50">
            <MoreHorizontal size={22} className="text-yellow-600" />
          </div>
          <span className="text-xs">更多</span>
        </button>
      </div>

      {/* Transaction List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {groupedTransactions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">本月还没有记账哦~</div>
        ) : (
          <div className="space-y-4">
            {groupedTransactions.map((group) => (
              <div key={group.date}>
                <div className="flex justify-between text-sm text-gray-500 mb-2">
                  <span>{formatDateHeader(group.date)}</span>
                  <span>
                    支出:{' '}
                    {formatMoney(
                      group.transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
                    )}
                  </span>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  {group.transactions.map((transaction) => {
                    const category = categories.find((c) => c.id === transaction.categoryId);
                    return (
                      <button
                        key={transaction.id}
                        onClick={() => setSelectedTransaction(transaction)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-50 last:border-0"
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                          style={{ backgroundColor: category?.color || '#9CA3AF' }}
                        >
                          <Icon name={category?.icon || 'more-horizontal'} size={18} />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-medium">{category?.name || '未分类'}</div>
                          {transaction.note && (
                            <div className="text-xs text-gray-400 truncate">{transaction.note}</div>
                          )}
                        </div>
                        <div
                          className={`font-semibold ${
                            transaction.type === 'income'
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
            ))}
          </div>
        )}
      </div>

      {selectedTransaction && (
        <TransactionDetail
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      )}

      {showBudget && <BudgetPage onClose={() => setShowBudget(false)} />}
      {showCategory && <CategoryPage onClose={() => setShowCategory(false)} />}
      {showRecurring && <RecurringPage onClose={() => setShowRecurring(false)} />}

      {showMore && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-2xl p-4 animate-in slide-in-from-bottom">
            <div className="text-center text-gray-500 text-sm mb-4">更多</div>
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => {
                  setShowMore(false);
                  setShowCategory(true);
                }}
                className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-50"
              >
                <FileText size={24} className="text-yellow-600" />
                <span className="text-xs">分类管理</span>
              </button>
              <button
                onClick={() => {
                  setShowMore(false);
                  setShowRecurring(true);
                }}
                className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-50"
              >
                <BarChart3 size={24} className="text-yellow-600" />
                <span className="text-xs">周期记账</span>
              </button>
            </div>
            <button
              onClick={() => setShowMore(false)}
              className="w-full mt-4 py-3 text-gray-500 bg-gray-100 rounded-xl"
            >
              取消
            </button>
          </div>
        </div>
      )}
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-4 animate-in slide-in-from-bottom">
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
