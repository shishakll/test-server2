import React from 'react';
import { useUIStore } from '@stores';
import { Dashboard } from './views/Dashboard';
import { ScanView } from './views/ScanView';
import { Settings } from './views/Settings';
import { Sidebar } from './components/Sidebar';

/**
 * Main App component with layout and view routing
 */
export const App: React.FC = () => {
  const { activeView, sidebarCollapsed } = useUIStore();

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard />;
      case 'scan':
        return <ScanView />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className={`app-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {renderView()}
      </main>
    </div>
  );
};

export default App;
