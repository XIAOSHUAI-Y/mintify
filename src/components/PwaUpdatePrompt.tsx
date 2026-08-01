import { CheckCircle2, Download, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('PWA Service Worker 注册失败', error);
    },
  });

  if (!needRefresh && !offlineReady) return null;

  const close = () => {
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  return (
    <div className="fixed left-4 right-4 bottom-24 z-[80] max-w-sm mx-auto bg-gray-900 text-white rounded-2xl p-4 shadow-xl">
      <div className="flex items-start gap-3">
        {needRefresh
          ? <Download size={20} className="text-primary shrink-0 mt-0.5" />
          : <CheckCircle2 size={20} className="text-green-400 shrink-0 mt-0.5" />}
        <div className="flex-1">
          <div className="font-medium">{needRefresh ? '新版本已准备好' : '现在可以离线使用'}</div>
          <div className="text-xs text-gray-300 mt-1">
            {needRefresh ? '账本数据不会被更新清除，确认后刷新程序文件。' : '程序资源已缓存到本机。'}
          </div>
          {needRefresh && (
            <button
              onClick={() => void updateServiceWorker(true)}
              className="mt-3 px-4 py-2 bg-primary text-black text-sm font-medium rounded-lg"
            >
              立即更新
            </button>
          )}
        </div>
        <button onClick={close} aria-label="关闭提示" className="text-gray-400">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
