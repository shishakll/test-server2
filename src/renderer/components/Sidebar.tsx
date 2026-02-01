import React from 'react';
import { useUIStore, useScanStore } from '@stores';
import { 
  LayoutDashboard, 
  Scan, 
  Settings as SettingsIcon,
  FileText,
  ChevronLeft,
  ChevronRight,
  Shield,
  Activity
} from 'lucide-react';

/**
 * Sidebar navigation component
 */
export const Sidebar: React.FC = () => {
  const { activeView, setActiveView, sidebarCollapsed, toggleSidebar } = useUIStore();
  const { isScanning } = useScanStore();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'scan', label: 'New Scan', icon: Scan, disabled: isScanning },
    { id: 'results', label: 'Results', icon: FileText },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-header">
        <div className="logo">
          <Shield className="logo-icon" />
          {!sidebarCollapsed && (
            <span className="logo-text">Security Scanner</span>
          )}
        </div>
        <button 
          className="collapse-btn"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item ${activeView === item.id ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
              onClick={() => !item.disabled && setActiveView(item.id as any)}
              disabled={item.disabled}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon className="nav-icon" />
              {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
              {isScanning && activeView !== item.id && item.id === 'scan' && (
                <span className="nav-badge">
                  <Activity className="w-3 h-3 animate-pulse" />
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Status */}
      {!sidebarCollapsed && (
        <div className="sidebar-footer">
          <div className="scan-status">
            {isScanning ? (
              <>
                <Activity className="w-4 h-4 text-success" />
                <span className="status-text">Scan in progress</span>
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 text-muted" />
                <span className="status-text">Ready</span>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
