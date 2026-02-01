import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import type { Vulnerability, Severity } from '../types';
import { generateId } from '../utils';

/**
 * NucleiExecutor - Template-based vulnerability scanner
 *
 * This service provides:
 * - Nuclei CLI execution and output parsing
 * - Template management and filtering
 * - Authentication header support
 * - Concurrent scan execution
 * - Progress tracking
 */
export class NucleiExecutor extends EventEmitter {
  private nucleiPath: string = '';
  private templatesPath: string = '';
  private authHeaders: Record<string, string> = {};

  // Configuration
  private rateLimit = 150;
  private concurrency = 25;
  private timeout = 10;

  // Runtime state
  private isScanning = false;
  private scanProcess: ReturnType<typeof spawn> | null = null;

  // Output processing
  private outputBuffer = '';
  private findings: NucleiFinding[] = [];

  constructor() {
    super();
  }

  /**
   * Initialize Nuclei executor with configuration
   */
  async initialize(config?: {
    nucleiPath?: string;
    templatesPath?: string;
    rateLimit?: number;
    concurrency?: number;
    timeout?: number;
  }): Promise<void> {
    this.nucleiPath = config?.nucleiPath || process.env.NUCLEI_PATH || 'nuclei';
    this.templatesPath = config?.templatesPath || process.env.NUCLEI_TEMPLATES_PATH || '';
    this.rateLimit = config?.rateLimit || this.rateLimit;
    this.concurrency = config?.concurrency || this.concurrency;
    this.timeout = config?.timeout || this.timeout;

    // Verify nuclei is available
    const isAvailable = await this.checkAvailability();
    if (!isAvailable) {
      throw new Error(`Nuclei not found at: ${this.nucleiPath}`);
    }

    this.emit('initialized', { config });
  }

  /**
   * Check if nuclei is available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      // Try to run nuclei -version
      const { execSync } = await import('child_process');
      execSync(`${this.nucleiPath} -version`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Scan targets with nuclei
   */
  async scan(targets: string[], options?: {
    templates?: string[];
    tags?: string[];
    severity?: string[];
    excludeTemplates?: string[];
    customHeaders?: Record<string, string>;
    rateLimit?: number;
    concurrency?: number;
    timeout?: number;
    headless?: boolean;
  }): Promise<Vulnerability[]> {
    if (this.isScanning) {
      throw new Error('Scan already in progress');
    }

    this.isScanning = true;
    this.findings = [];
    this.outputBuffer = '';

    try {
      // Create target file
      const targetFile = this.createTargetFile(targets);

      // Build nuclei command
      const args = this.buildNucleiArgs(targetFile, options);

      // Execute nuclei
      await this.executeNuclei(args);

      // Parse findings
      const vulnerabilities = this.parseFindings();

      this.emit('scanCompleted', { count: vulnerabilities.length });

      return vulnerabilities;
    } finally {
      this.isScanning = false;
      this.scanProcess = null;
    }
  }

  /**
   * Execute nuclei process
   */
  private async executeNuclei(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.emit('executionStarted', { args });

      const scanProcess = spawn(this.nucleiPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: this.timeout * 60 * 1000, // Convert to milliseconds
      });
      this.scanProcess = scanProcess;

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      scanProcess.stdout.on('data', (data) => {
        stdoutChunks.push(data);
        this.processOutput(data.toString());
        this.emit('progress', { output: data.toString() });
      });

      scanProcess.stderr.on('data', (data) => {
        stderrChunks.push(data);
        this.processOutput(data.toString());
      });

      scanProcess.on('error', (error) => {
        this.isScanning = false;
        this.emit('error', { error });
        reject(error);
      });

      scanProcess.on('close', (code) => {
        if (code === 0 || code === 1) {
          // nuclei returns 1 when findings are found (which is expected)
          this.emit('executionCompleted', { code });
          resolve();
        } else {
          const error = new Error(`Nuclei exited with code ${code}`);
          this.isScanning = false;
          this.emit('error', { error });
          reject(error);
        }
      });

