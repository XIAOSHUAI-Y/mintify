import { createContext, useContext } from 'react';

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
  checkForUpdates: () => Promise<void>;
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
