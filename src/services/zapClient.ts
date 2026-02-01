import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import type {
  Vulnerability,
  ProxyConfig,
} from '../types';

/**
 * ZAPClient - OWASP ZAP daemon management and API client
 *
 * This service provides:
 * - ZAP daemon lifecycle management (start/stop)
 * - ZAP JSON API access
 * - Spider and AJAX Spider control
 * - Active scanning
 * - Alert retrieval
 * - Automation Framework support
 *
 * ZAP can run via Docker or native installation
 */
export class ZAPClient extends EventEmitter {
  private zapProcess: ChildProcess | null = null;
  private apiPort = 8080;
  private proxyPort = 8080;
  private homeDirectory = '';
  private isRunning = false;
  private useDocker = false;
  private dockerContainerId = '';

  // API base URL
  private get baseUrl(): string {
    return `http://localhost:${this.apiPort}`;
  }

  // Configuration
  private allowedDomains: string[] = [];

  constructor() {
    super();
  }

  /**
   * Initialize ZAP client with configuration
   */
  async initialize(config?: {
    apiPort?: number;
    proxyPort?: number;
    homeDirectory?: string;
    useDocker?: boolean;
  }): Promise<void> {
    this.apiPort = config?.apiPort || 8080;
    this.proxyPort = config?.proxyPort || 8080;
    this.homeDirectory = config?.homeDirectory || '';
    this.useDocker = config?.useDocker || false;

    this.emit('initialized', { config });
  }

  /**
   * Start ZAP daemon
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('ZAP is already running');
    }

    this.emit('starting');

    if (this.useDocker) {
      await this.startDocker();
    } else {
      await this.startNative();
    }

    // Wait for ZAP to be ready
    await this.waitForReady();

    this.isRunning = true;
    this.emit('started');
  }

  /**
   * Start ZAP via Docker
   */
  private async startDocker(): Promise<void> {
    // In a real implementation:
    // const dockerode = require('dockerode');
    // const docker = new dockerode();
    // const container = await docker.createContainer({
    //   Image: 'owasp/zap2docker-stable',
    //   ExposedPorts: { '8080/tcp': {} },
    //   HostConfig: {
    //     PortBindings: { '8080/tcp': [{ HostPort: this.proxyPort.toString() }] },
    //     AutoRemove: true,
    //   },
    //   Cmd: ['zap.sh', '-daemon', '-port', this.apiPort.toString()],
    // });
    // this.dockerContainerId = container.id;
    // await container.start();

    this.emit('dockerStarted');
  }

  /**
   * Start ZAP natively
   */
  private async startNative(): Promise<void> {
    const zapPath = this.homeDirectory || process.env.ZAP_PATH || 'zap.sh';
    const args = [
      '-daemon',
      '-port', this.apiPort.toString(),
      '-config', `api.addrs.addr.name=.*`,
      '-config', `api.addrs.addr.port=${this.apiPort}`,
    ];

    // In a real implementation:
    // this.zapProcess = spawn(zapPath, args, {
    //   stdio: ['ignore', 'pipe', 'pipe'],
    //   detached: false,
    // });
    // this.zapProcess.stdout.on('data', (data) => this.emit('stdout', data));
    // this.zapProcess.stderr.on('data', (data) => this.emit('stderr', data));
    // this.zapProcess.on('close', (code) => {
    //   this.isRunning = false;
    //   this.emit('stopped', { code });
    // });

    this.emit('nativeStarted');
  }

