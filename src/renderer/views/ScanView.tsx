import React, { useState, useEffect, useCallback } from 'react';
import { useScanStore, useSettingsStore, useUIStore, useBulkScanStore } from '@stores';
import type { ScanConfig } from '@types';
import { Zap, Play, Settings, BarChart2, AlertTriangle, Loader, Layers } from 'lucide-react';
import { ProgressBar } from '../components/ProgressBar';
import { ResultsView } from './ResultsView';
import { BulkScanInput } from '../components/BulkScanInput';
import { BulkScanProgress } from '../components/BulkScanProgress';

/**
 * ScanView - Main scan configuration and execution component
 */
export const ScanView: React.FC = () => {
  const {
    isScanning,
    scanState,
    vulnerabilities,
    startScan,
    pauseScan,
    cancelScan,
  } = useScanStore();

  const { bulkScanState, aggregateVulnerabilities } = useBulkScanStore();

  const { setActiveView } = useUIStore();

  const [activeTab, setActiveTab] = useState<'config' | 'progress' | 'results' | 'bulk'>('config');
  const [config, setConfig] = useState<ScanConfig | null>(null);
  const [scanMode, setScanMode] = useState<'single' | 'bulk'>('single');

  // Handle scan state changes
  useEffect(() => {
    if (isScanning) {
      setActiveTab('progress');
    } else if (vulnerabilities.length > 0) {
      setActiveTab('results');
    }
  }, [isScanning, vulnerabilities.length]);

  // Handle bulk scan state changes
  useEffect(() => {
    if (bulkScanState.bulkScanId) {
      setActiveTab('bulk');
    }
  }, [bulkScanState.bulkScanId]);

  const handleStartScan = useCallback(() => {
    if (config) {
      startScan(config);
    }
  }, [config, startScan]);

  const handleDownloadReport = useCallback((format: 'html' | 'json' | 'csv' | 'sarif') => {
    console.log(`Downloading report as ${format}`);
    // TODO: Implement report download
  }, []);

  const handleUploadDefectDojo = useCallback(() => {
    console.log('Uploading to DefectDojo');
    // TODO: Implement DefectDojo upload
  }, []);

  const hasResults = vulnerabilities.length > 0 || aggregateVulnerabilities.length > 0;

  return (
    <div className="scan-view">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Security Scan</h1>
          <p className="text-gray-500 dark:text-gray-400">Configure and run security scans</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveView('dashboard')}
            className="btn btn-secondary"
          >
            <BarChart2 className="w-4 h-4 mr-2" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveView('settings')}
            className="btn btn-secondary"
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </button>
        </div>
      </div>

      {/* Scan Mode Toggle */}
      <div className="scan-mode-toggle">
        <button
          className={`mode-btn ${scanMode === 'single' ? 'active' : ''}`}
          onClick={() => setScanMode('single')}
        >
          <Play className="w-4 h-4" />
          Single Target
        </button>
        <button
          className={`mode-btn ${scanMode === 'bulk' ? 'active' : ''}`}
          onClick={() => setScanMode('bulk')}
        >
          <Layers className="w-4 h-4" />
          Multi-Target (Bulk)
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {scanMode === 'single' && (
          <>
            <button
              className={`tab ${activeTab === 'config' ? 'active' : ''}`}
              onClick={() => setActiveTab('config')}
            >
              Configuration
            </button>
            <button
              className={`tab ${activeTab === 'progress' ? 'active' : ''}`}
              onClick={() => setActiveTab('progress')}
              disabled={!isScanning && !scanState}
            >
              Progress
            </button>
            <button
              className={`tab ${activeTab === 'results' ? 'active' : ''}`}
              onClick={() => setActiveTab('results')}
              disabled={vulnerabilities.length === 0}
            >
              Results ({vulnerabilities.length})
            </button>
          </>
        )}

        {scanMode === 'bulk' && (
          <button
            className={`tab ${activeTab === 'bulk' ? 'active' : ''}`}
            onClick={() => setActiveTab('bulk')}
          >
            {bulkScanState.bulkScanId ? 'Bulk Progress' : 'Bulk Configuration'}
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {scanMode === 'single' && activeTab === 'config' && (
          <ScanConfigForm
            config={config}
            onConfigChange={setConfig}
            onStart={handleStartScan}
            disabled={isScanning}
          />
        )}

        {scanMode === 'single' && activeTab === 'progress' && (
          <ProgressBar
            onPause={pauseScan}
            onResume={() => {}}
            onCancel={cancelScan}
          />
        )}

        {scanMode === 'single' && activeTab === 'results' && (
          <ResultsView
            onDownloadReport={handleDownloadReport}
            onUploadDefectDojo={handleUploadDefectDojo}
          />
        )}

        {scanMode === 'bulk' && (
          <>
            {!bulkScanState.bulkScanId ? (
              <BulkScanInput
                onScanStart={(config) => console.log('Bulk scan started:', config)}
                disabled={isScanning}
              />
            ) : (
              <BulkScanProgress
                onComplete={() => {
                  console.log('Bulk scan completed');
                }}
              />
            )}
          </>
        )}
      </div>

      <style>{`
        .scan-mode-toggle {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          padding: 0.25rem;
          background: #1a1a2e;
          border-radius: 10px;
          width: fit-content;
        }

        .mode-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: #94a3b8;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mode-btn.active {
          background: #6366f1;
          color: white;
        }

        .mode-btn:hover:not(.active) {
          background: #2d2d44;
          color: #fff;
        }
      `}</style>
    </div>
  );
};

