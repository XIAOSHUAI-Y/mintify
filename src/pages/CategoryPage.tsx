import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Icon } from '../components/Icon';
import { APP_COLORS, APP_ICONS } from '../data/seed';
import { generateId } from '../utils/helpers';
import type { Category } from '../types';

interface CategoryPageProps {
  onClose: () => void;
}

export default function CategoryPage({ onClose }: CategoryPageProps) {
  const { categories, addCategory, updateCategory, removeCategory } = useApp();
  const [type, setType] = useState<Category['type']>('expense');
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const filteredCategories = categories
    .filter((c) => c.type === type)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <button onClick={onClose} className="text-gray-600"><X size={20} /></button>
        <div className="font-medium">分类管理</div>
        <button onClick={() => setShowForm(true)}><Plus size={22} className="text-yellow-700" /></button>
      </div>

      <div className="flex p-2 bg-gray-50 m-4 rounded-lg">
        <button
          onClick={() => setType('expense')}
          className={`flex-1 py-2 rounded-md text-sm ${type === 'expense' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
        >
          支出
        </button>
        <button
          onClick={() => setType('income')}
          className={`flex-1 py-2 rounded-md text-sm ${type === 'income' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
        >
          收入
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        <div className="space-y-2">
          {filteredCategories.map((category) => (
            <div
              key={category.id}
              className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                style={{ backgroundColor: category.color }}
              >
                <Icon name={category.icon} size={18} />
              </div>
              <span className="flex-1">{category.name}</span>
              {category.isBuiltIn ? (
                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded">内置</span>
              ) : (
                <button
                  onClick={() => setEditingCategory(category)}
                  className="text-gray-400"
                >
                  编辑
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {(showForm || editingCategory) && (
        <CategoryForm
          category={editingCategory}
          type={type}
          onSave={(category) => {
            if (editingCategory) {
              updateCategory(category);
            } else {
              addCategory(category);
            }
            setShowForm(false);
            setEditingCategory(null);
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingCategory(null);
          }}
          onDelete={
            editingCategory
              ? () => {
                  removeCategory(editingCategory.id);
                  setEditingCategory(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function CategoryForm({
  category,
  type,
  onSave,
  onCancel,
  onDelete,
}: {
  category: Category | null;
  type: Category['type'];
  onSave: (category: Category) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const { currentLedger, categories } = useApp();
  const [name, setName] = useState(category?.name || '');
  const [icon, setIcon] = useState(category?.icon || APP_ICONS[0]);
  const [color, setColor] = useState(category?.color || APP_COLORS[0]);

  const handleSave = () => {
    if (!currentLedger || !name) return;

    const sameTypeCategories = categories.filter((c) => c.type === type && c.ledgerId === currentLedger.id);

    onSave({
      id: category?.id || generateId(),
      ledgerId: currentLedger.id,
      name,
      icon,
      color,
      type,
      sortOrder: category?.sortOrder || sameTypeCategories.length,
      isBuiltIn: false,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-4 max-h-[80vh] overflow-y-auto">
        <div className="font-medium text-center mb-4">{category ? '编辑分类' : '新建分类'}</div>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="分类名称"
          className="w-full p-3 border border-gray-200 rounded-lg mb-4"
        />

        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-2">图标</div>
          <div className="grid grid-cols-5 gap-2">
            {APP_ICONS.map((iconName) => (
              <button
                key={iconName}
                onClick={() => setIcon(iconName)}
                className={`p-2 rounded-lg ${icon === iconName ? 'bg-primary' : 'bg-gray-100'}`}
              >
                <Icon name={iconName} size={20} />
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-2">颜色</div>
          <div className="grid grid-cols-5 gap-2">
            {APP_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-10 h-10 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-gray-800' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

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
