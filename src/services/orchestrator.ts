import { EventEmitter } from 'events';
import type {
  ScanConfig,
  ScanState,
  ScanPhase,
  ScanProgress,
  Vulnerability,
  ScanError,
} from '../types';
import { generateId, sleep } from '../utils';

// Service interfaces (to be implemented)
interface BrowserService {
  start(config: ScanConfig): Promise<void>;
  navigate(url: string): Promise<void>;
  captureSession(): Promise<void>;
  stop(): Promise<void>;
}

interface ZAPService {
  start(): Promise<void>;
  stop(): Promise<void>;
  spider(url: string): Promise<number>;
  ajaxSpider(url: string): Promise<number>;
  activeScan(url: string): Promise<number>;
  getAlerts(): Promise<Vulnerability[]>;
  getDiscoveredUrls(): Promise<string[]>;
}

interface NucleiService {
  scan(targets: string[]): Promise<Vulnerability[]>;
  setAuthHeaders(headers: Record<string, string>): void;
}

interface AssetDiscoveryService {
  discoverSubdomains(domain: string): Promise<string[]>;
  discoverAPIs(domain: string): Promise<string[]>;
}

interface ReportGeneratorService {
  generateZip(scanId: string): Promise<Buffer>;
  generateSummary(scanId: string): { summary: unknown; vulnerabilities: Vulnerability[] };
}

interface SessionManagerService {
  captureSession(windowId: string): Promise<unknown>;
  restoreSession(sessionId: string): Promise<void>;
}

/**
 * ScanOrchestrator - Coordinates the multi-phase scanning workflow
 *
 * This is the core component that manages:
 * - Browser initialization and session capture
 * - ZAP proxy startup and scanning phases
 * - Nuclei vulnerability scanning
 * - Asset discovery (optional)
 * - Report generation
 * - Error handling and recovery
 */
export class ScanOrchestrator extends EventEmitter {
  private config: ScanConfig | null = null;
  private scanId: string | null = null;
  private isCancelled = false;
  private isRunning = false;

  // Services (injected or defaulted)
  private browserService: BrowserService | null = null;
  private zapService: ZAPService | null = null;
  private nucleiService: NucleiService | null = null;
  private assetDiscoveryService: AssetDiscoveryService | null = null;
  private reportGenerator: ReportGeneratorService | null = null;

  constructor() {
    super();
  }

  /**
   * Inject services for dependency injection (useful for testing)
   */
  injectServices(services: {
    browser?: BrowserService;
    zap?: ZAPService;
    nuclei?: NucleiService;
    assetDiscovery?: AssetDiscoveryService;
    reportGenerator?: ReportGeneratorService;
  }): void {
    this.browserService = services.browser || null;
    this.zapService = services.zap || null;
    this.nucleiService = services.nuclei || null;
    this.assetDiscoveryService = services.assetDiscovery || null;
    this.reportGenerator = services.reportGenerator || null;
  }

  /**
   * Start a new scan with the given configuration
   */
  async startScan(config: ScanConfig): Promise<string> {
    if (this.isRunning) {
      throw new Error('Scan is already running');
    }

    this.config = config;
    this.scanId = config.id || generateId('scan');
    this.isCancelled = false;
    this.isRunning = true;

    // Emit scan started event
    this.emit('started', { scanId: this.scanId, config });

    try {
      await this.executeScan();
    } catch (error) {
      this.handleError(error as Error, 'idle');
    } finally {
      this.isRunning = false;
    }

    return this.scanId;
  }

