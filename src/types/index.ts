// Scan Configuration Types
export interface ScanConfig {
  id: string;
  targetUrl?: string;
  targetHosts?: string[];
  scanType: ScanType;
  authMode: 'none' | 'manual' | 'session';
  sessionId?: string;
  browserEngine: 'electron' | 'playwright';
  playwrightBrowser?: 'chromium' | 'firefox' | 'webkit';
  scanOptions?: {
    passiveOnly: boolean;
    activeScan: boolean;
    ajaxSpider: boolean;
    nucleiTemplates: string[];
    nucleiAuth?: Record<string, string>;
    assetDiscovery: boolean;
    subdomainEnum: boolean;
  };
  zapOptions?: {
    context: string;
    policy: string;
    customRules?: string[];
  };
  browser?: string[];
  securityTools?: string[];
  assetDiscovery?: boolean;
  ai?: { enabled: boolean; provider?: string; model?: string };
}

export type ScanType = 'quick' | 'standard' | 'deep' | 'custom';

// Scan State Types
export type ScanPhase =
  | 'idle'
  | 'browser_init'
  | 'proxy_start'
  | 'navigating'
  | 'spider'
  | 'ajax_spider'
  | 'active_scan'
  | 'nuclei_scan'
  | 'asset_discovery'
  | 'reporting'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export interface ScanState {
  scanId: string;
  status: ScanPhase;
  progress: number;
  currentUrl: string;
  urlsDiscovered: number;
  alertsFound: number;
  nucleiFindings: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  errors: ScanError[];
}

export interface ScanError {
  code: string;
  message: string;
  phase: ScanPhase;
  recoverable: boolean;
  suggestion?: string;
  details?: Record<string, unknown>;
}

export interface ScanProgress {
  scanId: string;
  phase: ScanPhase;
  progress: number;
  message: string;
  timestamp: Date;
}

// Vulnerability Types
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'informational';

export interface Vulnerability {
  id: string;
  source: 'zap' | 'nuclei' | 'trivy' | 'manual';
  templateId?: string;
  name: string;
  description: string;
  severity: Severity;
  confidence: 'high' | 'medium' | 'low';
  url: string;
  method: string;
  param?: string;
  evidence?: string;
  timestamp: Date;
  cwe?: string;
  cvss?: string;
  remediation?: string;
}

export interface VulnerabilitySummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  informational: number;
  total: number;
}

// Session Types
export interface SessionData {
  id: string;
  name: string;
  createdAt: Date;
  cookies: CookieData[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
}

export interface CookieData {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: string;
}

// Configuration Types
export interface AppSettings {
  zap: {
    port: number;
    proxyPort: number;
    enabled: boolean;
    homeDirectory: string;
  };
  nuclei: {
    templatesPath: string;
    rateLimit: number;
    concurrency: number;
  };
  playwright: {
    browserPath?: string;
    headless: boolean;
  };
  defectDojo: {
    url?: string;
    apiKey?: string;
    productId?: number;
    engagementId?: number;
  };
  general: {
    dataDirectory: string;
    reportsDirectory: string;
    autoUpdate: boolean;
    telemetry: boolean;
  };
}

// Browser Types
export interface BrowserInfo {
  type: 'electron' | 'playwright';
  engine: string;
  version: string;
  userAgent: string;
}

export interface ProxyConfig {
  enabled: boolean;
  host: string;
  port: number;
  username?: string;
  password?: string;
  bypassRules?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

// Event Types
export interface ScanEvent {
  type: 'started' | 'progress' | 'completed' | 'failed' | 'cancelled';
  scanId: string;
  data: ScanProgress | ScanError | Vulnerability[];
  timestamp: Date;
}

// Report Types
export interface ReportData {
  scanId: string;
  targetUrl: string;
  scanType: ScanType;
  duration: number;
  summary: VulnerabilitySummary;
  vulnerabilities: Vulnerability[];
  metadata: {
    toolVersion: string;
    scannerVersion: string;
    zapVersion?: string;
    nucleiVersion?: string;
    browserInfo: BrowserInfo;
  };
}
