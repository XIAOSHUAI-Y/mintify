import { useState } from 'react';
import { ChevronRight, Plus, X } from 'lucide-react';
import CategoryEditor, { type CategoryEditorValue } from '../components/CategoryEditor';
import { useConfirmDeletion } from '../context/ConfirmDialogContext';
import { Icon } from '../components/Icon';
import { useApp } from '../context/AppContext';
import type { Category } from '../types';
import { generateId } from '../utils/helpers';

interface CategoryPageProps {
  onClose: () => void;
}

export default function CategoryPage({ onClose }: CategoryPageProps) {
  const { currentLedger, categories, addCategory, updateCategory, removeCategory } = useApp();
  const [type, setType] = useState<Category['type']>('expense');
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const confirmDeletion = useConfirmDeletion();

  const filteredCategories = categories
    .filter((category) => !category.deletedAt && category.type === type && category.name !== '退款')
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const closeEditor = () => {
    setShowForm(false);
    setEditingCategory(null);
  };

  const save = async (value: CategoryEditorValue) => {
    if (!currentLedger) return;
    const sameTypeCategories = categories.filter((category) =>
      category.type === type && category.ledgerId === currentLedger.id);
    const nextCategory: Category = {
      id: editingCategory?.id || generateId(),
      ledgerId: currentLedger.id,
      ...value,
      type,
      sortOrder: editingCategory?.sortOrder ?? sameTypeCategories.length,
      isBuiltIn: editingCategory?.isBuiltIn ?? false,
    };
    if (editingCategory) await updateCategory(nextCategory);
    else await addCategory(nextCategory);
    closeEditor();
  };

  const remove = async () => {
    if (!editingCategory) return;
    const confirmed = await confirmDeletion({
      title: '删除分类',
      message: `删除“${editingCategory.name}”后，它不会再出现在新增记账中；历史账单仍会保留。`,
    });
    if (!confirmed) return;
    await removeCategory(editingCategory.id);
    closeEditor();
  };

  return (
    <div className="mobile-overlay">
      <div className="mobile-toolbar">
        <button aria-label="返回明细" onClick={onClose} className="icon-button text-slate-600 dark:text-slate-300"><X size={20} /></button>
        <div className="font-semibold">分类管理</div>
        <button aria-label="新增分类" onClick={() => setShowForm(true)} className="icon-button"><Plus size={22} className="text-amber-700 dark:text-amber-300" /></button>
      </div>

      <div className="m-4 flex rounded-xl bg-slate-200/60 p-1 dark:bg-slate-600/60">
        {(['expense', 'income'] as const).map((categoryType) => (
          <button
            key={categoryType}
            onClick={() => setType(categoryType)}
            className={`min-h-11 flex-1 rounded-lg text-sm font-medium ${type === categoryType ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500 dark:text-slate-400'}`}
          >
            {categoryType === 'expense' ? '支出' : '收入'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <div className="space-y-2">
          {filteredCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => setEditingCategory(category)}
              className="surface-card flex min-h-16 w-full items-center gap-3 p-3 text-left active:bg-slate-50 dark:active:bg-slate-800"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: category.color }}
              >
                <Icon name={category.icon} size={18} />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">{category.name}</span>
              {category.isBuiltIn && <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-400 dark:bg-slate-700/60">内置</span>}
              <ChevronRight size={18} className="text-slate-300" />
            </button>
          ))}
        </div>
      </div>

      {(showForm || editingCategory) && (
        <CategoryEditor
          title={editingCategory ? '编辑分类' : '新建分类'}
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
