import { describe, expect, it } from 'vitest';
import { getStorageStatus, requestPersistentStorage } from './persistence';

describe('浏览器存储可靠性', () => {
  it('请求持久化后返回最新的配额和持久化状态', async () => {
    let persisted = false;
    const storageManager = {
      async persisted() {
        return persisted;
      },
      async persist() {
        persisted = true;
        return true;
      },
      async estimate() {
        return { usage: 1024, quota: 4096 };
      },
    };

    expect(await getStorageStatus(storageManager)).toMatchObject({
      supported: true,
      persisted: false,
      usage: 1024,
      quota: 4096,
    });
    expect(await requestPersistentStorage(storageManager)).toMatchObject({
      supported: true,
      persisted: true,
    });
  });
});
