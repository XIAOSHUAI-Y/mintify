import { useMemo, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Icon } from '../components/Icon';
import { formatMoney, getYearMonth } from '../utils/helpers';
import { generateId } from '../utils/helpers';
import type { Budget } from '../types';

interface BudgetPageProps {
  onClose: () => void;
}

export default function BudgetPage({ onClose }: BudgetPageProps) {
  const { currentLedger, categories, transactions, budgets, addBudget, updateBudget, removeBudget } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  const currentMonth = getYearMonth(Date.now());

  const overallBudget = useMemo(
    () => budgets.find((b) => b.includeOverall && b.yearMonth === currentMonth),
    [budgets, currentMonth]
  );

  const categoryBudgets = useMemo(
    () => budgets.filter((b) => !b.includeOverall && b.yearMonth === currentMonth),
    [budgets, currentMonth]
  );

  const calculateSpent = (budget: Budget) => {
    if (!currentLedger) return 0;
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);

    return transactions
      .filter((t) => {
        if (t.type !== 'expense') return false;
        if (t.occurredAt < start.getTime() || t.occurredAt > end.getTime()) return false;
        if (budget.includeOverall) return true;
        return t.categoryId === budget.categoryId;
      })
      .reduce((sum, t) => sum + t.amount, 0);
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <button onClick={onClose} className="text-gray-600"><X size={20} /></button>
        <div className="font-medium">预算管理</div>
        <button onClick={() => setShowForm(true)}><Plus size={22} className="text-yellow-700" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-sm text-gray-500 mb-3">{currentMonth.replace('-', '年')}月</div>

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
              onClick={() => setShowForm(true)}
              className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-500"
            >
              + 设置本月总预算
            </button>
          )}
        </div>

        <div>
          <div className="text-sm font-medium mb-2">分类预算</div>
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

          <button
            onClick={() => setShowForm(true)}
            className="w-full mt-4 py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500"
          >
            + 添加分类预算
          </button>
        </div>
      </div>

      {(showForm || editingBudget) && (
        <BudgetForm
          budget={editingBudget}
          categories={categories.filter((c) => c.type === 'expense')}
          onSave={(budget) => {
            if (editingBudget) {
              updateBudget(budget);
            } else {
              addBudget(budget);
            }
            setShowForm(false);
            setEditingBudget(null);
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingBudget(null);
          }}
          onDelete={
            editingBudget
              ? () => {
                  removeBudget(editingBudget.id);
                  setEditingBudget(null);
                }
              : undefined
          }
        />
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
      className="w-full bg-white border border-gray-100 rounded-xl p-4 text-left active:bg-gray-50"
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
  categories,
  onSave,
  onCancel,
  onDelete,
}: {
  budget: Budget | null;
  categories: { id: string; name: string; icon: string; color: string }[];
  onSave: (budget: Budget) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const { currentLedger } = useApp();
  const [amount, setAmount] = useState(budget ? String(budget.amount) : '');
  const [isOverall, setIsOverall] = useState(!budget || budget.includeOverall);
  const [categoryId, setCategoryId] = useState(budget?.categoryId || categories[0]?.id || '');

  const handleSave = () => {
    if (!currentLedger || !amount || isNaN(Number(amount))) return;

    onSave({
      id: budget?.id || generateId(),
      ledgerId: currentLedger.id,
      categoryId: isOverall ? undefined : categoryId,
      amount: Number(amount),
      period: 'monthly',
      yearMonth: getYearMonth(Date.now()),
      includeOverall: isOverall,
      createdAt: budget?.createdAt || Date.now(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-4">
        <div className="font-medium text-center mb-4">{budget ? '编辑预算' : '新增预算'}</div>

        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="预算金额"
          className="w-full p-3 border border-gray-200 rounded-lg mb-4"
        />

        <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
          <button
            onClick={() => setIsOverall(true)}
            className={`flex-1 py-2 rounded-md text-sm ${isOverall ? 'bg-white shadow-sm' : 'text-gray-500'}`}
          >
            总预算
          </button>
          <button
            onClick={() => setIsOverall(false)}
            className={`flex-1 py-2 rounded-md text-sm ${!isOverall ? 'bg-white shadow-sm' : 'text-gray-500'}`}
          >
            分类预算
          </button>
        </div>

        {!isOverall && (
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-lg mb-4"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}

        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-gray-100 rounded-xl">取消</button>
          {onDelete && (
            <button onClick={onDelete} className="flex-1 py-3 bg-red-100 text-red-600 rounded-xl">删除</button>
          )}
          <button onClick={handleSave} className="flex-1 py-3 bg-primary rounded-xl font-medium">保存</button>
        </div>
      </div>
    </div>
  );
}
