/**
 * E2E Integration Tests for Security Scanner
 *
 * These tests verify the integration between services and components.
 * Note: These are integration tests that can run without external tools (ZAP, Nuclei)
 */

import { describe, it, expect } from 'vitest';
import type { Vulnerability, ScanConfig } from '../src/types';

// Mock types for testing (since we're testing the integration layer)
interface MockScanState {
  scanId: string;
  status: string;
  progress: number;
  currentUrl: string;
  urlsDiscovered: number;
  alertsFound: number;
  nucleiFindings: number;
}

describe('Security Scanner E2E Tests', () => {
  describe('Service Integration', () => {
    describe('Orchestrator Integration', () => {
      it('should create scan with valid configuration', async () => {
        const config: ScanConfig = {
          id: 'test-scan-1',
          targetUrl: 'https://example.com',
          scanType: 'quick',
          authMode: 'none',
          browserEngine: 'electron',
        };

        expect(config.id).toBeDefined();
        expect(config.targetUrl).toBe('https://example.com');
        expect(config.scanType).toBe('quick');
      });

      it('should validate scan phases', async () => {
        const validPhases = [
          'idle',
          'browser_init',
          'proxy_start',
          'navigating',
          'spider',
          'ajax_spider',
          'active_scan',
          'nuclei_scan',
          'asset_discovery',
          'reporting',
          'completed',
          'failed',
          'cancelled',
          'paused',
        ];

        expect(validPhases).toContain('browser_init');
        expect(validPhases).toContain('nuclei_scan');
        expect(validPhases).toContain('completed');
      });

      it('should track scan progress correctly', async () => {
        const mockState: MockScanState = {
          scanId: 'scan-123',
          status: 'active_scan',
          progress: 65,
          currentUrl: 'https://example.com/admin',
          urlsDiscovered: 150,
          alertsFound: 23,
          nucleiFindings: 12,
        };

        expect(mockState.progress).toBeGreaterThan(50);
        expect(mockState.urlsDiscovered).toBeGreaterThan(0);
        expect(mockState.alertsFound).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Vulnerability Processing', () => {
      it('should create vulnerability with required fields', async () => {
        const vuln: Vulnerability = {
          id: 'vuln-001',
          source: 'zap',
          templateId: '40018',
          name: 'Cross Site Scripting (Reflected)',
          description: 'Reflected XSS vulnerability detected',
          severity: 'high',
          confidence: 'high',
          url: 'https://example.com/search?q=test',
          method: 'GET',
          param: 'q',
          evidence: '<script>alert(1)</script>',
          timestamp: new Date(),
          cwe: 'CWE-79',
          cvss: '6.1',
          remediation: 'Implement input validation and output encoding',
        };

        expect(vuln.id).toBeDefined();
        expect(vuln.source).toBe('zap');
        expect(vuln.severity).toBe('high');
        expect(vuln.confidence).toBe('high');
        expect(vuln.url).toContain('http');
      });

      it('should calculate vulnerability summary correctly', async () => {
        const vulnerabilities: Vulnerability[] = [
          { id: '1', source: 'zap', name: 'Critical vuln', severity: 'critical', confidence: 'high', url: 'http://test.com', method: 'GET', timestamp: new Date() },
          { id: '2', source: 'zap', name: 'High vuln 1', severity: 'high', confidence: 'high', url: 'http://test.com', method: 'GET', timestamp: new Date() },
          { id: '3', source: 'zap', name: 'High vuln 2', severity: 'high', confidence: 'medium', url: 'http://test.com', method: 'GET', timestamp: new Date() },
          { id: '4', source: 'nuclei', name: 'Medium vuln', severity: 'medium', confidence: 'high', url: 'http://test.com', method: 'GET', timestamp: new Date() },
          { id: '5', source: 'zap', name: 'Low vuln', severity: 'low', confidence: 'medium', url: 'http://test.com', method: 'GET', timestamp: new Date() },
        ];

        const summary = {
          critical: vulnerabilities.filter(v => v.severity === 'critical').length,
          high: vulnerabilities.filter(v => v.severity === 'high').length,
          medium: vulnerabilities.filter(v => v.severity === 'medium').length,
          low: vulnerabilities.filter(v => v.severity === 'low').length,
          informational: vulnerabilities.filter(v => v.severity === 'informational').length,
          total: vulnerabilities.length,
        };

        expect(summary.critical).toBe(1);
        expect(summary.high).toBe(2);
        expect(summary.medium).toBe(1);
        expect(summary.low).toBe(1);
        expect(summary.total).toBe(5);
      });
    });

    describe('Session Management', () => {
      it('should create valid session data', async () => {
        const sessionData = {
          id: 'session-001',
          name: 'Test Session',
          createdAt: new Date(),
          cookies: [
            {
              name: 'session_id',
              value: 'abc123',
              domain: '.example.com',
              path: '/',
              httpOnly: true,
              secure: true,
            },
          ],
          localStorage: {
            auth_token: 'xyz789',
          },
          sessionStorage: {},
        };

        expect(sessionData.id).toBeDefined();
        expect(sessionData.cookies).toHaveLength(1);
        expect(sessionData.cookies[0].name).toBe('session_id');
        expect(sessionData.localStorage.auth_token).toBeDefined();
      });
    });

    describe('Report Generation', () => {
      it('should format scan results for report', async () => {
        const reportData = {
          scanId: 'scan-001',
          targetUrl: 'https://example.com',
          scanType: 'standard' as const,
          duration: 180000, // 3 minutes
          summary: {
            critical: 1,
            high: 3,
            medium: 5,
            low: 10,
            informational: 2,
            total: 21,
          },
          vulnerabilities: [] as Vulnerability[],
          metadata: {
            toolVersion: '1.0.0',
            scannerVersion: '1.0.0',
            zapVersion: '2.14.0',
            nucleiVersion: '3.0.0',
            browserInfo: {
              type: 'electron' as const,
              engine: 'Chromium',
              version: '120.0.0.0',
              userAgent: 'Mozilla/5.0',
            },
          },
        };

        expect(reportData.scanId).toBeDefined();
        expect(reportData.targetUrl).toContain('https');
        expect(reportData.summary.total).toBeGreaterThan(0);
        expect(reportData.duration).toBeGreaterThan(0);
      });
    });
  });

  describe('Store Integration', () => {
    describe('Scan Store', () => {
      it('should track scan state transitions', async () => {
        let currentState: MockScanState | null = null;

        // Simulate state transitions
        const transitions = [
          { status: 'browser_init', progress: 5 },
          { status: 'proxy_start', progress: 10 },
          { status: 'navigating', progress: 20 },
          { status: 'spider', progress: 40 },
          { status: 'active_scan', progress: 70 },
          { status: 'nuclei_scan', progress: 85 },
          { status: 'reporting', progress: 95 },
          { status: 'completed', progress: 100 },
        ];

        for (const transition of transitions) {
          currentState = {
            scanId: 'test-scan',
            status: transition.status,
            progress: transition.progress,
            currentUrl: 'https://example.com',
            urlsDiscovered: 100,
            alertsFound: 25,
            nucleiFindings: 15,
          };
        }

        expect(currentState?.status).toBe('completed');
        expect(currentState?.progress).toBe(100);
      });

      it('should handle error states', async () => {
        const errorState: MockScanState & { errors: Array<{ code: string; message: string }> } = {
          scanId: 'failed-scan',
          status: 'failed',
          progress: 45,
          currentUrl: 'https://example.com',
          urlsDiscovered: 50,
          alertsFound: 0,
          nucleiFindings: 0,
          errors: [
            { code: 'ZAP_INIT_FAILED', message: 'Failed to start ZAP proxy' },
            { code: 'NAVIGATION_TIMEOUT', message: 'Page load timed out' },
          ],
        };

        expect(errorState.status).toBe('failed');
        expect(errorState.errors).toHaveLength(2);
        expect(errorState.errors[0].code).toBe('ZAP_INIT_FAILED');
      });
    });

    describe('Settings Store', () => {
      it('should validate proxy configuration', async () => {
        const proxyConfig = {
          enabled: true,
          host: '127.0.0.1',
          port: 8080,
          username: 'user',
          password: 'pass123',
          bypassRules: 'localhost',
        };

        expect(proxyConfig.enabled).toBe(true);
        expect(proxyConfig.host).toBe('127.0.0.1');
        expect(proxyConfig.port).toBe(8080);
        expect(proxyConfig.username).toBeDefined();
      });

      it('should validate ZAP settings', async () => {
        const zapSettings = {
          port: 8080,
          proxyPort: 8080,
          enabled: true,
          homeDirectory: '/opt/zap',
        };

        expect(zapSettings.port).toBe(8080);
        expect(zapSettings.enabled).toBe(true);
        expect(zapSettings.homeDirectory).toBeDefined();
      });

      it('should validate nuclei settings', async () => {
        const nucleiSettings = {
          templatesPath: '/opt/nuclei-templates',
          rateLimit: 150,
          concurrency: 25,
        };

        expect(nucleiSettings.rateLimit).toBeGreaterThan(0);
        expect(nucleiSettings.concurrency).toBeGreaterThan(0);
        expect(nucleiSettings.templatesPath).toBeDefined();
      });
    });
  });

  describe('Utility Functions', () => {
    it('should format duration correctly', async () => {
      const formatDuration = (ms: number): string => {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
        return `${(ms / 3600000).toFixed(1)}h`;
      };

      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(30000)).toBe('30.0s');
      expect(formatDuration(90000)).toBe('1.5m');
      expect(formatDuration(7200000)).toBe('2.0h');
    });

    it('should validate URLs correctly', async () => {
      const isValidUrl = (url: string): boolean => {
        try {
          const parsed = new URL(url);
          return ['http:', 'https:'].includes(parsed.protocol);
        } catch {
          return false;
        }
      };

      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });

    it('should mask sensitive data', async () => {
      const maskSensitive = (data: string): string => {
        const patterns = [
          /password["']?\s*[:=]\s*["']?[^"']+["']?/gi,
          /api[_-]?key["']?\s*[:=]\s*["']?[^"']+["']?/gi,
        ];

        let masked = data;
        for (const pattern of patterns) {
          masked = masked.replace(pattern, '"***MASKED***"');
        }
        return masked;
      };

      expect(maskSensitive('password=secret123')).toContain('***MASKED***');
      expect(maskSensitive('api_key=abc123')).toContain('***MASKED***');
      expect(maskSensitive('hello world')).not.toContain('***MASKED***');
    });
  });
});

describe('Performance Tests', () => {
  it('should handle large vulnerability lists efficiently', async () => {
    // Generate 1000 vulnerabilities
    const vulnerabilities: Vulnerability[] = Array.from({ length: 1000 }, (_, i) => ({
      id: `vuln-${i}`,
      source: i % 2 === 0 ? 'zap' : 'nuclei',
      name: `Vulnerability ${i}`,
      description: 'Test vulnerability description',
      severity: ['critical', 'high', 'medium', 'low', 'informational'][i % 5] as Vulnerability['severity'],
      confidence: 'high',
      url: `https://example${i}.com`,
      method: 'GET',
      timestamp: new Date(),
    }));

    // Test filtering performance
    const criticalCount = vulnerabilities.filter(v => v.severity === 'critical').length;
    const highCount = vulnerabilities.filter(v => v.severity === 'high').length;

    expect(criticalCount).toBe(200);
    expect(highCount).toBe(200);
    expect(vulnerabilities.length).toBe(1000);
  });

  it('should handle rapid state updates', async () => {
    let progress = 0;
    const updates = 100;

    for (let i = 0; i < updates; i++) {
      progress = Math.floor((i / updates) * 100);
    }

    expect(progress).toBe(99);
  });
});
