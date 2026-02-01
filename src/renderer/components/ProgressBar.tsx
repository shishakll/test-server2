import React from 'react';
import { useScanStore } from '@stores';
import type { ScanPhase } from '@types';
import { Play, Pause, Square, Clock, CheckCircle, XCircle, AlertCircle, ChevronRight } from 'lucide-react';

interface ProgressBarProps {
  onCancel?: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

const PHASES: { id: ScanPhase; label: string; weight: number }[] = [
  { id: 'browser_init', label: 'Browser Initialization', weight: 10 },
  { id: 'proxy_start', label: 'Proxy Configuration', weight: 5 },
  { id: 'navigating', label: 'Navigation & Discovery', weight: 15 },
  { id: 'spider', label: 'Spider Crawling', weight: 15 },
  { id: 'ajax_spider', label: 'AJAX Spider', weight: 10 },
  { id: 'active_scan', label: 'Active Scanning', weight: 20 },
  { id: 'nuclei_scan', label: 'Nuclei Templates', weight: 10 },
  { id: 'asset_discovery', label: 'Asset Discovery', weight: 10 },
  { id: 'reporting', label: 'Report Generation', weight: 5 },
];

const STATUS_ICONS: Record<string, React.FC<{ className?: string }>> = {
  completed: CheckCircle,
  failed: XCircle,
  cancelled: XCircle,
};

/**
 * ProgressBar - Multi-phase scan progress indicator with controls
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  onCancel,
  onPause,
  onResume,
}) => {
  const { scanState, isScanning } = useScanStore();

  const getPhaseProgress = (): number => {
    if (!scanState) return 0;

    const currentPhaseIndex = PHASES.findIndex(p => p.id === scanState.status);
    const previousWeight = PHASES.slice(0, currentPhaseIndex).reduce((acc, p) => acc + p.weight, 0);
    const currentPhase = PHASES[currentPhaseIndex];

    if (!currentPhase) return 100;

    return previousWeight + (scanState.progress / 100) * currentPhase.weight;
  };

  const getPhaseStatus = (phaseId: ScanPhase): 'completed' | 'active' | 'pending' | 'failed' | 'cancelled' => {
    if (!scanState) return 'pending';

    const status = scanState.status;
    if (status === 'failed') return 'failed';
    if (status === 'cancelled') return 'cancelled';

    const currentIndex = PHASES.findIndex(p => p.id === status);
    const phaseIndex = PHASES.findIndex(p => p.id === phaseId);

    if (phaseIndex < currentIndex) return 'completed';
    if (phaseIndex === currentIndex) return 'active';
    return 'pending';
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  };

  const getElapsedTime = (): string => {
    if (!scanState?.startTime) return '0s';
    const elapsed = Date.now() - new Date(scanState.startTime).getTime();
    return formatDuration(elapsed);
  };

  const progress = getPhaseProgress();
  const isCompleted = scanState?.status === 'completed';
  const isFailed = scanState?.status === 'failed';
  const isCancelled = scanState?.status === 'cancelled';
  const isPaused = isScanning && scanState?.status === 'paused';

  return (
    <div className="progress-bar-container">
      {/* Header with Progress */}
      <div className="progress-header">
        <div className="progress-info">
          <span className="progress-label">
            {isCompleted && 'Scan Complete'}
            {isFailed && 'Scan Failed'}
            {isCancelled && 'Scan Cancelled'}
            {!isCompleted && !isFailed && !isCancelled && 'Scanning in Progress...'}
          </span>
          <div className="progress-percentage-wrapper">
            <span className="progress-percentage">{progress.toFixed(0)}%</span>
            {!isCompleted && !isFailed && !isCancelled && (
              <span className="progress-time">
                <Clock className="w-3 h-3" />
                {getElapsedTime()}
              </span>
            )}
          </div>
        </div>

        {/* Controls */}
        {isScanning && (
          <div className="progress-controls">
            <button 
              className="btn btn-ghost btn-icon" 
              onClick={isPaused ? onResume : onPause}
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button 
              className="btn btn-danger btn-icon" 
              onClick={onCancel}
              title="Cancel Scan"
            >
              <Square className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Progress Track */}
      <div className="progress-track">
        <div 
          className={`progress-fill ${isFailed ? 'failed' : ''} ${isCancelled ? 'cancelled' : ''}`}
          style={{ width: `${progress}%` }}
        />
        {/* Phase markers */}
        {PHASES.map((phase, index) => {
          const position = PHASES.slice(0, index).reduce((acc, p) => acc + p.weight, 0) + (phase.weight / 2);
          return (
            <div 
              key={phase.id}
              className="progress-marker"
              style={{ left: `${position}%` }}
              title={phase.label}
            />
          );
        })}
      </div>

      {/* Phase List */}
      <div className="progress-phases">
        {PHASES.map((phase, phaseIndex) => {
          const status = getPhaseStatus(phase.id);
          const StatusIcon = STATUS_ICONS[status] || (status === 'active' ? AlertCircle : Square);

          return (
            <div 
              key={phase.id} 
              className={`progress-phase ${status} ${scanState?.status === phase.id ? 'current' : ''}`}
            >
              <div className="phase-indicator">
                {status === 'completed' && <CheckCircle className="w-4 h-4" />}
                {status === 'active' && <div className="phase-spinner" />}
                {status === 'pending' && <div className="phase-dot" />}
                {status === 'failed' && <XCircle className="w-4 h-4" />}
                {status === 'cancelled' && <XCircle className="w-4 h-4" />}
              </div>
              <div className="phase-content">
                <span className="phase-label">{phase.label}</span>
                {status === 'active' && scanState && (
                  <span className="phase-current-url">
                    {scanState.currentUrl || 'Processing...'}
                  </span>
                )}
              </div>
              {phaseIndex < PHASES.length - 1 && (
                <ChevronRight className="phase-arrow w-4 h-4" />
              )}
            </div>
          );
        })}
      </div>

      {/* Stats */}
      {scanState && (
        <div className="progress-stats">
          <div className="stat">
            <div className="stat-icon urls">
              <Clock className="w-4 h-4" />
            </div>
            <div className="stat-content">
              <span className="stat-value">{scanState.urlsDiscovered}</span>
              <span className="stat-label">URLs Discovered</span>
            </div>
          </div>
          <div className="stat">
            <div className="stat-icon alerts">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="stat-content">
              <span className="stat-value">{scanState.alertsFound}</span>
              <span className="stat-label">ZAP Alerts</span>
            </div>
          </div>
          <div className="stat">
            <div className="stat-icon nuclei">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div className="stat-content">
              <span className="stat-value">{scanState.nucleiFindings}</span>
              <span className="stat-label">Nuclei Findings</span>
            </div>
          </div>
        </div>
      )}

      {/* Errors */}
      {scanState?.errors && scanState.errors.length > 0 && (
        <div className="progress-errors">
          <div className="errors-header">
            <AlertCircle className="w-4 h-4 text-warning" />
            <span>{scanState.errors.length} error(s) occurred</span>
          </div>
          <div className="errors-list">
            {scanState.errors.slice(0, 3).map((error, index) => (
              <div key={index} className="error-item">
                <span className="error-phase">[{error.phase}]</span>
                <span className="error-message">{error.message}</span>
              </div>
            ))}
            {scanState.errors.length > 3 && (
              <button className="btn btn-link btn-sm">
                View all {scanState.errors.length} errors
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressBar;
