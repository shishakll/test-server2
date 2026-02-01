import { EventEmitter } from 'events';
import type {
  Vulnerability,
  CookieData,
  BrowserInfo,
  ProxyConfig,
} from '../types';

/**
 * CDPService - Chrome DevTools Protocol client for browser control
 *
 * This service provides direct CDP protocol access for:
 * - Network monitoring and interception
 * - Response body capture
 * - DOM inspection
 * - JavaScript execution
 * - Performance profiling
 *
 * Can connect to any CDP-enabled browser (Electron, Chrome, remote Chrome)
 */
export class CDPService extends EventEmitter {
  private ws: WebSocket | null = null;
  private connected = false;
  private messageId = 0;
  private pendingRequests: Map<number, {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
  }> = new Map();

  // Browser info
  private browserName = '';
  private browserVersion = '';
  private debugUrl: string | null = null;

  // Data collection
  private requests: Map<string, CDPRequest> = new Map();
  private responses: Map<string, CDPResponse> = new Map();
  private cookies: CDPCookie[] = [];

  // Configuration
  private targetUrl: string = '';
  private allowedDomains: string[] = [];

  constructor() {
    super();
  }

  /**
   * Connect to browser via CDP WebSocket
   */
  async connect(debuggingUrl: string, browserType: 'electron' | 'playwright' = 'electron'): Promise<BrowserInfo> {
    if (this.connected) {
      throw new Error('Already connected to CDP');
    }

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(debuggingUrl);

      this.ws.onopen = async () => {
        this.connected = true;
        this.debugUrl = debuggingUrl;

        // Get browser version
        try {
          const version = await this.sendCommand('Browser.getVersion') as BrowserVersionResponse;
          this.browserName = version.product;
          this.browserVersion = version.version;

          // Enable required domains
          await Promise.all([
            this.sendCommand('Network.enable'),
            this.sendCommand('Page.enable'),
            this.sendCommand('Log.enable'),
            this.sendCommand('Runtime.enable'),
            this.sendCommand('Console.enable'),
          ]);

          // Set up event handlers
          this.setupEventHandlers();

          this.emit('connected');

          resolve({
            type: browserType,
            engine: this.browserName.split('/')[0] || 'Chromium',
            version: this.browserVersion,
            userAgent: '',
          });
        } catch (error) {
          reject(error);
        }
      };

      this.ws.onerror = (_error) => {
        this.emit('error', { error: _error });
        reject(new Error('CDP connection failed'));
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.emit('disconnected');
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Handle responses
      if (message.id && this.pendingRequests.has(message.id)) {
        const { resolve } = this.pendingRequests.get(message.id)!;
        this.pendingRequests.delete(message.id);
        resolve(message.result);
      }

      // Handle errors
      if (message.error) {
        const id = message.id;
        if (this.pendingRequests.has(id)) {
          const { reject } = this.pendingRequests.get(id)!;
          this.pendingRequests.delete(id);
          reject(new Error(message.error.message));
        }
      }

      // Handle notifications
      if (message.method) {
        this.handleNotification(message.method, message.params);
      }
    } catch (error) {
      console.error('Failed to parse CDP message:', error);
    }
  }

  /**
   * Set up CDP event handlers
   */
  private setupEventHandlers(): void {
    // Event handlers are set up via handleNotification
  }

