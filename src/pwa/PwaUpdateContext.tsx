import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { checkServiceWorkerUpdate } from './update-check';
import { PwaUpdateContext, type UpdateCheckStatus } from './update-context';

const AUTO_CHECK_INTERVAL = 15 * 60 * 1000;
const AUTO_CHECK_THROTTLE = 60 * 1000;

export function PwaUpdateProvider({ children }: { children: ReactNode }) {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const lastAutomaticCheckRef = useRef(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [checkStatus, setCheckStatus] = useState<UpdateCheckStatus>('idle');
  const [checkError, setCheckError] = useState<string | null>(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      registrationRef.current = registration ?? null;
      // iOS 主屏 PWA 经常恢复旧进程；注册完成后主动检查一次，不能只等待 WebKit 自己轮询。
      if (registration) void registration.update().catch(() => undefined);
    },
    onRegisterError(error) {
      console.error('PWA Service Worker 注册失败', error);
    },
  });

  const getRegistration = useCallback(async () => {
    if (registrationRef.current) return registrationRef.current;
    if (!('serviceWorker' in navigator)) return null;

    const scopeUrl = new URL(import.meta.env.BASE_URL, window.location.origin).href;
    const registration = await navigator.serviceWorker.getRegistration(scopeUrl);
    registrationRef.current = registration ?? null;
    return registration ?? null;
  }, []);

  const checkSilently = useCallback(async () => {
    const now = Date.now();
    if (now - lastAutomaticCheckRef.current < AUTO_CHECK_THROTTLE) return;
    lastAutomaticCheckRef.current = now;

    try {
      const registration = await getRegistration();
      if (registration) await registration.update();
    } catch {
      // 自动检查失败不打断记账流程；用户仍可点击版本号获取明确的错误反馈。
    }
  }, [getRegistration]);

  useEffect(() => {
    const checkWhenActive = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void checkSilently();
      }
    };

    window.addEventListener('focus', checkWhenActive);
    window.addEventListener('online', checkWhenActive);
    window.addEventListener('pageshow', checkWhenActive);
    document.addEventListener('visibilitychange', checkWhenActive);
    const timer = window.setInterval(checkWhenActive, AUTO_CHECK_INTERVAL);

    return () => {
      window.removeEventListener('focus', checkWhenActive);
      window.removeEventListener('online', checkWhenActive);
      window.removeEventListener('pageshow', checkWhenActive);
      document.removeEventListener('visibilitychange', checkWhenActive);
      window.clearInterval(timer);
    };
  }, [checkSilently]);

  useEffect(() => {
    if (needRefresh) setCheckStatus('update-available');
  }, [needRefresh]);

  const checkForUpdates = useCallback(async () => {
    setDialogOpen(true);
    setCheckStatus('checking');
    setCheckError(null);

    try {
      const registration = await getRegistration();
      if (!registration) {
        throw new Error('当前环境尚未启用离线更新，请确认已通过主屏应用或 HTTPS 页面打开。');
      }

      const result = await checkServiceWorkerUpdate(registration);
      setCheckStatus(result);
    } catch (error) {
      setCheckStatus('error');
      setCheckError(error instanceof Error ? error.message : '暂时无法检查更新，请稍后重试。');
    }
  }, [getRegistration]);

  const applyUpdate = useCallback(async () => {
    setCheckStatus('applying');
    await updateServiceWorker(true);
  }, [updateServiceWorker]);

  const closeDialog = () => {
    setDialogOpen(false);
    setCheckStatus('idle');
    setCheckError(null);
  };

  const dismissPrompt = () => {
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  return (
    <PwaUpdateContext.Provider
      value={{
        needRefresh,
        offlineReady,
        dialogOpen,
        checkStatus,
        checkError,
        checkForUpdates,
        applyUpdate,
        closeDialog,
        dismissPrompt,
      }}
    >
      {children}
    </PwaUpdateContext.Provider>
  );
}
