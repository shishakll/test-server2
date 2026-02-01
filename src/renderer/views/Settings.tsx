import React, { useState } from 'react';
import { useSettingsStore, useUIStore } from '@stores';
import type { ProxyConfig } from '@types';
import { Settings as SettingsIcon, Shield, Globe, Key, Save, RefreshCw, Check, AlertTriangle } from 'lucide-react';

/**
 * Settings - Application settings configuration
 */
export const Settings: React.FC = () => {
  const {
    theme,
    language,
    setTheme,
    setLanguage,
    proxy,
    setProxy,
    defectDojo,
    setDefectDojo,
    ai,
    setAI,
    toolPaths,
    setToolPath,
  } = useSettingsStore();

  const { setActiveView } = useUIStore();
  const [activeTab, setActiveTab] = useState<'general' | 'proxy' | 'tools' | 'integrations' | 'ai'>('general');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      // Save settings (handled by Zustand persist)
      await new Promise(resolve => setTimeout(resolve, 500));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'proxy', label: 'Proxy', icon: Globe },
    { id: 'tools', label: 'Tool Paths', icon: Shield },
    { id: 'integrations', label: 'Integrations', icon: Key },
    { id: 'ai', label: 'AI Settings', icon: RefreshCw },
  ];

  return (
    <div className="settings">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-500 dark:text-gray-400">Configure application preferences</p>
        </div>
        <button
          onClick={() => setActiveView('dashboard')}
          className="btn btn-secondary"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Save Status */}
      {saveStatus !== 'idle' && (
        <div className={`save-status ${saveStatus}`}>
          {saveStatus === 'saving' && (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Saving...
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <Check className="w-4 h-4" />
              Saved successfully
            </>
          )}
          {saveStatus === 'error' && (
            <>
              <AlertTriangle className="w-4 h-4" />
              Error saving settings
            </>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="settings-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
          >
            <tab.icon className="w-4 h-4 mr-2" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="settings-content">
        {activeTab === 'general' && (
          <GeneralSettings
            theme={theme}
            language={language}
            onThemeChange={setTheme}
            onLanguageChange={setLanguage}
          />
        )}

        {activeTab === 'proxy' && (
          <ProxySettings
            proxy={proxy}
            onProxyChange={setProxy}
          />
        )}

        {activeTab === 'tools' && (
          <ToolPathsSettings
            toolPaths={toolPaths}
            onToolPathChange={setToolPath}
          />
        )}

        {activeTab === 'integrations' && (
          <IntegrationSettings
            defectDojo={defectDojo}
            onDefectDojoChange={setDefectDojo}
          />
        )}

        {activeTab === 'ai' && (
          <AISettings
            ai={ai}
            onAIChange={setAI}
          />
        )}
      </div>

      {/* Save Button */}
      <div className="settings-footer">
        <button
          onClick={handleSave}
          className="btn btn-primary"
          disabled={saveStatus === 'saving'}
        >
          <Save className="w-4 h-4 mr-2" />
          Save Settings
        </button>
      </div>
    </div>
  );
};

/**
 * General Settings
 */
const GeneralSettings: React.FC<{
  theme: string;
  language: string;
  onThemeChange: (theme: string) => void;
  onLanguageChange: (language: string) => void;
}> = ({ theme, language, onThemeChange, onLanguageChange }) => (
  <div className="settings-section">
    <div className="form-group">
      <label>Theme</label>
      <select
        value={theme}
        onChange={(e) => onThemeChange(e.target.value)}
        className="select"
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      <span className="help-text">Choose your preferred color theme</span>
    </div>

    <div className="form-group">
      <label>Language</label>
      <select
        value={language}
        onChange={(e) => onLanguageChange(e.target.value)}
        className="select"
      >
        <option value="en">English</option>
        <option value="ko">Korean</option>
        <option value="ja">Japanese</option>
        <option value="zh">Chinese</option>
      </select>
      <span className="help-text">Select interface language</span>
    </div>
  </div>
);

/**
 * Proxy Settings
 */
const ProxySettings: React.FC<{
  proxy: ProxyConfig;
  onProxyChange: (proxy: ProxyConfig) => void;
}> = ({ proxy, onProxyChange }) => (
  <div className="settings-section">
    <div className="form-group">
      <label className="checkbox">
        <input
          type="checkbox"
          checked={proxy.enabled || false}
          onChange={(e) => onProxyChange({ ...proxy, enabled: e.target.checked })}
        />
        Enable Proxy
      </label>
    </div>

    <div className="form-row">
      <div className="form-group">
        <label htmlFor="proxyHost">Host</label>
        <input
          id="proxyHost"
          type="text"
          value={proxy.host || ''}
          onChange={(e) => onProxyChange({ ...proxy, host: e.target.value })}
          placeholder="127.0.0.1"
          disabled={!proxy.enabled}
        />
      </div>
      <div className="form-group">
        <label htmlFor="proxyPort">Port</label>
        <input
          id="proxyPort"
          type="number"
          value={proxy.port || ''}
          onChange={(e) => onProxyChange({ ...proxy, port: parseInt(e.target.value) || 0 })}
          placeholder="8080"
          disabled={!proxy.enabled}
        />
      </div>
    </div>

    <div className="form-group">
      <label htmlFor="proxyUser">Username (optional)</label>
      <input
        id="proxyUser"
        type="text"
        value={proxy.username || ''}
        onChange={(e) => onProxyChange({ ...proxy, username: e.target.value })}
        placeholder="proxy_username"
        disabled={!proxy.enabled}
      />
    </div>

    <div className="form-group">
      <label htmlFor="proxyPass">Password (optional)</label>
      <input
        id="proxyPass"
        type="password"
        value={proxy.password || ''}
        onChange={(e) => onProxyChange({ ...proxy, password: e.target.value })}
        placeholder="proxy_password"
        disabled={!proxy.enabled}
      />
    </div>

    <div className="form-group">
      <label htmlFor="bypass">Bypass Rules</label>
      <input
        id="bypass"
        type="text"
        value={proxy.bypassRules || ''}
        onChange={(e) => onProxyChange({ ...proxy, bypassRules: e.target.value })}
        placeholder="<local>, *.internal.corp"
        disabled={!proxy.enabled}
      />
      <span className="help-text">Comma-separated list of hosts to bypass proxy</span>
    </div>
  </div>
);

/**
 * Tool Paths Settings
 */
const ToolPathsSettings: React.FC<{
  toolPaths: Record<string, string>;
  onToolPathChange: (tool: string, path: string) => void;
}> = ({ toolPaths, onToolPathChange }) => {
  const tools = [
    { key: 'zap', name: 'OWASP ZAP', defaultPath: 'zap.sh' },
    { key: 'nuclei', name: 'Nuclei', defaultPath: 'nuclei' },
    { key: 'subfinder', name: 'Subfinder', defaultPath: 'subfinder' },
    { key: 'amass', name: 'Amass', defaultPath: 'amass' },
    { key: 'trivy', name: 'Trivy', defaultPath: 'trivy' },
    { key: 'nmap', name: 'Nmap', defaultPath: 'nmap' },
    { key: 'playwright', name: 'Playwright', defaultPath: 'playwright' },
  ];

  return (
    <div className="settings-section">
      {tools.map(tool => (
        <div key={tool.key} className="form-group">
          <label htmlFor={`path-${tool.key}`}>{tool.name}</label>
          <input
            id={`path-${tool.key}`}
            type="text"
            value={toolPaths[tool.key] || ''}
            onChange={(e) => onToolPathChange(tool.key, e.target.value)}
            placeholder={tool.defaultPath}
          />
          <span className="help-text">Path to {tool.name} executable</span>
        </div>
      ))}
    </div>
  );
};

/**
 * Integration Settings
 */
const IntegrationSettings: React.FC<{
  defectDojo: { url: string; apiKey: string } | null;
  onDefectDojoChange: (config: { url: string; apiKey: string } | null) => void;
}> = ({ defectDojo, onDefectDojoChange }) => (
  <div className="settings-section">
    <h3>DefectDojo Integration</h3>
    <p className="section-description">
      Connect to DefectDojo for vulnerability management and reporting.
    </p>

    <div className="form-group">
      <label className="checkbox">
        <input
          type="checkbox"
          checked={!!defectDojo}
          onChange={(e) => onDefectDojoChange(e.target.checked ? { url: '', apiKey: '' } : null)}
        />
        Enable DefectDojo Integration
      </label>
    </div>

    {defectDojo && (
      <>
        <div className="form-group">
          <label htmlFor="defectDojoUrl">DefectDojo URL</label>
          <input
            id="defectDojoUrl"
            type="url"
            value={defectDojo.url}
            onChange={(e) => onDefectDojoChange({ ...defectDojo, url: e.target.value })}
            placeholder="https://defectdojo.example.com"
          />
          <span className="help-text">URL of your DefectDojo instance</span>
        </div>

        <div className="form-group">
          <label htmlFor="defectDojoApiKey">API Key</label>
          <input
            id="defectDojoApiKey"
            type="password"
            value={defectDojo.apiKey}
            onChange={(e) => onDefectDojoChange({ ...defectDojo, apiKey: e.target.value })}
            placeholder="Your DefectDojo API key"
          />
          <span className="help-text">Generate API key from DefectDojo user settings</span>
        </div>
      </>
    )}
  </div>
);

/**
 * AI Settings
 */
const AISettings: React.FC<{
  ai: { enabled: boolean; provider: string; model: string } | null;
  onAIChange: (config: { enabled: boolean; provider: string; model: string } | null) => void;
}> = ({ ai, onAIChange }) => (
  <div className="settings-section">
    <div className="form-group">
      <label className="checkbox">
        <input
          type="checkbox"
          checked={ai?.enabled || false}
          onChange={(e) => onAIChange(
            e.target.checked
              ? { enabled: true, provider: 'openai', model: 'gpt-4' }
              : null
          )}
        />
        Enable AI Enhancement
      </label>
      <span className="help-text">
        Use AI for vulnerability description, false positive filtering, and attack recommendations
      </span>
    </div>

    {ai?.enabled && (
      <>
        <div className="form-group">
          <label>AI Provider</label>
          <select
            value={ai.provider}
            onChange={(e) => onAIChange({ ...ai, provider: e.target.value })}
            className="select"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="local">Local LLM</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="aiModel">Model</label>
          <input
            id="aiModel"
            type="text"
            value={ai.model}
            onChange={(e) => onAIChange({ ...ai, model: e.target.value })}
            placeholder="gpt-4"
          />
          <span className="help-text">AI model to use for enhancement</span>
        </div>
      </>
    )}
  </div>
);