  /**
   * Execute the complete scan pipeline
   */
  private async executeScan(): Promise<void> {
    if (!this.config || !this.scanId) {
      throw new Error('Scan not initialized');
    }

    const phases: Array<{
      phase: ScanPhase;
      weight: number;
      execute: () => Promise<void>;
    }> = [
      { phase: 'browser_init', weight: 5, execute: () => this.phaseBrowserInit() },
      { phase: 'proxy_start', weight: 5, execute: () => this.phaseProxyStart() },
      { phase: 'navigating', weight: 10, execute: () => this.phaseNavigating() },
      { phase: 'spider', weight: 20, execute: () => this.phaseSpider() },
      { phase: 'ajax_spider', weight: 10, execute: () => this.phaseAjaxSpider() },
      { phase: 'active_scan', weight: 25, execute: () => this.phaseActiveScan() },
      { phase: 'nuclei_scan', weight: 15, execute: () => this.phaseNucleiScan() },
      { phase: 'asset_discovery', weight: 5, execute: () => this.phaseAssetDiscovery() },
      { phase: 'reporting', weight: 5, execute: () => this.phaseReporting() },
    ];

    let totalProgress = 0;

    for (const { phase, weight, execute } of phases) {
      if (this.isCancelled) {
        this.isCancelled = false; // Reset flag
        this.completeScan(false);
        return;
      }

      try {
        await this.executePhase(phase, weight, totalProgress, execute);
        totalProgress += weight;
      } catch (error) {
        const scanError: ScanError = {
          code: `PHASE_${phase.toUpperCase()}_FAILED`,
          message: (error as Error).message,
          phase,
          recoverable: this.isPhaseRecoverable(phase),
          suggestion: this.getPhaseSuggestion(phase),
        };

        this.emit('error', { scanId: this.scanId, error: scanError });

        if (!scanError.recoverable) {
          this.completeScan(false, [scanError]);
          return;
        }

        // Continue with next phase if recoverable
        this.emit('warning', {
          scanId: this.scanId,
          message: `Phase ${phase} failed but continuing: ${scanError.message}`,
        });
      }
    }

    this.completeScan(true);
  }

  /**
   * Execute a single phase with progress tracking
   */
  private async executePhase(
    phase: ScanPhase,
    weight: number,
    startProgress: number,
    execute: () => Promise<void>
  ): Promise<void> {
    this.updateProgress(phase, startProgress, `Starting ${phase}...`);

    await execute();

    this.updateProgress(phase, startProgress + weight, `Completed ${phase}`);
  }

  /**
   * Phase 1: Browser Initialization
   */
  private async phaseBrowserInit(): Promise<void> {
    this.updateProgress('browser_init', 0, 'Initializing browser...');

    if (this.browserService) {
      await this.browserService.start(this.config!);
    }

    this.updateProgress('browser_init', 3, 'Browser initialized');
    await sleep(500);
  }

  /**
   * Phase 2: Proxy Start
   */
  private async phaseProxyStart(): Promise<void> {
    this.updateProgress('proxy_start', 5, 'Starting ZAP proxy...');

    if (this.zapService) {
      await this.zapService.start();
    }

    this.updateProgress('proxy_start', 8, 'ZAP proxy ready');
    await sleep(500);
  }

  /**
   * Phase 3: Navigation
   */
  private async phaseNavigating(): Promise<void> {
    if (!this.config) return;

    const targetUrl = this.config.targetUrl || '';
    this.updateProgress('navigating', 10, `Navigating to ${targetUrl}...`);

    if (this.browserService && targetUrl) {
      await this.browserService.navigate(targetUrl);
    }

    this.updateProgress('navigating', 18, 'Page loaded');
    await sleep(1000);
  }

  /**
   * Phase 4: Spider
   */
  private async phaseSpider(): Promise<void> {
    if (!this.config) return;

    this.updateProgress('spider', 20, 'Starting spider scan...');

    if (this.zapService && this.config.targetUrl) {
      const scanId = await this.zapService.spider(this.config.targetUrl);
      await this.waitForScanCompletion(scanId, 'spider');
    }

    this.updateProgress('spider', 38, 'Spider scan completed');
  }

  /**
   * Phase 5: AJAX Spider (for SPA)
   */
  private async phaseAjaxSpider(): Promise<void> {
    if (!this.config?.scanOptions?.ajaxSpider) {
      this.updateProgress('ajax_spider', 40, 'AJAX spider skipped (disabled)');
      return;
    }

    this.updateProgress('ajax_spider', 40, 'Starting AJAX spider...');

    if (this.zapService && this.config?.targetUrl) {
      const scanId = await this.zapService.ajaxSpider(this.config.targetUrl);
      await this.waitForScanCompletion(scanId, 'ajax_spider');
    }

    this.updateProgress('ajax_spider', 48, 'AJAX spider completed');
  }

