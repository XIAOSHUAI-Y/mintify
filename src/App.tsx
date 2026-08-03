import { useEffect, useState } from 'react';
import { List, PieChart, User, Plus, WalletCards } from 'lucide-react';
import HomePage from './pages/HomePage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import BudgetPage from './pages/BudgetPage';
import CategoryPage from './pages/CategoryPage';
import RecurringPage from './pages/RecurringPage';
import FundPage from './pages/FundPage';
import ReserveCenter from './components/ReserveCenter';
import TransactionForm from './components/TransactionForm';
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt';
import { getYearMonth } from './utils/helpers';
import { isPrimaryRoute, type AppRoute } from './routing/hashRoute';
import { useHashRoute } from './routing/useHashRoute';

function App() {
  const { route, navigate } = useHashRoute();
  const [lastPrimaryRoute, setLastPrimaryRoute] = useState<AppRoute>('/home');

  useEffect(() => {
    // 页面共用 document 滚动容器，路由切换时必须重置位置，避免新页面从半屏开始。
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (isPrimaryRoute(route)) setLastPrimaryRoute(route);
  }, [route]);

  useEffect(() => {
    // iOS 的 gesture 事件不受普通 touch-action 完整约束，单独阻止双指缩放手势。
    const preventPageZoom = (event: Event) => event.preventDefault();
    document.addEventListener('gesturestart', preventPageZoom, { passive: false });
    document.addEventListener('gesturechange', preventPageZoom, { passive: false });
    document.addEventListener('gestureend', preventPageZoom, { passive: false });
    return () => {
      document.removeEventListener('gesturestart', preventPageZoom);
      document.removeEventListener('gesturechange', preventPageZoom);
      document.removeEventListener('gestureend', preventPageZoom);
    };
  }, []);

  const closeSecondaryPage = () => navigate(lastPrimaryRoute, { replace: true });

  const renderContent = () => {
    switch (route) {
      case '/home':
        return <HomePage onNavigate={navigate} />;
      case '/reports':
        return <ReportsPage />;
      case '/budget':
        return <BudgetPage />;
      case '/settings':
        return <SettingsPage />;
      case '/categories':
        return <CategoryPage onClose={closeSecondaryPage} />;
      case '/recurring':
        return <RecurringPage onClose={closeSecondaryPage} />;
      case '/funds':
        return <FundPage onClose={closeSecondaryPage} />;
      case '/savings':
        return (
          <ReserveCenter
            standalone
            showMonthlyTransfer={false}
            yearMonth={getYearMonth(Date.now())}
            onClose={closeSecondaryPage}
          />
        );
      case '/add':
        return <TransactionForm onClose={closeSecondaryPage} />;
      default:
        return <HomePage onNavigate={navigate} />;
    }
  };

  return (
    <div className="min-h-[100svh] bg-slate-50 pb-24">
      <main className="min-h-[100svh]">{renderContent()}</main>

      <PwaUpdatePrompt />

      <nav
        aria-label="主要导航"
        className="safe-bottom fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/95 px-2 pt-2 backdrop-blur-xl"
      >
        <div className="relative mx-auto grid max-w-[430px] grid-cols-5 items-end gap-1">
          <button
            onClick={() => navigate('/home')}
            aria-current={route === '/home' ? 'page' : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs transition-colors ${
              route === '/home' ? 'bg-amber-50 text-amber-700' : 'text-slate-500'
            }`}
          >
            <List size={21} />
            <span>明细</span>
          </button>

          <button
            onClick={() => navigate('/reports')}
            aria-current={route === '/reports' ? 'page' : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs transition-colors ${
              route === '/reports' ? 'bg-amber-50 text-amber-700' : 'text-slate-500'
            }`}
          >
            <PieChart size={21} />
            <span>图表</span>
          </button>

          <button
            onClick={() => navigate('/add')}
            aria-label="新增账单"
            className="mx-auto flex h-14 w-14 -translate-y-3 items-center justify-center rounded-full bg-primary text-black shadow-[0_10px_30px_rgba(250,204,21,0.42)] transition-transform active:scale-95"
          >
            <Plus size={28} strokeWidth={2.5} />
          </button>

          <button
            onClick={() => navigate('/budget')}
            aria-current={route === '/budget' ? 'page' : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs transition-colors ${
              route === '/budget' ? 'bg-amber-50 text-amber-700' : 'text-slate-500'
            }`}
          >
            <WalletCards size={21} />
            <span>预算</span>
          </button>

          <button
            onClick={() => navigate('/settings')}
            aria-current={route === '/settings' ? 'page' : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs transition-colors ${
              route === '/settings' ? 'bg-amber-50 text-amber-700' : 'text-slate-500'
            }`}
          >
            <User size={21} />
            <span>我的</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;
