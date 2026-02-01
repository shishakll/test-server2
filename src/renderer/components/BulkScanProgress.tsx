import React, { useEffect, useState } from 'react';
import { useBulkScanStore } from '../../stores';
import { formatDuration } from '../../utils';

interface BulkScanProgressProps {
  onComplete?: () => void;
}

export const BulkScanProgress: React.FC<BulkScanProgressProps> = ({ onComplete }) => {
  const { bulkScanState, aggregateVulnerabilities, pauseBulkScan, resumeBulkScan, cancelBulkScan, resetBulkScan } = useBulkScanStore();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!bulkScanState.isRunning || !bulkScanState.startTime) return;

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - bulkScanState.startTime!.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [bulkScanState.isRunning, bulkScanState.startTime]);

  useEffect(() => {
    if (!bulkScanState.isRunning && bulkScanState.bulkScanId && bulkScanState.progress === 100) {
      onComplete?.();
    }
  }, [bulkScanState.isRunning, bulkScanState.bulkScanId, bulkScanState.progress, onComplete]);

  const progress = bulkScanState.progress;
  const completed = bulkScanState.completedTargets;
  const total = bulkScanState.totalTargets;
  const failed = bulkScanState.failedTargets;
  const criticalCount = bulkScanState.criticalCount;
  const highCount = bulkScanState.highCount;
  const vulnerabilitiesFound = aggregateVulnerabilities.length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#4ade80';
      case 'running': return '#60a5fa';
      case 'failed': return '#ef4444';
      case 'pending': return '#94a3b8';
      default: return '#94a3b8';
    }
  };

  return (
    <div className="bulk-scan-progress">
      {/* Header */}
      <div className="progress-header">
        <div className="header-left">
          <h3>Bulk Scan Progress</h3>
          <span className="scan-id">ID: {bulkScanState.bulkScanId?.slice(0, 8)}</span>
        </div>
        <div className="header-right">
          {bulkScanState.isRunning && !bulkScanState.isPaused && (
            <span className="status-badge running">Running</span>
          )}
          {bulkScanState.isPaused && (
            <span className="status-badge paused">Paused</span>
          )}
          {!bulkScanState.isRunning && bulkScanState.bulkScanId && (
            <span className="status-badge completed">Completed</span>
          )}
        </div>
      </div>

      {/* Overall Progress */}
      <div className="overall-progress">
        <div className="progress-info">
          <span className="progress-label">Overall Progress</span>
          <span className="progress-percentage">{progress}%</span>
        </div>
        <div className="progress-bar-container">
          <div
            className="progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="progress-stats">
          <span className="stat">
            <span className="stat-value">{completed}</span>/
            <span className="stat-total">{total}</span> completed
          </span>
          {failed > 0 && (
            <span className="stat failed">
              <span className="stat-value">{failed}</span> failed
            </span>
          )}
          <span className="stat time">
            <span className="stat-value">{formatDuration(elapsed)}</span> elapsed
          </span>
        </div>
      </div>

      {/* Vulnerability Summary */}
      <div className="vuln-summary">
        <h4>Vulnerabilities Found</h4>
        <div className="vuln-counts">
          <div className="vuln-item critical">
            <span className="count">{criticalCount}</span>
            <span className="label">Critical</span>
          </div>
          <div className="vuln-item high">
            <span className="count">{highCount}</span>
            <span className="label">High</span>
          </div>
          <div className="vuln-item medium">
            <span className="count">{aggregateVulnerabilities.filter(v => v.severity === 'medium').length}</span>
            <span className="label">Medium</span>
          </div>
          <div className="vuln-item low">
            <span className="count">{aggregateVulnerabilities.filter(v => v.severity === 'low').length}</span>
            <span className="label">Low</span>
          </div>
          <div className="vuln-item informational">
            <span className="count">{aggregateVulnerabilities.filter(v => v.severity === 'informational').length}</span>
            <span className="label">Info</span>
          </div>
          <div className="vuln-item total">
            <span className="count">{vulnerabilitiesFound}</span>
            <span className="label">Total</span>
          </div>
        </div>
      </div>

      {/* Queue List */}
      <div className="queue-list">
        <h4>Scan Queue</h4>
        <div className="queue-items">
          {bulkScanState.queue.slice(0, 10).map((item, idx) => (
            <div key={item.id} className={`queue-item ${item.status}`}>
              <div className="item-status" style={{ backgroundColor: getStatusColor(item.status) }} />
              <div className="item-info">
                <span className="item-target">{item.target}</span>
                <span className="item-progress">{item.progress}%</span>
              </div>
              <div className="item-vulns">
                {item.vulnerabilities.length > 0 && (
                  <span className="vuln-badge">{item.vulnerabilities.length}</span>
                )}
              </div>
            </div>
          ))}
          {bulkScanState.queue.length > 10 && (
            <div className="queue-more">
              +{bulkScanState.queue.length - 10} more targets
            </div>
          )}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="control-buttons">
        {bulkScanState.isRunning && !bulkScanState.isPaused && (
          <>
            <button onClick={pauseBulkScan} className="btn-warning">
              Pause
            </button>
            <button onClick={() => cancelBulkScan()} className="btn-danger">
              Cancel
            </button>
          </>
        )}
        {bulkScanState.isPaused && (
          <>
            <button onClick={resumeBulkScan} className="btn-primary">
              Resume
            </button>
            <button onClick={() => cancelBulkScan()} className="btn-danger">
              Cancel
            </button>
          </>
        )}
        {!bulkScanState.isRunning && bulkScanState.bulkScanId && (
          <button onClick={resetBulkScan} className="btn-secondary">
            Start New Scan
          </button>
        )}
      </div>

      <style>{`
        .bulk-scan-progress {
          background: #1a1a2e;
          border-radius: 12px;
          padding: 1.5rem;
          color: #fff;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .header-left h3 {
          margin: 0;
          font-size: 1.25rem;
        }

        .scan-id {
          font-size: 0.75rem;
          color: #64748b;
          font-family: monospace;
        }

        .status-badge {
          padding: 0.375rem 0.75rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-badge.running {
          background: #1e3a5f;
          color: #60a5fa;
        }

        .status-badge.paused {
          background: #3d2a1a;
          color: #fbbf24;
        }

        .status-badge.completed {
          background: #1a3d2e;
          color: #4ade80;
        }

        .overall-progress {
          margin-bottom: 1.5rem;
        }

        .progress-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .progress-label {
          font-size: 0.875rem;
          color: #94a3b8;
        }

        .progress-percentage {
          font-size: 1.5rem;
          font-weight: 700;
          color: #fff;
        }

        .progress-bar-container {
          height: 12px;
          background: #0f0f23;
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 0.75rem;
        }

        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #6366f1, #8b5cf6);
          border-radius: 6px;
          transition: width 0.3s ease;
        }

        .progress-stats {
          display: flex;
          gap: 1.5rem;
          font-size: 0.875rem;
        }

        .stat {
          color: #94a3b8;
        }

        .stat-value {
          color: #fff;
          font-weight: 600;
        }

        .stat-total {
          color: #64748b;
        }

        .stat.failed .stat-value {
          color: #ef4444;
        }

        .vuln-summary {
          margin-bottom: 1.5rem;
          padding: 1rem;
          background: #0f0f23;
          border-radius: 8px;
        }

        .vuln-summary h4 {
          margin: 0 0 1rem 0;
          font-size: 0.875rem;
          color: #94a3b8;
        }

        .vuln-counts {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .vuln-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          min-width: 60px;
        }

        .vuln-item.critical {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .vuln-item.high {
          background: rgba(249, 115, 22, 0.2);
          border: 1px solid rgba(249, 115, 22, 0.3);
        }

        .vuln-item.medium {
          background: rgba(234, 179, 8, 0.2);
          border: 1px solid rgba(234, 179, 8, 0.3);
        }

        .vuln-item.low {
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .vuln-item.informational {
          background: rgba(107, 114, 128, 0.2);
          border: 1px solid rgba(107, 114, 128, 0.3);
        }

        .vuln-item.total {
          background: rgba(99, 102, 241, 0.2);
          border: 1px solid rgba(99, 102, 241, 0.3);
        }

        .vuln-item .count {
          font-size: 1.25rem;
          font-weight: 700;
        }

        .vuln-item .label {
          font-size: 0.625rem;
          text-transform: uppercase;
          color: #94a3b8;
        }

        .queue-list {
          margin-bottom: 1.5rem;
        }

        .queue-list h4 {
          margin: 0 0 1rem 0;
          font-size: 0.875rem;
          color: #94a3b8;
        }

        .queue-items {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 200px;
          overflow-y: auto;
        }

        .queue-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0.75rem;
          background: #0f0f23;
          border-radius: 6px;
        }

        .item-status {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .item-info {
          flex: 1;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .item-target {
          font-size: 0.75rem;
          color: #e2e8f0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 200px;
        }

        .item-progress {
          font-size: 0.75rem;
          color: #64748b;
        }

        .vuln-badge {
          padding: 0.125rem 0.5rem;
          background: rgba(239, 68, 68, 0.2);
          color: #f87171;
          border-radius: 10px;
          font-size: 0.625rem;
          font-weight: 600;
        }

        .queue-more {
          text-align: center;
          padding: 0.5rem;
          color: #64748b;
          font-size: 0.75rem;
        }

        .control-buttons {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .btn-primary,
        .btn-secondary,
        .btn-warning,
        .btn-danger {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
        }

        .btn-secondary {
          background: #2d2d44;
          color: #fff;
        }

        .btn-warning {
          background: #f59e0b;
          color: white;
        }

        .btn-danger {
          background: #ef4444;
          color: white;
        }
      `}</style>
    </div>
  );
};

export default BulkScanProgress;
