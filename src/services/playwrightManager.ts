import { EventEmitter } from 'events';
import type {
  BrowserInfo,
  ProxyConfig,
  CookieData,
} from '../types';

/**
 * PlaywrightManager - Browser automation with ZAP proxy integration
 *
 * This service provides:
 * - Multi-browser support (Chromium, Firefox, WebKit)
 * - ZAP proxy routing for all traffic
 * - storageState support for authenticated sessions
 * - Network interception and monitoring
 * - Headless/headed mode toggle
 *
 * Note: This is a wrapper that would be used in the renderer process
 * with actual Playwright library
 */
export class PlaywrightManager extends EventEmitter {
  private browser: unknown = null;
  private context: unknown = null;
  private page: unknown = null;
  private connected = false;
  private browserType: 'chromium' | 'firefox' | 'webkit' = 'chromium';
  private headless = true;

  // Proxy configuration
  private proxyConfig: ProxyConfig | null = null;
  private proxyServer = 'http://localhost:8080';

  // Data collection
  private requests: Map<string, PlaywrightRequest> = new Map();
  private responses: Map<string, PlaywrightResponse> = new Map();

  // Configuration
  private allowedDomains: string[] = [];

  constructor() {
    super();
  }

  /**
   * Initialize Playwright with given browser type
   */
  async initialize(browserType: 'chromium' | 'firefox' | 'webkit' = 'chromium'): Promise<void> {
    this.browserType = browserType;
    this.emit('initialized', { browserType });
  }

  /**
   * Launch browser with proxy configuration
   */
  async launch(options?: {
    headless?: boolean;
    proxyConfig?: ProxyConfig;
    browserPath?: string;
  }): Promise<void> {
    this.headless = options?.headless ?? true;
    this.proxyConfig = options?.proxyConfig || null;

    if (this.proxyConfig) {
      this.proxyServer = `http://${this.proxyConfig.host}:${this.proxyConfig.port}`;
    }

    // In a real implementation, this would use:
    // const { chromium, firefox, webkit } = require('playwright');
    // const browserType = browserType === 'chromium' ? chromium : browserType === 'firefox' ? firefox : webkit;

    this.emit('launching', { browserType: this.browserType, headless: this.headless });

    // Placeholder for actual browser launch
    // this.browser = await browserType.launch({
    //   headless: this.headless,
    //   args: ['--proxy-server=' + this.proxyServer]
    // });

    this.connected = true;
    this.emit('launched');
  }

  /**
   * Create a new browser context with proxy settings
   */
  async createContext(options?: {
    storageState?: string | { cookies: unknown[]; origins: unknown[] };
    viewport?: { width: number; height: number };
    userAgent?: string;
    ignoreHTTPSErrors?: boolean;
  }): Promise<void> {
    if (!this.browser) {
      throw new Error('Browser not launched');
    }

    // In a real implementation:
    // this.context = await this.browser.newContext({
    //   viewport: options?.viewport || { width: 1280, height: 720 },
    //   userAgent: options?.userAgent,
    //   ignoreHTTPSErrors: options?.ignoreHTTPSErrors ?? true,
    //   storageState: options?.storageState,
    //   proxy: this.proxyConfig ? {
    //     server: this.proxyServer,
    //     bypass: this.proxyConfig.bypassRules
    //   } : undefined
    // });

    this.emit('contextCreated', options);
  }

  /**
   * Create a new page in the current context
   */
  async createPage(): Promise<void> {
    if (!this.context) {
      throw new Error('Browser context not created');
    }

    // In a real implementation:
    // this.page = await this.context.newPage();

    // Set up request/response handlers
    // this.page.on('request', (request) => this.handleRequest(request));
    // this.page.on('response', (response) => this.handleResponse(response));
    // this.page.on('requestfailed', (request) => this.handleRequestFailed(request));

    this.emit('pageCreated');
  }

  /**
   * Navigate to URL
   */
  async navigate(url: string): Promise<void> {
    if (!this.page) {
      throw new Error('Page not created');
    }

    // In a real implementation:
    // await this.page.goto(url, { waitUntil: 'networkidle' });

    this.emit('navigated', { url });
  }

