import { useState } from 'react';
import { List, PieChart, User, Plus } from 'lucide-react';
import HomePage from './pages/HomePage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import TransactionForm from './components/TransactionForm';

export type TabType = 'home' | 'reports' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [showForm, setShowForm] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <HomePage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="min-h-screen pb-20">
      <div className="bg-white min-h-screen">{renderContent()}</div>

      {showForm && (
        <TransactionForm onClose={() => setShowForm(false)} />
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2 py-2 z-40">
        <div className="max-w-[430px] mx-auto flex items-center justify-around relative">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 px-4 py-1 rounded-lg transition-colors ${
              activeTab === 'home' ? 'text-yellow-600' : 'text-gray-500'
            }`}
          >
            <List size={22} />
            <span className="text-xs">明细</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center gap-1 px-4 py-1 rounded-lg transition-colors ${
              activeTab === 'reports' ? 'text-yellow-600' : 'text-gray-500'
            }`}
          >
            <PieChart size={22} />
            <span className="text-xs">图表</span>
          </button>

          <button
            onClick={() => setShowForm(true)}
            className="flex flex-col items-center justify-center w-14 h-14 -mt-6 bg-primary text-black rounded-full shadow-lg active:scale-95 transition-transform"
          >
            <Plus size={28} strokeWidth={2.5} />
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-1 px-4 py-1 rounded-lg transition-colors ${
              activeTab === 'settings' ? 'text-yellow-600' : 'text-gray-500'
            }`}
          >
            <User size={22} />
            <span className="text-xs">我的</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
