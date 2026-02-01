import React, { useState, useMemo } from 'react';
import { useScanStore } from '@stores';
import type { Vulnerability, Severity } from '@types';
import { 
  AlertTriangle, Filter, Download, Upload,
  ChevronDown, ChevronUp, X, ExternalLink,
  Shield, Search, Target, Info
} from 'lucide-react';

interface ResultsViewProps {
  onDownloadReport: (format: 'html' | 'json' | 'csv' | 'sarif') => void;
  onUploadDefectDojo: () => void;
}

type FilterType = 'all' | Severity;

const SEVERITY_CONFIG: Record<Severity, { color: string; bgColor: string; icon: React.FC<{ className?: string }> }> = {
  critical: { color: '#dc2626', bgColor: '#fef2f2', icon: AlertTriangle },
  high: { color: '#ea580c', bgColor: '#fff7ed', icon: Target },
  medium: { color: '#ca8a04', bgColor: '#fefce8', icon: Search },
  low: { color: '#16a34a', bgColor: '#f0fdf4', icon: Shield },
  informational: { color: '#6b7280', bgColor: '#f9fafb', icon: Info },
};

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'informational'];

/**
 * ResultsView - Displays scan results with vulnerability list and filtering
 */
export const ResultsView: React.FC<ResultsViewProps> = ({
  onDownloadReport,
  onUploadDefectDojo,
}) => {
  const { vulnerabilities } = useScanStore();
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['critical', 'high'])
  );
  const [searchQuery, setSearchQuery] = useState('');

  const filteredVulns = useMemo(() => {
    let result = filter === 'all' 
      ? vulnerabilities 
      : vulnerabilities.filter(v => v.severity === filter);
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(v => 
        v.name.toLowerCase().includes(query) ||
        v.description.toLowerCase().includes(query) ||
        v.url.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [vulnerabilities, filter, searchQuery]);

  const groupedVulns = useMemo(() => {
    return SEVERITY_ORDER.reduce((acc, severity) => {
      acc[severity] = filteredVulns.filter(v => v.severity === severity);
      return acc;
    }, {} as Record<Severity, Vulnerability[]>);
  }, [filteredVulns]);

  const toggleCategory = (severity: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(severity)) {
        newSet.delete(severity);
      } else {
        newSet.add(severity);
      }
      return newSet;
    });
  };

  const stats = useMemo(() => ({
    total: vulnerabilities.length,
    critical: vulnerabilities.filter(v => v.severity === 'critical').length,
    high: vulnerabilities.filter(v => v.severity === 'high').length,
    medium: vulnerabilities.filter(v => v.severity === 'medium').length,
    low: vulnerabilities.filter(v => v.severity === 'low').length,
    informational: vulnerabilities.filter(v => v.severity === 'informational').length,
  }), [vulnerabilities]);

  return (
    <div className="results-view">
      {/* Header */}
      <div className="results-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scan Results</h1>
          <p className="text-gray-500 dark:text-gray-400">
            {stats.total} vulnerabilities found
          </p>
        </div>
        <div className="results-actions">
          <div className="dropdown">
            <button className="btn btn-secondary">
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </button>
            <div className="dropdown-menu">
              <button onClick={() => onDownloadReport('html')}>HTML Report</button>
              <button onClick={() => onDownloadReport('json')}>JSON Report</button>
              <button onClick={() => onDownloadReport('csv')}>CSV Report</button>
              <button onClick={() => onDownloadReport('sarif')}>SARIF Report</button>
            </div>
          </div>
          <button className="btn btn-primary" onClick={onUploadDefectDojo}>
            <Upload className="w-4 h-4 mr-2" />
            Upload to DefectDojo
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="results-summary">
        <div className="summary-stat critical">
          <AlertTriangle className="w-5 h-5" />
          <span className="stat-value">{stats.critical}</span>
          <span className="stat-label">Critical</span>
        </div>
        <div className="summary-stat high">
          <Target className="w-5 h-5" />
          <span className="stat-value">{stats.high}</span>
          <span className="stat-label">High</span>
        </div>
        <div className="summary-stat medium">
          <Search className="w-5 h-5" />
          <span className="stat-value">{stats.medium}</span>
          <span className="stat-label">Medium</span>
        </div>
        <div className="summary-stat low">
          <Shield className="w-5 h-5" />
          <span className="stat-value">{stats.low}</span>
          <span className="stat-label">Low</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="results-toolbar">
        <div className="filter-group">
          <Filter className="w-4 h-4 text-gray-500" />
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({stats.total})
          </button>
          {(['critical', 'high', 'medium', 'low'] as const).map(severity => {
            const count = stats[severity as keyof typeof stats];
            return (
              <button
                key={severity}
                className={`filter-btn ${filter === severity ? 'active' : ''}`}
                onClick={() => setFilter(severity)}
              >
                {severity.charAt(0).toUpperCase() + severity.slice(1)} ({count})
              </button>
            );
          })}
        </div>
        <div className="search-box">
          <Search className="w-4 h-4" />
          <input
            type="text"
            placeholder="Search vulnerabilities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Vulnerability List */}
      <div className="vulnerability-list">
        {SEVERITY_ORDER.map(severity => {
          const vulns = groupedVulns[severity];
          if (vulns.length === 0) return null;

          const config = SEVERITY_CONFIG[severity];
          const Icon = config.icon;
          const isExpanded = expandedCategories.has(severity);

          return (
            <div key={severity} className={`vuln-category ${severity}`}>
              <button 
                className="category-header"
                onClick={() => toggleCategory(severity)}
              >
                <div className="header-left">
                  {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                  <span style={{ color: config.color }}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="category-name">{severity.toUpperCase()}</span>
                  <span className="category-count" style={{ backgroundColor: config.bgColor, color: config.color }}>
                    {vulns.length}
                  </span>
                </div>
                <div className="header-right">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedCategories(new Set(SEVERITY_ORDER));
                    }}
                  >
                    Expand All
                  </button>
                </div>
              </button>

              {isExpanded && (
                <div className="category-items">
                  {vulns.map(vuln => (
                    <VulnerabilityCard
                      key={vuln.id}
                      vulnerability={vuln}
                      onClick={() => setSelectedVuln(vuln)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredVulns.length === 0 && (
          <div className="empty-state">
            <Shield className="w-12 h-12 text-gray-300" />
            <p>No vulnerabilities found</p>
            {searchQuery && (
              <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
            )}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedVuln && (
        <VulnerabilityDetailModal
          vulnerability={selectedVuln}
          onClose={() => setSelectedVuln(null)}
        />
      )}
    </div>
  );
};

/**
 * VulnerabilityCard - Individual vulnerability item
 */
interface VulnerabilityCardProps {
  vulnerability: Vulnerability;
  onClick: () => void;
}

const VulnerabilityCard: React.FC<VulnerabilityCardProps> = ({ vulnerability, onClick }) => {
  const config = SEVERITY_CONFIG[vulnerability.severity];

  return (
    <div className="vuln-card" onClick={onClick}>
      <div className="vuln-card-header">
        <div className="vuln-meta">
          <span 
            className="severity-badge"
            style={{ backgroundColor: config.bgColor, color: config.color }}
          >
            {vulnerability.severity.toUpperCase()}
          </span>
          <span className="confidence-badge">
            {vulnerability.confidence} confidence
          </span>
        </div>
        <span className="vuln-source">{vulnerability.source.toUpperCase()}</span>
      </div>
      <h4 className="vuln-name">{vulnerability.name}</h4>
      <p className="vuln-url">
        <ExternalLink className="w-3 h-3" />
        {vulnerability.url}
        {vulnerability.method && <span className="method-badge">{vulnerability.method}</span>}
      </p>
      {vulnerability.param && (
        <p className="vuln-param">Parameter: {vulnerability.param}</p>
      )}
    </div>
  );
};

/**
 * VulnerabilityDetailModal - Full details modal
 */
interface VulnerabilityDetailModalProps {
  vulnerability: Vulnerability;
  onClose: () => void;
}

const VulnerabilityDetailModal: React.FC<VulnerabilityDetailModalProps> = ({ 
  vulnerability, 
  onClose 
}) => {
  const config = SEVERITY_CONFIG[vulnerability.severity];
  const Icon = config.icon;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content vuln-detail-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrapper">
            <span style={{ color: config.color }}>
              <Icon className="w-6 h-6" />
            </span>
            <div>
              <h2 className="modal-title">{vulnerability.name}</h2>
              <p className="modal-subtitle">
                {vulnerability.severity.toUpperCase()} - {vulnerability.confidence} confidence
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-body">
          {/* Source & Metadata */}
          <div className="detail-section">
            <h3>Information</h3>
            <dl className="detail-grid">
              <dt>Source</dt>
              <dd>{vulnerability.source.toUpperCase()}</dd>
              <dt>URL</dt>
              <dd>
                <a href={vulnerability.url} target="_blank" rel="noopener noreferrer">
                  {vulnerability.url}
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </dd>
              <dt>Method</dt>
              <dd>{vulnerability.method || 'N/A'}</dd>
              <dt>Parameter</dt>
              <dd>{vulnerability.param || 'N/A'}</dd>
              <dt>Found</dt>
              <dd>{new Date(vulnerability.timestamp).toLocaleString()}</dd>
            </dl>
          </div>

          {/* Description */}
          <div className="detail-section">
            <h3>Description</h3>
            <p className="detail-description">{vulnerability.description}</p>
          </div>

          {/* Evidence */}
          {vulnerability.evidence && (
            <div className="detail-section">
              <h3>Evidence</h3>
              <pre className="detail-code">{vulnerability.evidence}</pre>
            </div>
          )}

          {/* Remediation */}
          {vulnerability.remediation && (
            <div className="detail-section">
              <h3>Remediation</h3>
              <p className="detail-description">{vulnerability.remediation}</p>
            </div>
          )}

          {/* CWE */}
          {vulnerability.cwe && (
            <div className="detail-section">
              <h3>Classification</h3>
              <dl className="detail-grid">
                <dt>CWE</dt>
                <dd>
                  <a 
                    href={`https://cwe.mitre.org/data/definitions/${vulnerability.cwe}.html`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    CWE-{vulnerability.cwe}
                  </a>
                </dd>
              </dl>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary">
            <ExternalLink className="w-4 h-4 mr-2" />
            View in {vulnerability.source.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultsView;
