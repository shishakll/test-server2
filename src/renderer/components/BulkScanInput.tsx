import React, { useState, useCallback } from 'react';
import { useBulkScanStore } from '../../stores';
import type { BulkScanConfig, ScanType } from '../../types';

interface BulkScanInputProps {
  onScanStart?: (config: BulkScanConfig) => void;
  disabled?: boolean;
}

export const BulkScanInput: React.FC<BulkScanInputProps> = ({
  onScanStart,
  disabled = false,
}) => {
  const { startBulkScan, bulkScanState, resetBulkScan, pauseBulkScan, resumeBulkScan, cancelBulkScan } =
    useBulkScanStore();

  const [targets, setTargets] = useState('');
  const [scanMode, setScanMode] = useState<'sequential' | 'parallel'>('sequential');
  const [concurrency, setConcurrency] = useState(3);
  const [scanType, setScanType] = useState<ScanType>('standard');
  const [assetDiscovery, setAssetDiscovery] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  const handleFileImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setTargets(content);
      };
      reader.readAsText(file);
    }
  }, []);

  const handlePaste = useCallback((event: React.ClipboardEvent) => {
    const pastedText = event.clipboardData.getData('text');
    setTargets(prev => prev + (prev ? '\n' : '') + pastedText);
  }, []);

  const validateTargets = useCallback((input: string): number => {
    const lines = input.split(/[\n,]+/).map(t => t.trim()).filter(Boolean);
    const validCount = lines.filter(t => {
      const normalized = t.startsWith('http') ? t : `https://${t}`;
      try {
        new URL(normalized);
        return true;
      } catch {
        return false;
      }
    }).length;
    return validCount;
  }, []);

  const handleStartScan = useCallback(() => {
    if (!targets.trim()) return;

    const config: BulkScanConfig = {
      targets: targets.split(/[\n,]+/).map(t => t.trim()).filter(Boolean),
      mode: scanMode,
      concurrency: scanMode === 'parallel' ? concurrency : 1,
      scanType,
      assetDiscovery,
    };

    startBulkScan(config);
    onScanStart?.(config);
  }, [targets, scanMode, concurrency, scanType, assetDiscovery, startBulkScan, onScanStart]);

  const validTargetCount = validateTargets(targets);
  const isRunning = bulkScanState.isRunning;
  const isPaused = bulkScanState.isPaused;

  return (
    <div className="bulk-scan-input">
      <div className="section-header">
        <h3>Multi-Target Scanning</h3>
        <span className="target-count">
          {validTargetCount} valid target{validTargetCount !== 1 ? 's' : ''} detected
        </span>
      </div>

      {/* Target Input Area */}
      <div className="input-group">
        <label>Target URLs / Domains</label>
        <textarea
          value={targets}
          onChange={(e) => setTargets(e.target.value)}
          onPaste={handlePaste}
          placeholder="Enter URLs or domains (one per line or comma-separated)&#10;Example:&#10;https://example.com&#10;https://test.com&#10;subdomain.example.org"
          disabled={disabled || isRunning}
          rows={8}
          className="target-textarea"
        />
      </div>

      {/* File Import */}
      <div className="input-group file-import">
        <label>Or Import from File</label>
        <input
          type="file"
          accept=".txt,.csv,.json"
          onChange={handleFileImport}
          disabled={disabled || isRunning}
          className="file-input"
        />
        {importFile && (
          <span className="file-name">{importFile.name}</span>
        )}
      </div>

      {/* Scan Options */}
      <div className="options-grid">
        <div className="input-group">
          <label>Scan Mode</label>
          <select
            value={scanMode}
            onChange={(e) => setScanMode(e.target.value as 'sequential' | 'parallel')}
            disabled={disabled || isRunning}
            className="mode-select"
          >
            <option value="sequential">Sequential (one at a time)</option>
            <option value="parallel">Parallel (multiple at once)</option>
          </select>
        </div>

        {scanMode === 'parallel' && (
          <div className="input-group">
            <label>Concurrency ({concurrency})</label>
            <input
              type="range"
              min="2"
              max="10"
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              disabled={disabled || isRunning}
              className="concurrency-slider"
            />
          </div>
        )}

        <div className="input-group">
          <label>Scan Type</label>
          <select
            value={scanType}
            onChange={(e) => setScanType(e.target.value as ScanType)}
            disabled={disabled || isRunning}
            className="scan-type-select"
          >
            <option value="quick">Quick Scan (basic checks)</option>
            <option value="standard">Standard Scan (recommended)</option>
            <option value="deep">Deep Scan (comprehensive)</option>
            <option value="custom">Custom Scan</option>
          </select>
        </div>

        <div className="input-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={assetDiscovery}
              onChange={(e) => setAssetDiscovery(e.target.checked)}
              disabled={disabled || isRunning}
            />
            Enable Asset Discovery
          </label>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        {!isRunning && !bulkScanState.bulkScanId && (
          <button
            onClick={handleStartScan}
            disabled={disabled || validTargetCount === 0}
            className="btn-primary start-button"
          >
            Start Bulk Scan ({validTargetCount} target{validTargetCount !== 1 ? 's' : ''})
          </button>
        )}

        {isRunning && !isPaused && (
          <>
            <button
              onClick={pauseBulkScan}
              disabled={disabled}
              className="btn-warning pause-button"
            >
              Pause Scan
            </button>
            <button
              onClick={() => cancelBulkScan()}
              disabled={disabled}
              className="btn-danger cancel-button"
            >
              Cancel Scan
            </button>
          </>
        )}

        {isPaused && (
          <>
            <button
              onClick={resumeBulkScan}
              disabled={disabled}
              className="btn-primary resume-button"
            >
              Resume Scan
            </button>
            <button
              onClick={() => cancelBulkScan()}
              disabled={disabled}
              className="btn-danger cancel-button"
            >
              Cancel Scan
            </button>
          </>
        )}

        {bulkScanState.bulkScanId && !isRunning && (
          <button
            onClick={resetBulkScan}
            disabled={disabled}
            className="btn-secondary reset-button"
          >
            Start New Scan
          </button>
        )}
      </div>

      {/* Sample Targets */}
      <div className="sample-targets">
        <button
          onClick={() => setTargets('https://example.com\nhttps://test.com\nhttps://demo.io')}
          disabled={isRunning}
          className="btn-link"
        >
          Load Sample Targets
        </button>
        <button
          onClick={() => setTargets('')}
          disabled={isRunning || !targets}
          className="btn-link"
        >
          Clear All
        </button>
      </div>

      <style>{`
        .bulk-scan-input {
          padding: 1.5rem;
          background: #1a1a2e;
          border-radius: 12px;
          color: #fff;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .section-header h3 {
          margin: 0;
          font-size: 1.25rem;
          color: #fff;
        }

        .target-count {
          padding: 0.5rem 1rem;
          background: #16213e;
          border-radius: 20px;
          font-size: 0.875rem;
          color: #4ade80;
        }

        .input-group {
          margin-bottom: 1.25rem;
        }

        .input-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
          color: #94a3b8;
        }

        .target-textarea {
          width: 100%;
          padding: 1rem;
          background: #0f0f23;
          border: 1px solid #2d2d44;
          border-radius: 8px;
          color: #fff;
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 0.875rem;
          resize: vertical;
          transition: border-color 0.2s;
        }

        .target-textarea:focus {
          outline: none;
          border-color: #6366f1;
        }

        .target-textarea:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .file-import {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .file-input {
          flex: 1;
        }

        .file-name {
          color: #4ade80;
          font-size: 0.875rem;
        }

        .options-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .mode-select,
        .scan-type-select {
          width: 100%;
          padding: 0.75rem;
          background: #0f0f23;
          border: 1px solid #2d2d44;
          border-radius: 8px;
          color: #fff;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .mode-select:focus,
        .scan-type-select:focus {
          outline: none;
          border-color: #6366f1;
        }

        .concurrency-slider {
          width: 100%;
          cursor: pointer;
        }

        .checkbox-group label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }

        .checkbox-group input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .action-buttons {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
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

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
        }

        .btn-secondary {
          background: #2d2d44;
          color: #fff;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #3d3d54;
        }

        .btn-warning {
          background: #f59e0b;
          color: white;
        }

        .btn-warning:hover:not(:disabled) {
          background: #d97706;
        }

        .btn-danger {
          background: #ef4444;
          color: white;
        }

        .btn-danger:hover:not(:disabled) {
          background: #dc2626;
        }

        .btn-primary:disabled,
        .btn-secondary:disabled,
        .btn-warning:disabled,
        .btn-danger:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .sample-targets {
          display: flex;
          gap: 1rem;
        }

        .btn-link {
          background: none;
          border: none;
          color: #6366f1;
          font-size: 0.875rem;
          cursor: pointer;
          text-decoration: underline;
        }

        .btn-link:hover {
          color: #818cf8;
        }

        .btn-link:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default BulkScanInput;
