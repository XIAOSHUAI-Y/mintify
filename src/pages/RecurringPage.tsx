import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Icon } from '../components/Icon';
import { generateId, formatMoney, formatShortDate } from '../utils/helpers';
import type { RecurringRule } from '../types';

interface RecurringPageProps {
  onClose: () => void;
}

const FREQUENCY_LABELS: Record<RecurringRule['frequency'], string> = {
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  yearly: '每年',
};

export default function RecurringPage({ onClose }: RecurringPageProps) {
  const { categories, recurringRules, addRecurringRule, updateRecurringRule, removeRecurringRule } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);

  const sortedRules = [...recurringRules].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <button onClick={onClose} className="text-gray-600"><X size={20} /></button>
        <div className="font-medium">周期记账</div>
        <button onClick={() => setShowForm(true)}><Plus size={22} className="text-yellow-700" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {sortedRules.length === 0 ? (
          <div className="text-center text-gray-400 mt-12">还没有周期记账规则</div>
        ) : (
          <div className="space-y-3">
            {sortedRules.map((rule) => {
              const category = categories.find((c) => c.id === rule.categoryId);
              return (
                <button
                  key={rule.id}
                  onClick={() => setEditingRule(rule)}
                  className="w-full flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-xl text-left active:bg-gray-50"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: category?.color || '#9CA3AF' }}
                  >
                    <Icon name={category?.icon || 'more-horizontal'} size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{category?.name || '未分类'}</div>
                    <div className="text-xs text-gray-500">
                      {FREQUENCY_LABELS[rule.frequency]} · 从 {formatShortDate(rule.startDate)} 开始
                    </div>
                  </div>
                  <div
                    className={`font-semibold ${
                      rule.type === 'income' ? 'text-green-600' : rule.type === 'expense' ? 'text-red-500' : 'text-blue-500'
                    }`}
                  >
                    {rule.type === 'income' ? '+' : rule.type === 'expense' ? '-' : ''}
                    {formatMoney(rule.amount)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {(showForm || editingRule) && (
        <RecurringForm
          rule={editingRule}
          categories={categories}
          onSave={(rule) => {
            if (editingRule) {
              updateRecurringRule(rule);
            } else {
              addRecurringRule(rule);
            }
            setShowForm(false);
            setEditingRule(null);
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingRule(null);
          }}
          onDelete={
            editingRule
              ? () => {
                  removeRecurringRule(editingRule.id);
                  setEditingRule(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function RecurringForm({
  rule,
  categories,
  onSave,
  onCancel,
  onDelete,
}: {
  rule: RecurringRule | null;
  categories: { id: string; name: string; icon: string; color: string; type: RecurringRule['type'] }[];
  onSave: (rule: RecurringRule) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const { currentLedger } = useApp();
  const [type, setType] = useState<RecurringRule['type']>(rule?.type || 'expense');
  const [amount, setAmount] = useState(rule ? String(rule.amount) : '');
  const [categoryId, setCategoryId] = useState(rule?.categoryId || '');
  const [frequency, setFrequency] = useState<RecurringRule['frequency']>(rule?.frequency || 'monthly');
  const [interval, setInterval] = useState(rule ? String(rule.interval) : '1');
  const [startDate, setStartDate] = useState(
    rule ? new Date(rule.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [hasEndDate, setHasEndDate] = useState(!!rule?.endDate);
  const [endDate, setEndDate] = useState(
    rule?.endDate ? new Date(rule.endDate).toISOString().split('T')[0] : ''
  );
  const [note, setNote] = useState(rule?.note || '');

  const filteredCategories = categories.filter((c) => c.type === type);

  const handleSave = () => {
    if (!currentLedger || !amount || isNaN(Number(amount)) || !categoryId) return;

    onSave({
      id: rule?.id || generateId(),
      ledgerId: currentLedger.id,
      categoryId,
      amount: Number(amount),
      type,
      note,
      frequency,
      interval: Number(interval) || 1,
      startDate: new Date(startDate).getTime(),
      endDate: hasEndDate && endDate ? new Date(endDate).getTime() : undefined,
      lastGeneratedDate: rule?.lastGeneratedDate,
      createdAt: rule?.createdAt || Date.now(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-4 max-h-[80vh] overflow-y-auto">
        <div className="font-medium text-center mb-4">{rule ? '编辑周期记账' : '新建周期记账'}</div>

        <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
          {(['expense', 'income', 'transfer'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-2 rounded-md text-sm ${type === t ? 'bg-white shadow-sm' : 'text-gray-500'}`}
            >
              {t === 'expense' ? '支出' : t === 'income' ? '收入' : '转账'}
            </button>
          ))}
        </div>

        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="金额"
          className="w-full p-3 border border-gray-200 rounded-lg mb-3"
        />

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full p-3 border border-gray-200 rounded-lg mb-3"
        >
          <option value="">选择分类</option>
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as RecurringRule['frequency'])}
          className="w-full p-3 border border-gray-200 rounded-lg mb-3"
        >
          <option value="daily">每天</option>
          <option value="weekly">每周</option>
          <option value="monthly">每月</option>
          <option value="yearly">每年</option>
        </select>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-gray-500">每</span>
          <input
            type="number"
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            className="flex-1 p-3 border border-gray-200 rounded-lg"
          />
          <span className="text-sm text-gray-500">{FREQUENCY_LABELS[frequency]}</span>
        </div>

        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full p-3 border border-gray-200 rounded-lg mb-3"
        />

        <div className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            id="hasEndDate"
            checked={hasEndDate}
            onChange={(e) => setHasEndDate(e.target.checked)}
          />
          <label htmlFor="hasEndDate" className="text-sm">设置结束日期</label>
        </div>

        {hasEndDate && (
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-lg mb-3"
          />
        )}

        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="备注（可选）"
          className="w-full p-3 border border-gray-200 rounded-lg mb-4"
        />

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