/**
 * ScanConfigForm - Scan configuration form
 */
const ScanConfigForm: React.FC<{
  config: ScanConfig | null;
  onConfigChange: (config: ScanConfig | null) => void;
  onStart: () => void;
  disabled: boolean;
}> = ({ config, onConfigChange, onStart, disabled }) => {
  const [targetUrl, setTargetUrl] = useState('');
  const [targetHosts, setTargetHosts] = useState('');
  const [selectedBrowsers, setSelectedBrowsers] = useState<string[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [assetDiscovery, setAssetDiscovery] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newConfig: ScanConfig = {
      id: `scan-${Date.now()}`,
      targetUrl: targetUrl || undefined,
      targetHosts: targetHosts ? targetHosts.split(',').map(h => h.trim()).filter(Boolean) : undefined,
      scanType: 'standard',
      authMode: 'none',
      browserEngine: 'electron',
      browser: selectedBrowsers,
      securityTools: selectedTools,
      assetDiscovery,
      ai: aiEnabled ? { enabled: true } : undefined,
    };
    
    onConfigChange(newConfig);
    onStart();
  };

  return (
    <form onSubmit={handleSubmit} className="config-form">
      {/* Target */}
      <div className="form-group">
        <label htmlFor="targetUrl">Target URL</label>
        <input
          id="targetUrl"
          type="url"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="https://example.com"
          disabled={disabled}
        />
        <span className="help-text">Single URL to scan</span>
      </div>

      <div className="form-group">
        <label htmlFor="targetHosts">Target Hosts (comma-separated)</label>
        <textarea
          id="targetHosts"
          value={targetHosts}
          onChange={(e) => setTargetHosts(e.target.value)}
          placeholder="example.com, api.example.com, admin.example.com"
          disabled={disabled}
          rows={3}
        />
        <span className="help-text">Multiple hosts for nuclei/asset discovery</span>
      </div>

      {/* Browser Tools */}
      <div className="form-group">
        <label>Browser Automation</label>
        <div className="checkbox-group">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={selectedBrowsers.includes('cdp')}
              onChange={(e) => {
                setSelectedBrowsers(
                  e.target.checked
                    ? [...selectedBrowsers, 'cdp']
                    : selectedBrowsers.filter(b => b !== 'cdp')
                );
              }}
              disabled={disabled}
            />
            CDP (Chrome DevTools Protocol)
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={selectedBrowsers.includes('playwright')}
              onChange={(e) => {
                setSelectedBrowsers(
                  e.target.checked
                    ? [...selectedBrowsers, 'playwright']
                    : selectedBrowsers.filter(b => b !== 'playwright')
                );
              }}
              disabled={disabled}
            />
            Playwright
          </label>
        </div>
      </div>

      {/* Security Tools */}
      <div className="form-group">
        <label>Security Tools</label>
        <div className="checkbox-group">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={selectedTools.includes('zap')}
              onChange={(e) => {
                setSelectedTools(
                  e.target.checked
                    ? [...selectedTools, 'zap']
                    : selectedTools.filter(t => t !== 'zap')
                );
              }}
              disabled={disabled}
            />
            <Zap className="w-4 h-4" />
            OWASP ZAP
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={selectedTools.includes('nuclei')}
              onChange={(e) => {
                setSelectedTools(
                  e.target.checked
                    ? [...selectedTools, 'nuclei']
                    : selectedTools.filter(t => t !== 'nuclei')
                );
              }}
              disabled={disabled}
            />
            Nuclei
          </label>
        </div>
      </div>

      {/* Options */}
      <div className="form-group">
        <label>Options</label>
        <div className="checkbox-group">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={assetDiscovery}
              onChange={(e) => setAssetDiscovery(e.target.checked)}
              disabled={disabled}
            />
            Enable Asset Discovery (Subdomains, APIs, Ports)
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
              disabled={disabled}
            />
            Enable AI Enhancement
          </label>
        </div>
      </div>

      {/* Submit */}
      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={disabled || (!targetUrl && !targetHosts)}
        >
          {disabled ? (
            <>
              <Loader className="w-4 h-4 mr-2 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Start Scan
            </>
          )}
        </button>
      </div>
    </form>
  );
};