  /**
   * Navigate to URL and wait for load
   */
  async navigateAndWait(url: string, options?: {
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
    timeout?: number;
  }): Promise<void> {
    if (!this.page) {
      throw new Error('Page not created');
    }

    // In a real implementation:
    // await this.page.goto(url, {
    //   waitUntil: options?.waitUntil || 'networkidle',
    //   timeout: options?.timeout || 30000
    // });

    this.emit('navigated', { url });
  }

  /**
   * Click on element
   */
  async click(selector: string, options?: {
    button?: 'left' | 'right' | 'middle';
    clickCount?: number;
    delay?: number;
    timeout?: number;
  }): Promise<void> {
    if (!this.page) {
      throw new Error('Page not created');
    }

    // await this.page.click(selector, options);
  }

  /**
   * Fill form input
   */
  async fill(selector: string, value: string): Promise<void> {
    if (!this.page) {
      throw new Error('Page not created');
    }

    // await this.page.fill(selector, value);
  }

  /**
   * Press keys
   */
  async press(selector: string, key: string, options?: {
    delay?: number;
  }): Promise<void> {
    if (!this.page) {
      throw new Error('Page not created');
    }

    // await this.page.press(selector, key, options);
  }

  /**
   * Wait for selector
   */
  async waitForSelector(selector: string, options?: {
    state?: 'attached' | 'detached' | 'visible' | 'hidden';
    timeout?: number;
  }): Promise<void> {
    if (!this.page) {
      throw new Error('Page not created');
    }

    // await this.page.waitForSelector(selector, options);
  }

  /**
   * Wait for navigation
   */
  async waitForNavigation(options?: {
    timeout?: number;
  }): Promise<void> {
    if (!this.page) {
      throw new Error('Page not created');
    }

    // await this.page.waitForNavigation(options);
  }

  /**
   * Wait for network idle
   */
  async waitForNetworkIdle(options?: {
    idleTime?: number;
    timeout?: number;
  }): Promise<void> {
    if (!this.page) {
      throw new Error('Page not created');
    }

    // await this.page.waitForLoadState('networkidle');
  }

  /**
   * Evaluate JavaScript
   */
  async evaluate<T = unknown>(expression: string): Promise<T> {
    if (!this.page) {
      throw new Error('Page not created');
    }

    // const result = await this.page.evaluate(expression);
    // return result as T;
    return {} as T;
  }

  /**
   * Get page content (HTML)
   */
  async getPageContent(): Promise<string> {
    if (!this.page) {
      throw new Error('Page not created');
    }

    // return await this.page.content();
    return '';
  }

  /**
   * Get page title
   */
  async getPageTitle(): Promise<string> {
    if (!this.page) {
      throw new Error('Page not created');
    }

    // return await this.page.title();
    return '';
  }

  /**
   * Get current URL
   */
  async getCurrentUrl(): Promise<string> {
    if (!this.page) {
      throw new Error('Page not created');
    }

    // return this.page.url();
    return '';
  }

  /**
   * Take screenshot
   */
  async takeScreenshot(options?: {
    path?: string;
    fullPage?: boolean;
    clip?: { x: number; y: number; width: number; height: number };
  }): Promise<Buffer> {
    if (!this.page) {
      throw new Error('Page not created');
    }

    // const screenshot = await this.page.screenshot(options);
    // return Buffer.from(screenshot);
    return Buffer.from('');
  }

  /**
   * Set viewport size
   */
  async setViewport(size: { width: number; height: number }): Promise<void> {
    if (!this.page) {
      throw new Error('Page not created');
    }

    // await this.page.setViewportSize(size);
  }

  /**
   * Add cookies
   */
  async addCookies(cookies: CookieData[]): Promise<void> {
    if (!this.context) {
      throw new Error('Context not created');
    }

    // await this.context.addCookies(cookies.map(cookie => ({
    //   name: cookie.name,
    //   value: cookie.value,
    //   domain: cookie.domain,
    //   path: cookie.path || '/',
    //   expires: cookie.expires ? new Date(cookie.expires).getTime() / 1000 : undefined,
    //   httpOnly: cookie.httpOnly,
    //   secure: cookie.secure,
    //   sameSite: cookie.sameSite
    // })));
  }

