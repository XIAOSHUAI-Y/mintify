export interface StorageStatus {
  supported: boolean;
  persisted: boolean;
  usage?: number;
  quota?: number;
}

export interface StorageManagerLike {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
  estimate?: () => Promise<{ usage?: number; quota?: number }>;
}

function getBrowserStorageManager(): StorageManagerLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return navigator.storage;
}

export async function getStorageStatus(
  manager: StorageManagerLike | undefined = getBrowserStorageManager(),
): Promise<StorageStatus> {
  if (!manager) return { supported: false, persisted: false };

  const persistedPromise = manager.persisted
    ? manager.persisted().catch(() => false)
    : Promise.resolve(false);
  const estimatePromise: Promise<{ usage?: number; quota?: number }> = manager.estimate
    ? manager.estimate().catch(() => ({}))
    : Promise.resolve({});
  const [persisted, estimate] = await Promise.all([
    persistedPromise,
    estimatePromise,
  ]);
  return {
    supported: true,
    persisted,
    usage: estimate.usage,
    quota: estimate.quota,
  };
}

export async function requestPersistentStorage(
  manager: StorageManagerLike | undefined = getBrowserStorageManager(),
): Promise<StorageStatus> {
  if (!manager) return { supported: false, persisted: false };

  // persist() 由浏览器根据安装状态和使用频率决定是否批准，不会弹出系统授权框。
  await manager.persist?.().catch(() => false);
  return getStorageStatus(manager);
}