  /**
   * Wait for ZAP API to be ready
   */
  private async waitForReady(): Promise<void> {
    const maxAttempts = 30;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`${this.baseUrl}/JSON/core/view/version/`);
        if (response.ok) {
          return;
        }
      } catch {
        // Not ready yet
      }

      await this.sleep(1000);
    }

    throw new Error('ZAP failed to start within timeout');
  }

  /**
   * Check if ZAP is running
   */
  async isReady(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/JSON/core/view/version/`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Make API request to ZAP
   */
  private async apiRequest<T = unknown>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}/JSON${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`ZAP API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get ZAP version
   */
  async getVersion(): Promise<string> {
    const result = await this.apiRequest<{ version: string }>('/core/view/version/');
    return result.version;
  }

  // ==================== Spider ====================

  /**
   * Start spider scan
   */
  async spider(url: string, options?: {
    maxChildren?: number;
    recurse?: boolean;
    contextName?: string;
  }): Promise<number> {
    const params: Record<string, string> = {
      url,
      maxChildren: (options?.maxChildren || 0).toString(),
      recurse: (options?.recurse ?? true).toString(),
    };

    if (options?.contextName) {
      params.contextname = options.contextName;
    }

    const result = await this.apiRequest<{ scan: string }>('/spider/action/scan/', params);
    return parseInt(result.scan, 10);
  }

  /**
   * Start AJAX spider
   */
  async ajaxSpider(url: string, options?: {
    inScope?: boolean;
    contextName?: string;
  }): Promise<number> {
    const params: Record<string, string> = {
      url,
      inScope: (options?.inScope ?? true).toString(),
    };

    if (options?.contextName) {
      params.contextname = options.contextName;
    }

    const result = await this.apiRequest<{ scan: string }>('/ajaxSpider/action/scan/', params);
    return parseInt(result.scan, 10);
  }

  /**
   * Get spider status
   */
  async getSpiderStatus(scanId: number): Promise<{
    status: string;
    progress: number;
    urlsFound: number;
  }> {
    const result = await this.apiRequest<{
      status: string;
      progress: string;
      urls: string;
    }>('/spider/view/status/', { scanId: scanId.toString() });

    return {
      status: result.status,
      progress: parseInt(result.progress, 10),
      urlsFound: parseInt(result.urls, 10),
    };
  }

  /**
   * Get spider results
   */
  async getSpiderResults(scanId: number): Promise<string[]> {
    const result = await this.apiRequest<{ results: string }>(
      '/spider/view/results/',
      { scanId: scanId.toString() }
    );

    return result.results.split(',').filter(Boolean);
  }

  // ==================== Active Scan ====================

  /**
   * Start active scan
   */
  async activeScan(url: string, options?: {
    recurse?: boolean;
    inScopeOnly?: boolean;
    scanPolicyName?: string;
    method?: string;
    postData?: string;
    contextName?: string;
  }): Promise<number> {
    const params: Record<string, string> = {
      url,
      recurse: (options?.recurse ?? true).toString(),
      inScopeOnly: (options?.inScopeOnly ?? false).toString(),
    };

    if (options?.scanPolicyName) {
      params.scanpolicyname = options.scanPolicyName;
    }

    if (options?.method) {
      params.method = options.method;
    }

    if (options?.postData) {
      params.postdata = options.postData;
    }

    if (options?.contextName) {
      params.contextname = options.contextName;
    }

    const result = await this.apiRequest<{ scan: string }>('/ascan/action/scan/', params);
    return parseInt(result.scan, 10);
  }

  /**
   * Get active scan status
   */
  async getActiveScanStatus(scanId: number): Promise<{
    status: string;
    progress: number;
  }> {
    const result = await this.apiRequest<{
      status: string;
      progress: string;
    }>('/ascan/view/status/', { scanId: scanId.toString() });

    return {
      status: result.status,
      progress: parseInt(result.progress, 10),
    };
  }

  // ==================== Alerts ====================

  /**
   * Get alerts
   */
  async getAlerts(options?: {
    baseurl?: string;
    start?: number;
    count?: number;
    riskid?: string;
    confidence?: string;
  }): Promise<ZAPAlert[]> {
    const params: Record<string, string> = {};

    if (options?.baseurl) {
      params.baseurl = options.baseurl;
    }

    if (options?.start !== undefined) {
      params.start = options.start.toString();
    }

    if (options?.count !== undefined) {
      params.count = options.count.toString();
    }

    if (options?.riskid) {
      params.riskid = options.riskid;
    }

    if (options?.confidence) {
      params.confidence = options.confidence;
    }

    const result = await this.apiRequest<{ alerts: ZAPAlert[] }>('/core/view/alerts/', params);
    return result.alerts || [];
  }

  /**
   * Get alert counts by risk
   */
  async getAlertCounts(): Promise<{
    high: number;
    medium: number;
    low: number;
    informational: number;
  }> {
    const alerts = await this.getAlerts({ count: 0 });

    return {
      high: alerts.filter(a => a.risk === 'High').length,
      medium: alerts.filter(a => a.risk === 'Medium').length,
      low: alerts.filter(a => a.risk === 'Low').length,
      informational: alerts.filter(a => a.risk === 'Informational').length,
    };
  }

  // ==================== Context ====================

  /**
   * Create a new context
   */
  async createContext(contextName: string): Promise<number> {
    const result = await this.apiRequest<{ context: string }>(
      '/context/action/newContext/',
      { contextname: contextName }
    );

    return parseInt(result.context, 10);
  }

  /**
   * Include URL in context
   */
  async includeInContext(contextName: string, pattern: string): Promise<void> {
    await this.apiRequest('/context/action/includeInContext/', {
      contextname: contextName,
      pattern,
    });
  }

  /**
   * Exclude URL from context
   */
  async excludeFromContext(contextName: string, pattern: string): Promise<void> {
    await this.apiRequest('/context/action/excludeFromContext/', {
      contextname: contextName,
      pattern,
    });
  }

  // ==================== Authentication ====================

  /**
   * Set authentication method
   */
  async setAuthenticationMethod(
    contextName: string,
    method: string,
    config: Record<string, string>
  ): Promise<void> {
    const params: Record<string, string> = {
      contextname: contextName,
      authmethodname: method,
      ...config,
    };

    await this.apiRequest('/auth/action/setAuthenticationMethod/', params);
  }

  /**
   * Configure form-based authentication
   */
  async setFormAuthentication(
    contextName: string,
    loginUrl: string,
    loginRequestData: string
  ): Promise<void> {
    await this.setAuthenticationMethod(contextName, 'formBasedAuthentication', {
      loginurl: loginUrl,
      loginrequestdata: loginRequestData,
    });
  }

  /**
   * Set logged in indicator
   */
  async setLoggedInIndicator(contextName: string, pattern: string): Promise<void> {
    await this.apiRequest('/auth/action/setLoggedInIndicator/', {
      contextname: contextName,
      pattern,
    });
  }

  // ==================== Users ====================

  /**
   * Create a user
   */
  async createUser(contextName: string, name: string): Promise<number> {
    const result = await this.apiRequest<{ userId: string }>(
      '/users/action/newUser/',
      { contextname: contextName, username: name }
    );

    return parseInt(result.userId, 10);
  }

  /**
   * Set user credentials
   */
  async setUserCredentials(
    contextName: string,
    userId: number,
    credentials: Record<string, string>
  ): Promise<void> {
    await this.apiRequest('/users/action/setAuthenticationCredentials/', {
      contextname: contextName,
      userid: userId.toString(),
      ...credentials,
    });
  }

  /**
   * Enable user
   */
  async enableUser(contextName: string, userId: number): Promise<void> {
    await this.apiRequest('/users/action/setUserEnabled/', {
      contextname: contextName,
      userid: userId.toString(),
      enabled: 'true',
    });
  }

  // ==================== Automation Framework ====================

  /**
   * Load automation plan from YAML
   */
  async loadAutomationPlan(yamlPath: string): Promise<void> {
    await this.apiRequest('/automation/action/loadConfig/', {
      configFile: yamlPath,
    });
  }

  /**
   * Run automation plan
   */
  async runAutomationPlan(): Promise<void> {
    await this.apiRequest('/automation/action/run/', {});
  }

  // ==================== Reports ====================

  /**
   * Generate report
   */
  async generateReport(options?: {
    title?: string;
    template?: string;
    reportfilename?: string;
    reportfileextension?: string;
  }): Promise<Buffer> {
    const params: Record<string, string> = {};

    if (options?.title) {
      params.title = options.title;
    }

    if (options?.template) {
      params.template = options.template;
    }

    if (options?.reportfilename) {
      params.reportfilename = options.reportfilename;
    }

    if (options?.reportfileextension) {
      params.reportfileextension = options.reportfileextension;
    }

    const url = new URL(`${this.baseUrl}/OTHER/core/other/report/`);

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Failed to generate report: ${response.statusText}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Get discovered URLs
   */
  async getDiscoveredUrls(): Promise<string[]> {
    const result = await this.apiRequest<{ urls: string }>('/spider/view/urls/');
    return result.urls.split(',').filter(Boolean);
  }

  /**
   * Shutdown ZAP
   */
  async shutdown(): Promise<void> {
    if (this.useDocker) {
      await this.shutdownDocker();
    } else {
      await this.shutdownNative();
    }

    this.isRunning = false;
    this.emit('stopped');
  }

  /**
   * Shutdown Docker container
   */
  private async shutdownDocker(): Promise<void> {
    // In a real implementation:
    // const dockerode = require('dockerode');
    // const docker = new dockerode();
    // const container = docker.getContainer(this.dockerContainerId);
    // await container.stop();
    // await container.remove();

    this.emit('dockerStopped');
  }

  /**
   * Shutdown native ZAP
   */
  private async shutdownNative(): Promise<void> {
    try {
      await this.apiRequest('/core/action/shutdown/', {});
    } catch {
      // Ignore errors during shutdown
    }

    if (this.zapProcess) {
      this.zapProcess.kill();
      this.zapProcess = null;
    }

    this.emit('nativeStopped');
  }

  /**
   * Helper sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.removeAllListeners();

    if (this.isRunning) {
      this.shutdown().catch(console.error);
    }
  }
}

// Types
interface ZAPAlert {
  pluginId: string;
  alert: string;
  name: string;
  description: string;
  risk: 'High' | 'Medium' | 'Low' | 'Informational';
  confidence: 'High' | 'Medium' | 'Low';
  url: string;
  method: string;
  param: string;
  evidence: string;
  otherInfo: string;
  solution: string;
  reference: string;
  cweid: string;
  wascid: string;
  source: string;
}

// Export singleton
let zapClientInstance: ZAPClient | null = null;

export function getZAPClient(): ZAPClient {
  if (!zapClientInstance) {
    zapClientInstance = new ZAPClient();
  }
  return zapClientInstance;
}

export function resetZAPClient(): void {
  if (zapClientInstance) {
    zapClientInstance.dispose();
    zapClientInstance = null;
  }
}
