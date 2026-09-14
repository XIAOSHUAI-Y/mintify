import { createContext, useContext } from 'react';
import type { ReleaseNotesPayload } from './release-notes';

export type UpdateCheckStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'update-available'
  | 'applying'
  | 'error';

export interface PwaUpdateContextValue {
  needRefresh: boolean;
  offlineReady: boolean;
  dialogOpen: boolean;
  checkStatus: UpdateCheckStatus;
  checkError: string | null;
  /** 服务器上最新版本的更新说明；拉取失败时为 null，不阻断更新。 */
  releaseNotes: ReleaseNotesPayload | null;
  checkForUpdates: () => Promise<void>;
  /** 从底部提示条进入：已知有新版本，直接打开弹窗展示更新内容。 */
  openUpdateDialog: () => void;
  applyUpdate: () => Promise<void>;
  closeDialog: () => void;
  dismissPrompt: () => void;
}

export const PwaUpdateContext = createContext<PwaUpdateContextValue | null>(null);

export function usePwaUpdate(): PwaUpdateContextValue {
  const context = useContext(PwaUpdateContext);
  if (!context) throw new Error('usePwaUpdate 必须在 PwaUpdateProvider 内使用');
  return context;
}
