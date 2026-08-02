import { useMemo, useState } from 'react';
import { Popover } from 'antd-mobile';
import { Check, ChevronDown, WalletCards } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Icon } from '../components/Icon';
import { useConfirmDeletion } from '../context/ConfirmDialogContext';
import { formatMoney, getYearMonth } from '../utils/helpers';
import { generateId } from '../utils/helpers';
import { calculateBudgetAllocationSummary, type BudgetAllocationSummary } from '../domain/budgetAnalytics';
import { getNetSpendingByCategory } from '../domain/transactionAccounting';
import type { Budget, Transaction } from '../types';

export default function BudgetPage() {
  const { currentLedger, categories, transactions, budgets, addBudget, updateBudget, removeBudget } = useApp();
  const [creatingBudgetType, setCreatingBudgetType] = useState<'overall' | 'category' | null>(null);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const confirmDeletion = useConfirmDeletion();

  const currentMonth = getYearMonth(Date.now());

  const overallBudget = useMemo(
    () => budgets.find((b) => b.ledgerId === currentLedger?.id && b.includeOverall && b.yearMonth === currentMonth),
    [budgets, currentLedger?.id, currentMonth]
  );

  const categoryBudgets = useMemo(
    () => budgets.filter((b) => b.ledgerId === currentLedger?.id && !b.includeOverall && b.yearMonth === currentMonth),
    [budgets, currentLedger?.id, currentMonth]
  );

  const allocationSummary = useMemo(
    () => currentLedger
      ? calculateBudgetAllocationSummary({
          budgets,
          transactions,
          ledgerId: currentLedger.id,
          yearMonth: currentMonth,
        })
      : EMPTY_ALLOCATION_SUMMARY,
    [budgets, currentLedger, currentMonth, transactions]
  );

  const spendingByCategory = useMemo(
    () => currentLedger
      ? getNetSpendingByCategory(
          transactions.filter((transaction) => transaction.ledgerId === currentLedger.id),
          currentMonth,
        )
      : new Map<string, number>(),
    [currentLedger, currentMonth, transactions],
  );

  const calculateSpent = (budget: Budget) => {
    if (budget.includeOverall) return [...spendingByCategory.values()].reduce((sum, amount) => sum + amount, 0);
    return budget.categoryId ? spendingByCategory.get(budget.categoryId) ?? 0 : 0;
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 pb-28">
      <header className="safe-top mb-4">
        <h1 className="text-2xl font-bold tracking-tight">预算管理</h1>
        <p className="mt-1 text-sm text-slate-500">{currentMonth.replace('-', '年')}月 · 支出计划</p>
      </header>

      <div className="mb-6">
          <div className="text-sm font-medium mb-2">总预算</div>
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
              + 设置本月总预算
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

      {(creatingBudgetType || editingBudget) && (
        <BudgetForm
          budget={editingBudget}
          budgetType={editingBudget?.includeOverall ? 'overall' : creatingBudgetType || 'category'}
          categories={categories.filter((category) =>
            category.type === 'expense'
            && (!category.deletedAt || category.id === editingBudget?.categoryId))}
          budgets={budgets}
          transactions={transactions}
          yearMonth={currentMonth}
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
                    message: '确定删除这项预算吗？本月已有账单不会被删除。',
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
            <span className="font-medium">本月总预算</span>
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