  /**
   * Send CDP command and wait for response
   */
  async sendCommand<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.connected || !this.ws) {
      throw new Error('Not connected to CDP');
    }

    const id = ++this.messageId;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
      });

      this.ws!.send(JSON.stringify({
        id,
        method,
        params,
      }));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`CDP command timeout: ${method}`));
        }
      }, 30000);
    });
  }

  /**
   * Handle CDP notifications
   */
  private handleNotification(method: string, params: unknown): void {
    switch (method) {
      case 'Network.requestWillBeSent':
        this.handleRequestWillBeSent(params as RequestWillBeSentParams);
        break;

      case 'Network.responseReceived':
        this.handleResponseReceived(params as ResponseReceivedParams);
        break;

      case 'Network.loadingFinished':
        this.handleLoadingFinished(params as LoadingFinishedParams);
        break;

      case 'Network.loadingFailed':
        this.handleLoadingFailed(params as LoadingFailedParams);
        break;

      case 'Page.domContentEventFired':
        this.emit('domContentEventFired', params);
        break;

      case 'Page.loadEventFired':
        this.emit('loadEventFired', params);
        break;

      case 'Console.messageAdded':
        this.emit('consoleMessage', (params as ConsoleMessageParams).entry);
        break;

      case 'Log.entryAdded':
        this.emit('logEntry', (params as LogEntryParams).entry);
        break;

      default:
        this.emit(method, params);
    }
  }

  /**
   * Handle Network.requestWillBeSent
   */
  private handleRequestWillBeSent(params: RequestWillBeSentParams): void {
    const request: CDPRequest = {
      id: params.requestId,
      url: params.request.url,
      method: params.request.method,
      headers: params.request.headers,
      timestamp: params.timestamp,
      wallTime: params.wallTime,
      postData: params.request.postData?.bytes,
      type: params.type,
      documentURL: params.documentURL,
    };

    this.requests.set(params.requestId, request);
    this.emit('request', request);

    // Check if allowed
    if (!this.isUrlAllowed(request.url)) {
      this.emit('requestBlocked', { request, reason: 'domain-not-allowed' });
    }
  }

  /**
   * Handle Network.responseReceived
   */
  private handleResponseReceived(params: ResponseReceivedParams): void {
    const response: CDPResponse = {
      id: params.requestId,
      url: params.response.url,
      status: params.response.status,
      statusText: params.response.statusText,
      headers: params.response.headers,
      mimeType: params.response.mimeType,
      requestHeaders: params.response.requestHeaders,
      timestamp: params.timestamp,
      protocol: params.response.protocol,
      remoteIPAddress: params.response.remoteIPAddress,
      remotePort: params.response.remotePort,
    };

    this.responses.set(params.requestId, response);
    this.emit('response', response);
  }

  /**
   * Handle Network.loadingFinished
   */
  private handleLoadingFinished(params: LoadingFinishedParams): void {
    this.emit('loadingFinished', { requestId: params.requestId, timestamp: params.timestamp });
  }

  /**
   * Handle Network.loadingFailed
   */
  private handleLoadingFailed(params: LoadingFailedParams): void {
    this.emit('loadingFailed', {
      requestId: params.requestId,
      errorText: params.errorText,
      canceled: params.canceled,
    });
  }

  /**
   * Check if URL is allowed
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
   * Get response body
   */
  async getResponseBody(requestId: string): Promise<string | null> {
    try {
      const result = await this.sendCommand('Network.getResponseBody', { requestId }) as {
        body: string;
        base64Encoded: boolean;
      };

      return result.base64Encoded
        ? Buffer.from(result.body, 'base64').toString('utf-8')
        : result.body;
    } catch (error) {
      console.error(`Failed to get response body for ${requestId}:`, error);
      return null;
    }
  }

  /**
   * Get request body
   */
  async getRequestBody(requestId: string): Promise<string | null> {
    try {
      const result = await this.sendCommand('Network.getRequestBody', { requestId }) as {
        body: string;
        base64Encoded: boolean;
      };

      return result.base64Encoded
        ? Buffer.from(result.body, 'base64').toString('utf-8')
        : result.body;
    } catch (error) {
      console.error(`Failed to get request body for ${requestId}:`, error);
      return null;
    }
  }

  /**
   * Set request interception
   */
  async setRequestInterception(patterns: RequestPattern[]): Promise<void> {
    await this.sendCommand('Network.setRequestInterception', { patterns } as any);
  }

  /**
   * Continue intercepted request
   */
  async continueRequest(requestId: string, options?: {
    url?: string;
    method?: string;
    postData?: string;
    headers?: Record<string, string>;
  }): Promise<void> {
    await this.sendCommand('Network.continueInterceptedRequest', {
      interceptionId: requestId,
      ...options,
    } as any);
  }

  /**
   * Delete cookies
   */
  async deleteCookies(name: string, url?: string, domain?: string): Promise<void> {
    await this.sendCommand('Network.deleteCookies', { name, url, domain } as any);
  }

  /**
   * Get cookies
   */
  async getCookies(url?: string): Promise<CDPCookie[]> {
    const result = await this.sendCommand('Network.getCookies', { urls: url ? [url] : [] }) as {
      cookies: CDPCookie[];
    };
    this.cookies = result.cookies;
    return this.cookies;
  }

  /**
   * Set cookie
   */
  async setCookie(params: SetCookieParams): Promise<boolean> {
    const result = await this.sendCommand('Network.setCookie', params as any) as { success: boolean };
    return result.success;
  }

  /**
   * Clear cookies
   */
  async clearCookies(url?: string): Promise<void> {
    const cookies = await this.getCookies(url);
    for (const cookie of cookies) {
      await this.deleteCookies(cookie.name, undefined, cookie.domain);
    }
  }

  /**
   * Navigate to URL
   */
  async navigate(url: string): Promise<void> {
    const result = await this.sendCommand('Page.navigate', { url }) as { frameId: string };
    this.targetUrl = url;
    this.emit('navigated', { url, frameId: result.frameId });
  }

  /**
   * Reload page
   */
  async reload(ignoreCache = false): Promise<void> {
    await this.sendCommand('Page.reload', { ignoreCache });
  }

  /**
   * Capture screenshot
   */
  async captureScreenshot(format: 'jpeg' | 'png' = 'png', quality?: number): Promise<string> {
    const result = await this.sendCommand('Page.captureScreenshot', {
      format,
      quality,
    } as any) as { data: string };
    return result.data;
  }

  /**
   * Get page content (HTML)
   */
  async getPageContent(): Promise<string> {
    const result = await this.sendCommand('Page.getContent') as { content: string };
    return result.content;
  }

  /**
   * Get document root
   */
  async getDocumentRoot(): Promise<unknown> {
    return this.sendCommand('DOM.getDocument');
  }

  /**
   * Query selector
   */
  async querySelector(selector: string): Promise<unknown> {
    const doc = await this.getDocumentRoot() as { root?: { nodeId: number } };
    if (!doc.root) throw new Error('No document root');

    const result = await this.sendCommand('DOM.querySelector', {
      nodeId: doc.root.nodeId,
      selector,
    }) as { nodeId: number };
    return result;
  }

  /**
   * Evaluate JavaScript
   */
  async evaluate(expression: string, returnByValue = true): Promise<unknown> {
    const result = await this.sendCommand('Runtime.evaluate', {
      expression,
      returnByValue,
    } as any) as { result: { value: unknown; type: string } };
    return result.result.value;
  }

  /**
   * Get all cookies in standard format
   */
  async captureCookies(): Promise<CookieData[]> {
    const cookies = await this.getCookies();

    return cookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || '/',
      expires: cookie.expires ? new Date(cookie.expires * 1000).toISOString() : undefined,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
    }));
  }

  /**
   * Get browser info
   */
  getBrowserInfo(): BrowserInfo {
    return {
      type: 'electron',
      engine: this.browserName.split('/')[0] || 'Chromium',
      version: this.browserVersion,
      userAgent: '',
    };
  }

  /**
   * Get all captured requests
   */
  getRequests(): CDPRequest[] {
    return Array.from(this.requests.values());
  }

  /**
   * Get all captured responses
   */
  getResponses(): CDPResponse[] {
    return Array.from(this.responses.values());
  }

  /**
   * Clear captured data
   */
  clearData(): void {
    this.requests.clear();
    this.responses.clear();
    this.emit('dataCleared');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Disconnect from CDP
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.pendingRequests.clear();
    this.requests.clear();
    this.responses.clear();
    this.emit('disconnected');
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.disconnect();
    this.removeAllListeners();
  }
}