      // Handle timeout
      setTimeout(() => {
        if (this.isScanning && scanProcess) {
          scanProcess.kill('SIGTERM');
          const timeoutError = new Error('Nuclei scan timed out');
          this.isScanning = false;
          reject(timeoutError);
        }
      }, this.timeout * 60 * 1000);
    });
  }

  /**
   * Build nuclei command arguments
   */
  private buildNucleiArgs(
    targetFile: string,
    options?: {
      templates?: string[];
      tags?: string[];
      severity?: string[];
      excludeTemplates?: string[];
      customHeaders?: Record<string, string>;
      rateLimit?: number;
      concurrency?: number;
      headless?: boolean;
    }
  ): string[] {
    const args: string[] = [];

    // Input
    args.push('-l', targetFile);
    args.push('-jsonl'); // JSON lines output

    // Templates
    if (options?.templates && options.templates.length > 0) {
      args.push('-t', options.templates.join(','));
    } else if (this.templatesPath) {
      args.push('-t', this.templatesPath);
    }

    // Tags (e.g., cve, os, tech)
    if (options?.tags && options.tags.length > 0) {
      args.push('--tags', options.tags.join(','));
    }

    // Severity filter
    if (options?.severity && options.severity.length > 0) {
      args.push('-severity', options.severity.join(','));
    }

    // Exclude templates
    if (options?.excludeTemplates && options.excludeTemplates.length > 0) {
      args.push('-et', options.excludeTemplates.join(','));
    }

    // Rate limiting
    const rateLimit = options?.rateLimit || this.rateLimit;
    args.push('-rl', rateLimit.toString());

    // Concurrency
    const concurrency = options?.concurrency || this.concurrency;
    args.push('-c', concurrency.toString());

    // Timeout per template
    args.push('-timeout', `${this.timeout * 60}`); // nuclei uses seconds

    // Headless mode (for templates that need JavaScript)
    if (options?.headless) {
      args.push('-headless');
    }

    // Headless browser size
    args.push('-headless-bulk-size', '5');

    // Don't stop on first match (scan all targets)
    args.push('-no-strict-template-size');

    // Silent mode (reduce noise)
    args.push('-silent');

    // Disable update checks
    args.push('-disable-update-check');

    // Output to stdout (we're capturing it)
    // No -o flag needed since we're using stdout

    return args;
  }

  /**
   * Create temporary target file
   */
  private createTargetFile(targets: string[]): string {
    const tempDir = tmpdir();
    const targetFile = join(tempDir, `nuclei-targets-${generateId()}.txt`);

    writeFileSync(targetFile, targets.join('\n'), 'utf-8');

    this.emit('targetFileCreated', { path: targetFile, count: targets.length });

    return targetFile;
  }

  /**
   * Process nuclei output
   */
  private processOutput(output: string): void {
    this.outputBuffer += output;

    // Parse JSON lines from output
    const lines = this.outputBuffer.split('\n');
    this.outputBuffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const finding = JSON.parse(line) as NucleiRawFinding;

        // Only process actual findings, not info messages
        if (finding.matcher_name || finding.extracted_results) {
          this.findings.push(this.normalizeFinding(finding));
        }
      } catch {
        // Not valid JSON, might be progress message
      }
    }
  }

  /**
   * Normalize nuclei finding to internal format
   */
  private normalizeFinding(raw: NucleiRawFinding): NucleiFinding {
    return {
      templateId: raw.template,
      templateName: raw.template_url,
      type: raw.type,
      severity: this.mapSeverity(raw.severity),
      host: raw.host || raw.ip,
      matched: raw.matched || raw.url,
      extracted: Array.isArray(raw.extracted_results)
        ? raw.extracted_results.join('\n')
        : raw.extracted_results || '',
      timestamp: raw.timestamp,
      templateURL: raw.template_url,
      info: raw.info,
      matcherStatus: raw.matcher_status,
    };
  }

  /**
   * Map nuclei severity to internal severity
   */
  private mapSeverity(severity: string): Severity {
    const severityMap: Record<string, Severity> = {
      critical: 'critical',
      high: 'high',
      medium: 'medium',
      low: 'low',
      info: 'informational',
      informational: 'informational',
    };
    return severityMap[severity.toLowerCase()] || 'informational';
  }

  /**
   * Parse findings from output
   */
  private parseFindings(): Vulnerability[] {
    return this.findings.map(finding => ({
      id: generateId('nuclei'),
      source: 'nuclei' as const,
      templateId: finding.templateId,
      name: finding.info?.name || `${finding.type} - ${finding.templateId}`,
      description: this.generateDescription(finding),
      severity: finding.severity,
      confidence: this.mapConfidence(finding.matcherStatus),
      url: finding.matched || '',
      method: 'GET',
      evidence: finding.extracted,
      timestamp: new Date(finding.timestamp),
      cwe: this.extractCWE(finding.info?.tags),
      remediation: finding.info?.remediation,
    }));
  }

  /**
   * Generate description from finding
   */
  private generateDescription(finding: NucleiFinding): string {
    const parts: string[] = [];

    if (finding.templateName) {
      parts.push(`Template: ${finding.templateName}`);
    }

    if (finding.extracted) {
      parts.push(`Found: ${finding.extracted}`);
    }

    return parts.join('\n') || 'No details available';
  }

  /**
   * Map matcher status to confidence
   */
  private mapConfidence(status?: string): 'high' | 'medium' | 'low' {
    if (status === 'true' || status === 'matched') return 'high';
    if (status === 'negative') return 'low';
    return 'medium';
  }

  /**
   * Extract CWE from tags
   */
  private extractCWE(tags?: string[]): string | undefined {
    if (!tags) return undefined;

    const cweTag = tags.find(tag => tag.toLowerCase().startsWith('cwe'));
    if (cweTag) {
      const match = cweTag.match(/cwe-?(\d+)/i);
      return match ? `CWE-${match[1]}` : undefined;
    }

    return undefined;
  }

  /**
   * Scan file with nuclei
   */
  async scanFile(filePath: string, options?: {
    templates?: string[];
    tags?: string[];
    severity?: string[];
  }): Promise<Vulnerability[]> {
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    return this.scan([filePath], options);
  }

  /**
   * Update nuclei templates
   */
  async updateTemplates(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.emit('updatingTemplates');

      const process = spawn(this.nucleiPath, ['-update-templates'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          this.emit('templatesUpdated');
          resolve(true);
        } else {
          reject(new Error(`Template update failed: ${output}`));
        }
      });

      process.on('error', reject);
    });
  }

  /**
   * Get list of available templates
   */
  async listTemplates(): Promise<string[]> {
    if (!this.templatesPath || !existsSync(this.templatesPath)) {
      return [];
    }

    const templates: string[] = [];

    const walkDir = (dir: string) => {
      const files = require('fs').readdirSync(dir);
      for (const file of files) {
        const fullPath = join(dir, file);
        if (require('fs').statSync(fullPath).isDirectory()) {
          walkDir(fullPath);
        } else if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          templates.push(fullPath);
        }
      }
    };

    walkDir(this.templatesPath);

    return templates;
  }

  /**
   * Get template count by severity
   */
  async getTemplateStats(): Promise<{
    total: number;
    bySeverity: Record<string, number>;
  }> {
    const templates = await this.listTemplates();

    const bySeverity: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    for (const templatePath of templates) {
      try {
        const content = readFileSync(templatePath, 'utf-8');
        const severityMatch = content.match(/severity:\s*(\w+)/i);
        if (severityMatch) {
          const severity = severityMatch[1].toLowerCase();
          if (bySeverity[severity] !== undefined) {
            bySeverity[severity]++;
          }
        }
      } catch {
        // Skip invalid templates
      }
    }

    return {
      total: templates.length,
      bySeverity,
    };
  }

  /**
   * Set authentication headers for authenticated scanning
   */
  setAuthHeaders(headers: Record<string, string>): void {
    this.authHeaders = headers;
    this.emit('authHeadersUpdated', { headers: Object.keys(headers) });
  }

  /**
   * Clear authentication headers
   */
  clearAuthHeaders(): void {
    this.authHeaders = {};
    this.emit('authHeadersCleared');
  }

  /**
   * Cancel ongoing scan
   */
  cancelScan(): void {
    if (this.scanProcess) {
      this.scanProcess.kill('SIGTERM');
      this.scanProcess = null;
    }

    this.isScanning = false;
    this.emit('scanCancelled');
  }

  /**
   * Check if scan is running
   */
  isScanRunning(): boolean {
    return this.isScanning;
  }

  /**
   * Get current findings
   */
  getCurrentFindings(): NucleiFinding[] {
    return [...this.findings];
  }

  /**
   * Get nuclei version
   */
  async getVersion(): Promise<string> {
    try {
      const { execSync } = await import('child_process');
      return execSync(`${this.nucleiPath} -version`, { encoding: 'utf-8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.cancelScan();
    this.removeAllListeners();
  }
}

// Types for nuclei output
interface NucleiRawFinding {
  template: string;
  template_url: string;
  template_id: string;
  type: string;
  severity: string;
  host: string;
  ip: string;
  matched: string;
  url: string;
  timestamp: string;
  extracted_results?: string | string[];
  matcher_name?: string;
  matcher_status?: string;
  info?: {
    name?: string;
    description?: string;
    remediation?: string;
    tags?: string[];
  };
}

interface NucleiFinding {
  templateId: string;
  templateName: string;
  type: string;
  severity: Severity;
  host: string;
  matched: string;
  extracted: string;
  timestamp: string;
  templateURL: string;
  info?: {
    name?: string;
    description?: string;
    remediation?: string;
    tags?: string[];
  };
  matcherStatus?: string;
}

// Export singleton
let nucleiExecutorInstance: NucleiExecutor | null = null;

export function getNucleiExecutor(): NucleiExecutor {
  if (!nucleiExecutorInstance) {
    nucleiExecutorInstance = new NucleiExecutor();
  }
  return nucleiExecutorInstance;
}

export function resetNucleiExecutor(): void {
  if (nucleiExecutorInstance) {
    nucleiExecutorInstance.dispose();
    nucleiExecutorInstance = null;
  }
}
