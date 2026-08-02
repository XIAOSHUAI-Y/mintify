import { useMemo, useState } from 'react';
import { DatePicker } from 'antd-mobile';
import {
  Banknote,
  CalendarDays,
  Car,
  ChevronDown,
  CreditCard,
  Gift,
  House,
  ReceiptText,
  ShoppingBag,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import { generateId } from '../utils/helpers';
import type { Category, FundTransaction, Transaction } from '../types';

export type FundRecordFormMode = 'income' | 'expense' | 'allocation';

interface FundRecordFormProps {
  mode: FundRecordFormMode;
  ledgerId: string;
  monthDate: Date;
  record?: FundTransaction | null;
  existingIncomes?: Transaction[];
  ledgerCategories?: Category[];
  onSave: (record: FundTransaction) => void | Promise<void>;
  onLinkExisting?: (transaction: Transaction) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: () => void | Promise<void>;
}

const INCOME_CATEGORIES = [
  { name: '工资', icon: Banknote, color: 'bg-emerald-500' },
  { name: '奖金', icon: Gift, color: 'bg-teal-500' },
  { name: '其他收入', icon: ReceiptText, color: 'bg-sky-500' },
];

const EXPENSE_CATEGORIES = [
  { name: '车贷', icon: Car, color: 'bg-blue-500' },
  { name: '房租', icon: House, color: 'bg-violet-500' },
  { name: '京东白条', icon: ShoppingBag, color: 'bg-rose-500' },
  { name: '花呗', icon: CreditCard, color: 'bg-cyan-500' },
  { name: '其他支出', icon: ReceiptText, color: 'bg-slate-500' },
];

export default function FundRecordForm({
  mode,
  ledgerId,
  monthDate,
  record,
  existingIncomes = [],
  ledgerCategories = [],
  onSave,
  onLinkExisting,
  onCancel,
  onDelete,
}: FundRecordFormProps) {
  const categories = mode === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const [amount, setAmount] = useState(record ? String(record.amount) : '');
  const [category, setCategory] = useState(
    mode === 'allocation' ? '生活费' : record?.category || categories[0].name,
  );
  const [note, setNote] = useState(record?.note || '');
  const [occurredAt, setOccurredAt] = useState(record?.occurredAt || getDefaultDate(monthDate));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [allocationSource, setAllocationSource] = useState<'new' | 'existing'>(
    record?.mainIncomeOrigin === 'existing' ? 'existing' : 'new',
  );
  const [selectedIncomeId, setSelectedIncomeId] = useState(
    record?.linkedTransactionId || existingIncomes[0]?.id || '',
  );
  const parsedAmount = Number(amount);
  const amountValid = amount.trim() !== '' && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const linkingExisting = mode === 'allocation' && allocationSource === 'existing';
  const existingBindingLocked = linkingExisting && !!record;
  const selectedIncome = existingIncomes.find((transaction) => transaction.id === selectedIncomeId);
  const canSave = linkingExisting ? existingBindingLocked || !!selectedIncome : amountValid;
  const title = record
    ? `编辑${mode === 'allocation' ? '生活费' : '资金记录'}`
    : mode === 'allocation'
      ? '划拨生活费'
      : `新增${mode === 'income' ? '收入' : '支出'}`;
  const selectedCategoryMeta = useMemo(
    () => categories.find((item) => item.name === category),
    [categories, category],
  );

  const handleSave = async () => {
    if (existingBindingLocked) {
      onCancel();
      return;
    }
    if (linkingExisting) {
      if (selectedIncome && onLinkExisting) await onLinkExisting(selectedIncome);
      return;
    }
    if (!amountValid) return;
    const now = Date.now();
    await onSave({
      id: record?.id || generateId(),
      ledgerId,
      type: mode === 'income' ? 'income' : 'expense',
      category: mode === 'allocation' ? '生活费' : category,
      kind: mode === 'allocation' ? 'living-expense-allocation' : 'record',
      amount: parsedAmount,
      note: note.trim(),
      occurredAt,
      createdAt: record?.createdAt || now,
      linkedTransactionId: record?.linkedTransactionId,
      mainIncomeOrigin: record?.mainIncomeOrigin,
    });
  };

  return (
    <div className="mobile-overlay z-[80]">
      <div className="mobile-toolbar">
        <button aria-label="取消" onClick={onCancel} className="icon-button text-slate-600"><X size={20} /></button>
        <div className="font-semibold">{title}</div>
        <button
          onClick={() => void handleSave()}
          disabled={!canSave}
          className="min-h-11 rounded-full px-2 text-sm font-semibold text-amber-700 disabled:text-slate-300"
        >
          {existingBindingLocked ? '完成' : '保存'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50 p-4 pb-8">
        {mode === 'allocation' && !linkingExisting && (
          <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs leading-5 text-amber-800">
            保存后，资金账本记录一笔“生活费”支出，主账本自动增加同金额的“生活费”收入。
          </div>
        )}

        {mode === 'allocation' && !record && existingIncomes.length > 0 && (
          <div className="mb-4 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
            <button
              onClick={() => setAllocationSource('new')}
              className={`min-h-11 rounded-xl text-sm font-medium ${allocationSource === 'new' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              新建划拨
            </button>
            <button
              onClick={() => setAllocationSource('existing')}
              className={`min-h-11 rounded-xl text-sm font-medium ${allocationSource === 'existing' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              关联已有收入
            </button>
          </div>
        )}

        {linkingExisting && (
          <div className="mb-4 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-xs leading-5 text-sky-800">
            {existingBindingLocked
              ? '这笔生活费来自主账本已有收入。资金页只保存关联，解除关联不会删除原收入。'
              : '选择主账本本月已有收入后，资金页只新增对应生活费支出，不会重复创建收入。'}
          </div>
        )}

        <section className="surface-card p-4">
          {linkingExisting ? (
            <div>
              <div className="mb-3 text-xs font-medium text-slate-500">选择主账本收入</div>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                {existingIncomes.map((transaction) => {
                  const selected = transaction.id === selectedIncomeId;
                  const categoryName = ledgerCategories.find((item) => item.id === transaction.categoryId)?.name;
                  return (
                    <button
                      key={transaction.id}
                      disabled={existingBindingLocked}
                      onClick={() => setSelectedIncomeId(transaction.id)}
                      className={`flex min-h-16 w-full items-center gap-3 border-b border-slate-100 px-3 text-left last:border-0 ${selected ? 'bg-amber-50' : 'bg-white'} disabled:opacity-100`}
                    >
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${selected ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300 text-transparent'}`}>✓</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800">{transaction.note || categoryName || '主账本收入'}</span>
                        <span className="mt-1 block text-xs text-slate-400">{formatFullDate(transaction.occurredAt)}</span>
                      </span>
                      <span className="text-sm font-semibold text-emerald-600">+¥{transaction.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
          <>
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-slate-500">金额</span>
            <div className="flex min-h-16 items-center rounded-2xl border border-slate-200 bg-white px-4 focus-within:border-amber-400 focus-within:ring-4 focus-within:ring-amber-100">
              <span className="mr-2 text-xl font-semibold text-slate-400">¥</span>
              <input
                autoFocus
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                className="min-w-0 flex-1 bg-transparent text-2xl font-semibold text-slate-900 outline-none"
              />
            </div>
          </label>

          {mode !== 'allocation' && (
            <div className="mt-5">
              <div className="mb-2 text-xs font-medium text-slate-500">类型</div>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((item) => {
                  const CategoryIcon = item.icon;
                  const selected = category === item.name;
                  return (
                    <button
                      key={item.name}
                      onClick={() => setCategory(item.name)}
                      className={`flex min-h-14 items-center gap-3 rounded-2xl border px-3 text-left transition-colors ${
                        selected
                          ? 'border-amber-300 bg-amber-50 text-amber-900'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-white ${item.color}`}>
                        <CategoryIcon size={18} />
                      </span>
                      <span className="text-sm font-medium">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {mode === 'allocation' && (
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-amber-50 p-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white"><WalletCards size={19} /></span>
              <span>
                <span className="block text-sm font-semibold text-amber-900">生活费</span>
                <span className="mt-0.5 block text-[11px] text-amber-700">同步到当前生活费主账本</span>
              </span>
            </div>
          )}

          <div className="mt-5">
            <div className="mb-2 text-xs font-medium text-slate-500">日期</div>
            <button
              onClick={() => setShowDatePicker(true)}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-200 px-3 text-left active:bg-slate-50"
            >
              <CalendarDays size={19} className="text-amber-600" />
              <span className="flex-1 text-sm font-medium text-slate-700">{formatFullDate(occurredAt)}</span>
              <ChevronDown size={18} className="text-slate-400" />
            </button>
          </div>

          <label className="mt-5 block">
            <span className="mb-2 block text-xs font-medium text-slate-500">备注（可选）</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={mode === 'allocation' ? '例如：8月生活费' : `例如：${selectedCategoryMeta?.name || category}`}
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
            />
          </label>
          </>
          )}
        </section>

        {onDelete && (
          <button
            onClick={() => void onDelete()}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-rose-50 text-sm font-medium text-rose-600"
          >
            <Trash2 size={17} />
            {record?.mainIncomeOrigin === 'existing' ? '解除关联' : '删除这条记录'}
          </button>
        )}
      </div>

      <DatePicker
        className="mintify-date-picker"
        visible={showDatePicker}
        value={new Date(occurredAt)}
        precision="day"
        title="选择发生日期"
        cancelText="取消"
        confirmText="完成"
        onClose={() => setShowDatePicker(false)}
        onConfirm={(date) => setOccurredAt(date.getTime())}
      />
    </div>
  );
}

function getDefaultDate(monthDate: Date): number {
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === monthDate.getFullYear()
    && now.getMonth() === monthDate.getMonth();
  if (isCurrentMonth) return now.getTime();
  return new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getTime();
}

function formatFullDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}
