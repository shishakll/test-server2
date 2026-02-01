import React, { useState, useEffect, useMemo } from 'react';
import { useScanStore, useUIStore } from '@stores';
import type { Vulnerability, VulnerabilitySummary } from '@types';
import {
  Shield,
  Activity,
  Target,
  AlertTriangle,
  Clock,
  TrendingUp,
  Calendar,
  Search,
  ArrowRight,
  BarChart3,
  PieChart,
  Zap,
} from 'lucide-react';
import { formatDuration } from '@utils';
import { SeverityChart, DonutChart, TrendLineChart } from '../components/Charts';

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
 * Dashboard - Main dashboard with scan statistics and charts
 */
export const Dashboard: React.FC = () => {
  const { vulnerabilities, scanHistory, isScanning, scanState } = useScanStore();
  const { setActiveView } = useUIStore();

  const severitySummary: VulnerabilitySummary = useMemo(() => {
    return {
      critical: vulnerabilities.filter((v: Vulnerability) => v.severity === 'critical').length,
      high: vulnerabilities.filter((v: Vulnerability) => v.severity === 'high').length,
      medium: vulnerabilities.filter((v: Vulnerability) => v.severity === 'medium').length,
      low: vulnerabilities.filter((v: Vulnerability) => v.severity === 'low').length,
      informational: vulnerabilities.filter((v: Vulnerability) => v.severity === 'informational').length,
      total: vulnerabilities.length,
    };
  }, [vulnerabilities]);

  const stats = useMemo(() => {
    const avgScanTime = scanHistory.length > 0
      ? scanHistory.reduce((acc: number, s: { duration?: number }) => acc + (s.duration || 0), 0) / scanHistory.length
      : 0;

    return {
      totalScans: scanHistory.length,
      totalVulnerabilities: severitySummary.total,
      criticalCount: severitySummary.critical,
      highCount: severitySummary.high,
      mediumCount: severitySummary.medium,
      avgScanTime,
    };
  }, [severitySummary, scanHistory]);

  // Generate trend data from scan history
  const vulnerabilityTrend = useMemo(() => {
    return scanHistory.slice(-10).map((scan) => {
      // This would typically count vulnerabilities from the scan
      return scan.nucleiFindings || 0;
    });
  }, [scanHistory]);

  const recentScans = scanHistory.slice(-5).reverse();

  return (
    <div className="dashboard" style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>
            Dashboard
          </h1>
          <p style={{ fontSize: '14px', color: '#8b8b9e' }}>
            Security scan overview and statistics
          </p>
        </div>
        <button
          onClick={() => setActiveView('scan')}
          className="btn btn-primary"
          disabled={isScanning}
        >
          <Search className="w-4 h-4" style={{ marginRight: '8px' }} />
          New Scan
        </button>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}>
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

      {/* Charts Section */}
      <div className="dashboard-charts">
        {/* Severity Distribution Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Severity Distribution</h3>
              <p className="chart-subtitle">Vulnerabilities by severity level</p>
            </div>
            <BarChart3 className="w-5 h-5" style={{ color: '#8b8b9e' }} />
          </div>
          <SeverityChart summary={severitySummary} />
        </div>

        {/* Donut Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Vulnerability Overview</h3>
              <p className="chart-subtitle">Distribution breakdown</p>
            </div>
            <PieChart className="w-5 h-5" style={{ color: '#8b8b9e' }} />
          </div>
          <DonutChart summary={severitySummary} />
        </div>

        {/* Trend Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Scan Trend</h3>
              <p className="chart-subtitle">Recent findings over time</p>
            </div>
            <TrendingUp className="w-5 h-5" style={{ color: '#8b8b9e' }} />
          </div>
          {vulnerabilityTrend.length > 0 ? (
            <TrendLineChart data={vulnerabilityTrend} height={100} />
          ) : (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#8b8b9e' }}>
              <BarChart3 className="w-12 h-12 mx-auto mb-3" style={{ opacity: 0.3 }} />
              <p>No scan history yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Scans */}
      <div className="card" style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        marginBottom: '24px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff' }}>Recent Scans</h3>
          <button
            onClick={() => setActiveView('scan')}
            className="btn btn-ghost btn-sm"
          >
            View All <ArrowRight className="w-4 h-4" style={{ marginLeft: '4px' }} />
          </button>
        </div>
        <div style={{ padding: '16px 24px' }}>
          {recentScans.length > 0 ? (
            <div className="scan-history-chart">
              {recentScans.map((scan) => (
                <div key={scan.id} className="history-item">
                  <span className="history-date">{formatDate(scan.startTime)}</span>
                  <span className="history-target">
                    {scan.targetUrl || scan.targetHosts?.join(', ') || 'Unknown'}
                  </span>
                  <div className="history-counts">
                    {scan.status === 'completed' && (
                      <>
                        <span className="history-count critical">
                          <Zap className="w-3 h-3" /> {scan.nucleiFindings || 0}
                        </span>
                      </>
                    )}
                  </div>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '500',
                    background: scan.status === 'completed'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : scan.status === 'failed'
                        ? 'rgba(239, 68, 68, 0.15)'
                        : 'rgba(245, 158, 11, 0.15)',
                    color: scan.status === 'completed'
                      ? '#10b981'
                      : scan.status === 'failed'
                        ? '#ef4444'
                        : '#f59e0b',
                  }}>
                    {scan.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <Search className="w-12 h-12" style={{ color: '#5a5a6e', marginBottom: '16px' }} />
              <p style={{ color: '#8b8b9e', marginBottom: '16px' }}>No scans yet</p>
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

      {/* Quick Actions */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', marginBottom: '16px' }}>
          Quick Actions
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px',
        }}>
          <button
            className="action-card"
            onClick={() => setActiveView('scan')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              padding: '20px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Search className="w-8 h-8" style={{ color: '#6366f1' }} />
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#e0e0e0' }}>New Scan</span>
          </button>
          <button
            className="action-card"
            onClick={() => setActiveView('results')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              padding: '20px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <TrendingUp className="w-8 h-8" style={{ color: '#10b981' }} />
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#e0e0e0' }}>View Reports</span>
          </button>
          <button
            className="action-card"
            onClick={() => setActiveView('settings')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              padding: '20px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Shield className="w-8 h-8" style={{ color: '#8b5cf6' }} />
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#e0e0e0' }}>Settings</span>
          </button>
        </div>
      </div>

      {/* Active Scan Banner */}
      {isScanning && scanState && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          padding: '16px 20px',
          background: 'rgba(99, 102, 241, 0.15)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <Activity className="w-5 h-5 animate-pulse" style={{ color: '#6366f1' }} />
          <div>
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#fff' }}>
              Scan in Progress
            </span>
            <p style={{ fontSize: '12px', color: '#8b8b9e' }}>
              {scanState.progress}% complete - {scanState.currentUrl || 'Processing...'}
            </p>
          </div>
        </div>
      )}
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
  <div className="stat-card" style={{
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  }}>
    <div style={{
      width: '48px',
      height: '48px',
      borderRadius: '12px',
      background: `${color}15`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Icon className="w-6 h-6" style={{ color }} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: '24px', fontWeight: '700', color: '#fff' }}>{value}</span>
      <span style={{ fontSize: '13px', color: '#8b8b9e' }}>{title}</span>
    </div>
  </div>
);

export default Dashboard;
