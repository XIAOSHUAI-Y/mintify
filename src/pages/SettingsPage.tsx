import { useEffect, useState } from 'react';
import { ChevronRight, Download, Upload, Bell, BookOpen, Tag, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Icon } from '../components/Icon';
import { PRESET_TAGS } from '../data/seed';
import { exportData, importData } from '../db/operations';
import { generateId } from '../utils/helpers';
import type { Ledger } from '../types';

export default function SettingsPage() {
  const {
    currentLedger,
    ledgers,
    runRecurringGenerator,
  } = useApp();

  const [showLedgers, setShowLedgers] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('21:00');
  const syncStatus = '本地模式';

  useEffect(() => {
    const enabled = localStorage.getItem('reminderEnabled') === 'true';
    const time = localStorage.getItem('reminderTime') || '21:00';
    setReminderEnabled(enabled);
    setReminderTime(time);
    if (enabled) scheduleReminder(time);
  }, []);

  const scheduleReminder = (_time: string) => {
    if (!('Notification' in window)) return;
    void _time;
    // 实际项目中可用 service worker 实现精确提醒
    // 这里仅请求权限
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        console.log('Notification permission granted');
      }
    });
  };

  const handleReminderToggle = (enabled: boolean) => {
    setReminderEnabled(enabled);
    localStorage.setItem('reminderEnabled', String(enabled));
    if (enabled) scheduleReminder(reminderTime);
  };

  const handleReminderTimeChange = (time: string) => {
    setReminderTime(time);
    localStorage.setItem('reminderTime', time);
    if (reminderEnabled) scheduleReminder(time);
  };

  const handleExport = async () => {
    const data = await exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mintify-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    if (confirm('导入会覆盖现有数据，确定继续吗？')) {
      await importData(text);
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen p-4 pb-24 overflow-y-auto">
      <div className="text-lg font-bold mb-6">我的</div>

      {/* Current Ledger */}
      {currentLedger && (
        <div className="bg-primary/10 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white"
              style={{ backgroundColor: currentLedger.color }}
            >
              <Icon name={currentLedger.icon} size={24} />
            </div>
            <div className="flex-1">
              <div className="font-medium">{currentLedger.name}</div>
              <div className="text-sm text-gray-500">{ledgers.length} 个账本</div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <SettingsItem
          icon={<BookOpen size={20} />}
          title="账本管理"
          subtitle="切换、添加、删除账本"
          onClick={() => setShowLedgers(true)}
        />
        <SettingsItem
          icon={<Tag size={20} />}
          title="标签管理"
          subtitle="管理常用标签"
          onClick={() => setShowTags(true)}
        />
        <SettingsItem
          icon={<RefreshCw size={20} />}
          title="立即执行周期记账"
          subtitle="手动触发生成周期账单"
          onClick={async () => {
            const count = await runRecurringGenerator();
            alert(`已生成 ${count} 条周期账单`);
          }}
        />
      </div>

      <div className="mt-6 space-y-3">
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Bell size={20} className="text-yellow-600" />
              <span>每日记账提醒</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(e) => handleReminderToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
          {reminderEnabled && (
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => handleReminderTimeChange(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg"
            />
          )}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <SettingsItem
          icon={<Download size={20} />}
          title="导出数据"
          subtitle="备份到本地文件"
          onClick={handleExport}
        />
        <label className="flex items-center justify-between p-4 bg-white rounded-xl active:bg-gray-50 cursor-pointer">
          <div className="flex items-center gap-3">
            <Upload size={20} className="text-yellow-600" />
            <div>
              <div className="font-medium">导入数据</div>
              <div className="text-sm text-gray-500">从备份文件恢复</div>
            </div>
          </div>
          <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          <ChevronRight size={20} className="text-gray-400" />
        </label>
      </div>

      <div className="mt-6 p-4 bg-white rounded-xl">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">同步状态</span>
          <span className="text-sm text-gray-600">{syncStatus}</span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-gray-500">版本</span>
          <span className="text-sm text-gray-600">1.0.0</span>
        </div>
      </div>

      {showLedgers && <LedgerManager onClose={() => setShowLedgers(false)} />}
      {showTags && <TagManager onClose={() => setShowTags(false)} />}
    </div>
  );
}

function SettingsItem({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-4 bg-white rounded-xl active:bg-gray-50"
    >
      <div className="flex items-center gap-3">
        <div className="text-yellow-600">{icon}</div>
        <div className="text-left">
          <div className="font-medium">{title}</div>
          <div className="text-sm text-gray-500">{subtitle}</div>
        </div>
      </div>
      <ChevronRight size={20} className="text-gray-400" />
    </button>
  );
}

function LedgerManager({ onClose }: { onClose: () => void }) {
  const { ledgers, currentLedger, setCurrentLedger, addLedger, updateLedger, removeLedger } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [editingLedger, setEditingLedger] = useState<Ledger | null>(null);
  const [name, setName] = useState('');

  const handleSave = () => {
    if (!name) return;
    if (editingLedger) {
      updateLedger({ ...editingLedger, name });
    } else {
      addLedger({
        id: generateId(),
        name,
        icon: 'book',
        color: '#FACC15',
        isDefault: ledgers.length === 0,
        sortOrder: ledgers.length,
        createdAt: Date.now(),
      });
    }
    setName('');
    setShowAdd(false);
    setEditingLedger(null);
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <button onClick={onClose}>返回</button>
        <div className="font-medium">账本管理</div>
        <button onClick={() => setShowAdd(true)}>新增</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {ledgers.map((ledger) => (
            <div
              key={ledger.id}
              className={`flex items-center gap-3 p-4 rounded-xl border ${
                currentLedger?.id === ledger.id ? 'border-primary bg-primary/5' : 'border-gray-100'
              }`}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                style={{ backgroundColor: ledger.color }}
              >
                <Icon name={ledger.icon} size={18} />
              </div>
              <span className="flex-1">{ledger.name}</span>
              <button
                onClick={() => setCurrentLedger(ledger.id)}
                className="text-sm px-3 py-1 bg-primary rounded-lg"
              >
                切换
              </button>
              <button
                onClick={() => {
                  setEditingLedger(ledger);
                  setName(ledger.name);
                  setShowAdd(true);
                }}
                className="text-sm text-gray-500"
              >
                编辑
              </button>
              {ledgers.length > 1 && (
                <button
                  onClick={() => removeLedger(ledger.id)}
                  className="text-sm text-red-500"
                >
                  删除
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-4">
            <div className="font-medium text-center mb-4">{editingLedger ? '编辑账本' : '新建账本'}</div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="账本名称"
              className="w-full p-3 border border-gray-200 rounded-lg mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAdd(false);
                  setEditingLedger(null);
                  setName('');
                }}
                className="flex-1 py-3 bg-gray-100 rounded-xl"
              >
                取消
              </button>
              <button onClick={handleSave} className="flex-1 py-3 bg-primary rounded-xl font-medium">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TagManager({ onClose }: { onClose: () => void }) {
  const [tags, setTags] = useState<string[]>(() => {
    const saved = localStorage.getItem('presetTags');
    return saved ? JSON.parse(saved) : PRESET_TAGS;
  });
  const [newTag, setNewTag] = useState('');

  const saveTags = (updated: string[]) => {
    setTags(updated);
    localStorage.setItem('presetTags', JSON.stringify(updated));
  };

  const addTag = () => {
    if (!newTag || tags.includes(newTag)) return;
    saveTags([...tags, newTag]);
    setNewTag('');
  };

  const removeTag = (tag: string) => {
    saveTags(tags.filter((t) => t !== tag));
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <button onClick={onClose}>返回</button>
        <div className="font-medium">标签管理</div>
        <div />
      </div>

      <div className="p-4">
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="新标签"
            className="flex-1 p-3 border border-gray-200 rounded-lg"
          />
          <button onClick={addTag} className="px-4 py-2 bg-primary rounded-lg font-medium">添加</button>
        </div>

        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <div
              key={tag}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-full text-sm"
            >
              {tag}
              <button onClick={() => removeTag(tag)} className="text-gray-400 hover:text-red-500">×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
