import { useState } from 'react';
import { ChevronRight, Plus, X } from 'lucide-react';
import CategoryEditor, { type CategoryEditorValue } from '../components/CategoryEditor';
import { useConfirmDeletion } from '../context/ConfirmDialogContext';
import { Icon } from '../components/Icon';
import { useApp } from '../context/AppContext';
import type { FundCategory } from '../types';
import { generateId } from '../utils/helpers';

interface FundCategoryPageProps {
  onClose: () => void;
}

export default function FundCategoryPage({ onClose }: FundCategoryPageProps) {
  const {
    currentLedger,
    fundCategories,
    addFundCategory,
    updateFundCategory,
    removeFundCategory,
  } = useApp();
  const [type, setType] = useState<FundCategory['type']>('expense');
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FundCategory | null>(null);
  const confirmDeletion = useConfirmDeletion();
  const visibleCategories = fundCategories
    .filter((category) => !category.deletedAt && category.type === type)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const closeEditor = () => {
    setShowForm(false);
    setEditingCategory(null);
  };

  const save = async (value: CategoryEditorValue) => {
    if (!currentLedger) return;
    const sameTypeCategories = fundCategories.filter((category) => category.type === type);
    const nextCategory: FundCategory = {
      id: editingCategory?.id || generateId(),
      ledgerId: currentLedger.id,
      ...value,
      type,
      sortOrder: editingCategory?.sortOrder ?? sameTypeCategories.length,
      isBuiltIn: editingCategory?.isBuiltIn ?? false,
    };
    if (editingCategory) await updateFundCategory(nextCategory);
    else await addFundCategory(nextCategory);
    closeEditor();
  };

  const remove = async () => {
    if (!editingCategory) return;
    const confirmed = await confirmDeletion({
      title: '删除资金分类',
      message: `删除“${editingCategory.name}”后，它不会再出现在资金记账中；历史记录仍会保留。`,
    });
    if (!confirmed) return;
    await removeFundCategory(editingCategory.id);
    closeEditor();
  };

  return (
    <div className="mobile-overlay z-[80]">
      <div className="mobile-toolbar">
        <button aria-label="返回资金页" onClick={onClose} className="icon-button text-slate-600"><X size={20} /></button>
        <div className="text-center">
          <div className="font-semibold">资金分类</div>
          <div className="mt-0.5 text-[10px] text-slate-400">仅用于工资与固定收支</div>
        </div>
        <button aria-label="新增资金分类" onClick={() => setShowForm(true)} className="icon-button"><Plus size={22} className="text-amber-700" /></button>
      </div>

      <div className="m-4 flex rounded-xl bg-slate-200/60 p-1">
        {(['expense', 'income'] as const).map((categoryType) => (
          <button
            key={categoryType}
            onClick={() => setType(categoryType)}
            className={`min-h-11 flex-1 rounded-lg text-sm font-medium ${type === categoryType ? 'bg-white shadow-sm' : 'text-slate-500'}`}
          >
            {categoryType === 'expense' ? '支出' : '收入'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <div className="mb-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
          这里的分类与生活费账本分开管理，新增工资、贷款或季度房租等类型不会影响日常预算。
        </div>
        <div className="space-y-2">
          {visibleCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => setEditingCategory(category)}
              className="surface-card flex min-h-16 w-full items-center gap-3 p-3 text-left active:bg-slate-50"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: category.color }}
              >
                <Icon name={category.icon} size={18} />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{category.name}</span>
              {category.isBuiltIn && <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-400">内置</span>}
              <ChevronRight size={18} className="text-slate-300" />
            </button>
          ))}
        </div>
      </div>

      {(showForm || editingCategory) && (
        <CategoryEditor
          title={editingCategory ? '编辑资金分类' : '新建资金分类'}
          initialValue={editingCategory || undefined}
          isBuiltIn={editingCategory?.isBuiltIn}
          onSave={save}
          onCancel={closeEditor}
          onDelete={editingCategory ? remove : undefined}
        />
      )}
    </div>
  );
}
