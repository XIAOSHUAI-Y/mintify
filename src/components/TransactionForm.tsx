import { useEffect, useMemo, useState } from 'react';
import { DatePicker, Toast } from 'antd-mobile';
import { Calendar, Tag, FileImage, X, FileText, Link2, RotateCcw, Landmark, PiggyBank, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Icon } from './Icon';
import HorizontalScrollArea from './HorizontalScrollArea';
import { generateId, formatMoney, formatShortDate, getYearMonth } from '../utils/helpers';
import { PRESET_TAGS } from '../data/seed';
import type { Transaction } from '../types';
import { getRemainingRefundableAmount } from '../domain/transactionAccounting';
import { calculateMonthlyBudgetAvailability } from '../domain/reserveLedger';
import { buildBudgetAlerts } from '../domain/budgetAlerts';

type EntryMode = Transaction['type'] | 'saving';

interface TransactionFormProps {
  onClose: () => void;
  editingTransaction?: Transaction | null;
}

export default function TransactionForm({ onClose, editingTransaction }: TransactionFormProps) {
  const {
    currentLedger,
    categories,
    transactions,
    budgets,
    savingsPlans,
    reserveEntries,
    addTransaction,
    addReserveEntry,
    updateTransaction,
  } = useApp();

  const [type, setType] = useState<EntryMode>(editingTransaction?.type || 'expense');
  const [amount, setAmount] = useState(editingTransaction ? String(editingTransaction.amount) : '');
  const [selectedCategoryId, setSelectedCategoryId] = useState(editingTransaction?.categoryId || '');
  const [occurredAt, setOccurredAt] = useState(editingTransaction?.occurredAt || Date.now());
  const [note, setNote] = useState(editingTransaction?.note || '');
  const [tags, setTags] = useState<string[]>(editingTransaction?.tags || []);
  const [photo, setPhoto] = useState(editingTransaction?.photo || '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [draftOccurredAt, setDraftOccurredAt] = useState(occurredAt);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [incomeMode, setIncomeMode] = useState<'standard' | 'refund'>(
    editingTransaction?.kind === 'refund' ? 'refund' : 'standard',
  );
  const [linkedExpenseId, setLinkedExpenseId] = useState(editingTransaction?.linkedExpenseTransactionId || '');
  const [refundKeyword, setRefundKeyword] = useState('');
  const [saveError, setSaveError] = useState('');
  const [savingTarget, setSavingTarget] = useState('general');
  const isRefundMode = type === 'income' && incomeMode === 'refund';
  const isSavingMode = type === 'saving';
  const activeSavingsPlans = useMemo(
    () => savingsPlans.filter((plan) => !plan.archivedAt),
    [savingsPlans],
  );
  const savingAvailability = useMemo(
    () => currentLedger
      ? calculateMonthlyBudgetAvailability({
          budgets,
          transactions,
          reserveEntries,
          ledgerId: currentLedger.id,
          yearMonth: getYearMonth(occurredAt),
        })
      : { budgetAmount: 0, spentAmount: 0, reservedAmount: 0, availableAmount: 0 },
    [budgets, currentLedger, occurredAt, reserveEntries, transactions],
  );

  const filteredCategories = useMemo(
    () => categories
      .filter((category) =>
        category.type === type
        && category.name !== '退款'
        && (!category.deletedAt || category.id === editingTransaction?.categoryId))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [categories, editingTransaction?.categoryId, type]
  );

  const refundCategory = useMemo(
    () => categories.find((category) => category.type === 'income' && category.name === '退款'),
    [categories],
  );

  const refundableExpenses = useMemo(() => transactions
    .filter((transaction) =>
      transaction.type === 'expense'
      && getRemainingRefundableAmount(transactions, transaction.id, editingTransaction?.id) > 0)
    .sort((a, b) => b.occurredAt - a.occurredAt),
  [editingTransaction?.id, transactions]);

  // 可退支出可能上百条，按备注/分类/金额过滤后再展示。
  const filteredRefundableExpenses = useMemo(() => {
    const query = refundKeyword.trim().toLowerCase();
    if (!query) return refundableExpenses;
    return refundableExpenses.filter((expense) => {
      const category = categories.find((item) => item.id === expense.categoryId);
      return (
        expense.note.toLowerCase().includes(query)
        || (category?.name.toLowerCase().includes(query) ?? false)
        || String(expense.amount).includes(query)
      );
    });
  }, [categories, refundableExpenses, refundKeyword]);

  useEffect(() => {
    if (isSavingMode) return;
    if (isRefundMode) {
      setSelectedCategoryId(refundCategory?.id || '');
      return;
    }
    const categoryStillMatchesType = filteredCategories.some((category) => category.id === selectedCategoryId);
    // 切换收支类型时必须同步切换分类，避免保存出“收入 + 支出分类”的脏数据。
    if (!categoryStillMatchesType) {
      setSelectedCategoryId(filteredCategories[0]?.id || '');
    }
  }, [filteredCategories, isRefundMode, isSavingMode, refundCategory?.id, selectedCategoryId]);

  const handleNumber = (num: string) => {
    if (num === '.') {
      if (amount.includes('.')) return;
      setAmount((prev) => (prev === '' ? '0.' : prev + '.'));
      return;
    }
    setAmount((prev) => {
      if (prev === '0') return num;
      return prev + num;
    });
  };

  const handleBackspace = () => {
    setAmount((prev) => prev.slice(0, -1));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const openDatePicker = () => {
    // 弹层内先维护草稿日期，取消操作不能意外改写账单时间。
    setDraftOccurredAt(occurredAt);
    setShowDatePicker(true);
  };

  const handleSave = async (keepOpen = false) => {
    if (!currentLedger || !amount || isNaN(Number(amount))) return;
    if (isSavingMode) {
      setSaveError('');
      try {
        await addReserveEntry({
          id: generateId(),
          ledgerId: currentLedger.id,
          amount: Number(amount),
          sourceType: 'budget',
          targetType: savingTarget === 'general' ? 'general' : 'plan',
          targetPlanId: savingTarget === 'general' ? undefined : savingTarget,
          sourceYearMonth: getYearMonth(occurredAt),
          note: note || (savingTarget === 'general' ? '存入通用结余池' : '存入攒钱计划'),
          occurredAt,
          createdAt: Date.now(),
        });
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : '保存失败，请重试');
        return;
      }
      if (keepOpen) {
        setAmount('');
        setNote('');
        setOccurredAt(Date.now());
        return;
      }
      onClose();
      return;
    }
    if (!selectedCategoryId) return;
    if (isRefundMode && !linkedExpenseId) return;
    setSaveError('');

    const transactionData: Transaction = {
      id: editingTransaction?.id || generateId(),
      ledgerId: currentLedger.id,
      categoryId: selectedCategoryId,
      amount: Number(amount),
      type,
      note,
      tags,
      photo,
      occurredAt,
      createdAt: editingTransaction?.createdAt || Date.now(),
      recurringRuleId: editingTransaction?.recurringRuleId,
      kind: isRefundMode ? 'refund' : undefined,
      linkedExpenseTransactionId: isRefundMode ? linkedExpenseId : undefined,
    };

    try {
      if (editingTransaction) {
        await updateTransaction(transactionData);
      } else {
        await addTransaction(transactionData);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '保存失败，请重试');
      return;
    }

    showBudgetAlertsIfNeeded(transactionData);

    if (keepOpen && !isRefundMode) {
      setAmount('');
      setNote('');
      setTags([]);
      setPhoto('');
      setOccurredAt(Date.now());
      setSelectedCategoryId(filteredCategories[0]?.id || '');
      return;
    }
    onClose();
  };

  // 保存成功后才评估预算：上下文里的 transactions 此刻还是旧快照，需要手动并入刚保存的记录。
  const showBudgetAlertsIfNeeded = (saved: Transaction) => {
    if (!currentLedger || saved.type !== 'expense') return;
    const mergedTransactions = [
      ...transactions.filter((item) => item.id !== saved.id),
      saved,
    ];
    const alerts = buildBudgetAlerts({
      budgets,
      transactions: mergedTransactions,
      ledgerId: currentLedger.id,
      savedTransaction: saved,
      previousTransaction: editingTransaction,
      categoryName: categories.find((category) => category.id === saved.categoryId)?.name,
    });
    if (alerts.length === 0) return;
    Toast.show({
      duration: 3000,
      content: alerts
        .map((alert) => alert.severity === 'exceeded'
          ? `${alert.label}已超支（${Math.round(alert.percentage)}%）`
          : `${alert.label}已用 ${Math.round(alert.percentage)}%`)
        .join('；'),
    });
  };

  const canSave = Boolean(
    amount
    && Number(amount) > 0
    && (isSavingMode ? savingTarget : selectedCategoryId)
    && (!isRefundMode || linkedExpenseId),
  );

  return (
    <div className="mobile-overlay bg-white dark:bg-slate-900">
      <div className="mobile-toolbar">
        <button onClick={onClose} className="min-h-11 rounded-full px-2 text-sm text-slate-500 active:bg-slate-100 dark:text-slate-400 dark:active:bg-slate-800">取消</button>
        <div className="font-semibold">{editingTransaction ? '编辑账单' : currentLedger?.name || '记账'}</div>
        <button
          onClick={() => handleSave(false)}
          className="min-h-11 rounded-full px-2 text-sm font-semibold text-amber-700 disabled:text-slate-300 dark:text-amber-400"
          disabled={!canSave}
        >
          保存
        </button>
      </div>

      {/* Amount Display */}
      <div className="px-5 pb-5 pt-6">
        <div className="mb-1 text-right text-xs font-medium text-slate-400">输入金额</div>
        <div className="truncate text-right text-5xl font-bold tracking-tight">
          ¥{amount || '0.00'}
        </div>
      </div>

      {/* Type Selector */}
      <div className="mb-3 px-4">
        <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-700/60">
          {((editingTransaction
            ? ['expense', 'income', 'transfer']
            : ['expense', 'income', 'transfer', 'saving']) as EntryMode[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setType(t);
                if (t !== 'income') setIncomeMode('standard');
                setSaveError('');
              }}
              aria-pressed={type === t}
              className={`min-h-11 flex-1 rounded-lg text-sm font-medium transition-colors ${
                type === t ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t === 'expense' ? '支出' : t === 'income' ? '收入' : t === 'transfer' ? '转账' : '存钱'}
            </button>
          ))}
        </div>
      </div>

      {type === 'income' && (
        <div className="mb-3 px-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setIncomeMode('standard')}
              className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition-colors ${
                incomeMode === 'standard'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300'
                  : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              普通收入
            </button>
            <button
              onClick={() => setIncomeMode('refund')}
              className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition-colors ${
                incomeMode === 'refund'
                  ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300'
                  : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              <RotateCcw size={17} /> 退款
            </button>
          </div>
        </div>
      )}

      {/* Meta Fields */}
      <HorizontalScrollArea className="mb-4 flex gap-2 overflow-x-auto px-4 pb-1 pr-10">
        <button
          onClick={openDatePicker}
          className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-sm dark:bg-slate-700/60"
        >
          <Calendar size={16} />
          {formatShortDate(occurredAt)}
        </button>
        {!isSavingMode && (
          <button
            onClick={() => setShowTagPicker(true)}
            className="flex min-h-10 max-w-32 shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-sm dark:bg-slate-700/60"
          >
            <Tag size={16} />
            {tags.length > 0 ? tags.join(',') : '标签'}
          </button>
        )}
        <button
          onClick={() => setShowNoteInput(true)}
          className="flex min-h-10 max-w-32 shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-sm dark:bg-slate-700/60"
        >
          <FileText size={16} />
          {note || '备注'}
        </button>
        {!isSavingMode && (
          <label className="flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-slate-100 px-3 text-sm dark:bg-slate-700/60">
            <FileImage size={16} />
            {photo ? '已选图片' : '图片'}
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </label>
        )}
      </HorizontalScrollArea>

      {photo && (
        <div className="px-4 mb-4">
          <img src={photo} alt="receipt" className="h-20 w-20 object-cover rounded-lg" />
        </div>
      )}

      {saveError && (
        <div className="mx-4 mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-400/10 dark:text-rose-300">{saveError}</div>
      )}

      {/* 退款必须显式绑定原支出；普通收支继续沿用原有分类网格。 */}
      <div className="flex-1 overflow-y-auto px-4 pb-3">
        {isSavingMode ? (
          <>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">存到哪里</div>
              <div className="text-xs text-slate-400">
                {savingAvailability.budgetAmount > 0
                  ? `本月可存 ${formatMoney(savingAvailability.availableAmount)}`
                  : '本月还没有预算'}
              </div>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => setSavingTarget('general')}
                aria-pressed={savingTarget === 'general'}
                className={`flex min-h-18 w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors ${
                  savingTarget === 'general' ? 'border-amber-300 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-400/10' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                }`}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400 text-amber-950">
                  <Landmark size={21} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">通用结余池</span>
                  <span className="mt-0.5 block text-xs text-slate-400">先存下来，以后再决定用途</span>
                </span>
              </button>
              {activeSavingsPlans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSavingTarget(plan.id)}
                  aria-pressed={savingTarget === plan.id}
                  className={`flex min-h-18 w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors ${
                    savingTarget === plan.id ? 'border-amber-300 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-400/10' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                  }`}
                >
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
                    style={{ backgroundColor: plan.color }}
                  >
                    <PiggyBank size={21} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{plan.name}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      {plan.targetAmount ? `目标 ${formatMoney(plan.targetAmount)}` : '慢慢攒，不设压力'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-xs leading-5 text-slate-500 dark:bg-slate-700/60 dark:text-slate-400">
              这笔钱会减少当月可用预算，但不会算作消费，也不会影响分类支出图表。
            </div>
          </>
        ) : isRefundMode ? (
          <>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <Link2 size={16} className="text-amber-600 dark:text-amber-400" /> 绑定支出账单
              </div>
              <div className="text-xs text-slate-400">
                {refundKeyword.trim()
                  ? `匹配 ${filteredRefundableExpenses.length} / ${refundableExpenses.length} 笔`
                  : `${refundableExpenses.length} 笔可退`}
              </div>
            </div>
            {refundableExpenses.length > 0 && (
              <div className="relative mb-3">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={refundKeyword}
                  onChange={(event) => setRefundKeyword(event.target.value)}
                  placeholder="搜索备注、分类或金额"
                  className="min-h-10 w-full rounded-full bg-slate-100 pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-amber-300 dark:bg-slate-800 dark:text-slate-100"
                />
                {refundKeyword && (
                  <button
                    onClick={() => setRefundKeyword('')}
                    aria-label="清空搜索"
                    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            )}
            {refundableExpenses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center dark:border-slate-700 dark:bg-slate-800/60">
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400">没有可退款的支出</div>
                <div className="mt-1 text-xs text-slate-400">请先记录支出，或检查是否已经全额退款</div>
              </div>
            ) : filteredRefundableExpenses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center dark:border-slate-700 dark:bg-slate-800/60">
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400">没有匹配的支出</div>
                <div className="mt-1 text-xs text-slate-400">换个关键词试试</div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRefundableExpenses.map((expense) => {
                  const category = categories.find((item) => item.id === expense.categoryId);
                  const remaining = getRemainingRefundableAmount(transactions, expense.id, editingTransaction?.id);
                  const selected = linkedExpenseId === expense.id;
                  return (
                    <button
                      key={expense.id}
                      onClick={() => {
                        setLinkedExpenseId(expense.id);
                        if (!amount) setAmount(String(remaining));
                        setSaveError('');
                      }}
                      className={`flex min-h-18 w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                        selected ? 'border-amber-300 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-400/10' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                      }`}
                    >
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
                        style={{ backgroundColor: category?.color || '#94A3B8' }}
                      >
                        <Icon name={category?.icon || 'more-horizontal'} size={20} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {expense.note || category?.name || '未分类支出'}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-400">
                          {formatShortDate(expense.occurredAt)} · 原支出 {formatMoney(expense.amount)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-xs text-slate-400">可退</span>
                        <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">{formatMoney(remaining)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">选择分类</div>
              <div className="text-xs text-slate-400">{filteredCategories.length} 个</div>
            </div>
            <div className="grid grid-cols-4 gap-x-3 gap-y-4">
              {filteredCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategoryId(category.id)}
              aria-label={`选择${category.name}分类`}
              aria-pressed={selectedCategoryId === category.id}
              className="flex flex-col items-center gap-2"
            >
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-all ${
                  selectedCategoryId === category.id ? 'text-white' : 'bg-gray-100 text-gray-700 dark:bg-slate-700/60 dark:text-slate-300'
                }`}
                style={{
                  backgroundColor: selectedCategoryId === category.id ? category.color : undefined,
                }}
              >
                <Icon name={category.icon} size={24} />
              </div>
              <span className="text-xs">{category.name}</span>
            </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Number Pad */}
      <div className="safe-bottom border-t border-slate-100 bg-slate-50 dark:border-slate-700/50 dark:bg-slate-800/60">
        <div className="grid grid-cols-4">
          {[
            { label: '1', action: () => handleNumber('1') },
            { label: '2', action: () => handleNumber('2') },
            { label: '3', action: () => handleNumber('3') },
            { label: '今天', action: () => setOccurredAt(Date.now()) },
            { label: '4', action: () => handleNumber('4') },
            { label: '5', action: () => handleNumber('5') },
            { label: '6', action: () => handleNumber('6') },
            { label: '清空', action: () => setAmount('') },
            { label: '7', action: () => handleNumber('7') },
            { label: '8', action: () => handleNumber('8') },
            { label: '9', action: () => handleNumber('9') },
            { label: isRefundMode ? '全额' : '再记', action: () => {
              if (isRefundMode && linkedExpenseId) {
                setAmount(String(getRemainingRefundableAmount(transactions, linkedExpenseId, editingTransaction?.id)));
              } else {
                void handleSave(true);
              }
            } },
            { label: '.', action: () => handleNumber('.') },
            { label: '0', action: () => handleNumber('0') },
            { label: '⌫', action: handleBackspace },
            { label: '保存', action: () => handleSave(false), primary: true },
          ].map((btn, idx) => (
            <button
              key={idx}
              onClick={btn.action}
              disabled={btn.label === '保存' && !canSave}
              className={`h-14 text-lg font-medium transition-opacity active:opacity-70 disabled:opacity-40 ${
                btn.primary ? 'bg-primary text-black' : 'border-b border-r border-slate-100 bg-white text-slate-800 dark:border-slate-700/50 dark:bg-slate-800 dark:text-slate-100'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* 组件库滚轮选择器在 iOS PWA 中保持一致外观，记账日期只需精确到天。 */}
      <DatePicker
        className="mintify-date-picker"
        visible={showDatePicker}
        value={new Date(draftOccurredAt)}
        min={TRANSACTION_DATE_MIN}
        max={TRANSACTION_DATE_MAX}
        precision="day"
        title={(
          <div className="mintify-date-picker-title">
            <span className="mintify-date-picker-title-icon" aria-hidden="true">
              <Calendar size={17} strokeWidth={2.25} />
            </span>
            <span>
              <strong>{formatPickerDay(draftOccurredAt)}</strong>
              <small>{formatPickerYearAndWeekday(draftOccurredAt)}</small>
            </span>
          </div>
        )}
        cancelText="取消"
        confirmText="完成"
        closeOnMaskClick
        mouseWheel
        onClose={() => setShowDatePicker(false)}
        onConfirm={(date) => setOccurredAt(date.getTime())}
        onSelect={(date) => setDraftOccurredAt(date.getTime())}
        renderLabel={(type, value) => {
          if (type === 'year') return `${value}年`;
          if (type === 'month') return `${value}月`;
          if (type === 'day') return `${value}日`;
          return String(value);
        }}
      />

      {/* Tag Picker Modal */}
      {showTagPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-4 w-full max-w-sm max-h-[70vh] overflow-y-auto dark:bg-slate-800">
            <div className="flex justify-between items-center mb-4">
              <span className="font-medium">选择标签</span>
              <button onClick={() => setShowTagPicker(false)}><X size={20} /></button>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESET_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-sm ${
                    tags.includes(tag) ? 'bg-primary text-black' : 'bg-gray-100 text-gray-700 dark:bg-slate-700/60 dark:text-slate-300'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Note Input Modal */}
      {showNoteInput && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-4 w-full max-w-sm dark:bg-slate-800">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="请输入备注"
              className="w-full p-3 border border-gray-200 rounded-lg mb-4 min-h-[100px] dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              onClick={() => setShowNoteInput(false)}
              className="w-full py-3 bg-primary rounded-lg font-medium"
            >
              完成
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const TRANSACTION_DATE_MIN = new Date(2000, 0, 1);
const TRANSACTION_DATE_MAX = new Date(2100, 11, 31);
const WEEKDAY_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function formatPickerDay(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatPickerYearAndWeekday(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}年 · ${WEEKDAY_LABELS[date.getDay()]}`;
}
