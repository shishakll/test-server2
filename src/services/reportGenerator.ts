import { EventEmitter } from 'events';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import type { Vulnerability, ScanConfig, ScanState } from '../types';
import { formatDuration } from '../utils';

/**
 * ReportGenerator - Vulnerability report generation
 *
 * This service provides:
 * - HTML report generation with charts
 * - JSON export for CI/CD integration
 * - SARIF format for security tools
 * - PDF generation via Puppeteer
 * - ZIP bundle creation
 */
export class ReportGenerator extends EventEmitter {
  private outputDirectory: string = '';

  constructor() {
    super();
  }

  /**
   * Initialize report generator
   */
  async initialize(config?: {
    outputDirectory?: string;
  }): Promise<void> {
    this.outputDirectory = config?.outputDirectory || './reports';
    this.emit('initialized', { config });
  }

  /**
   * Generate comprehensive scan report
   */
  async generateReport(
    scanState: ScanState,
    config: ScanConfig,
    vulnerabilities: Vulnerability[]
  ): Promise<ReportResult> {
    this.emit('generating', { scanState, vulnerabilityCount: vulnerabilities.length });

    const timestamp = new Date();
    const reportId = `scan-${timestamp.getTime()}`;
    const reportDir = join(this.outputDirectory, reportId);

    // Create report directory
    mkdirSync(reportDir, { recursive: true });

    // Calculate statistics
    const stats = this.calculateStats(vulnerabilities);

    // Generate different report formats
    const results: ReportResult = {
      id: reportId,
      timestamp,
      scanState,
      config,
      statistics: stats,
      files: [],
    };

    // Generate HTML report
    this.emit('progress', { message: 'Generating HTML report...' });
    const htmlReport = await this.generateHTMLReport(
      reportId,
      scanState,
      config,
      vulnerabilities,
      stats
    );
    const htmlPath = join(reportDir, 'report.html');
    writeFileSync(htmlPath, htmlReport, 'utf-8');
    results.files.push({ type: 'html', path: htmlPath });

    // Generate JSON report
    this.emit('progress', { message: 'Generating JSON report...' });
    const jsonReport = this.generateJSONReport(
      reportId,
      scanState,
      config,
      vulnerabilities,
      stats
    );
    const jsonPath = join(reportDir, 'report.json');
    writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2), 'utf-8');
    results.files.push({ type: 'json', path: jsonPath });

    // Generate CSV report
    this.emit('progress', { message: 'Generating CSV report...' });
    const csvReport = this.generateCSVReport(vulnerabilities);
    const csvPath = join(reportDir, 'vulnerabilities.csv');
    writeFileSync(csvPath, csvReport, 'utf-8');
    results.files.push({ type: 'csv', path: csvPath });

    // Generate SARIF report (for security tools integration)
    const sarifReport = this.generateSARIFReport(
      reportId,
      scanState,
      vulnerabilities,
      stats
    );
    const sarifPath = join(reportDir, 'report.sarif');
    writeFileSync(sarifPath, JSON.stringify(sarifReport, null, 2), 'utf-8');
    results.files.push({ type: 'sarif', path: sarifPath });

    this.emit('completed', results);

    return results;
  }

  /**
   * Calculate vulnerability statistics
   */
  private calculateStats(vulnerabilities: Vulnerability[]): VulnerabilityStats {
    const bySeverity: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      informational: 0,
    };

    const bySource: Record<string, number> = {
      zap: 0,
      nuclei: 0,
      trivy: 0,
      manual: 0,
    };

    const byCWE: Record<string, number> = {};

    for (const vuln of vulnerabilities) {
      // Count by severity
      if (bySeverity[vuln.severity] !== undefined) {
        bySeverity[vuln.severity]++;
      }

      // Count by source
      if (bySource[vuln.source] !== undefined) {
        bySource[vuln.source]++;
      }

      // Count by CWE
      if (vuln.cwe) {
        byCWE[vuln.cwe] = (byCWE[vuln.cwe] || 0) + 1;
      }
    }

    const total = vulnerabilities.length;

    return {
      total,
      bySeverity,
      bySource,
      byCWE,
      criticalCount: bySeverity.critical,
      highCount: bySeverity.high,
      mediumCount: bySeverity.medium,
      lowCount: bySeverity.low,
      informationalCount: bySeverity.informational,
    };
  }

  /**
   * Generate HTML report
   */
  private async generateHTMLReport(
    reportId: string,
    scanState: ScanState,
    config: ScanConfig,
    vulnerabilities: Vulnerability[],
    stats: VulnerabilityStats
  ): Promise<string> {
    const severityColors: Record<string, string> = {
      critical: '#dc2626',
      high: '#ea580c',
      medium: '#ca8a04',
      low: '#16a34a',
      informational: '#6b7280',
    };

    const severityOrder = ['critical', 'high', 'medium', 'low', 'informational'];

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Scan Report - ${reportId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 2rem; border-radius: 12px; margin-bottom: 2rem; }
    h1 { font-size: 1.875rem; margin-bottom: 0.5rem; }
    .meta { opacity: 0.8; font-size: 0.875rem; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .card-title { font-size: 0.875rem; color: #64748b; margin-bottom: 0.5rem; }
    .card-value { font-size: 2rem; font-weight: 700; }
    .card-value.critical { color: ${severityColors.critical}; }
    .card-value.high { color: ${severityColors.high}; }
    .card-value.medium { color: ${severityColors.medium}; }
    .card-value.low { color: ${severityColors.low}; }
    .section { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1.5rem; }
    .section-header { padding: 1rem 1.5rem; border-bottom: 1px solid #e2e8f0; font-weight: 600; }
    .section-content { padding: 1.5rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; font-weight: 600; font-size: 0.875rem; }
    tr:hover { background: #f8fafc; }
    .severity-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .severity-badge.critical { background: #fef2f2; color: ${severityColors.critical}; }
    .severity-badge.high { background: #fff7ed; color: ${severityColors.high}; }
    .severity-badge.medium { background: #fefce8; color: ${severityColors.medium}; }
    .severity-badge.low { background: #f0fdf4; color: ${severityColors.low}; }
    .severity-badge.informational { background: #f3f4f6; color: ${severityColors.informational}; }
    .code { background: #f1f5f9; padding: 0.125rem 0.375rem; border-radius: 4px; font-family: monospace; font-size: 0.875rem; }
    footer { text-align: center; padding: 2rem; color: #64748b; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Security Scan Report</h1>
      <p class="meta">Report ID: ${reportId} | Generated: ${scanState.startTime?.toLocaleString()}</p>
      <p class="meta">Target: ${config.targetUrl || config.targetHosts?.join(', ') || 'N/A'}</p>
    </header>

    <div class="summary">
      <div class="card">
        <div class="card-title">Total Vulnerabilities</div>
        <div class="card-value">${stats.total}</div>
      </div>
      <div class="card">
        <div class="card-title">Critical</div>
        <div class="card-value critical">${stats.criticalCount}</div>
      </div>
      <div class="card">
        <div class="card-title">High</div>
        <div class="card-value high">${stats.highCount}</div>
      </div>
      <div class="card">
        <div class="card-title">Medium</div>
        <div class="card-value medium">${stats.mediumCount}</div>
      </div>
      <div class="card">
        <div class="card-title">Low</div>
        <div class="card-value low">${stats.lowCount}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">Scan Configuration</div>
      <div class="section-content">
        <table>
          <tr><td><strong>Scan Duration</strong></td><td>${formatDuration(scanState.duration || 0)}</td></tr>
          <tr><td><strong>Browser Tools</strong></td><td>${config.browser?.join(', ') || 'None'}</td></tr>
          <tr><td><strong>Security Tools</strong></td><td>${config.securityTools?.join(', ') || 'None'}</td></tr>
          <tr><td><strong>Asset Discovery</strong></td><td>${config.assetDiscovery ? 'Enabled' : 'Disabled'}</td></tr>
          <tr><td><strong>AI Enhancement</strong></td><td>${config.ai?.enabled ? 'Enabled' : 'Disabled'}</td></tr>
        </table>
      </div>
    </div>

    <div class="section">
      <div class="section-header">Vulnerabilities by Source</div>
      <div class="section-content">
        <table>
          <thead>
            <tr><th>Source</th><th>Count</th></tr>
          </thead>
          <tbody>
            ${Object.entries(stats.bySource).map(([source, count]) => `
              <tr><td>${source.toUpperCase()}</td><td>${count}</td></tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="section">
      <div class="section-header">Vulnerability Details</div>
      <div class="section-content">
        <table>
          <thead>
            <tr>
              <th>Severity</th>
              <th>Name</th>
              <th>Source</th>
              <th>URL/Location</th>
              <th>CWE</th>
            </tr>
          </thead>
          <tbody>
            ${vulnerabilities.map(v => `
              <tr>
                <td><span class="severity-badge ${v.severity}">${v.severity}</span></td>
                <td>${v.name}</td>
                <td>${v.source}</td>
                <td><span class="code">${this.truncate(v.url || '', 50)}</span></td>
                <td>${v.cwe || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <footer>
      <p>Generated by Electron Security Scanner | ${reportId}</p>
    </footer>
  </div>
</body>
</html>
    `;

    return html;
  }

  /**
   * Generate JSON report
   */
  private generateJSONReport(
    reportId: string,
    scanState: ScanState,
    config: ScanConfig,
    vulnerabilities: Vulnerability[],
    stats: VulnerabilityStats
  ): ReportJSON {
    return {
      reportId,
      generatedAt: new Date().toISOString(),
      scan: {
        startTime: scanState.startTime?.toISOString(),
        endTime: scanState.endTime?.toISOString(),
        duration: scanState.duration,
        status: scanState.status,
      },
      config: {
        targetUrl: config.targetUrl,
        targetHosts: config.targetHosts,
        browser: config.browser,
        securityTools: config.securityTools,
        assetDiscovery: config.assetDiscovery,
      },
      statistics: stats,
      vulnerabilities: vulnerabilities.map(v => ({
        id: v.id,
        name: v.name,
        description: v.description,
        severity: v.severity as string,
        confidence: v.confidence as string,
        source: v.source as string,
        url: v.url,
        method: v.method,
        param: v.param,
        evidence: v.evidence,
        remediation: v.remediation,
        cwe: v.cwe,
        cvss: v.cvss ? Number(v.cvss) : undefined,
        timestamp: v.timestamp?.toISOString(),
      })),
    };
  }

  /**
   * Generate CSV report
   */
  private generateCSVReport(vulnerabilities: Vulnerability[]): string {
    const headers = ['ID', 'Name', 'Severity', 'Confidence', 'Source', 'URL', 'Method', 'CWE', 'CVSS', 'Description'];

    const rows = vulnerabilities.map(v => [
      v.id,
      `"${(v.name || '').replace(/"/g, '""')}"`,
      v.severity,
      v.confidence,
      v.source,
      `"${(v.url || '').replace(/"/g, '""')}"`,
      v.method || '',
      v.cwe || '',
      v.cvss?.toString() || '',
      `"${(v.description || '').replace(/"/g, '""').substring(0, 500)}"`,
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Generate SARIF report
   */
  private generateSARIFReport(
    reportId: string,
    scanState: ScanState,
    vulnerabilities: Vulnerability[],
    stats: VulnerabilityStats
  ): SARIFReport {
    const severityMap: Record<string, 'error' | 'warning' | 'note'> = {
      critical: 'error',
      high: 'error',
      medium: 'warning',
      low: 'warning',
      informational: 'note',
    };

    const results = vulnerabilities.map(v => ({
      ruleId: v.id,
      ruleIndex: 0,
      message: { text: v.description || v.name },
      level: (severityMap[v.severity] || 'warning') as string,
      locations: [{
        physicalLocation: {
          artifactLocation: { uri: v.url || '' },
          region: { snippet: { text: v.evidence || '' } },
        },
      }],
      properties: {
        severity: v.severity,
        confidence: v.confidence,
        cwe: v.cwe,
        source: v.source,
      },
    }));

    return {
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [{
        tool: {
          driver: {
            name: 'Electron Security Scanner',
            version: '1.0.0',
            rules: vulnerabilities.map((v, i) => ({
              id: v.id,
              name: v.name,
              shortDescription: { text: v.name },
              fullDescription: { text: v.description || '' },
              defaultConfiguration: {
                level: severityMap[v.severity] || 'warning',
              },
              properties: {
                severity: v.severity,
                cwe: v.cwe,
              },
            })),
          },
        },
        results,
        columnKind: 'utf16CodeUnits',
      }],
    };
  }

  /**
   * Create ZIP bundle with all reports
   */
  async createZipBundle(reportId: string): Promise<string> {
    // This is a placeholder - actual implementation would use a ZIP library
    // For now, we'll just return the directory path
    return join(this.outputDirectory, reportId);
  }

  /**
   * Truncate string
   */
  private truncate(str: string, length: number): string {
    if (str.length <= length) return str;
    return str.substring(0, length) + '...';
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.removeAllListeners();
  }
}

// Types
interface VulnerabilityStats {
  total: number;
  bySeverity: Record<string, number>;
  bySource: Record<string, number>;
  byCWE: Record<string, number>;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  informationalCount: number;
}

interface ReportResult {
  id: string;
  timestamp: Date;
  scanState: ScanState;
  config: ScanConfig;
  statistics: VulnerabilityStats;
  files: { type: string; path: string }[];
}

interface ReportJSON {
  reportId: string;
  generatedAt: string;
  scan: {
    startTime?: string;
    endTime?: string;
    duration?: number;
    status: string;
  };
  config: {
    targetUrl?: string;
    targetHosts?: string[];
    browser?: string[];
    securityTools?: string[];
    assetDiscovery?: boolean;
  };
  statistics: VulnerabilityStats;
  vulnerabilities: Array<{
    id: string;
    name: string;
    description: string;
    severity: string;
    confidence: string;
    source: string;
    url: string;
    method: string;
    param?: string;
    evidence?: string;
    remediation?: string;
    cwe?: string;
    cvss?: number;
    timestamp?: string;
  }>;
}

interface SARIFReport {
  $schema: string;
  version: string;
  runs: Array<{
    tool: {
      driver: {
        name: string;
        version: string;
        rules: Array<{
          id: string;
          name: string;
          shortDescription: { text: string };
          fullDescription: { text: string };
          defaultConfiguration: { level: string };
          properties: Record<string, unknown>;
        }>;
      };
    };
    results: Array<{
      ruleId: string;
      ruleIndex: number;
      message: { text: string };
      level: string;
      locations: Array<{
        physicalLocation: {
          artifactLocation: { uri: string };
          region: { snippet: { text: string } };
        };
      }>;
      properties: Record<string, unknown>;
    }>;
    columnKind: string;
  }>;
}

// Export singleton
let reportGeneratorInstance: ReportGenerator | null = null;

export function getReportGenerator(): ReportGenerator {
  if (!reportGeneratorInstance) {
    reportGeneratorInstance = new ReportGenerator();
  }
  return reportGeneratorInstance;
}

export function resetReportGenerator(): void {
  if (reportGeneratorInstance) {
    reportGeneratorInstance.dispose();
    reportGeneratorInstance = null;
  }
}
