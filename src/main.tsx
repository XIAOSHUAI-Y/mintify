import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppProvider } from './context/AppContext.tsx'
import { getStorageStatus, requestPersistentStorage } from './storage/persistence.ts'

// 主屏幕 PWA 可能被浏览器授予持久化存储；失败不会阻断应用启动，设置页仍会展示真实状态。
void getStorageStatus().then((status) => {
  if (status.supported && !status.persisted) void requestPersistentStorage()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
)
