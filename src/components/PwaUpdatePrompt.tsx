import { AlertTriangle, CheckCircle2, Download, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { usePwaUpdate } from '../pwa/update-context';
import { APP_VERSION } from '../pwa/app-version';

export function PwaUpdatePrompt() {
  const {
    needRefresh,
    offlineReady,
    dialogOpen,
    checkStatus,
    checkError,
    checkForUpdates,
    applyUpdate,
    closeDialog,
    dismissPrompt,
  } = usePwaUpdate();

  return (
    <>
      {!dialogOpen && (needRefresh || offlineReady) && (
        <div className="fixed bottom-24 left-4 right-4 z-[80] mx-auto max-w-sm rounded-2xl border border-amber-100 bg-white p-4 text-slate-900 shadow-[0_16px_42px_rgba(15,23,42,0.14)]">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${needRefresh ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {needRefresh ? <Download size={20} /> : <CheckCircle2 size={20} />}
            </div>
            <div className="flex-1">
              <div className="font-medium">{needRefresh ? '新版本已准备好' : '现在可以离线使用'}</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">
                {needRefresh ? '账本数据不会被更新清除，确认后刷新程序文件。' : '程序资源已缓存到本机。'}
              </div>
              {needRefresh && (
                <button
                  onClick={() => void applyUpdate()}
                  className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-black"
                >
                  立即更新
                </button>
              )}
            </div>
            <button
              onClick={dismissPrompt}
              aria-label="关闭提示"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {dialogOpen && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="update-dialog-title"
            className="safe-bottom w-full max-w-sm rounded-[1.75rem] bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="update-dialog-title" className="text-lg font-semibold">检查更新</h2>
                <p className="mt-1 text-xs text-slate-500">当前版本 v{APP_VERSION}</p>
              </div>
              <button
                onClick={closeDialog}
                aria-label="关闭检查更新"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 flex flex-col items-center px-3 pb-2 text-center">
              <UpdateStatusIcon status={checkStatus} />
              <div className="mt-4 text-base font-semibold">{getStatusTitle(checkStatus)}</div>
              <div className="mt-2 min-h-10 text-sm leading-5 text-slate-500">
                {getStatusDescription(checkStatus, checkError, needRefresh)}
              </div>

              {checkStatus === 'update-available' && needRefresh && (
                <button
                  onClick={() => void applyUpdate()}
                  className="mt-5 min-h-12 w-full rounded-2xl bg-primary px-5 font-semibold text-black"
                >
                  立即更新并重启
                </button>
              )}
              {checkStatus === 'error' && (
                <button
                  onClick={() => void checkForUpdates()}
                  className="mt-5 min-h-12 w-full rounded-2xl bg-amber-100 px-5 font-semibold text-amber-900"
                >
                  重新检查
                </button>
              )}
              {(checkStatus === 'up-to-date' || (checkStatus === 'update-available' && !needRefresh)) && (
                <button
                  onClick={closeDialog}
                  className="mt-5 min-h-12 w-full rounded-2xl bg-slate-100 px-5 font-semibold text-slate-700"
                >
                  完成
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function UpdateStatusIcon({ status }: { status: ReturnType<typeof usePwaUpdate>['checkStatus'] }) {
  const className = 'h-12 w-12';
  if (status === 'checking' || status === 'applying') {
    return <LoaderCircle className={`${className} animate-spin text-amber-500`} />;
  }
  if (status === 'up-to-date') return <CheckCircle2 className={`${className} text-emerald-500`} />;
  if (status === 'update-available') return <Download className={`${className} text-amber-500`} />;
  if (status === 'error') return <AlertTriangle className={`${className} text-red-500`} />;
  return <RefreshCw className={`${className} text-slate-400`} />;
}

function getStatusTitle(status: ReturnType<typeof usePwaUpdate>['checkStatus']): string {
  switch (status) {
    case 'checking': return '正在检查更新';
    case 'up-to-date': return '已是最新版本';
    case 'update-available': return '发现新版本';
    case 'applying': return '正在更新并重启';
    case 'error': return '检查更新失败';
    default: return '准备检查更新';
  }
}

function getStatusDescription(
  status: ReturnType<typeof usePwaUpdate>['checkStatus'],
  error: string | null,
  updateReady: boolean,
): string {
  switch (status) {
    case 'checking': return '正在向服务器确认是否有新的程序版本…';
    case 'up-to-date': return '当前程序文件已经是服务器上的最新版本。';
    case 'update-available': return updateReady
      ? '新版本已经下载完成，可以安全刷新程序文件。'
      : '已发现新版本，正在后台完成下载，请稍后再次检查。';
    case 'applying': return '账本数据保存在 IndexedDB 中，更新程序文件不会清除账本。';
    case 'error': return error ?? '暂时无法检查更新，请确认网络后重试。';
    default: return '';
  }
}