  /**
   * Get cookies
   */
  async getCookies(): Promise<CookieData[]> {
    if (!this.context) {
      throw new Error('Context not created');
    }

    // const cookies = await this.context.cookies();
    // return cookies.map(cookie => ({
    //   name: cookie.name,
    //   value: cookie.value,
    //   domain: cookie.domain,
    //   path: cookie.path || '/',
    //   expires: cookie.expires ? new Date(cookie.expires * 1000).toISOString() : undefined,
    //   httpOnly: cookie.httpOnly,
    //   secure: cookie.secure,
    //   sameSite: cookie.sameSite
    // }));
    return [];
  }

  /**
   * Clear cookies
   */
  async clearCookies(): Promise<void> {
    if (!this.context) {
      throw new Error('Context not created');
    }

    // await this.context.clearCookies();
  }

  /**
   * Save storage state (cookies + localStorage)
   */
  async saveStorageState(): Promise<{ cookies: unknown[]; origins: unknown[] }> {
    if (!this.context) {
      throw new Error('Context not created');
    }

    // return await this.context.storageState();
    return { cookies: [], origins: [] };
  }

  /**
   * Restore storage state
   */
  async restoreStorageState(state: string | { cookies: unknown[]; origins: unknown[] }): Promise<void> {
    if (!this.context) {
      throw new Error('Context not created');
    }

    // await this.context.storageState({ storageState: state });
  }

  /**
   * Handle request (internal)
   */
  private handleRequest(request: unknown): void {
    // In real implementation:
    // const req: PlaywrightRequest = {
    //   id: request.url(),
    //   url: request.url(),
    //   method: request.method(),
    //   headers: request.headers(),
    //   timestamp: Date.now(),
    // };
    // this.requests.set(req.id, req);
    // this.emit('request', req);
  }

  /**
   * Handle response (internal)
   */
  private handleResponse(response: unknown): void {
    // In real implementation:
    // const res: PlaywrightResponse = {
    //   id: response.url(),
    //   url: response.url(),
    //   status: response.status(),
    //   headers: response.headers(),
    //   timestamp: Date.now(),
    // };
    // this.responses.set(res.id, res);
    // this.emit('response', res);
  }

  /**
   * Get all captured requests
   */
  getRequests(): PlaywrightRequest[] {
    return Array.from(this.requests.values());
  }

  /**
   * Get all captured responses
   */
  getResponses(): PlaywrightResponse[] {
    return Array.from(this.responses.values());
  }

  /**
   * Clear captured data
   */
  clearCapturedData(): void {
    this.requests.clear();
    this.responses.clear();
    this.emit('dataCleared');
  }

  /**
   * Get browser information
   */
  getBrowserInfo(): BrowserInfo {
    return {
      type: 'playwright',
      engine: this.browserType,
      version: '1.50+',
      userAgent: '',
    };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Close browser and cleanup
   */
  async close(): Promise<void> {
    if (this.page) {
      // await this.page.close();
      this.page = null;
    }

    if (this.context) {
      // await this.context.close();
      this.context = null;
    }

    if (this.browser) {
      // await this.browser.close();
      this.browser = null;
    }

    this.connected = false;
    this.requests.clear();
    this.responses.clear();

    this.emit('closed');
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.removeAllListeners();
    this.close();
  }
}

// Types for Playwright
interface PlaywrightRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  timestamp: number;
  postData?: string;
  resourceType?: string;
}

interface PlaywrightResponse {
  id: string;
  url: string;
  status: number;
  statusText?: string;
  headers: Record<string, string>;
  timestamp: number;
  body?: string;
}

// Export singleton
let playwrightManagerInstance: PlaywrightManager | null = null;

export function getPlaywrightManager(): PlaywrightManager {
  if (!playwrightManagerInstance) {
    playwrightManagerInstance = new PlaywrightManager();
  }
  return playwrightManagerInstance;
}

export function resetPlaywrightManager(): void {
  if (playwrightManagerInstance) {
    playwrightManagerInstance.dispose();
    playwrightManagerInstance = null;
  }
}
