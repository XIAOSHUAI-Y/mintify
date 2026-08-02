import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  BarChart3,
  Car,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  House,
  List,
  ReceiptText,
  ShoppingBag,
  WalletCards,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import FundRecordForm, { type FundRecordFormMode } from '../components/FundRecordForm';
import {
  buildFundExpenseBreakdown,
  buildFundMonthlyTrend,
  summarizeFundMonth,
} from '../domain/fundLedger';
import { isRefund } from '../domain/transactionAccounting';
import { formatMoney, getYearMonth } from '../utils/helpers';
import type { FundTransaction } from '../types';

interface FundPageProps {
  onClose: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  生活费: '#F59E0B',
  车贷: '#3B82F6',
  房租: '#8B5CF6',
  京东白条: '#F43F5E',
  花呗: '#06B6D4',
  工资: '#10B981',
  奖金: '#14B8A6',
};

export default function FundPage({ onClose }: FundPageProps) {
  const {
    currentLedger,
    categories,
    fundTransactions,
    transactions,
    linkExistingLivingExpenseAllocation,
    saveFundRecord,
    removeFundRecord,
    saveLivingExpenseAllocation,
  } = useApp();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<'records' | 'charts'>('records');
  const [formMode, setFormMode] = useState<FundRecordFormMode | null>(null);
  const [editingRecord, setEditingRecord] = useState<FundTransaction | null>(null);
  const selectedYearMonth = getYearMonth(selectedDate.getTime());
  const monthTransactions = useMemo(
    () => fundTransactions
      .filter((transaction) => getYearMonth(transaction.occurredAt) === selectedYearMonth)
      .sort((a, b) => b.occurredAt - a.occurredAt || b.createdAt - a.createdAt),
    [fundTransactions, selectedYearMonth],
  );
  const summary = useMemo(
    () => summarizeFundMonth(fundTransactions, selectedYearMonth),
    [fundTransactions, selectedYearMonth],
  );
  const livingExpenseAllocation = monthTransactions.find(
    (transaction) => transaction.kind === 'living-expense-allocation',
  );
  const linkedTransactionIds = useMemo(
    () => new Set(fundTransactions.map((transaction) => transaction.linkedTransactionId).filter(Boolean)),
    [fundTransactions],
  );
  const existingIncomeCandidates = useMemo(
    () => transactions.filter((transaction) =>
      transaction.type === 'income'
      && !isRefund(transaction)
      && getYearMonth(transaction.occurredAt) === selectedYearMonth
      && (
        !linkedTransactionIds.has(transaction.id)
        || transaction.id === editingRecord?.linkedTransactionId
      )),
    [editingRecord?.linkedTransactionId, linkedTransactionIds, selectedYearMonth, transactions],
  );

  if (!currentLedger) return null;

  const goMonth = (offset: number) => {
    setSelectedDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const openForm = (mode: FundRecordFormMode, record: FundTransaction | null = null) => {
    setFormMode(mode);
    setEditingRecord(record);
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingRecord(null);
  };

  return (
    <div className="mobile-overlay z-[60]">
      <div className="mobile-toolbar">
        <button aria-label="返回明细" onClick={onClose} className="icon-button text-slate-600"><X size={20} /></button>
        <div>
          <div className="text-center font-semibold">资金</div>
          <div className="mt-0.5 text-[10px] text-slate-400">工资与固定支出</div>
        </div>
        <span className="h-11 w-11" />
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50 p-4 pb-8">
        <div className="mb-4 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
          <button
            onClick={() => setView('records')}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium ${view === 'records' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            <List size={17} />月度记录
          </button>
          <button
            onClick={() => setView('charts')}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium ${view === 'charts' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            <BarChart3 size={17} />资金图表
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-100">
          <button aria-label="上个月" onClick={() => goMonth(-1)} className="icon-button"><ChevronLeft size={18} /></button>
          <div className="text-center text-sm font-semibold text-slate-800">{formatYearMonth(selectedYearMonth)}</div>
          <button aria-label="下个月" onClick={() => goMonth(1)} className="icon-button"><ChevronRight size={18} /></button>
        </div>

        {view === 'records' ? (
          <>
            <section className="mb-4 overflow-hidden rounded-[1.5rem] border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-5 shadow-[0_14px_32px_rgba(148,163,184,0.14)]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-slate-500">本月资金结余</div>
                  <div className={`mt-1 text-2xl font-bold tracking-tight ${summary.balance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                    {formatMoney(summary.balance)}
                  </div>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Banknote size={22} /></span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <SummaryCell label="实际收入" value={summary.income} income />
                <SummaryCell label="实际支出" value={summary.expense} />
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-white/75 px-3 py-2.5 text-xs shadow-sm">
                <span className="flex items-center gap-1.5 text-slate-500"><WalletCards size={15} className="text-amber-600" />已划拨生活费</span>
                <span className="font-semibold text-amber-800">{formatMoney(summary.livingExpenseAllocation)}</span>
              </div>
            </section>

            <section className="mb-5">
              <button
                onClick={() => openForm('allocation', livingExpenseAllocation || null)}
                className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-primary px-4 text-left shadow-[0_12px_28px_rgba(250,204,21,0.22)] active:scale-[0.99]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 text-amber-700"><WalletCards size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{livingExpenseAllocation ? '调整本月生活费' : '划拨本月生活费'}</span>
                  <span className="mt-0.5 block text-xs text-black/50">
                    {livingExpenseAllocation?.mainIncomeOrigin === 'existing'
                      ? '已关联主账本收入'
                      : '自动同步为主账本收入'}
                  </span>
                </span>
                {livingExpenseAllocation
                  ? <span className="text-sm font-semibold">{formatMoney(livingExpenseAllocation.amount)}</span>
                  : <ChevronRight size={19} />}
              </button>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button onClick={() => openForm('income')} className="surface-card flex min-h-16 items-center gap-3 px-4 text-left active:scale-[0.99]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><ArrowDownToLine size={19} /></span>
                  <span><span className="block text-sm font-semibold text-slate-800">记收入</span><span className="mt-0.5 block text-[11px] text-slate-400">工资、奖金</span></span>
                </button>
                <button onClick={() => openForm('expense')} className="surface-card flex min-h-16 items-center gap-3 px-4 text-left active:scale-[0.99]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-500"><ArrowUpFromLine size={19} /></span>
                  <span><span className="block text-sm font-semibold text-slate-800">记支出</span><span className="mt-0.5 block text-[11px] text-slate-400">房租、车贷</span></span>
                </button>
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-slate-800">本月资金记录</h2>
                <span className="text-xs text-slate-400">{monthTransactions.length} 笔</span>
              </div>
              {monthTransactions.length === 0 ? (
                <div className="surface-card py-10 text-center">
                  <div className="text-sm font-medium text-slate-500">本月还没有资金记录</div>
                  <div className="mt-1 text-xs text-slate-400">按实际发生金额直接记录即可</div>
                </div>
              ) : (
                <div className="surface-card overflow-hidden">
                  {monthTransactions.map((transaction) => (
                    <FundTransactionRow
                      key={transaction.id}
                      transaction={transaction}
                      onClick={() => openForm(getMode(transaction), transaction)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <FundCharts
            transactions={fundTransactions}
            selectedDate={selectedDate}
            selectedYearMonth={selectedYearMonth}
          />
        )}
      </div>

      {formMode && (
        <FundRecordForm
          mode={formMode}
          ledgerId={currentLedger.id}
          monthDate={selectedDate}
          record={editingRecord}
          existingIncomes={existingIncomeCandidates}
          ledgerCategories={categories}
          onCancel={closeForm}
          onSave={async (transaction) => {
            if (transaction.kind === 'living-expense-allocation') {
              await saveLivingExpenseAllocation(transaction);
            } else {
              await saveFundRecord(transaction);
            }
            closeForm();
          }}
          onLinkExisting={async (transaction) => {
            await linkExistingLivingExpenseAllocation(transaction);
            closeForm();
          }}
          onDelete={editingRecord ? async () => {
            const message = editingRecord.mainIncomeOrigin === 'existing'
              ? '确定解除关联吗？主账本原有收入会保留。'
              : '确定删除这条资金记录吗？';
            if (!window.confirm(message)) return;
            await removeFundRecord(editingRecord.id);
            closeForm();
          } : undefined}
        />
      )}
    </div>
  );
}

function SummaryCell({ label, value, income = false }: { label: string; value: number; income?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/75 px-3 py-3 shadow-sm">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-1 text-sm font-semibold ${income ? 'text-emerald-600' : 'text-rose-500'}`}>{formatMoney(value)}</div>
    </div>
  );
}

function FundTransactionRow({ transaction, onClick }: { transaction: FundTransaction; onClick: () => void }) {
  const Icon = getCategoryIcon(transaction.category);
  const income = transaction.type === 'income';
  return (
    <button onClick={onClick} className="flex min-h-[4.5rem] w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 active:bg-slate-50">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ backgroundColor: CATEGORY_COLORS[transaction.category] || '#64748B' }}
      >
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-800">{transaction.category}</span>
        <span className="mt-1 block truncate text-xs text-slate-400">
          {formatDay(transaction.occurredAt)}
          {transaction.kind === 'living-expense-allocation'
            ? transaction.mainIncomeOrigin === 'existing' ? ' · 已关联主账本收入' : ' · 已同步生活费'
            : transaction.note ? ` · ${transaction.note}` : ''}
        </span>
      </span>
      <span className={`text-sm font-semibold ${income ? 'text-emerald-600' : 'text-rose-500'}`}>
        {income ? '+' : '-'}{formatMoney(transaction.amount)}
      </span>
    </button>
  );
}

function FundCharts({
  transactions,
  selectedDate,
  selectedYearMonth,
}: {
  transactions: FundTransaction[];
  selectedDate: Date;
  selectedYearMonth: string;
}) {
  const trend = useMemo(
    () => buildFundMonthlyTrend(transactions, selectedDate.getFullYear()),
    [selectedDate, transactions],
  );
  const breakdown = useMemo(
    () => buildFundExpenseBreakdown(transactions, selectedYearMonth),
    [selectedYearMonth, transactions],
  );
  const expenseTotal = breakdown.reduce((sum, item) => sum + item.amount, 0);
  const hasTrend = trend.some((item) => item.income > 0 || item.expense > 0);

  return (
    <div>
      <section className="surface-card mb-4 p-4">
        <div className="mb-4 font-semibold text-slate-800">{selectedDate.getFullYear()} 年资金趋势</div>
        {hasTrend ? (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 8, right: 0, left: -8, bottom: 0 }} barGap={1}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} interval={1} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatAxisAmount}
                  tick={{ fontSize: 10, fill: '#94A3B8' }}
                  width={46}
                />
                <Legend />
                <Bar dataKey="income" name="收入" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="支出" fill="#FB7185" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <div className="flex h-40 items-center justify-center text-sm text-slate-400">暂无资金记录</div>}
      </section>

      <section className="surface-card p-4">
        <div className="font-semibold text-slate-800">{formatYearMonth(selectedYearMonth)}支出构成</div>
        {breakdown.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-slate-400">本月暂无支出</div>
        ) : (
          <>
            <div className="relative h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={breakdown} dataKey="amount" nameKey="category" cx="50%" cy="50%" innerRadius={55} outerRadius={78} paddingAngle={2}>
                    {breakdown.map((item) => <Cell key={item.category} fill={CATEGORY_COLORS[item.category] || '#64748B'} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs text-slate-400">总支出</span>
                <span className="mt-1 text-lg font-bold text-slate-800">{formatMoney(expenseTotal)}</span>
              </div>
            </div>
            <div className="space-y-2">
              {breakdown.map((item) => (
                <div key={item.category} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600"><i className="h-3 w-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[item.category] || '#64748B' }} />{item.category}</span>
                  <span className="font-medium text-slate-800">{formatMoney(item.amount)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function getMode(transaction: FundTransaction): FundRecordFormMode {
  if (transaction.kind === 'living-expense-allocation') return 'allocation';
  return transaction.type;
}

function getCategoryIcon(category: string) {
  if (category === '生活费') return WalletCards;
  if (category === '工资' || category === '奖金') return Banknote;
  if (category === '车贷') return Car;
  if (category === '房租') return House;
  if (category === '京东白条') return ShoppingBag;
  if (category === '花呗') return CreditCard;
  return ReceiptText;
}

function formatYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  return `${year}年${month}月`;
}

function formatDay(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatAxisAmount(value: number): string {
  if (value >= 10000) return `${Math.round(value / 10000)}万`;
  if (value >= 1000) return `${Math.round(value / 1000)}千`;
  return String(value);
}
