import { describe, expect, it, vi } from 'vitest';
import { checkServiceWorkerUpdate, type UpdatableServiceWorkerRegistration } from './update-check';

describe('手动检查更新', () => {
  it('已有等待激活的新版本时直接报告可更新', async () => {
    const registration: UpdatableServiceWorkerRegistration = {
      waiting: {} as ServiceWorker,
      installing: null,
      update: vi.fn(async () => undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    await expect(checkServiceWorkerUpdate(registration)).resolves.toBe('update-available');
    expect(registration.update).not.toHaveBeenCalled();
  });

  it('服务器检查触发 updatefound 时报告可更新', async () => {
    let onUpdateFound: (() => void) | undefined;
    const registration: UpdatableServiceWorkerRegistration = {
      waiting: null,
      installing: null,
      update: vi.fn(async () => onUpdateFound?.()),
      addEventListener: vi.fn((_type, listener) => {
        onUpdateFound = listener;
      }),
      removeEventListener: vi.fn(),
    };

    await expect(checkServiceWorkerUpdate(registration)).resolves.toBe('update-available');
    expect(registration.update).toHaveBeenCalledOnce();
    expect(registration.removeEventListener).toHaveBeenCalledWith('updatefound', onUpdateFound);
  });

  it('服务器没有新 Service Worker 时报告已是最新版', async () => {
    const registration: UpdatableServiceWorkerRegistration = {
      waiting: null,
      installing: null,
      update: vi.fn(async () => undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    await expect(checkServiceWorkerUpdate(registration)).resolves.toBe('up-to-date');
    expect(registration.update).toHaveBeenCalledOnce();
    expect(registration.removeEventListener).toHaveBeenCalledOnce();
  });
});
