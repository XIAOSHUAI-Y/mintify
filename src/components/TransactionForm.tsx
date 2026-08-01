import { useEffect, useMemo, useState } from 'react';
import { Calendar, Tag, FileImage, X, FileText } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Icon } from './Icon';
import { generateId, formatShortDate } from '../utils/helpers';
import { PRESET_TAGS } from '../data/seed';
import type { Transaction } from '../types';

interface TransactionFormProps {
  onClose: () => void;
  editingTransaction?: Transaction | null;
}

export default function TransactionForm({ onClose, editingTransaction }: TransactionFormProps) {
  const {
    currentLedger,
    categories,
    addTransaction,
    updateTransaction,
  } = useApp();

  const [type, setType] = useState<Transaction['type']>(editingTransaction?.type || 'expense');
  const [amount, setAmount] = useState(editingTransaction ? String(editingTransaction.amount) : '');
  const [selectedCategoryId, setSelectedCategoryId] = useState(editingTransaction?.categoryId || '');
  const [occurredAt, setOccurredAt] = useState(editingTransaction?.occurredAt || Date.now());
  const [note, setNote] = useState(editingTransaction?.note || '');
  const [tags, setTags] = useState<string[]>(editingTransaction?.tags || []);
  const [photo, setPhoto] = useState(editingTransaction?.photo || '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories, type]
  );

  useEffect(() => {
    const categoryStillMatchesType = filteredCategories.some((category) => category.id === selectedCategoryId);
    // 切换收支类型时必须同步切换分类，避免保存出“收入 + 支出分类”的脏数据。
    if (!categoryStillMatchesType) {
      setSelectedCategoryId(filteredCategories[0]?.id || '');
    }
  }, [filteredCategories, selectedCategoryId]);

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

  const handleSave = (keepOpen = false) => {
    if (!currentLedger || !selectedCategoryId || !amount || isNaN(Number(amount))) return;

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
    };

    if (editingTransaction) {
      updateTransaction(transactionData);
    } else {
      addTransaction(transactionData);
    }

    if (keepOpen) {
      setAmount('');
      setNote('');
      setTags([]);
      setPhoto('');
      setOccurredAt(Date.now());
      setSelectedCategoryId(filteredCategories[0]?.id || '');
    } else {
      onClose();
    }
  };

  return (
    <div className="mobile-overlay bg-white">
      <div className="mobile-toolbar">
        <button onClick={onClose} className="min-h-11 rounded-full px-2 text-sm text-slate-500 active:bg-slate-100">取消</button>
        <div className="font-semibold">{editingTransaction ? '编辑账单' : currentLedger?.name || '记账'}</div>
        <button
          onClick={() => handleSave(false)}
          className="min-h-11 rounded-full px-2 text-sm font-semibold text-amber-700 disabled:text-slate-300"
          disabled={!amount || !selectedCategoryId}
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
        <div className="flex rounded-xl bg-slate-100 p-1">
          {(['expense', 'income', 'transfer'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={`min-h-11 flex-1 rounded-lg text-sm font-medium transition-colors ${
                type === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              {t === 'expense' ? '支出' : t === 'income' ? '收入' : '转账'}
            </button>
          ))}
        </div>
      </div>

      {/* Meta Fields */}
      <div className="mb-4 flex gap-2 overflow-x-auto px-4 pb-1 hide-scrollbar">
        <button
          onClick={() => setShowDatePicker(true)}
          className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-sm"
        >
          <Calendar size={16} />
          {formatShortDate(occurredAt)}
        </button>
        <button
          onClick={() => setShowTagPicker(true)}
          className="flex min-h-10 max-w-32 shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-sm"
        >
          <Tag size={16} />
          {tags.length > 0 ? tags.join(',') : '标签'}
        </button>
        <button
          onClick={() => setShowNoteInput(true)}
          className="flex min-h-10 max-w-32 shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-sm"
        >
          <FileText size={16} />
          {note || '备注'}
        </button>
        <label className="flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-slate-100 px-3 text-sm">
          <FileImage size={16} />
          {photo ? '已选图片' : '图片'}
          <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        </label>
      </div>

      {photo && (
        <div className="px-4 mb-4">
          <img src={photo} alt="receipt" className="h-20 w-20 object-cover rounded-lg" />
        </div>
      )}

      {/* Category Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-800">选择分类</div>
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
                  selectedCategoryId === category.id ? 'text-white' : 'bg-gray-100 text-gray-700'
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
      </div>

      {/* Number Pad */}
      <div className="safe-bottom border-t border-slate-100 bg-slate-50">
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
            { label: '再记', action: () => handleSave(true) },
            { label: '.', action: () => handleNumber('.') },
            { label: '0', action: () => handleNumber('0') },
            { label: '⌫', action: handleBackspace },
            { label: '保存', action: () => handleSave(false), primary: true },
          ].map((btn, idx) => (
            <button
              key={idx}
              onClick={btn.action}
              disabled={btn.label === '保存' && (!amount || !selectedCategoryId)}
              className={`h-14 text-lg font-medium transition-opacity active:opacity-70 disabled:opacity-40 ${
                btn.primary ? 'bg-primary text-black' : 'border-b border-r border-slate-100 bg-white text-slate-800'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-4 w-full max-w-sm">
            <input
              type="date"
              value={new Date(occurredAt).toISOString().split('T')[0]}
              onChange={(e) => setOccurredAt(new Date(e.target.value).getTime())}
              className="w-full p-3 border border-gray-200 rounded-lg mb-4"
            />
            <button
              onClick={() => setShowDatePicker(false)}
              className="w-full py-3 bg-primary rounded-lg font-medium"
            >
              完成
            </button>
          </div>
        </div>
      )}

      {/* Tag Picker Modal */}
      {showTagPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-4 w-full max-w-sm max-h-[70vh] overflow-y-auto">
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
                    tags.includes(tag) ? 'bg-primary text-black' : 'bg-gray-100 text-gray-700'
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
          <div className="bg-white rounded-2xl p-4 w-full max-w-sm">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="请输入备注"
              className="w-full p-3 border border-gray-200 rounded-lg mb-4 min-h-[100px]"
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