  /**
   * Phase 6: Active Scan
   */
  private async phaseActiveScan(): Promise<void> {
    if (!this.config?.scanOptions?.passiveOnly) {
      this.updateProgress('active_scan', 50, 'Active scan skipped (passive mode)');
      return;
    }

    this.updateProgress('active_scan', 50, 'Starting active scan...');

    if (this.zapService && this.config?.targetUrl) {
      const scanId = await this.zapService.activeScan(this.config.targetUrl);
      await this.waitForScanCompletion(scanId, 'active_scan');
    }

    this.updateProgress('active_scan', 73, 'Active scan completed');
  }

  /**
   * Phase 7: Nuclei Scan
   */
  private async phaseNucleiScan(): Promise<void> {
    this.updateProgress('nuclei_scan', 75, 'Starting Nuclei scan...');

    let targets: string[] = [];

    if (this.config?.targetUrl) {
      targets = [this.config.targetUrl];
    }

    if (this.zapService) {
      const discoveredUrls = await this.zapService.getDiscoveredUrls();
      const allUrls = this.config?.targetUrl ? [this.config.targetUrl, ...discoveredUrls] : discoveredUrls;
      targets = [...new Set(allUrls)];
    }

    this.updateProgress('nuclei_scan', 80, `Scanning ${targets.length} targets with Nuclei...`);

    if (this.nucleiService) {
      const findings = await this.nucleiService.scan(targets);
      this.emit('vulnerabilities', { scanId: this.scanId, vulnerabilities: findings });
    }

    this.updateProgress('nuclei_scan', 88, 'Nuclei scan completed');
  }

  /**
   * Phase 8: Asset Discovery (Optional)
   */
  private async phaseAssetDiscovery(): Promise<void> {
    if (!this.config?.scanOptions?.assetDiscovery) {
      this.updateProgress('asset_discovery', 90, 'Asset discovery skipped (disabled)');
      return;
    }

    this.updateProgress('asset_discovery', 90, 'Running asset discovery...');

    if (this.config?.targetUrl) {
      try {
        const hostname = new URL(this.config.targetUrl).hostname;
        const domain = hostname.replace(/^[^.]+\./, '');

        if (this.assetDiscoveryService) {
          const subdomains = await this.assetDiscoveryService.discoverSubdomains(domain);
          this.emit('discovered', { scanId: this.scanId, subdomains });
        }
      } catch {
        // URL parsing failed, skip asset discovery
      }
    }

    this.updateProgress('asset_discovery', 93, 'Asset discovery completed');
  }

  /**
   * Phase 9: Report Generation
   */
  private async phaseReporting(): Promise<void> {
    this.updateProgress('reporting', 95, 'Generating report...');

    if (this.reportGenerator) {
      await this.reportGenerator.generateZip(this.scanId!);
    }

    this.updateProgress('reporting', 99, 'Report generated');
    await sleep(500);
  }

  /**
   * Wait for ZAP scan completion with polling
   */
  private async waitForScanCompletion(scanId: number, phase: ScanPhase): Promise<void> {
    if (!this.zapService) return;

    let completed = false;
    let lastProgress = 0;

    while (!completed && !this.isCancelled) {
      await sleep(2000);

      // Get scan status (simplified - actual implementation would query ZAP API)
      const status = await this.getScanStatus(scanId);

      if (status.complete) {
        completed = true;
      } else if (status.progress !== lastProgress) {
        lastProgress = status.progress;
        this.updateProgress(phase, this.getPhaseStart(phase) + status.progress, status.message);
      }
    }
  }

  /**
   * Get scan status from ZAP (stub for now)
   */
  private async getScanStatus(scanId: number): Promise<{ complete: boolean; progress: number; message: string }> {
    // This would be implemented by ZAPService
    return { complete: false, progress: 0, message: 'Scanning...' };
  }

