import { EventEmitter } from 'events';
import type {
  ScanConfig,
  ScanState,
  ScanPhase,
  ScanProgress,
  Vulnerability,
  ScanError,
  BulkScanConfig,
  ScanQueueItem,
} from '../types';
import { generateId, sleep, parseTargets, validateUrl } from '../utils';

/**
 * MultiTargetScanner - Manages bulk scanning operations with queue support
 *
 * Features:
 * - Queue-based batch processing
 * - Parallel/sequential scan modes
 * - Progress tracking per target
 * - Aggregate results reporting
 * - Pause/Resume/Cancel support
 */
export class MultiTargetScanner extends EventEmitter {
  private queue: ScanQueueItem[] = [];
  private isRunning = false;
  private isPaused = false;
  private isCancelled = false;
  private currentIndex = 0;
  private concurrency = 1; // Number of parallel scans
  private aggregateVulnerabilities: Vulnerability[] = [];
  private startTime: Date | null = null;

  // Services
  private orchestrator: any = null;

  constructor() {
    super();
  }

  /**
   * Inject orchestrator service
   */
  injectOrchestrator(orchestrator: any): void {
    this.orchestrator = orchestrator;
  }

  /**
   * Set concurrency level for parallel scanning
   */
  setConcurrency(level: number): void {
    this.concurrency = Math.max(1, Math.min(level, 10));
  }

  /**
   * Start bulk scan with targets
   */
  async startBulkScan(config: BulkScanConfig): Promise<string> {
    if (this.isRunning) {
      throw new Error('Bulk scan is already running');
    }

    const bulkScanId = generateId('bulk');

    // Parse and validate targets
    const targets = this.parseTargets(config.targets);
    if (targets.length === 0) {
      throw new Error('No valid targets provided');
    }

    // Create queue items
    this.queue = targets.map((target, index) => ({
      id: generateId('scan'),
      bulkScanId,
      index,
      target,
      status: 'pending' as const,
      scanConfig: this.createScanConfig(target, config, bulkScanId),
      vulnerabilities: [],
      error: null,
      progress: 0,
      startTime: null,
      endTime: null,
    }));

    this.isRunning = true;
    this.isPaused = false;
    this.isCancelled = false;
    this.currentIndex = 0;
    this.aggregateVulnerabilities = [];
    this.startTime = new Date();

    // Emit started event
    this.emit('bulkStarted', {
      bulkScanId,
      totalTargets: targets.length,
      mode: config.mode,
      concurrency: this.concurrency,
    });

    // Start processing
    await this.processQueue();

    return bulkScanId;
  }

  /**
   * Parse target input (supports URLs, domains, file paths)
   */
  private parseTargets(input: string | string[]): string[] {
    let targets: string[] = [];

    if (Array.isArray(input)) {
      targets = input;
    } else if (typeof input === 'string') {
      // Handle file import, newlines, commas
      targets = parseTargets(input);
    }

    // Validate and deduplicate
    const validTargets = targets
      .map(t => t.trim())
      .filter(t => t.length > 0 && validateUrl(t))
      .filter(t => {
        // Normalize URL
        let normalized = t;
        if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
          normalized = `https://${t}`;
        }
        try {
          new URL(normalized);
          return true;
        } catch {
          return false;
        }
      });

