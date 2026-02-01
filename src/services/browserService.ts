import { EventEmitter } from 'events';
import { BrowserWindow, session, ipcMain, WebContents } from 'electron';
import path from 'path';
import type { ScanConfig, BrowserInfo, ProxyConfig, CookieData } from '../types';

/**
 * BrowserService - Electron BrowserWindow with CDP integration
 *
 * This service manages:
 * - BrowserWindow creation and configuration
 * - CDP debugging connection
 * - Network traffic interception via CDP
 * - Proxy configuration for ZAP integration
 * - Session capture for authenticated scans
 */
export class BrowserService extends EventEmitter {
  private window: BrowserWindow | null = null;
  private isConnected = false;
  private isNavigating = false;
  private capturedRequests: Map<string, CapturedRequest> = new Map();
  private capturedResponses: Map<string, CapturedResponse> = new Map();
  private currentUrl: string = '';

  // Configuration
  private proxyConfig: ProxyConfig | null = null;
  private cdpPort: number = 9222;
  private allowedDomains: string[] = [];

  constructor() {
    super();
  }

  /**
   * Initialize the browser service
   */
  async initialize(config: {
    proxyConfig?: ProxyConfig;
    cdpPort?: number;
    allowedDomains?: string[];
  }): Promise<void> {
    this.proxyConfig = config.proxyConfig || null;
    this.cdpPort = config.cdpPort || 9222;
    this.allowedDomains = config.allowedDomains || [];

    // Configure proxy
    if (this.proxyConfig?.enabled) {
      await this.configureProxy();
    }

    // Set up IPC handlers
    this.setupIPCHandlers();

    this.emit('initialized');
  }

  /**
   * Configure proxy settings
   */
  private async configureProxy(): Promise<void> {
    if (!this.proxyConfig) return;

    const proxyRules = `${this.proxyConfig.host}:${this.proxyConfig.port}`;
    const proxyBypassRules = this.proxyConfig.bypassRules || '<local>';

    await session.defaultSession.setProxy({
      proxyRules,
      proxyBypassRules,
    });

    this.emit('proxyConfigured', { config: this.proxyConfig });
  }