  /**
   * Get the starting progress for a phase
   */
  private getPhaseStart(phase: ScanPhase): number {
    const phaseStarts: Record<ScanPhase, number> = {
      idle: 0,
      paused: 0,
      browser_init: 0,
      proxy_start: 5,
      navigating: 10,
      spider: 20,
      ajax_spider: 40,
      active_scan: 50,
      nuclei_scan: 75,
      asset_discovery: 90,
      reporting: 95,
      completed: 100,
      failed: 0,
      cancelled: 0,
    };
    return phaseStarts[phase] ?? 0;
  }

  /**
   * Update progress and emit event
   */
  private updateProgress(phase: ScanPhase, progress: number, message: string): void {
    const progressEvent: ScanProgress = {
      scanId: this.scanId!,
      phase,
      progress: Math.min(progress, 100),
      message,
      timestamp: new Date(),
    };

    this.emit('progress', progressEvent);
  }

  /**
   * Handle error during scan
   */
  private handleError(error: Error, phase: ScanPhase): void {
    const scanError: ScanError = {
      code: 'SCAN_ERROR',
      message: error.message,
      phase,
      recoverable: false,
      suggestion: 'Check logs for details and try again',
    };

    this.completeScan(false, [scanError]);
    this.emit('error', { scanId: this.scanId, error: scanError });
  }

  /**
   * Check if a phase is recoverable
   */
  private isPhaseRecoverable(phase: ScanPhase): boolean {
    const nonRecoverable: ScanPhase[] = ['browser_init', 'reporting'];
    return !nonRecoverable.includes(phase);
  }

  /**
   * Get suggestion for failed phase
   */
  private getPhaseSuggestion(phase: ScanPhase): string {
    const suggestions: Record<ScanPhase, string> = {
      paused: 'Resume the scan to continue',
      browser_init: 'Check browser installation and permissions',
      proxy_start: 'Ensure ZAP is installed and port is available',
      navigating: 'Verify target URL is accessible',
      spider: 'Try increasing timeout or check network connectivity',
      ajax_spider: 'Enable JavaScript in browser settings',
      active_scan: 'Check if target allows active testing',
      nuclei_scan: 'Verify Nuclei installation and templates',
      asset_discovery: 'Check DNS resolution and network access',
      reporting: 'Check disk space and write permissions',
      idle: '',
      completed: '',
      failed: '',
      cancelled: '',
    };
    return suggestions[phase] || 'Try running the scan again';
  }

  /**
   * Complete the scan (success or failure)
   */
  private completeScan(success: boolean, errors?: ScanError[]): void {
    if (!this.scanId) return;

    const phase: ScanPhase = this.isCancelled ? 'cancelled' : (success ? 'completed' : 'failed');

    this.updateProgress(phase, 100, `Scan ${success ? 'completed' : 'failed'}`);

    this.emit('completed', {
      scanId: this.scanId,
      success,
      errors,
      phase,
    });

    this.cleanup();
  }

  /**
   * Cancel the current scan
   */
  async cancelScan(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isCancelled = true;

    // Stop all services
    if (this.browserService) {
      await this.browserService.stop();
    }

    if (this.zapService) {
      await this.zapService.stop();
    }

    this.completeScan(false);
  }

  /**
   * Get current scan state
   */
  getState(): ScanState | null {
    return null; // Would return current state from store
  }

  /**
   * Check if scan is running
   */
  isScanRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.isRunning = false;
    this.isCancelled = false;
    this.config = null;
  }

  /**
   * Dispose the orchestrator
   */
  dispose(): void {
    this.removeAllListeners();
    this.cleanup();
  }
}

// Singleton instance
let orchestratorInstance: ScanOrchestrator | null = null;

export function getOrchestrator(): ScanOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new ScanOrchestrator();
  }
  return orchestratorInstance;
}

export function resetOrchestrator(): void {
  if (orchestratorInstance) {
    orchestratorInstance.dispose();
    orchestratorInstance = null;
  }
}
