import { useEffect, useMemo, useState } from 'react';
import { Popover } from 'antd-mobile';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, WalletCards } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Icon } from '../components/Icon';
import { useConfirmDeletion } from '../context/ConfirmDialogContext';
import { getAppSettings } from '../db';
import { saveBudgetViewPreference } from '../db/operations';
import { formatMoney, generateId, getYearMonth } from '../utils/helpers';
import {
  buildMonthlyBudgetOverview,
  calculateBudgetAllocationSummary,
  type BudgetAllocationSummary,
  type MonthlyBudgetOverview,
} from '../domain/budgetAnalytics';
import { getNetSpendingByCategory } from '../domain/transactionAccounting';
import type { Budget, Transaction } from '../types';

export default function BudgetPage() {
  const { currentLedger, categories, transactions, budgets, addBudget, updateBudget, removeBudget } = useApp();
  const [creatingBudgetType, setCreatingBudgetType] = useState<'overall' | 'category' | null>(null);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  const [selectedYearMonth, setSelectedYearMonth] = useState(() => getYearMonth(Date.now()));
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const confirmDeletion = useConfirmDeletion();

  const currentMonth = getYearMonth(Date.now());
  const selectedYear = Number(selectedYearMonth.slice(0, 4));

  useEffect(() => {
    let cancelled = false;
    setPreferenceLoaded(false);
    if (!currentLedger) return;

    void getAppSettings().then((settings) => {
      if (cancelled) return;
      const preference = settings.budgetViewByLedger[currentLedger.id];
      if (
        preference
        && (preference.mode === 'month' || preference.mode === 'year')
        && /^\d{4}-(0[1-9]|1[0-2])$/.test(preference.yearMonth)
      ) {
        setViewMode(preference.mode);
        setSelectedYearMonth(preference.yearMonth);
      } else {
        setViewMode('month');
        setSelectedYearMonth(currentMonth);
      }
      setPreferenceLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [currentLedger, currentMonth]);

  useEffect(() => {
    if (!currentLedger || !preferenceLoaded) return;
    // 浏览位置与预算数据一起留在 IndexedDB；短暂延迟避免连续切月产生多次写入。
    const timer = window.setTimeout(() => {
      void saveBudgetViewPreference(currentLedger.id, { mode: viewMode, yearMonth: selectedYearMonth });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [currentLedger, preferenceLoaded, selectedYearMonth, viewMode]);

  const overallBudget = useMemo(
    () => budgets.find((b) => b.ledgerId === currentLedger?.id && b.includeOverall && b.yearMonth === selectedYearMonth),
    [budgets, currentLedger?.id, selectedYearMonth]
  );

  const categoryBudgets = useMemo(
    () => budgets.filter((b) => b.ledgerId === currentLedger?.id && !b.includeOverall && b.yearMonth === selectedYearMonth),
    [budgets, currentLedger?.id, selectedYearMonth]
  );

  const allocationSummary = useMemo(
    () => currentLedger
      ? calculateBudgetAllocationSummary({
          budgets,
          transactions,
          ledgerId: currentLedger.id,
          yearMonth: selectedYearMonth,
        })
      : EMPTY_ALLOCATION_SUMMARY,
    [budgets, currentLedger, selectedYearMonth, transactions]
  );

  const spendingByCategory = useMemo(
    () => currentLedger
      ? getNetSpendingByCategory(
          transactions.filter((transaction) => transaction.ledgerId === currentLedger.id),
          selectedYearMonth,
        )
      : new Map<string, number>(),
    [currentLedger, selectedYearMonth, transactions],
  );

  const yearlyOverview = useMemo(
    () => currentLedger
      ? buildMonthlyBudgetOverview({ budgets, transactions, ledgerId: currentLedger.id, year: selectedYear })
      : [],
    [budgets, currentLedger, selectedYear, transactions],
  );

  const calculateSpent = (budget: Budget) => {
    if (budget.includeOverall) return [...spendingByCategory.values()].reduce((sum, amount) => sum + amount, 0);
    return budget.categoryId ? spendingByCategory.get(budget.categoryId) ?? 0 : 0;
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 pb-28">
      <header className="safe-top mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">预算管理</h1>
          <p className="mt-1 text-sm text-slate-500">按月规划，按年回看</p>
        </div>
        <div className="flex rounded-xl bg-slate-200/70 p-1 text-xs font-semibold text-slate-500">
          {(['month', 'year'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              aria-pressed={viewMode === mode}
              className={`rounded-lg px-3 py-2 transition-all ${
                viewMode === mode ? 'bg-white text-slate-900 shadow-sm' : ''
              }`}
            >
              {mode === 'month' ? '月' : '年'}
            </button>
          ))}
        </div>
      </header>

      <PeriodNavigator
        mode={viewMode}
        yearMonth={selectedYearMonth}
        isCurrentMonth={selectedYearMonth === currentMonth}
        onPrevious={() => setSelectedYearMonth((value) => shiftYearMonth(value, viewMode === 'month' ? -1 : -12))}
        onNext={() => setSelectedYearMonth((value) => shiftYearMonth(value, viewMode === 'month' ? 1 : 12))}
        onToday={() => setSelectedYearMonth(currentMonth)}
      />

      {viewMode === 'year' ? (
        <YearBudgetView
          overview={yearlyOverview}
          year={selectedYear}
          currentYearMonth={currentMonth}
          onSelectMonth={(yearMonth) => {
            setSelectedYearMonth(yearMonth);
            setViewMode('month');
          }}
        />
      ) : (
        <>
          <div className="mb-6">
            <div className="mb-2 text-sm font-medium">总预算</div>
            {overallBudget ? (
              <BudgetCard
                budget={overallBudget}
                spent={calculateSpent(overallBudget)}
                onClick={() => setEditingBudget(overallBudget)}
              />
            ) : (
              <button
                onClick={() => setCreatingBudgetType('overall')}
                className="surface-card w-full border-dashed py-6 text-sm font-medium text-slate-500 active:bg-slate-50"
              >
                + 设置 {Number(selectedYearMonth.slice(5))} 月总预算
              </button>
            )}
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">分类预算</div>
            <div className="space-y-3">
              {categoryBudgets.map((budget) => (
                <BudgetCard
                  key={budget.id}
                  budget={budget}
                  spent={calculateSpent(budget)}
                  category={categories.find((c) => c.id === budget.categoryId)}
                  onClick={() => setEditingBudget(budget)}
                />
              ))}
            </div>

            <BudgetBalanceCard summary={allocationSummary} hasOverallBudget={!!overallBudget} />

            <button
              onClick={() => setCreatingBudgetType('category')}
              className="surface-card mt-4 w-full border-dashed py-4 text-sm font-medium text-slate-500 active:bg-slate-50"
            >
              + 添加分类预算
            </button>
          </div>
        </>
      )}

      {(creatingBudgetType || editingBudget) && (
        <BudgetForm
          budget={editingBudget}
          budgetType={editingBudget?.includeOverall ? 'overall' : creatingBudgetType || 'category'}
          categories={categories.filter((category) =>
            category.type === 'expense'
            && (!category.deletedAt || category.id === editingBudget?.categoryId))}
          budgets={budgets}
          transactions={transactions}
          yearMonth={selectedYearMonth}
          onSave={(budget) => {
            if (editingBudget) {
              updateBudget(budget);
            } else {
              addBudget(budget);
            }
            setCreatingBudgetType(null);
            setEditingBudget(null);
          }}
          onCancel={() => {
            setCreatingBudgetType(null);
            setEditingBudget(null);
          }}
          onDelete={
            editingBudget
              ? async () => {
                  const confirmed = await confirmDeletion({
                    title: editingBudget.includeOverall ? '删除总预算' : '删除分类预算',
                    message: `确定删除 ${Number(selectedYearMonth.slice(5))} 月的这项预算吗？该月已有账单不会被删除。`,
                  });
                  if (!confirmed) return;
                  await removeBudget(editingBudget.id);
                  setEditingBudget(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function PeriodNavigator({
  mode,
  yearMonth,
  isCurrentMonth,
  onPrevious,
  onNext,
  onToday,
}: {
  mode: 'month' | 'year';
  yearMonth: string;
  isCurrentMonth: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const [year, month] = yearMonth.split('-').map(Number);
  const isCurrentYear = year === new Date().getFullYear();
  const isCurrentPeriod = mode === 'month' ? isCurrentMonth : isCurrentYear;

  return (
    <section className="surface-card mb-5 flex items-center gap-2 p-2">
      <button aria-label={mode === 'month' ? '上个月' : '上一年'} onClick={onPrevious} className="icon-button shrink-0">
        <ChevronLeft size={19} />
      </button>
      <div className="min-w-0 flex-1 text-center">
        <div className="text-sm font-semibold text-slate-800">
          {mode === 'month' ? `${year} 年 ${month} 月` : `${year} 年`}
        </div>
        <button
          onClick={onToday}
          disabled={isCurrentPeriod}
          className={`mt-0.5 text-[11px] ${isCurrentPeriod ? 'text-slate-400' : 'font-medium text-amber-600'}`}
        >
          {isCurrentPeriod ? (mode === 'month' ? '本月' : '本年') : (mode === 'month' ? '回到本月' : '回到本年')}
        </button>
      </div>
      <button aria-label={mode === 'month' ? '下个月' : '下一年'} onClick={onNext} className="icon-button shrink-0">
        <ChevronRight size={19} />
      </button>
    </section>
  );
}

function YearBudgetView({
  overview,
  year,
  currentYearMonth,
  onSelectMonth,
}: {
  overview: MonthlyBudgetOverview[];
  year: number;
  currentYearMonth: string;
  onSelectMonth: (yearMonth: string) => void;
}) {
  const totalBudget = overview.reduce((sum, month) => sum + month.budgetAmount, 0);
  const totalSpent = overview.reduce((sum, month) => sum + month.spentAmount, 0);
  const configuredMonths = overview.filter((month) => month.budgetAmount > 0).length;
  const overspentMonths = overview.filter((month) => month.status === 'overspent').length;

  return (
    <div>
      <section className="mb-4 overflow-hidden rounded-[1.5rem] border border-amber-100 bg-gradient-to-br from-amber-100 via-amber-50 to-white p-5 shadow-[0_14px_34px_rgba(245,158,11,0.10)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-amber-800/70">{year} 年预算总览</div>
            <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{formatMoney(totalBudget)}</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-amber-600 shadow-sm">
            <CalendarDays size={20} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <YearMetric label="已用" value={formatMoney(totalSpent)} />
          <YearMetric label="已设预算" value={`${configuredMonths} 个月`} />
          <YearMetric label="超支" value={`${overspentMonths} 个月`} danger={overspentMonths > 0} />
        </div>
      </section>

      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium">每月预算</div>
        <div className="text-xs text-slate-400">点击月份查看详情</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {overview.map((month) => (
          <YearMonthCard
            key={month.yearMonth}
            month={month}
            isCurrent={month.yearMonth === currentYearMonth}
            isFuture={month.yearMonth > currentYearMonth}
            onClick={() => onSelectMonth(month.yearMonth)}
          />
        ))}
      </div>
    </div>
  );
}

function YearMetric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-white/80 bg-white/70 px-2 py-2.5">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className={`mt-1 truncate text-xs font-semibold ${danger ? 'text-rose-500' : 'text-slate-700'}`}>{value}</div>
    </div>
  );
}

function YearMonthCard({
  month,
  isCurrent,
  isFuture,
  onClick,
}: {
  month: MonthlyBudgetOverview;
  isCurrent: boolean;
  isFuture: boolean;
  onClick: () => void;
}) {
  const usage = month.utilization === null ? 0 : Math.min(month.utilization, 100);
  const statusColor = month.status === 'overspent'
    ? 'text-rose-500'
    : month.status === 'on-track'
      ? 'text-emerald-600'
      : 'text-slate-400';

  return (
    <button
      onClick={onClick}
      className={`surface-card p-3.5 text-left transition-transform active:scale-[0.98] ${
        isCurrent ? 'ring-2 ring-amber-300 ring-offset-1 ring-offset-slate-50' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-slate-800">{month.month} 月</div>
        <div className={`text-[10px] font-medium ${statusColor}`}>
          {month.status === 'no-budget'
            ? '未设置'
            : month.status === 'overspent'
              ? `超支 ${Math.round(month.utilization ?? 0)}%`
              : `已用 ${Math.round(month.utilization ?? 0)}%`}
        </div>
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-700">{formatMoney(month.budgetAmount)}</div>
      <div className="mt-1 text-[11px] text-slate-400">支出 {formatMoney(month.spentAmount)}</div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${month.status === 'overspent' ? 'bg-rose-500' : 'bg-emerald-500'}`}
          style={{ width: `${usage}%` }}
        />
      </div>
      {!isFuture && month.budgetChanges.length > 0 && (
        <div className="mt-2 text-[10px] font-medium text-amber-600">较上月调整 {month.budgetChanges.length} 项</div>
      )}
    </button>
  );
}

function shiftYearMonth(yearMonth: string, offset: number): string {
  const [year, month] = yearMonth.split('-').map(Number);
  return getYearMonth(new Date(year, month - 1 + offset, 1).getTime());
}

const EMPTY_ALLOCATION_SUMMARY: BudgetAllocationSummary = {
  overallBudgetAmount: 0,
  allocatedAmount: 0,
  categoryOverspendAmount: 0,
  unbudgetedSpendingAmount: 0,
  balanceAmount: 0,
};

function BudgetBalanceCard({
  summary,
  hasOverallBudget,
}: {
  summary: BudgetAllocationSummary;
  hasOverallBudget: boolean;
}) {
  const occupiedByOverspend = summary.categoryOverspendAmount + summary.unbudgetedSpendingAmount;

  return (
    <div className="surface-card mt-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <WalletCards size={20} />
          </div>
          <div>
            <div className="font-medium">预算结余</div>
            <div className="mt-0.5 text-xs text-slate-400">总预算扣除已分配与超额支出</div>
          </div>
        </div>
        {hasOverallBudget ? (
          <div className={`text-right font-semibold ${summary.balanceAmount >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            {formatMoney(summary.balanceAmount)}
          </div>
        ) : (
          <div className="text-xs text-slate-400">未设置总预算</div>
        )}
      </div>

      {hasOverallBudget && occupiedByOverspend > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-rose-600">
            超额占用 {formatMoney(occupiedByOverspend)}
          </span>
        </div>
      )}
    </div>
  );
}

function BudgetCard({
  budget,
  spent,
  category,
  onClick,
}: {
  budget: Budget;
  spent: number;
  category?: { name: string; icon: string; color: string };
  onClick: () => void;
}) {
  const progress = budget.amount > 0 ? Math.min((spent / budget.amount) * 100, 100) : 0;
  const remaining = budget.amount - spent;

  return (
    <button
      onClick={onClick}
      className="surface-card w-full p-4 text-left active:bg-slate-50"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {category ? (
            <>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                style={{ backgroundColor: category.color }}
              >
                <Icon name={category.icon} size={16} />
              </div>
              <span className="font-medium">{category.name}</span>
            </>
          ) : (
            <span className="font-medium">{Number(budget.yearMonth.slice(5))} 月总预算</span>
          )}
          <span className="text-sm font-semibold text-slate-500">{formatMoney(budget.amount)}</span>
        </div>
        <span className={`text-sm font-semibold ${progress >= 100 ? 'text-red-500' : 'text-gray-600'}`}>
          {Math.round(progress)}%
        </span>
      </div>

      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full ${
            progress >= 100 ? 'bg-red-500' : progress >= 80 ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-gray-500">已用 {formatMoney(spent)}</span>
        <span className={remaining >= 0 ? 'text-green-600' : 'text-red-500'}>
          剩余 {formatMoney(remaining)}
        </span>
      </div>
    </button>
  );
}

function BudgetForm({
  budget,
  budgetType,
  categories,
  budgets,
  transactions,
  yearMonth,
  onSave,
  onCancel,
  onDelete,
}: {
  budget: Budget | null;
  budgetType: 'overall' | 'category';
  categories: { id: string; name: string; icon: string; color: string }[];
  budgets: Budget[];
  transactions: Transaction[];
  yearMonth: string;
  onSave: (budget: Budget) => void;
  onCancel: () => void;
  onDelete?: () => void | Promise<void>;
}) {
  const { currentLedger } = useApp();
  const [amount, setAmount] = useState(budget ? String(budget.amount) : '');
  const [categoryId, setCategoryId] = useState(budget?.categoryId || categories[0]?.id || '');
  const [categorySelectOpen, setCategorySelectOpen] = useState(false);
  const isOverall = budgetType === 'overall';
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId) || categories[0],
    [categories, categoryId]
  );

  const currentAllocationSummary = useMemo(
    () => currentLedger
      ? calculateBudgetAllocationSummary({
          budgets,
          transactions,
          ledgerId: currentLedger.id,
          yearMonth,
        })
      : EMPTY_ALLOCATION_SUMMARY,
    [budgets, currentLedger, transactions, yearMonth]
  );
  const projectedBalance = useMemo(() => {
    if (!currentLedger || isOverall || !categoryId || !amount || isNaN(Number(amount))) return null;
    const proposedBudget: Budget = {
      id: budget?.id || 'budget-preview',
      ledgerId: currentLedger.id,
      categoryId,
      amount: Number(amount),
      period: 'monthly',
      yearMonth,
      includeOverall: false,
      createdAt: budget?.createdAt || Date.now(),
    };
    const projectedBudgets = budget
      ? budgets.map((item) => item.id === budget.id ? proposedBudget : item)
      : [...budgets, proposedBudget];
    return calculateBudgetAllocationSummary({
      budgets: projectedBudgets,
      transactions,
      ledgerId: currentLedger.id,
      yearMonth,
    }).balanceAmount;
  }, [amount, budget, budgets, categoryId, currentLedger, isOverall, transactions, yearMonth]);

  const handleSave = () => {
    if (!currentLedger || !amount || isNaN(Number(amount))) return;

    onSave({
      id: budget?.id || generateId(),
      ledgerId: currentLedger.id,
      categoryId: isOverall ? undefined : categoryId,
      amount: Number(amount),
      period: 'monthly',
      yearMonth,
      includeOverall: isOverall,
      createdAt: budget?.createdAt || Date.now(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-4">
        <div className="font-medium text-center mb-4">
          {budget ? '编辑' : '新增'}{isOverall ? '总预算' : '分类预算'}
        </div>

        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="预算金额"
          className="w-full p-3 border border-gray-200 rounded-lg mb-4"
        />

        {!isOverall && (
          <>
            {categorySelectOpen && (
              <button
                type="button"
                aria-label="收起分类选择器"
                className="fixed inset-0 z-[70] bg-slate-950/20 backdrop-blur-[1px]"
                onClick={() => setCategorySelectOpen(false)}
              />
            )}

            {/* 使用组件库 Popover 实现 Select：默认只展示当前值，选择后自动收起。 */}
            <Popover
              className="mintify-budget-category-select"
              visible={categorySelectOpen}
              onVisibleChange={setCategorySelectOpen}
              trigger="click"
              placement="bottom-start"
              content={(
                <div className="mintify-budget-category-options">
                  {categories.map((category) => {
                    const selected = category.id === categoryId;
                    return (
                      <button
                        type="button"
                        key={category.id}
                        aria-selected={selected}
                        className={`mintify-budget-category-option ${selected ? 'is-selected' : ''}`}
                        onClick={() => {
                          setCategoryId(category.id);
                          setCategorySelectOpen(false);
                        }}
                      >
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                          style={{ backgroundColor: category.color }}
                        >
                          <Icon name={category.icon} size={17} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-left font-medium text-slate-700">
                          {category.name}
                        </span>
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full ${
                          selected ? 'bg-amber-500 text-white' : 'text-transparent'
                        }`}>
                          <Check size={15} strokeWidth={3} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            >
              <button
                type="button"
                aria-label="选择预算分类"
                aria-expanded={categorySelectOpen}
                className={`mb-3 flex min-h-14 w-full items-center gap-3 rounded-xl border bg-white px-3 text-left transition-all ${
                  categorySelectOpen
                    ? 'border-amber-400 ring-4 ring-amber-100'
                    : 'border-slate-200 active:bg-slate-50'
                }`}
              >
                {selectedCategory && (
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                    style={{ backgroundColor: selectedCategory.color }}
                  >
                    <Icon name={selectedCategory.icon} size={17} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-medium text-slate-400">预算分类</span>
                  <span className="mt-0.5 block truncate text-sm font-semibold text-slate-800">
                    {selectedCategory?.name || '请选择分类'}
                  </span>
                </span>
                <ChevronDown
                  size={19}
                  className={`shrink-0 text-slate-400 transition-transform ${categorySelectOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </Popover>

            <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50/70 p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-amber-900/70">当前预算结余</span>
                <span className={`font-semibold ${currentAllocationSummary.balanceAmount >= 0 ? 'text-amber-900' : 'text-rose-600'}`}>
                  {formatMoney(currentAllocationSummary.balanceAmount)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-amber-200/60 pt-2 text-sm">
                <span className="text-amber-900/70">保存后结余</span>
                <span className={`font-semibold ${projectedBalance === null || projectedBalance >= 0 ? 'text-amber-900' : 'text-rose-600'}`}>
                  {projectedBalance === null ? '输入金额后计算' : formatMoney(projectedBalance)}
                </span>
              </div>
            </div>
          </>
        )}

        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-gray-100 rounded-xl">取消</button>
          {onDelete && (
            <button onClick={() => void onDelete()} className="flex-1 py-3 bg-red-100 text-red-600 rounded-xl">删除</button>
          )}
          <button onClick={handleSave} className="flex-1 py-3 bg-primary rounded-xl font-medium">保存</button>
        </div>
      </div>
    </div>
  );
}