  /**
   * Create and show BrowserWindow
   */
  async createWindow(options?: {
    width?: number;
    height?: number;
    backgroundColor?: string;
  }): Promise<BrowserWindow> {
    if (this.window) {
      return this.window;
    }

    this.window = new BrowserWindow({
      width: options?.width || 1400,
      height: options?.height || 900,
      minWidth: 1200,
      minHeight: 700,
      backgroundColor: options?.backgroundColor || '#1a1a2e',
      titleBarStyle: 'hiddenInset',
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'browser-preload.js'),
        webSecurity: true,
        allowRunningInsecureContent: false,
        partition: 'persist:scanner',
      },
    });

    // Set up CDP debugging
    await this.attachCDPSession();

    // Window events
    this.window.on('ready-to-show', () => {
      this.window?.show();
      this.emit('windowReady');
    });

    this.window.on('closed', () => {
      this.window = null;
      this.isConnected = false;
      this.emit('windowClosed');
    });

    this.window.on('page-title-updated', (_event: Electron.Event, title: string) => {
      this.currentUrl = title;
    });

    // Navigation events
    this.window.webContents.on('did-start-loading', () => {
      this.isNavigating = true;
      this.emit('navigationStarted');
    });

    this.window.webContents.on('did-stop-loading', () => {
      this.isNavigating = false;
      this.emit('navigationStopped');
    });

    this.window.webContents.on('did-navigate', (_event: Electron.Event, url: string) => {
      this.currentUrl = url;
      this.emit('navigated', { url });
    });

    this.window.webContents.on('did-navigate-in-page', (_event: Electron.Event, url: string) => {
      this.currentUrl = url;
      this.emit('navigatedInPage', { url });
    });

    // Console logging from renderer
    this.window.webContents.on('console-message', (_event: Electron.Event, _level: number, message: string) => {
      this.emit('consoleMessage', { level: _level, message });
    });

    // Error handling
    this.window.webContents.on('render-process-gone', (_event: Electron.Event, details: { reason: string }) => {
      this.emit('renderProcessGone', { details });
    });

    this.window.webContents.on('plugin-crashed', (_event: Electron.Event, pluginName: string) => {
      this.emit('pluginCrashed', { pluginName });
    });

    return this.window;
  }

  /**
   * Attach CDP debugging session
   */
  private async attachCDPSession(): Promise<void> {
    if (!this.window) return;

    const webContents = this.window.webContents;

    // Enable CDP debugging
    try {
      webContents.debugger.attach('1.3');
      this.isConnected = true;

      // Listen for detachment
      webContents.debugger.on('detach', (_event: Electron.Event, reason: string) => {
        this.isConnected = false;
        this.emit('cdpDetached', { reason });
      });

      // Listen for CDP messages
      webContents.debugger.on('message', (_event: Electron.Event, method: string, params: any) => {
        this.handleCDPMessage(method, params);
      });

      // Enable required CDP domains
      await webContents.debugger.sendCommand('Network.enable');
      await webContents.debugger.sendCommand('Page.enable');
      await webContents.debugger.sendCommand('Log.enable');

      this.emit('cdpAttached');
    } catch (error) {
      console.error('Failed to attach CDP:', error);
      this.emit('cdpError', { error });
    }
  }

  /**
   * Handle incoming CDP message
   */
  private handleCDPMessage(method: string, params: any): void {
    switch (method) {
      case 'Network.requestWillBeSent':
        this.handleRequestWillBeSent(params);
        break;

      case 'Network.responseReceived':
        this.handleResponseReceived(params);
        break;

      case 'Network.loadingFinished':
        this.handleLoadingFinished(params);
        break;

      case 'Network.loadingFailed':
        this.handleLoadingFailed(params);
        break;

      case 'Page.domContentEventFired':
        this.emit('domContentLoaded', params);
        break;

      case 'Page.loadEventFired':
        this.emit('pageLoaded', params);
        break;

      case 'Log.entryAdded':
        this.emit('logEntry', params);
        break;

      default:
        this.emit(method, params);
    }
  }

  /**
   * Handle CDP request will be sent event
   */
  private handleRequestWillBeSent(params: {
    requestId: string;
    documentURL?: string;
    request: { url: string; method: string; headers: Record<string, string> };
    type?: string;
    timestamp: number;
    wallTime?: number;
  }): void {
    const request: CapturedRequest = {
      id: params.requestId,
      url: params.request.url,
      method: params.request.method,
      headers: params.request.headers,
      timestamp: params.timestamp,
      wallTime: params.wallTime || 0,
      type: params.type || 'other',
    };

    this.capturedRequests.set(params.requestId, request);
    this.emit('request', request);

    // Check if URL is allowed
    if (!this.isUrlAllowed(request.url)) {
      this.emit('requestBlocked', { request, reason: 'not-allowed-domain' });
    }
  }

  /**
   * Handle CDP response received event
   */
  private handleResponseReceived(params: {
    requestId: string;
    response: {
      url: string;
      status: number;
      statusText: string;
      headers: Record<string, string>;
      mimeType: string;
      requestHeaders?: Record<string, string>;
    };
    type: string;
    timestamp: number;
  }): void {
    const response: CapturedResponse = {
      id: params.requestId,
      url: params.response.url,
      status: params.response.status,
      statusText: params.response.statusText,
      headers: params.response.headers,
      mimeType: params.response.mimeType,
      requestHeaders: params.response.requestHeaders,
      timestamp: params.timestamp,
    };

    this.capturedResponses.set(params.requestId, response);
    this.emit('response', response);
  }

  /**
   * Handle CDP loading finished event
   */
  private handleLoadingFinished(params: { requestId: string; timestamp: number }): void {
    this.emit('loadingFinished', { requestId: params.requestId });
  }

  /**
   * Handle CDP loading failed event
   */
  private handleLoadingFailed(params: {
    requestId: string;
    errorText: string;
    canceled?: boolean;
  }): void {
    this.emit('loadingFailed', {
      requestId: params.requestId,
      errorText: params.errorText,
      canceled: params.canceled,
    });
  }

  /**
   * Check if URL is in allowed domains
   */
  private isUrlAllowed(url: string): boolean {
    if (this.allowedDomains.length === 0) return true;

    try {
      const urlObj = new URL(url);
      return this.allowedDomains.some(domain => {
        if (domain.startsWith('*.')) {
          const baseDomain = domain.slice(2);
          return urlObj.hostname.endsWith(baseDomain);
        }
        return urlObj.hostname === domain;
      });
    } catch {
      return false;
    }
  }

  /**
   * Navigate to URL
   */
  async navigate(url: string): Promise<void> {
    if (!this.window) {
      throw new Error('Browser window not created');
    }

    this.currentUrl = url;
    await this.window.loadURL(url);
  }

  /**
   * Get response body for a request
   */
  async getResponseBody(requestId: string): Promise<string | null> {
    if (!this.window) return null;

    try {
      const result = await this.window.webContents.debugger.sendCommand(
        'Network.getResponseBody',
        { requestId }
      );
      return result.base64Encoded
        ? Buffer.from(result.body, 'base64').toString('utf-8')
        : result.body;
    } catch (error) {
      console.error(`Failed to get response body for ${requestId}:`, error);
      return null;
    }
  }

  /**
   * Get request headers for a request
   */
  async getRequestHeaders(requestId: string): Promise<Record<string, string> | null> {
    const request = this.capturedRequests.get(requestId);
    return request?.headers || null;
  }

  /**
   * Get response headers for a request
   */
  async getResponseHeaders(requestId: string): Promise<Record<string, string> | null> {
    const response = this.capturedResponses.get(requestId);
    return response?.headers || null;
  }

  /**
   * Capture cookies from current session
   */
  async captureCookies(): Promise<CookieData[]> {
    const cookies = await session.defaultSession.cookies.get({});
    return cookies.map(cookie => {
      return {
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain || '',
        path: cookie.path || '/',
        expires: undefined,
        httpOnly: cookie.httpOnly || false,
        secure: cookie.secure || false,
        sameSite: cookie.sameSite || 'unspecified',
      };
    });
  }

  /**
   * Clear all captured data
   */
  clearCapturedData(): void {
    this.capturedRequests.clear();
    this.capturedResponses.clear();
    this.emit('dataCleared');
  }

  /**
   * Get all captured requests
   */
  getCapturedRequests(): CapturedRequest[] {
    return Array.from(this.capturedRequests.values());
  }

  /**
   * Get all captured responses
   */
  getCapturedResponses(): CapturedResponse[] {
    return Array.from(this.capturedResponses.values());
  }

  /**
   * Get browser information
   */
  getBrowserInfo(): BrowserInfo {
    return {
      type: 'electron',
      engine: 'Chromium',
      version: process.versions.chrome || 'unknown',
      userAgent: this.window?.webContents.getUserAgent() || 'unknown',
    };
  }

  /**
   * Get current URL
   */
  getCurrentUrl(): string {
    return this.currentUrl;
  }

  /**
   * Check if CDP is connected
   */
  isCDPConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Set user agent
   */
  setUserAgent(userAgent: string): void {
    this.window?.webContents.setUserAgent(userAgent);
  }

  /**
   * Execute JavaScript in the page
   */
  async executeJavaScript(code: string): Promise<unknown> {
    if (!this.window) throw new Error('Window not created');

    return new Promise((resolve, reject) => {
      this.window!.webContents.executeJavaScript(code, true)
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Reload the page
   */
  async reload(): Promise<void> {
    this.window?.webContents.reload();
  }

  /**
   * Go back in history
   */
  async goBack(): Promise<boolean> {
    if (!this.window) return false;
    if (!this.window.webContents.canGoBack()) return false;
    this.window.webContents.goBack();
    return true;
  }

  /**
   * Go forward in history
   */
  async goForward(): Promise<boolean> {
    if (!this.window) return false;
    if (!this.window.webContents.canGoForward()) return false;
    this.window.webContents.goForward();
    return true;
  }

  /**
   * Take a screenshot of the page
   */
  async takeScreenshot(options?: {
    path?: string;
    fullPage?: boolean;
    clip?: { x: number; y: number; width: number; height: number };
  }): Promise<Buffer> {
    if (!this.window) throw new Error('Window not created');

    const image = await this.window.webContents.capturePage(options?.clip);

    if (options?.path) {
      const { writeFile } = await import('fs/promises');
      await writeFile(options.path, image.toPNG());
    }

    return image.toPNG();
  }

  /**
   * Save page as PDF
   */
  async saveAsPDF(path: string, options?: {
    marginsType?: 0 | 1 | 2;
    pageSize?: { width: number; height: number };
    printBackground?: boolean;
    scale?: number;
  }): Promise<void> {
    if (!this.window) throw new Error('Window not created');

    await this.window.webContents.printToPDF({
      marginsType: options?.marginsType || 0,
      pageSize: options?.pageSize || { width: 8.5 * 96, height: 11 * 96 }, // Letter size in pixels
      printBackground: options?.printBackground ?? true,
      scale: options?.scale || 1,
      preferCSSPageSize: false,
    });
  }

  /**
   * Get page HTML
   */
  async getPageHTML(): Promise<string> {
    if (!this.window) throw new Error('Window not created');
    return await this.window.webContents.executeJavaScript('document.documentElement.outerHTML');
  }

  /**
   * Get page title
   */
  getPageTitle(): string {
    return this.window?.webContents.getTitle() || '';
  }

  /**
   * Show dev tools
   */
  async openDevTools(mode: 'detach' | 'right' | 'bottom' = 'detach'): Promise<void> {
    this.window?.webContents.openDevTools({ mode });
  }

  /**
   * Close dev tools
   */
  closeDevTools(): void {
    this.window?.webContents.closeDevTools();
  }

  /**
   * Set up IPC handlers for renderer communication
   */
  private setupIPCHandlers(): void {
    ipcMain.handle('browser:navigate', async (_event: Electron.IpcMainInvokeEvent, url: string) => {
      await this.navigate(url);
    });

    ipcMain.handle('browser:reload', async () => {
      await this.reload();
    });

    ipcMain.handle('browser:get-url', () => {
      return this.getCurrentUrl();
    });

    ipcMain.handle('browser:capture-cookies', async () => {
      return await this.captureCookies();
    });

    ipcMain.handle('browser:get-requests', () => {
      return this.getCapturedRequests();
    });

    ipcMain.handle('browser:get-responses', () => {
      return this.getCapturedResponses();
    });

    ipcMain.handle('browser:clear-data', () => {
      this.clearCapturedData();
    });
  }

  /**
   * Close the browser and clean up
   */
  async close(): Promise<void> {
    if (this.isConnected && this.window) {
      this.window.webContents.debugger.detach();
    }

    if (this.window) {
      this.window.close();
      this.window = null;
    }

    this.isConnected = false;
    this.capturedRequests.clear();
    this.capturedResponses.clear();

    this.emit('closed');
  }

  /**
   * Dispose the service
   */
  dispose(): void {
    this.removeAllListeners();
    this.close();
  }
}

// Types for captured data
interface CapturedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  timestamp: number;
  wallTime: number;
  type: string;
}

interface CapturedResponse {
  id: string;
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  mimeType: string;
  requestHeaders?: Record<string, string>;
  timestamp: number;
}

// Export singleton getter
let browserServiceInstance: BrowserService | null = null;

export function getBrowserService(): BrowserService {
  if (!browserServiceInstance) {
    browserServiceInstance = new BrowserService();
  }
  return browserServiceInstance;
}

export function resetBrowserService(): void {
  if (browserServiceInstance) {
    browserServiceInstance.dispose();
    browserServiceInstance = null;
  }
}
