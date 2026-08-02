import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { APP_COLORS, APP_ICONS } from '../data/seed';
import { Icon } from './Icon';

export interface CategoryEditorValue {
  name: string;
  icon: string;
  color: string;
}

interface CategoryEditorProps {
  title: string;
  initialValue?: CategoryEditorValue;
  isBuiltIn?: boolean;
  onSave: (value: CategoryEditorValue) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: () => void | Promise<void>;
}

export default function CategoryEditor({
  title,
  initialValue,
  isBuiltIn = false,
  onSave,
  onCancel,
  onDelete,
}: CategoryEditorProps) {
  const [name, setName] = useState(initialValue?.name || '');
  const [icon, setIcon] = useState(initialValue?.icon || APP_ICONS[0]);
  const [color, setColor] = useState(initialValue?.color || APP_COLORS[0]);
  const normalizedName = name.trim();

  return (
    <div className="mobile-overlay z-[90] bg-slate-50">
      <div className="mobile-toolbar">
        <button aria-label="取消编辑" onClick={onCancel} className="icon-button text-slate-600">
          <X size={20} />
        </button>
        <div className="text-center">
          <div className="font-semibold">{title}</div>
          {isBuiltIn && <div className="mt-0.5 text-[10px] text-slate-400">内置分类也可以修改或删除</div>}
        </div>
        <button
          disabled={!normalizedName}
          onClick={() => void onSave({ name: normalizedName, icon, color })}
          className="min-h-11 rounded-full px-2 text-sm font-semibold text-amber-700 disabled:text-slate-300"
        >
          保存
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-8">
        <section className="surface-card p-4">
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-50 to-white p-3 ring-1 ring-amber-100">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
              style={{ backgroundColor: color }}
            >
              <Icon name={icon} size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-slate-400">分类预览</span>
              <span className="mt-1 block truncate font-semibold text-slate-800">{normalizedName || '分类名称'}</span>
            </span>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-slate-500">名称</span>
            <input
              autoFocus
              value={name}
              maxLength={12}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：充电、红包、保险"
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
            />
          </label>
        </section>

        <section className="surface-card mt-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">选择图标</span>
            <span className="text-xs text-slate-400">{APP_ICONS.length} 个</span>
          </div>
          {/* 图标统一来自 Icon 映射，避免保存后因组件引用无法序列化。 */}
          <div className="grid grid-cols-5 gap-2">
            {APP_ICONS.map((iconName) => (
              <button
                key={iconName}
                aria-label={`选择图标 ${iconName}`}
                aria-pressed={icon === iconName}
                onClick={() => setIcon(iconName)}
                className={`flex aspect-square items-center justify-center rounded-xl border transition-colors ${
                  icon === iconName
                    ? 'border-amber-300 bg-amber-50 text-amber-700 shadow-sm'
                    : 'border-slate-100 bg-slate-50 text-slate-500'
                }`}
              >
                <Icon name={iconName} size={20} />
              </button>
            ))}
          </div>
        </section>

        <section className="surface-card mt-4 p-4">
          <div className="mb-3 text-sm font-semibold text-slate-800">选择颜色</div>
          <div className="grid grid-cols-5 gap-3">
            {APP_COLORS.map((colorValue) => (
              <button
                key={colorValue}
                aria-label={`选择颜色 ${colorValue}`}
                aria-pressed={color === colorValue}
                onClick={() => setColor(colorValue)}
                className={`mx-auto h-10 w-10 rounded-full border-4 border-white shadow-sm ${
                  color === colorValue ? 'ring-2 ring-amber-400 ring-offset-2' : ''
                }`}
                style={{ backgroundColor: colorValue }}
              />
            ))}
          </div>
        </section>

        {onDelete && (
          <button
            onClick={() => void onDelete()}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-rose-50 text-sm font-medium text-rose-600"
          >
            <Trash2 size={17} />删除分类
          </button>
        )}
      </div>
    </div>
  );
}
