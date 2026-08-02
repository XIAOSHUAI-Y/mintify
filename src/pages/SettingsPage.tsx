import { useEffect, useState } from 'react';
import { ChevronRight, Download, Upload, Bell, BookOpen, Tag, RefreshCw, HardDrive } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Icon } from '../components/Icon';
import {
  exportData,
  importData,
  inspectBackup,
  type BackupPreview,
  type ImportOptions,
} from '../db/operations';
import { DEFAULT_APP_SETTINGS, getAppSettings, saveAppSettings } from '../db';
import { usePwaUpdate } from '../pwa/update-context';
import { APP_VERSION } from '../pwa/app-version';
import {
  getStorageStatus,
  requestPersistentStorage,
  type StorageStatus,
} from '../storage/persistence';
import { generateId } from '../utils/helpers';
import type { AppSettings, Ledger } from '../types';

interface PendingImport {
  fileName: string;
  text: string;
  preview: BackupPreview;
}

export default function SettingsPage() {
  const {
    currentLedger,
    ledgers,
    runRecurringGenerator,
  } = useApp();
  const { checkForUpdates } = usePwaUpdate();

  const [showLedgers, setShowLedgers] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    ...DEFAULT_APP_SETTINGS,
    presetTags: [...DEFAULT_APP_SETTINGS.presetTags],
  });
  const [storageStatus, setStorageStatus] = useState<StorageStatus>({
    supported: false,
    persisted: false,
  });
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const syncStatus = '本地模式';

  useEffect(() => {
    void Promise.all([getAppSettings(), getStorageStatus()]).then(([savedSettings, status]) => {
      setSettings(savedSettings);
      setStorageStatus(status);
    });
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

  const updateSettings = async (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await saveAppSettings(next);
  };

  const handleReminderToggle = async (enabled: boolean) => {
    await updateSettings({ reminderEnabled: enabled });
    if (enabled) scheduleReminder(settings.reminderTime);
  };

  const handleReminderTimeChange = async (time: string) => {
    await updateSettings({ reminderTime: time });
  };

  const handleExport = async () => {
    const data = await exportData();
    const fileName = `mintify-backup-${new Date().toISOString().split('T')[0]}.json`;
    const file = new File([data], fileName, { type: 'application/json' });
    setSettings(await getAppSettings());

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title: 'Mintify 数据备份', files: [file] });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        // 分享失败时回退为浏览器下载，保证备份仍然可用。
      }
    }

    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setPendingImport({ fileName: file.name, text, preview: inspectBackup(text) });
    } catch (error) {
      alert(error instanceof Error ? error.message : '无法读取备份文件');
    } finally {
      e.target.value = '';
    }
  };

  const handleImport = async (mode: ImportOptions['mode']) => {
    if (!pendingImport) return;
    setIsImporting(true);
    try {
      const result = await importData(pendingImport.text, { mode });
      alert(`恢复完成：${result.ledgers} 个账本，${result.transactions} 条交易`);
      window.location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : '恢复失败，原数据未改变');
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 pb-28">
      <header className="safe-top mb-4">
        <h1 className="text-2xl font-bold tracking-tight">我的</h1>
        <p className="mt-1 text-sm text-slate-500">管理账本、自动化与本地数据</p>
      </header>

      {/* Current Ledger */}
      {currentLedger && (
        <div className="mb-6 overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-amber-300 to-primary p-5 shadow-[0_14px_32px_rgba(250,204,21,0.2)]">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm"
              style={{ backgroundColor: currentLedger.color }}
            >
              <Icon name={currentLedger.icon} size={24} />
            </div>
            <div className="flex-1">
              <div className="font-semibold">{currentLedger.name}</div>
              <div className="text-sm text-black/50">当前账本 · 共 {ledgers.length} 个</div>
            </div>
          </div>
        </div>
      )}

      <SectionTitle>账本与自动化</SectionTitle>
      <div className="surface-card divide-y divide-slate-100 overflow-hidden">
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

      <SectionTitle className="mt-6">提醒</SectionTitle>
      <div className="surface-card overflow-hidden">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Bell size={20} className="text-yellow-600" />
              <span>每日记账提醒</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.reminderEnabled}
                onChange={(e) => void handleReminderToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
          {settings.reminderEnabled && (
            <input
              type="time"
              value={settings.reminderTime}
              onChange={(e) => void handleReminderTimeChange(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg"
            />
          )}
        </div>
      </div>

      <SectionTitle className="mt-6">数据与安全</SectionTitle>
      <div className="surface-card p-4">
        <div className="flex items-start gap-3">
          <HardDrive size={20} className="text-yellow-600 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="font-medium">本地数据保护</span>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${storageStatus.persisted ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-600'}`}>
                {storageStatus.persisted ? '持久化已启用' : '普通存储'}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              已使用 {formatBytes(storageStatus.usage)} / {formatBytes(storageStatus.quota)}
            </div>
            {!storageStatus.persisted && storageStatus.supported && (
              <button
                onClick={async () => setStorageStatus(await requestPersistentStorage())}
                className="mt-3 min-h-10 rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm font-medium text-amber-800"
              >
                请求持久化存储
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="surface-card mt-3 divide-y divide-slate-100 overflow-hidden">
        <SettingsItem
          icon={<Download size={20} />}
          title="导出数据"
          subtitle={settings.lastBackupAt
            ? `最近备份：${new Date(settings.lastBackupAt).toLocaleDateString()}`
            : '尚未备份，建议立即导出'}
          onClick={handleExport}
        />
        <label className="flex min-h-16 cursor-pointer items-center justify-between p-4 active:bg-slate-50">
          <div className="flex items-center gap-3">
            <Upload size={20} className="text-yellow-600" />
            <div>
              <div className="font-medium">导入数据</div>
              <div className="text-sm text-gray-500">从备份文件恢复</div>
            </div>
          </div>
          <input type="file" accept=".json,application/json" className="hidden" onChange={handleImportFile} />
          <ChevronRight size={20} className="text-gray-400" />
        </label>
      </div>

      <SectionTitle className="mt-6">关于</SectionTitle>
      <div className="surface-card p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">同步状态</span>
          <span className="text-sm text-gray-600">{syncStatus}</span>
        </div>
        <button
          onClick={() => void checkForUpdates()}
          className="mt-2 flex min-h-12 w-full items-center justify-between rounded-xl text-left active:bg-slate-50"
        >
          <span>
            <span className="block text-gray-500">版本</span>
            <span className="block text-xs text-slate-400">点击检查更新</span>
          </span>
          <span className="flex items-center gap-1 text-sm text-gray-600">
            v{APP_VERSION}
            <ChevronRight size={16} className="text-gray-400" />
          </span>
        </button>
      </div>

      {showLedgers && <LedgerManager onClose={() => setShowLedgers(false)} />}
      {showTags && <TagManager onClose={() => setShowTags(false)} />}
      {pendingImport && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="font-semibold text-center">确认恢复备份</div>
            <div className="text-sm text-gray-500 mt-2 break-all text-center">{pendingImport.fileName}</div>
            <div className="mt-4 p-3 bg-gray-50 rounded-xl text-sm space-y-1">
              <div>账本：{pendingImport.preview.ledgers} 个</div>
              <div>交易：{pendingImport.preview.transactions} 条</div>
              <div>分类：{pendingImport.preview.categories} 个</div>
              <div>资金记录：{pendingImport.preview.fundTransactions} 条</div>
            </div>
            <div className="text-xs text-orange-600 mt-3">
              覆盖恢复会先清除当前数据；操作在同一事务中完成，失败时自动回滚。
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                disabled={isImporting}
                onClick={() => void handleImport('merge')}
                className="py-3 bg-gray-100 rounded-xl disabled:opacity-50"
              >
                合并导入
              </button>
              <button
                disabled={isImporting}
                onClick={() => void handleImport('replace')}
                className="py-3 bg-primary rounded-xl font-medium disabled:opacity-50"
              >
                覆盖恢复
              </button>
            </div>
            <button
              disabled={isImporting}
              onClick={() => setPendingImport(null)}
              className="w-full mt-2 py-2 text-gray-500 disabled:opacity-50"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatBytes(value?: number): string {
  if (value === undefined) return '--';
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
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
      className="flex min-h-16 w-full items-center justify-between p-4 active:bg-slate-50"
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

function SectionTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-400 ${className}`}>{children}</div>;
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
    <div className="mobile-overlay">
      <div className="mobile-toolbar">
        <button onClick={onClose} className="min-h-11 rounded-full px-2 text-sm text-slate-600">返回</button>
        <div className="font-semibold">账本管理</div>
        <button onClick={() => setShowAdd(true)} className="min-h-11 rounded-full px-2 text-sm font-semibold text-amber-700">新增</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-8">
        <div className="space-y-3">
          {ledgers.map((ledger) => (
            <div
              key={ledger.id}
              className={`surface-card flex items-center gap-3 p-4 ${
                currentLedger?.id === ledger.id ? '!border-primary bg-primary/5' : ''
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
  const [tags, setTags] = useState<string[]>([...DEFAULT_APP_SETTINGS.presetTags]);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    void getAppSettings().then((saved) => setTags(saved.presetTags));
  }, []);

  const saveTags = async (updated: string[]) => {
    setTags(updated);
    const saved = await getAppSettings();
    await saveAppSettings({ ...saved, presetTags: updated });
  };

  const addTag = async () => {
    if (!newTag || tags.includes(newTag)) return;
    await saveTags([...tags, newTag]);
    setNewTag('');
  };

  const removeTag = async (tag: string) => {
    await saveTags(tags.filter((t) => t !== tag));
  };

  return (
    <div className="mobile-overlay">
      <div className="mobile-toolbar">
        <button onClick={onClose} className="min-h-11 rounded-full px-2 text-sm text-slate-600">返回</button>
        <div className="font-semibold">标签管理</div>
        <div />
      </div>

      <div className="p-4">
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="新标签"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-3 outline-none focus:border-amber-400"
          />
          <button onClick={() => void addTag()} className="min-h-11 rounded-xl bg-primary px-4 font-medium">添加</button>
        </div>

        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <div
              key={tag}
              className="flex min-h-10 items-center gap-1 rounded-full bg-white px-3 text-sm ring-1 ring-slate-200"
            >
              {tag}
              <button onClick={() => void removeTag(tag)} className="text-gray-400 hover:text-red-500">×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
