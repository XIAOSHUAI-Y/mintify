import { useState } from 'react';
import { ChevronRight, Plus, X } from 'lucide-react';
import CategoryEditor, {
  type CategoryEditorValue,
  type CategoryParentOption,
} from '../components/CategoryEditor';
import { useConfirmDeletion } from '../context/ConfirmDialogContext';
import { Icon } from '../components/Icon';
import { useApp } from '../context/AppContext';
import type { Category } from '../types';
import { generateId } from '../utils/helpers';
import {
  buildCategoryTree,
  getChildCategories,
  validateParentAssignment,
} from '../domain/categoryTree';

interface CategoryPageProps {
  onClose: () => void;
}

export default function CategoryPage({ onClose }: CategoryPageProps) {
  const { currentLedger, categories, addCategory, updateCategory, removeCategory } = useApp();
  const [type, setType] = useState<Category['type']>('expense');
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  /** 新建子分类时预设的父级。 */
  const [presetParentId, setPresetParentId] = useState<string>('');
  const [error, setError] = useState('');
  const confirmDeletion = useConfirmDeletion();

  const filteredCategories = categories
    .filter((category) => !category.deletedAt && category.type === type && category.name !== '退款')
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const tree = buildCategoryTree(filteredCategories);

  const closeEditor = () => {
    setShowForm(false);
    setEditingCategory(null);
    setPresetParentId('');
    setError('');
  };

  /** 可选的上级：同类型、未软删、自己不是子分类，且不能是被编辑的自己。 */
  const parentOptions: CategoryParentOption[] = filteredCategories
    .filter((category) =>
      !category.parentId && category.id !== editingCategory?.id)
    .map((category) => ({ id: category.id, name: category.name, icon: category.icon }));

  const save = async (value: CategoryEditorValue, parentId?: string) => {
    if (!currentLedger) return;
    const editingId = editingCategory?.id;
    if (parentId) {
      const blocked = validateParentAssignment({
        categories,
        categoryType: type,
        ledgerId: currentLedger.id,
        categoryId: editingId,
        parentId,
      });
      if (blocked) {
        setError(blocked);
        return;
      }
    }

    const sameTypeCategories = categories.filter((category) =>
      category.type === type && category.ledgerId === currentLedger.id);
    const siblings = parentId
      ? categories.filter((category) => category.parentId === parentId && !category.deletedAt)
      : sameTypeCategories.filter((category) => !category.parentId);
    const nextCategory: Category = {
      id: editingId || generateId(),
      ledgerId: currentLedger.id,
      ...value,
      type,
      parentId,
      sortOrder: editingCategory?.sortOrder ?? siblings.length,
      isBuiltIn: editingCategory?.isBuiltIn ?? false,
    };
    if (editingCategory) await updateCategory(nextCategory);
    else await addCategory(nextCategory);
    closeEditor();
  };

  const remove = async (category: Category) => {
    const children = getChildCategories(categories, category.id);
    if (children.length > 0) {
      await confirmDeletion({
        title: '无法删除',
        message: `“${category.name}”下还有 ${children.length} 个子分类：${children.map((child) => child.name).join('、')}。请先删除或移出子分类。`,
        confirmText: '知道了',
      });
      return;
    }
    const confirmed = await confirmDeletion({
      title: '删除分类',
      message: `删除“${category.name}”后，它不会再出现在新增记账中；历史账单仍会保留。`,
    });
    if (!confirmed) return;
    try {
      await removeCategory(category.id);
      closeEditor();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '删除失败');
    }
  };

  const openCreate = (categoryParentId = '') => {
    setError('');
    setEditingCategory(null);
    setPresetParentId(categoryParentId);
    setShowForm(true);
  };

  const openEdit = (category: Category) => {
    setError('');
    setEditingCategory(category);
    setPresetParentId('');
    setShowForm(true);
  };

  return (
    <div className="mobile-overlay">
      <div className="mobile-toolbar">
        <button aria-label="返回明细" onClick={onClose} className="icon-button text-slate-600 dark:text-slate-300"><X size={20} /></button>
        <div className="font-semibold">分类管理</div>
        <button aria-label="新增分类" onClick={() => openCreate()} className="icon-button"><Plus size={22} className="text-amber-700 dark:text-amber-300" /></button>
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
          {tree.roots.map((category) => {
            const children = getChildCategories(categories, category.id)
              .filter((child) => child.type === type);
            return (
              <div key={category.id} className="surface-card overflow-hidden">
                <div className="flex items-center gap-2 p-3">
                  <button
                    onClick={() => openEdit(category)}
                    className="flex min-h-10 min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                      style={{ backgroundColor: category.color }}
                    >
                      <Icon name={category.icon} size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-800 dark:text-slate-100">{category.name}</span>
                      {children.length > 0 && (
                        <span className="mt-0.5 block text-[11px] text-slate-400">{children.length} 个子分类，用于分组</span>
                      )}
                    </span>
                    {category.isBuiltIn && <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-400 dark:bg-slate-700/60">内置</span>}
                    <ChevronRight size={18} className="text-slate-300" />
                  </button>
                  <button
                    aria-label={`在${category.name}下新增子分类`}
                    onClick={() => openCreate(category.id)}
                    className="icon-button !h-9 !w-9 shrink-0"
                  >
                    <Plus size={18} className="text-amber-700 dark:text-amber-300" />
                  </button>
                </div>

                {children.length > 0 && (
                  <div className="border-t border-slate-100 dark:border-slate-700/50">
                    {children.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => openEdit(child)}
                        className="flex min-h-12 w-full items-center gap-3 border-b border-slate-100 py-2 pl-14 pr-3 text-left last:border-0 active:bg-slate-50 dark:border-slate-700/50 dark:active:bg-slate-800"
                      >
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
                          style={{ backgroundColor: child.color }}
                        >
                          <Icon name={child.icon} size={14} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-600 dark:text-slate-300">{child.name}</span>
                        <ChevronRight size={16} className="text-slate-300" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {(showForm || editingCategory) && (
        <CategoryEditor
          title={editingCategory ? '编辑分类' : presetParentId ? '新建子分类' : '新建分类'}
          initialValue={editingCategory || undefined}
          isBuiltIn={editingCategory?.isBuiltIn}
          parentOptions={parentOptions}
          initialParentId={editingCategory?.parentId || presetParentId}
          onSave={save}
          onCancel={closeEditor}
          onDelete={editingCategory ? () => remove(editingCategory) : undefined}
          errorMessage={error}
        />
      )}
    </div>
  );
}
