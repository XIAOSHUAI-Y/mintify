import { createContext, useContext } from 'react';

export interface ConfirmDeletionOptions {
  title?: string;
  message: string;
  confirmText?: string;
}

export type ConfirmDeletion = (options: ConfirmDeletionOptions) => Promise<boolean>;

export const ConfirmDialogContext = createContext<ConfirmDeletion | null>(null);

export function useConfirmDeletion(): ConfirmDeletion {
  const context = useContext(ConfirmDialogContext);
  if (!context) throw new Error('useConfirmDeletion 必须在 ConfirmDialogProvider 内使用');
  return context;
}