    return [...new Set(validTargets)];
  }

  /**
   * Create scan configuration for a single target
   */
  private createScanConfig(target: string, bulkConfig: BulkScanConfig, bulkScanId: string): ScanConfig {
    let normalizedTarget = target;
    if (!normalizedTarget.startsWith('http://') && !normalizedTarget.startsWith('https://')) {
      normalizedTarget = `https://${target}`;
    }

    return {
      id: generateId('scan'),
      targetUrl: normalizedTarget,
      scanType: bulkConfig.scanType || 'standard',
      authMode: bulkConfig.authMode || 'none',
      browserEngine: bulkConfig.browserEngine || 'playwright',
      playwrightBrowser: bulkConfig.playwrightBrowser || 'chromium',
      scanOptions: {
        passiveOnly: false,
        activeScan: true,
        ajaxSpider: true,
        nucleiTemplates: bulkConfig.nucleiTemplates || [],
        assetDiscovery: bulkConfig.assetDiscovery || false,
        subdomainEnum: false,
      },
      zapOptions: bulkConfig.zapOptions,
    };
  }

  /**
   * Process the scan queue
   */
  private async processQueue(): Promise<void> {
    while (this.currentIndex < this.queue.length && !this.isCancelled) {
      if (this.isPaused) {
        await sleep(1000);
        continue;
      }

      const batch = this.getNextBatch();
      if (batch.length === 0) break;

      // Process batch (parallel or sequential)
      if (this.concurrency > 1) {
        await Promise.all(batch.map(item => this.processItem(item)));
      } else {
        for (const item of batch) {
          await this.processItem(item);
        }
      }

      // Update aggregate progress
      this.updateAggregateProgress();
    }

    // Complete bulk scan
    this.completeBulkScan();
  }

  /**
   * Get next batch of items based on concurrency
   */
  private getNextBatch(): ScanQueueItem[] {
    const batch: ScanQueueItem[] = [];
    let count = 0;

    while (this.currentIndex < this.queue.length && count < this.concurrency) {
      const item = this.queue[this.currentIndex];
      if (item.status === 'pending') {
        batch.push(item);
        count++;
      }
      this.currentIndex++;
    }

    return batch;
  }

  /**
   * Process a single scan item
   */
  private async processItem(item: ScanQueueItem): Promise<void> {
    item.status = 'running';
    item.startTime = new Date();
    item.progress = 0;

    this.emit('targetStarted', {
      bulkScanId: item.bulkScanId,
      targetIndex: item.index,
      target: item.target,
      totalTargets: this.queue.length,
    });

    try {
      // Connect to orchestrator events
      const progressHandler = (progress: ScanProgress) => {
        item.progress = progress.progress;
        item.currentPhase = progress.phase;

        this.emit('targetProgress', {
          bulkScanId: item.bulkScanId,
          targetIndex: item.index,
          target: item.target,
          progress: item.progress,
          phase: progress.phase,
          message: progress.message,
        });
      };

      const vulnHandler = (data: { vulnerabilities: Vulnerability[] }) => {
        item.vulnerabilities = data.vulnerabilities;
        this.aggregateVulnerabilities = [
          ...this.aggregateVulnerabilities,
          ...data.vulnerabilities,
        ];
      };

      this.orchestrator?.on('progress', progressHandler);
      this.orchestrator?.on('vulnerabilities', vulnHandler);

      // Execute scan
      await this.orchestrator?.startScan(item.scanConfig);

      item.status = 'completed';
      item.progress = 100;

      // Disconnect handlers
      this.orchestrator?.off('progress', progressHandler);
      this.orchestrator?.off('vulnerabilities', vulnHandler);

    } catch (error) {
      item.status = 'failed';
      item.error = error instanceof Error ? error.message : 'Unknown error';
      item.progress = 0;

      this.emit('targetFailed', {
        bulkScanId: item.bulkScanId,
        targetIndex: item.index,
        target: item.target,
        error: item.error,
      });
    }

    item.endTime = new Date();

    this.emit('targetCompleted', {
      bulkScanId: item.bulkScanId,
      targetIndex: item.index,
      target: item.target,
      status: item.status,
      vulnerabilitiesFound: item.vulnerabilities.length,
      duration: item.endTime.getTime() - item.startTime!.getTime(),
    });
  }

  /**
   * Update aggregate progress
   */
  private updateAggregateProgress(): void {
    const completed = this.queue.filter(
      item => item.status === 'completed' || item.status === 'failed'
    ).length;
    const total = this.queue.length;
    const progress = Math.round((completed / total) * 100);

    const totalVulns = this.aggregateVulnerabilities.length;
    const criticalCount = this.aggregateVulnerabilities.filter(
      v => v.severity === 'critical'
    ).length;
    const highCount = this.aggregateVulnerabilities.filter(
      v => v.severity === 'high'
    ).length;

    this.emit('bulkProgress', {
      progress,
      completedTargets: completed,
      totalTargets: total,
      vulnerabilitiesFound: totalVulns,
      criticalCount,
      highCount,
    });
  }

  /**
   * Complete the bulk scan
   */
  private completeBulkScan(): void {
    const endTime = new Date();
    const duration = this.startTime
      ? endTime.getTime() - this.startTime.getTime()
      : 0;

    const completed = this.queue.filter(item => item.status === 'completed').length;
    const failed = this.queue.filter(item => item.status === 'failed').length;

    const result = {
      bulkScanId: this.queue[0]?.bulkScanId || '',
      totalTargets: this.queue.length,
      completedTargets: completed,
      failedTargets: failed,
      totalVulnerabilities: this.aggregateVulnerabilities.length,
      vulnerabilities: this.aggregateVulnerabilities,
      duration,
      startTime: this.startTime,
      endTime,
      results: this.queue.map(item => ({
        target: item.target,
        status: item.status,
        vulnerabilities: item.vulnerabilities,
        error: item.error,
        duration: item.endTime && item.startTime
          ? item.endTime.getTime() - item.startTime.getTime()
          : 0,
      })),
    };

    this.isRunning = false;

    this.emit('bulkCompleted', result);
  }

  /**
   * Pause the bulk scan
   */
  pauseBulkScan(): void {
    if (!this.isRunning) return;

    this.isPaused = true;
    this.emit('bulkPaused', {
      bulkScanId: this.queue[0]?.bulkScanId,
      completedTargets: this.currentIndex,
      totalTargets: this.queue.length,
    });
  }

  /**
   * Resume the bulk scan
   */
  resumeBulkScan(): void {
    if (!this.isPaused) return;

    this.isPaused = false;
    this.emit('bulkResumed', {
      bulkScanId: this.queue[0]?.bulkScanId,
    });
  }

  /**
   * Cancel the bulk scan
   */
  async cancelBulkScan(): Promise<void> {
    if (!this.isRunning) return;

    this.isCancelled = true;
    this.isPaused = false;

    // Cancel current scans
    await this.orchestrator?.cancelScan();

    this.emit('bulkCancelled', {
      bulkScanId: this.queue[0]?.bulkScanId,
      completedTargets: this.queue.filter(
        item => item.status === 'completed'
      ).length,
      cancelledTargets: this.queue.filter(
        item => item.status === 'pending' || item.status === 'running'
      ).length,
    });

    this.isRunning = false;
  }

  /**
   * Get current queue status
   */
  getQueueStatus(): {
    bulkScanId: string | null;
    totalTargets: number;
    completedTargets: number;
    runningTargets: number;
    pendingTargets: number;
    failedTargets: number;
    progress: number;
    isRunning: boolean;
    isPaused: boolean;
  } {
    const completed = this.queue.filter(
      item => item.status === 'completed'
    ).length;
    const running = this.queue.filter(
      item => item.status === 'running'
    ).length;
    const pending = this.queue.filter(
      item => item.status === 'pending'
    ).length;
    const failed = this.queue.filter(
      item => item.status === 'failed'
    ).length;

    return {
      bulkScanId: this.queue[0]?.bulkScanId || null,
      totalTargets: this.queue.length,
      completedTargets: completed,
      runningTargets: running,
      pendingTargets: pending,
      failedTargets: failed,
      progress: this.queue.length > 0
        ? Math.round((completed / this.queue.length) * 100)
        : 0,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
    };
  }

  /**
   * Get queue items
   */
  getQueueItems(): ScanQueueItem[] {
    return [...this.queue];
  }

  /**
   * Get aggregate vulnerabilities
   */
  getAggregateVulnerabilities(): Vulnerability[] {
    return [...this.aggregateVulnerabilities];
  }

  /**
   * Export results
   */
  exportResults(): {
    summary: {
      totalTargets: number;
      completed: number;
      failed: number;
      totalVulnerabilities: number;
      bySeverity: Record<string, number>;
      bySource: Record<string, number>;
    };
    results: ScanQueueItem[];
  } {
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

    for (const vuln of this.aggregateVulnerabilities) {
      bySeverity[vuln.severity]++;
      bySource[vuln.source]++;
    }

    return {
      summary: {
        totalTargets: this.queue.length,
        completed: this.queue.filter(i => i.status === 'completed').length,
        failed: this.queue.filter(i => i.status === 'failed').length,
        totalVulnerabilities: this.aggregateVulnerabilities.length,
        bySeverity,
        bySource,
      },
      results: this.queue,
    };
  }

  /**
   * Check if scan is running
   */
  isBulkScanRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Check if scan is paused
   */
  isBulkScanPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Get scan statistics
   */
  getStatistics(): {
    averageScanTime: number;
    successRate: number;
    mostVulnerableTarget: string | null;
  } {
    const completed = this.queue.filter(
      item => item.status === 'completed' && item.startTime && item.endTime
    );

    let totalTime = 0;
    let maxVulns = 0;
    let mostVulnerable: string | null = null;

    for (const item of completed) {
      const duration = item.endTime!.getTime() - item.startTime!.getTime();
      totalTime += duration;

      if (item.vulnerabilities.length > maxVulns) {
        maxVulns = item.vulnerabilities.length;
        mostVulnerable = item.target;
      }
    }

    return {
      averageScanTime: completed.length > 0 ? totalTime / completed.length : 0,
      successRate: this.queue.length > 0
        ? (completed.length / this.queue.length) * 100
        : 0,
      mostVulnerableTarget: mostVulnerable,
    };
  }

  /**
   * Dispose the scanner
   */
  dispose(): void {
    this.removeAllListeners();
    this.queue = [];
    this.isRunning = false;
    this.isPaused = false;
    this.isCancelled = false;
  }
}

// Singleton instance
let scannerInstance: MultiTargetScanner | null = null;

export function getMultiTargetScanner(): MultiTargetScanner {
  if (!scannerInstance) {
    scannerInstance = new MultiTargetScanner();
  }
  return scannerInstance;
}

export function resetMultiTargetScanner(): void {
  if (scannerInstance) {
    scannerInstance.dispose();
    scannerInstance = null;
  }
}
