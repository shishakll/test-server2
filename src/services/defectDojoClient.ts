import { EventEmitter } from 'events';
import type { Vulnerability } from '../types';
import { generateId } from '../utils';

/**
 * DefectDojoClient - Vulnerability management platform integration
 *
 * This service provides:
 * - DefectDojo API integration
 * - Import findings to DefectDojo
 * - Generate reports from DefectDojo
 * - Product/Engagement management
 */
export class DefectDojoClient extends EventEmitter {
  private baseUrl: string = '';
  private apiKey: string = '';
  private isConnected = false;

  constructor() {
    super();
  }

  /**
   * Initialize DefectDojo client
   */
  async initialize(config: {
    baseUrl: string;
    apiKey: string;
  }): Promise<void> {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey;

    // Verify connection
    const isValid = await this.verifyConnection();
    if (!isValid) {
      throw new Error('Failed to connect to DefectDojo');
    }

    this.isConnected = true;
    this.emit('initialized', { baseUrl: this.baseUrl });
  }

  /**
   * Verify DefectDojo connection
   */
  private async verifyConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v2/`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get headers for API requests
   */
  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Token ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Make API request to DefectDojo
   */
  private async apiRequest<T>(
    endpoint: string,
    options?: {
      method?: string;
      body?: unknown;
      params?: Record<string, string>;
    }
  ): Promise<T | null> {
    const url = new URL(`${this.baseUrl}/api/v2${endpoint}`);

    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      method: options?.method || 'GET',
      headers: this.getHeaders(),
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DefectDojo API error: ${response.status} - ${error}`);
    }

    // Some endpoints return empty response
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  /**
   * List products
   */
  async listProducts(options?: {
    limit?: number;
    offset?: number;
    name?: string;
  }): Promise<DefectDojoProduct[]> {
    const result = await this.apiRequest<{ results: DefectDojoProduct[] }>('/products/', {
      params: {
        limit: (options?.limit || 100).toString(),
        offset: (options?.offset || 0).toString(),
        ...(options?.name ? { name: options.name } : {}),
      },
    });

    return result?.results || [];
  }

  /**
   * Get product by ID
   */
  async getProduct(productId: number): Promise<DefectDojoProduct> {
    const result = await this.apiRequest<DefectDojoProduct>(`/products/${productId}/`);
    if (!result) throw new Error('Product not found');
    return result;
  }

  /**
   * Create product
   */
  async createProduct(product: {
    name: string;
    description?: string;
    prod_type?: number;
    team?: number;
    prod_numeric?: number;
    source_code_management_uri?: string;
    is_public?: boolean;
    enable_full_risk_accepted?: boolean;
    external_audience?: boolean;
    internet_accessible?: boolean;
  }): Promise<DefectDojoProduct> {
    const result = await this.apiRequest<DefectDojoProduct>('/products/', {
      method: 'POST',
      body: product,
    });
    if (!result) throw new Error('Failed to create product');
    return result;
  }

  /**
   * List engagements for a product
   */
  async listEngagements(productId: number, options?: {
    limit?: number;
    offset?: number;
    active?: boolean;
  }): Promise<DefectDojoEngagement[]> {
    const result = await this.apiRequest<{ results: DefectDojoEngagement[] }>(
      `/products/${productId}/engagements/`,
      {
        params: {
          limit: (options?.limit || 100).toString(),
          offset: (options?.offset || 0).toString(),
          ...(options?.active !== undefined ? { active: options.active.toString() } : {}),
        },
      }
    );

    return result?.results || [];
  }

  /**
   * Create engagement
   */
  async createEngagement(engagement: {
    name: string;
    product: number;
    target_start: string;
    target_end: string;
    status?: string;
    engagement_type?: string;
    description?: string;
    version?: string;
    branch_tag?: string;
    build_id?: string;
    commit_hash?: string;
    build_server?: string;
    source_code_management_server?: string;
    threat_model?: boolean;
    api_test?: boolean;
    pen_test?: boolean;
    check?: boolean;
  }): Promise<DefectDojoEngagement> {
    const result = await this.apiRequest<DefectDojoEngagement>('/engagements/', {
      method: 'POST',
      body: engagement,
    });
    if (!result) throw new Error('Failed to create engagement');
    return result;
  }

  /**
   * Import scan results
   */
  async importScan(params: {
    engagement: number;
    scan_type: string;
    file?: string;
    url?: string;
    branch_tag?: string;
    commit_hash?: string;
    build_id?: string;
    version?: string;
    engagement_name?: string;
    auto_create_context?: boolean;
    deduplication_on_engagement?: boolean;
    lead?: number;
    tags?: string[];
    close_old_findings?: boolean;
    push_to_jira?: boolean;
  }): Promise<DefectDojoImportResult> {
    // Note: File upload requires multipart/form-data
    // This is a simplified version using the API

    const result = await this.apiRequest<DefectDojoImportResult>('/import-scan/', {
      method: 'POST',
      body: params,
    });
    if (!result) throw new Error('Failed to import scan');
    return result;
  }

  /**
   * Upload scan file
   */
  async uploadScanFile(
    engagementId: number,
    scanType: string,
    file: {
      name: string;
      content: Buffer;
    },
    options?: {
      branch_tag?: string;
      commit_hash?: string;
      build_id?: string;
      version?: string;
      close_old_findings?: boolean;
      push_to_jira?: boolean;
    }
  ): Promise<DefectDojoImportResult> {
    // Create form data
    const formData = new FormData();
    formData.append('engagement', engagementId.toString());
    formData.append('scan_type', scanType);
    // Convert Buffer to Uint8Array for Blob
    const uint8Array = new Uint8Array(file.content);
    formData.append('file', new Blob([uint8Array]), file.name);

    if (options?.branch_tag) formData.append('branch_tag', options.branch_tag);
    if (options?.commit_hash) formData.append('commit_hash', options.commit_hash);
    if (options?.build_id) formData.append('build_id', options.build_id);
    if (options?.version) formData.append('version', options.version);
    if (options?.close_old_findings !== undefined) {
      formData.append('close_old_findings', options.close_old_findings.toString());
    }
    if (options?.push_to_jira !== undefined) {
      formData.append('push_to_jira', options.push_to_jira.toString());
    }

    const response = await fetch(`${this.baseUrl}/api/v2/import-scan/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DefectDojo import error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * List findings
   */
  async listFindings(options?: {
    product?: number;
    engagement?: number;
    severity?: string;
    active?: boolean;
    verified?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<DefectDojoFinding[]> {
    const result = await this.apiRequest<{ results: DefectDojoFinding[] }>('/findings/', {
      params: {
        limit: (options?.limit || 100).toString(),
        offset: (options?.offset || 0).toString(),
        ...(options?.product ? { product: options.product.toString() } : {}),
        ...(options?.engagement ? { engagement: options.engagement.toString() } : {}),
        ...(options?.severity ? { severity: options.severity } : {}),
        ...(options?.active !== undefined ? { is_active: options.active.toString() } : {}),
        ...(options?.verified !== undefined ? { is_verified: options.verified.toString() } : {}),
      },
    });

    return result?.results || [];
  }

  /**
   * Get finding by ID
   */
  async getFinding(findingId: number): Promise<DefectDojoFinding> {
    const result = await this.apiRequest<DefectDojoFinding>(`/findings/${findingId}/`);
    if (!result) throw new Error('Finding not found');
    return result;
  }

  /**
   * Create finding
   */
  async createFinding(finding: {
    title: string;
    description: string;
    severity: string;
    vulnerability_id?: string;
    date?: string;
    cwe?: number;
    cvss?: string;
    cvss3?: string;
    url?: string;
    product?: number;
    engagement?: number;
    static_finding?: boolean;
    dynamic_finding?: boolean;
    verified?: boolean;
    false_p?: boolean;
    duplicate?: boolean;
    out_of_scope?: boolean;
    risk_accepted?: boolean;
    mitigated?: string;
    mitigated_by?: number;
    component_name?: string;
    component_version?: string;
    found_by?: number[];
    tags?: string[];
  }): Promise<DefectDojoFinding> {
    const result = await this.apiRequest<DefectDojoFinding>('/findings/', {
      method: 'POST',
      body: finding,
    });
    if (!result) throw new Error('Failed to create finding');
    return result;
  }

  /**
   * Update finding
   */
  async updateFinding(findingId: number, finding: Partial<{
    title: string;
    description: string;
    severity: string;
    active: boolean;
    verified: boolean;
    false_p: boolean;
    duplicate: boolean;
    out_of_scope: boolean;
    risk_accepted: boolean;
    mitigated: string;
    mitigated_by: number;
    tags: string[];
  }>): Promise<DefectDojoFinding> {
    const result = await this.apiRequest<DefectDojoFinding>(`/findings/${findingId}/`, {
      method: 'PATCH',
      body: finding,
    });
    if (!result) throw new Error('Failed to update finding');
    return result;
  }

  /**
   * Close finding
   */
  async closeFinding(
    findingId: number,
    mitigated: string,
    mitigatedBy?: number,
    message?: string
  ): Promise<DefectDojoFinding> {
    return this.updateFinding(findingId, {
      active: false,
      verified: true,
      mitigated,
      mitigated_by: mitigatedBy,
    });
  }

  /**
   * Reopen finding
   */
  async reopenFinding(findingId: number): Promise<DefectDojoFinding> {
    return this.updateFinding(findingId, {
      active: true,
      false_p: false,
      risk_accepted: false,
      out_of_scope: false,
    });
  }

  /**
   * Upload vulnerabilities to DefectDojo
   */
  async uploadVulnerabilities(
    engagementId: number,
    vulnerabilities: Vulnerability[]
  ): Promise<DefectDojoImportResult> {
    // Convert vulnerabilities to SARIF or similar format
    // This is a simplified version - in practice you'd want to use proper scan types
    const finding = await this.createFinding({
      title: vulnerabilities[0]?.name || 'Security Scan Results',
      description: this.formatVulnerabilitiesForDefectDojo(vulnerabilities),
      severity: this.mapSeverityToDefectDojo(vulnerabilities[0]?.severity || 'medium'),
      engagement: engagementId,
      dynamic_finding: true,
    });

    return {
      success: true,
      finding: finding.id,
      count: vulnerabilities.length,
    };
  }

  /**
   * Format vulnerabilities for DefectDojo description
   */
  private formatVulnerabilitiesForDefectDojo(vulnerabilities: Vulnerability[]): string {
    return vulnerabilities.map(v =>
      `## ${v.name} (${v.severity.toUpperCase()})\n` +
      `**Source:** ${v.source}\n` +
      `**URL:** ${v.url || 'N/A'}\n` +
      `**CWE:** ${v.cwe || 'N/A'}\n\n` +
      `${v.description}\n\n` +
      `**Evidence:** ${v.evidence || 'N/A'}\n\n` +
      `---`
    ).join('\n');
  }

  /**
   * Map severity to DefectDojo format
   */
  private mapSeverityToDefectDojo(severity: string): string {
    const map: Record<string, string> = {
      critical: 'Critical',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
      informational: 'Info',
    };
    return map[severity.toLowerCase()] || 'Medium';
  }

  /**
   * Generate report
   */
  async generateReport(options: {
    engagement?: number;
    product?: number;
    template?: string;
    reportType?: string;
  }): Promise<Blob> {
    const params = new URLSearchParams();

    if (options.engagement) params.append('engagement', options.engagement.toString());
    if (options.product) params.append('product', options.product.toString());

    const response = await fetch(
      `${this.baseUrl}/api/v2/reports/?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Accept': 'application/pdf',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to generate report: ${response.statusText}`);
    }

    return response.blob();
  }

  /**
   * Get metrics
   */
  async getMetrics(options?: {
    product?: number;
    engagement?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<DefectDojoMetrics> {
    const params: Record<string, string> = {};

    if (options?.product) params.product = options.product.toString();
    if (options?.engagement) params.engagement = options.engagement.toString();
    if (options?.start_date) params.start_date = options.start_date;
    if (options?.end_date) params.end_date = options.end_date;

    const result = await this.apiRequest<DefectDojoMetrics>('/metrics/', { params });
    if (!result) throw new Error('Failed to get metrics');
    return result;
  }

  /**
   * Check connection status
   */
  isConnectedToDefectDojo(): boolean {
    return this.isConnected;
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.isConnected = false;
    this.removeAllListeners();
  }
}

// Types for DefectDojo
interface DefectDojoProduct {
  id: number;
  name: string;
  description: string;
  prod_type: number;
  prod_numeric: number;
  team: number;
  manager: number;
  tech_contact: number;
  updated: string;
  created: string;
  is_public: boolean;
  external_audience: boolean;
  internet_accessible: boolean;
  enable_full_risk_accepted: boolean;
  prod_meta: Array<{ name: string; value: string }>;
}

interface DefectDojoEngagement {
  id: number;
  name: string;
  product: number;
  target_start: string;
  target_end: string;
  status: string;
  engagement_type: string;
  progress: string;
  description: string;
  version: string;
  branch_tag: string;
  build_id: string;
  commit_hash: string;
  lead: number;
  number_of_findings: number;
  active: boolean;
  notifier: boolean;
  tags: string[];
  threat_model: boolean;
  api_test: boolean;
  pen_test: boolean;
  check: boolean;
}

interface DefectDojoFinding {
  id: number;
  title: string;
  description: string;
  severity: string;
  vulnerability_id: string;
  date: string;
  cwe: number;
  cvss: string;
  cvss3: string;
  url: string;
  product: number;
  engagement: number;
  static_finding: boolean;
  dynamic_finding: boolean;
  verified: boolean;
  false_p: boolean;
  duplicate: boolean;
  out_of_scope: boolean;
  risk_accepted: boolean;
  mitigated: string;
  mitigated_by: number;
  component_name: string;
  component_version: string;
  found_by: number[];
  tags: string[];
  active: boolean;
  created: string;
  modified: string;
}

interface DefectDojoImportResult {
  success: boolean;
  finding: number;
  count: number;
  message?: string;
}

interface DefectDojoMetrics {
  all: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  };
  opened: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  };
  closed: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  };
}

// Export singleton
let defectDojoClientInstance: DefectDojoClient | null = null;

export function getDefectDojoClient(): DefectDojoClient {
  if (!defectDojoClientInstance) {
    defectDojoClientInstance = new DefectDojoClient();
  }
  return defectDojoClientInstance;
}

export function resetDefectDojoClient(): void {
  if (defectDojoClientInstance) {
    defectDojoClientInstance.dispose();
    defectDojoClientInstance = null;
  }
}
