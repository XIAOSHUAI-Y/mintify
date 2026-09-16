import { useState } from 'react';
import { Archive, ArchiveRestore, Trash2, X } from 'lucide-react';
import { APP_COLORS, APP_ICONS } from '../data/seed';
import { Icon } from './Icon';

export interface ProjectEditorValue {
  name: string;
  icon: string;
  color: string;
  note: string;
}

interface ProjectEditorProps {
  title: string;
  initialValue?: ProjectEditorValue;
  archived?: boolean;
  onSave: (value: ProjectEditorValue) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: () => void | Promise<void>;
  onToggleArchive?: () => void | Promise<void>;
}

export default function ProjectEditor({
  title,
  initialValue,
  archived = false,
  onSave,
  onCancel,
  onDelete,
  onToggleArchive,
}: ProjectEditorProps) {
  const [name, setName] = useState(initialValue?.name || '');
  const [icon, setIcon] = useState(initialValue?.icon || 'package');
  const [color, setColor] = useState(initialValue?.color || APP_COLORS[0]);
  const [note, setNote] = useState(initialValue?.note || '');
  const normalizedName = name.trim();

  return (
    <div className="mobile-overlay z-[90] bg-slate-50 dark:bg-slate-900">
      <div className="mobile-toolbar">
        <button aria-label="取消编辑" onClick={onCancel} className="icon-button text-slate-600 dark:text-slate-300">
          <X size={20} />
        </button>
        <div className="text-center">
          <div className="font-semibold">{title}</div>
          {archived && <div className="mt-0.5 text-[10px] text-slate-400">已归档，不再出现在记账选择里</div>}
        </div>
        <button
          disabled={!normalizedName}
          onClick={() => void onSave({ name: normalizedName, icon, color, note: note.trim() })}
          className="min-h-11 rounded-full px-2 text-sm font-semibold text-amber-700 disabled:text-slate-300 dark:text-amber-300 dark:disabled:text-slate-600"
        >
          保存
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-8">
        <section className="surface-card p-4">
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-50 to-white p-3 ring-1 ring-amber-100 dark:from-amber-400/10 dark:to-slate-800 dark:ring-amber-400/20">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
              style={{ backgroundColor: color }}
            >
              <Icon name={icon} size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-slate-400">项目预览</span>
              <span className="mt-1 block truncate font-semibold text-slate-800 dark:text-slate-100">{normalizedName || '项目名称'}</span>
            </span>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">名称</span>
            <input
              autoFocus
              value={name}
              maxLength={12}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：日本旅行、新房装修"
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:focus:ring-amber-400/20"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">备注（可不填）</span>
            <input
              value={note}
              maxLength={30}
              onChange={(event) => setNote(event.target.value)}
              placeholder="例如：7 天 6 晚，含机票"
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:focus:ring-amber-400/20"
            />
          </label>
        </section>

        <section className="surface-card mt-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">选择图标</span>
            <span className="text-xs text-slate-400">{APP_ICONS.length} 个</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {APP_ICONS.map((iconName) => (
              <button
                key={iconName}
                aria-label={`选择图标 ${iconName}`}
                aria-pressed={icon === iconName}
                onClick={() => setIcon(iconName)}
                className={`flex aspect-square items-center justify-center rounded-xl border transition-colors ${
                  icon === iconName
                    ? 'border-amber-300 bg-amber-50 text-amber-700 shadow-sm dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300'
                    : 'border-slate-100 bg-slate-50 text-slate-500 dark:border-slate-700/50 dark:bg-slate-800/60 dark:text-slate-400'
                }`}
              >
                <Icon name={iconName} size={20} />
              </button>
            ))}
          </div>
        </section>

        <section className="surface-card mt-4 p-4">
          <div className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">选择颜色</div>
          <div className="grid grid-cols-5 gap-3">
            {APP_COLORS.map((colorValue) => (
              <button
                key={colorValue}
                aria-label={`选择颜色 ${colorValue}`}
                aria-pressed={color === colorValue}
                onClick={() => setColor(colorValue)}
                className={`mx-auto h-10 w-10 rounded-full border-4 border-white shadow-sm dark:border-slate-800 ${
                  color === colorValue ? 'ring-2 ring-amber-400 ring-offset-2' : ''
                }`}
                style={{ backgroundColor: colorValue }}
              />
            ))}
          </div>
        </section>

        {onToggleArchive && (
          <button
            onClick={() => void onToggleArchive()}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm font-medium text-slate-600 dark:bg-slate-700/60 dark:text-slate-200"
          >
            {archived ? <ArchiveRestore size={17} /> : <Archive size={17} />}
            {archived ? '恢复项目' : '归档项目'}
          </button>
        )}

        {onDelete && (
          <button
            onClick={() => void onDelete()}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-rose-50 text-sm font-medium text-rose-600 dark:bg-rose-400/10 dark:text-rose-300"
          >
            <Trash2 size={17} />删除项目
          </button>
        )}
      </div>
    </div>
  );
}
