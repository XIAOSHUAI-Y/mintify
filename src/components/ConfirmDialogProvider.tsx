import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Dialog } from 'antd-mobile';
import {
  ConfirmDialogContext,
  type ConfirmDeletion,
  type ConfirmDeletionOptions,
} from '../context/ConfirmDialogContext';

/**
 * React 19 下 antd-mobile 的静态 Dialog API 无法可靠挂载，因此统一在应用树中渲染确认框。
 * Promise 接口让各业务页面只在用户明确确认后执行不可逆操作。
 */
export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmDeletionOptions | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const confirmDeletion = useCallback<ConfirmDeletion>((options) => new Promise((resolve) => {
    // 理论上不会同时触发两个删除；若发生，先安全地取消上一个请求，避免 Promise 悬空。
    resolverRef.current?.(false);
    resolverRef.current = resolve;
    setRequest(options);
  }), []);

  const finish = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setRequest(null);
  }, []);

  useEffect(() => () => {
    resolverRef.current?.(false);
    resolverRef.current = null;
  }, []);

  return (
    <ConfirmDialogContext.Provider value={confirmDeletion}>
      {children}
      <Dialog
        visible={request !== null}
        title={request?.title || '确认删除'}
        content={request?.message}
        closeOnAction
        closeOnMaskClick={false}
        destroyOnClose
        className="mintify-delete-dialog"
        actions={[
          { key: 'cancel', text: '取消' },
          { key: 'confirm', text: request?.confirmText || '删除', danger: true, bold: true },
        ]}
        onAction={(action) => finish(action.key === 'confirm')}
        onClose={() => finish(false)}
      />
    </ConfirmDialogContext.Provider>
  );
}
