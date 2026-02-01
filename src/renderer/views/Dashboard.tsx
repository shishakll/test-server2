import React, { useState, useEffect, useMemo } from 'react';
import { useScanStore, useUIStore } from '@stores';
import type { Vulnerability } from '@types';
import { 
  Shield, 
  Activity, 
  Target, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  Calendar, 
  Search, 
  ArrowRight 
} from 'lucide-react';
import { formatDuration } from '@utils';

/**
 * Format date to readable string
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

/**
 * Dashboard - Main dashboard with scan statistics and recent activity
 */
export const Dashboard: React.FC = () => {
  const { vulnerabilities, scanHistory, isScanning } = useScanStore();
  const { setActiveView } = useUIStore();

  const stats = useMemo(() => {
    const totalVulns = vulnerabilities.length;
    const critical = vulnerabilities.filter((v: Vulnerability) => v.severity === 'critical').length;
    const high = vulnerabilities.filter((v: Vulnerability) => v.severity === 'high').length;
    const avgScanTime = scanHistory.length > 0
      ? scanHistory.reduce((acc: number, s: { duration?: number }) => acc + (s.duration || 0), 0) / scanHistory.length
      : 0;

    return {
      totalScans: scanHistory.length,
      totalVulnerabilities: totalVulns,
      criticalCount: critical,
      highCount: high,
      avgScanTime,
    };
  }, [vulnerabilities, scanHistory]);

  const severityDistribution = [
    { label: 'Critical', value: stats.criticalCount, color: '#dc2626', icon: AlertTriangle },
    { label: 'High', value: stats.highCount, color: '#ea580c', icon: Target },
    { label: 'Medium', value: vulnerabilities.filter((v: Vulnerability) => v.severity === 'medium').length, color: '#ca8a04', icon: Activity },
    { label: 'Low', value: vulnerabilities.filter((v: Vulnerability) => v.severity === 'low').length, color: '#16a34a', icon: Shield },
    { label: 'Info', value: vulnerabilities.filter((v: Vulnerability) => v.severity === 'informational').length, color: '#6b7280', icon: Clock },
  ];

  const recentScans = scanHistory.slice(-5).reverse();

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400">Security scan overview and statistics</p>
        </div>
        <button
          onClick={() => setActiveView('scan')}
          className="btn btn-primary"
        >
          <Search className="w-4 h-4 mr-2" />
          New Scan
        </button>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard
          title="Total Scans"
          value={stats.totalScans}
          icon={Calendar}
          color="#3b82f6"
        />
        <StatCard
          title="Total Vulnerabilities"
          value={stats.totalVulnerabilities}
          icon={AlertTriangle}
          color="#f59e0b"
        />
        <StatCard
          title="Critical"
          value={stats.criticalCount}
          icon={Activity}
          color="#dc2626"
        />
        <StatCard
          title="High"
          value={stats.highCount}
          icon={Target}
          color="#ea580c"
        />
        <StatCard
          title="Avg. Scan Time"
          value={formatDuration(stats.avgScanTime)}
          icon={Clock}
          color="#8b5cf6"
        />
      </div>

      {/* Main Content */}
      <div className="dashboard-content">
        {/* Severity Distribution */}
        <div className="card">
          <div className="card-header">
            <h3>Severity Distribution</h3>
          </div>
          <div className="card-body">
            <div className="severity-chart">
              {severityDistribution.map((item) => (
                <div key={item.label} className="severity-bar-item">
                  <div className="severity-label">
                    <item.icon className="w-4 h-4" style={{ color: item.color }} />
                    <span>{item.label}</span>
                  </div>
                  <div className="severity-bar-container">
                    <div
                      className="severity-bar"
                      style={{
                        width: `${stats.totalVulnerabilities > 0 ? (item.value / stats.totalVulnerabilities) * 100 : 0}%`,
                        backgroundColor: item.color,
                      }}
                    />
                    <span className="severity-value">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Scans */}
        <div className="card">
          <div className="card-header">
            <h3>Recent Scans</h3>
            <button
              onClick={() => setActiveView('scan')}
              className="btn btn-ghost"
            >
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
          <div className="card-body">
            {recentScans.length > 0 ? (
              <div className="recent-scans">
                {recentScans.map((scan) => (
                  <div key={scan.id} className="recent-scan-item">
                    <div className="scan-info">
                      <h4>{scan.targetUrl || scan.targetHosts?.join(', ') || 'Unknown'}</h4>
                      <p className="scan-meta">
                        {formatDate(scan.startTime)} &bull; {formatDuration(scan.duration || 0)}
                      </p>
                    </div>
                    <div className={`scan-status ${scan.status}`}>
                      {scan.status === 'completed' ? (
                        <span className="badge badge-success">Completed</span>
                      ) : scan.status === 'failed' ? (
                        <span className="badge badge-error">Failed</span>
                      ) : scan.status === 'cancelled' ? (
                        <span className="badge badge-warning">Cancelled</span>
                      ) : (
                        <span className="badge badge-info">{scan.status}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Search className="w-12 h-12 text-gray-300" />
                <p>No scans yet</p>
                <button
                  onClick={() => setActiveView('scan')}
                  className="btn btn-primary"
                >
                  Start Your First Scan
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="action-grid">
          <button className="action-card" onClick={() => setActiveView('scan')}>
            <Search className="w-8 h-8" />
            <span>New Scan</span>
          </button>
          <button className="action-card" onClick={() => setActiveView('settings')}>
            <Shield className="w-8 h-8" />
            <span>Settings</span>
          </button>
          <button className="action-card" onClick={() => setActiveView('results')}>
            <TrendingUp className="w-8 h-8" />
            <span>View Reports</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * StatCard - Statistics display card
 */
const StatCard: React.FC<{
  title: string;
  value: number | string;
  icon: React.FC<{ className?: string }>;
  color: string;
}> = ({ title, value, icon: Icon, color }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ backgroundColor: `${color}15`, color }}>
      <Icon className="w-6 h-6" />
    </div>
    <div className="stat-content">
      <span className="stat-value">{value}</span>
      <span className="stat-title">{title}</span>
    </div>
  </div>
);

export default Dashboard;