// CDP Types
interface BrowserVersionResponse {
  product: string;
  version: string;
  userAgent: string;
  jsVersion: string;
}

interface CDPRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  timestamp: number;
  wallTime: number;
  postData?: string;
  type?: string;
  documentURL?: string;
}

interface CDPResponse {
  id: string;
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  mimeType: string;
  requestHeaders?: Record<string, string>;
  timestamp: number;
  protocol?: string;
  remoteIPAddress?: string;
  remotePort?: number;
}

interface CDPCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  size: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string;
  session: boolean;
  priority: string;
  sourceScheme: string;
  sameParty: boolean;
  partitionKey?: string;
}

interface SetCookieParams {
  name: string;
  value: string;
  url?: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  expires?: number;
  priority?: 'Low' | 'Medium' | 'High';
}

interface RequestPattern {
  urlPattern: string;
  resourceType?: string;
  interceptionStage?: 'Request' | 'HeadersReceived';
}

interface RequestWillBeSentParams {
  requestId: string;
  documentURL: string;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    postData?: { bytes: string };
  };
  timestamp: number;
  wallTime: number;
  initiator?: { type: string; stack?: { callFrames: unknown[] } };
  type?: string;
}

interface ResponseReceivedParams {
  requestId: string;
  response: {
    url: string;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    mimeType: string;
    requestHeaders?: Record<string, string>;
    protocol: string;
    remoteIPAddress?: string;
    remotePort?: number;
  };
  type: string;
  timestamp: number;
}

interface LoadingFinishedParams {
  requestId: string;
  timestamp: number;
  encodedDataLength: number;
}

interface LoadingFailedParams {
  requestId: string;
  errorText: string;
  canceled: boolean;
}

interface ConsoleMessageParams {
  entry: {
    level: string;
    text: string;
    timestamp: number;
    source: string;
    category?: string;
  };
}

interface LogEntryParams {
  entry: {
    level: string;
    text: string;
    timestamp: number;
    source: string;
    category?: string;
  };
}

// Export singleton
let cdpServiceInstance: CDPService | null = null;

export function getCDPService(): CDPService {
  if (!cdpServiceInstance) {
    cdpServiceInstance = new CDPService();
  }
  return cdpServiceInstance;
}

export function resetCDPService(): void {
  if (cdpServiceInstance) {
    cdpServiceInstance.dispose();
    cdpServiceInstance = null;
  }
}
