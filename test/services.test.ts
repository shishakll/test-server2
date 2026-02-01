import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Simple tests for service structure and exports
// Full integration tests require actual external tools (ZAP, Nuclei, etc.)
// Note: Tests requiring keytar are skipped as it's a native module

describe('Services', () => {
  describe('Service Exports', () => {
    it('should export ScanOrchestrator', async () => {
      const { ScanOrchestrator } = await import('../src/services/orchestrator');
      expect(ScanOrchestrator).toBeDefined();
    });

    it('should export BrowserService', async () => {
      const { BrowserService } = await import('../src/services/browserService');
      expect(BrowserService).toBeDefined();
    });

    it('should export CDPService', async () => {
      const { CDPService } = await import('../src/services/cdpService');
      expect(CDPService).toBeDefined();
    });

    it('should export PlaywrightManager', async () => {
      const { PlaywrightManager } = await import('../src/services/playwrightManager');
      expect(PlaywrightManager).toBeDefined();
    });

    it('should export ZAPClient', async () => {
      const { ZAPClient } = await import('../src/services/zapClient');
      expect(ZAPClient).toBeDefined();
    });

    it('should export NucleiExecutor', async () => {
      const { NucleiExecutor } = await import('../src/services/nucleiExecutor');
      expect(NucleiExecutor).toBeDefined();
    });

    it('should export AssetDiscovery', async () => {
      const { AssetDiscovery } = await import('../src/services/assetDiscovery');
      expect(AssetDiscovery).toBeDefined();
    });

    it('should export ReportGenerator', async () => {
      const { ReportGenerator } = await import('../src/services/reportGenerator');
      expect(ReportGenerator).toBeDefined();
    });

    it('should export DefectDojoClient', async () => {
      const { DefectDojoClient } = await import('../src/services/defectDojoClient');
      expect(DefectDojoClient).toBeDefined();
    });

    it('should export PolicyEngine', async () => {
      const { PolicyEngine } = await import('../src/services/policyEngine');
      expect(PolicyEngine).toBeDefined();
    });

    it('should export CredentialManager', async () => {
      const { CredentialManager } = await import('../src/services/credentialManager');
      expect(CredentialManager).toBeDefined();
    });

    it('should export SessionManager', async () => {
      const { SessionManager } = await import('../src/services/sessionManager');
      expect(SessionManager).toBeDefined();
    });

    it('should export MultiTargetScanner', async () => {
      const { MultiTargetScanner } = await import('../src/services/multiTargetScanner');
      expect(MultiTargetScanner).toBeDefined();
    });
  });

  describe('PolicyEngine', () => {
    it('should load built-in policies', async () => {
      const { getPolicyEngine, resetPolicyEngine } = await import('../src/services/policyEngine');
      resetPolicyEngine();
      const engine = getPolicyEngine();
      const policies = engine.getPolicies();
      expect(policies.length).toBeGreaterThan(0);
    });

    it('should have OWASP Top 10 policy', async () => {
      const { getPolicyEngine, resetPolicyEngine } = await import('../src/services/policyEngine');
      resetPolicyEngine();
      const engine = getPolicyEngine();
      const owaspPolicy = engine.getPolicy('owasp-top10-2021');
      expect(owaspPolicy).toBeDefined();
      expect(owaspPolicy?.name).toBe('OWASP Top 10 2021');
    });

    it('should have PCI-DSS policy', async () => {
      const { getPolicyEngine, resetPolicyEngine } = await import('../src/services/policyEngine');
      resetPolicyEngine();
      const engine = getPolicyEngine();
      const pciPolicy = engine.getPolicy('pci-dss-4.0');
      expect(pciPolicy).toBeDefined();
      expect(pciPolicy?.framework).toBe('PCI-DSS');
    });

    it('should validate vulnerabilities against policy', async () => {
      const { getPolicyEngine, resetPolicyEngine } = await import('../src/services/policyEngine');
      resetPolicyEngine();
      const engine = getPolicyEngine();

      const testVulnerabilities = [
        { id: 'v1', source: 'nuclei', name: 'SQL Injection', severity: 'critical' as const, confidence: 'high' as const, url: 'http://test.com', method: 'GET', timestamp: new Date() },
        { id: 'v2', source: 'zap', name: 'XSS', severity: 'high' as const, confidence: 'high' as const, url: 'http://test.com', method: 'GET', timestamp: new Date() },
        { id: 'v3', source: 'nuclei', name: 'Info Disclosure', severity: 'low' as const, confidence: 'medium' as const, url: 'http://test.com', method: 'GET', timestamp: new Date() },
      ];

      const result = engine.validate(testVulnerabilities, 'quick-scan');
      expect(result.policyId).toBe('quick-scan');
      expect(result.summary).toBeDefined();
    });

    it('should create custom policy', async () => {
      const { getPolicyEngine, resetPolicyEngine } = await import('../src/services/policyEngine');
      resetPolicyEngine();
      const engine = getPolicyEngine();

      const customPolicy = engine.createPolicy({
        name: 'Custom Test Policy',
        description: 'A test policy for unit tests',
        version: '1.0.0',
        framework: 'Custom',
        rules: [
          { id: 'CT-001', name: 'Test Rule', severity: 'high', categories: ['test'] },
        ],
        compliance: { owasp: false, pciDss: false, hipaa: false, soc2: false },
      });

      expect(customPolicy.id).toBeDefined();
      expect(customPolicy.name).toBe('Custom Test Policy');
    });

    it('should check compliance', async () => {
      const { getPolicyEngine, resetPolicyEngine } = await import('../src/services/policyEngine');
      resetPolicyEngine();
      const engine = getPolicyEngine();

      const testVulnerabilities = [
        { id: 'v1', source: 'nuclei', name: 'SQL Injection', severity: 'critical' as const, confidence: 'high' as const, url: 'http://test.com', method: 'GET', timestamp: new Date() },
      ];

      const report = engine.checkCompliance(testVulnerabilities, 'quick-scan');
      expect(report.policyId).toBe('quick-scan');
      expect(report.score).toBeDefined();
    });
  });

  describe('Service Instances', () => {
    it('should create ScanOrchestrator instance', async () => {
      const { ScanOrchestrator } = await import('../src/services/orchestrator');
      const orchestrator = new ScanOrchestrator();
      expect(orchestrator).toBeDefined();
    });

    it('should create NucleiExecutor instance', async () => {
      const { NucleiExecutor } = await import('../src/services/nucleiExecutor');
      const executor = new NucleiExecutor();
      expect(executor).toBeDefined();
    });

    it('should create AssetDiscovery instance', async () => {
      const { AssetDiscovery } = await import('../src/services/assetDiscovery');
      const discovery = new AssetDiscovery();
      expect(discovery).toBeDefined();
    });

    it('should create ReportGenerator instance', async () => {
      const { ReportGenerator } = await import('../src/services/reportGenerator');
      const generator = new ReportGenerator();
      expect(generator).toBeDefined();
    });

    it('should create DefectDojoClient instance', async () => {
      const { DefectDojoClient } = await import('../src/services/defectDojoClient');
      const client = new DefectDojoClient();
      expect(client).toBeDefined();
    });

    it('should create MultiTargetScanner instance', async () => {
      const { MultiTargetScanner } = await import('../src/services/multiTargetScanner');
      const scanner = new MultiTargetScanner();
      expect(scanner).toBeDefined();
    });
  });

  describe('Service Events', () => {
    it('should have EventEmitter methods', async () => {
      const { NucleiExecutor } = await import('../src/services/nucleiExecutor');
      const executor = new NucleiExecutor();
      
      expect(typeof executor.on).toBe('function');
      expect(typeof executor.emit).toBe('function');
      expect(typeof executor.removeListener).toBe('function');
    });
  });

  describe('Service Configuration', () => {
    it('should have initialize methods', async () => {
      const { NucleiExecutor } = await import('../src/services/nucleiExecutor');
      const executor = new NucleiExecutor();
      
      expect(typeof executor.initialize).toBe('function');
    });

    it('should have dispose methods', async () => {
      const { NucleiExecutor } = await import('../src/services/nucleiExecutor');
      const executor = new NucleiExecutor();
      
      expect(typeof executor.dispose).toBe('function');
    });
  });

  describe('MultiTargetScanner', () => {
    it('should have EventEmitter methods', async () => {
      const { MultiTargetScanner } = await import('../src/services/multiTargetScanner');
      const scanner = new MultiTargetScanner();
      
      expect(typeof scanner.on).toBe('function');
      expect(typeof scanner.emit).toBe('function');
      expect(typeof scanner.removeListener).toBe('function');
    });

    it('should have scan control methods', async () => {
      const { MultiTargetScanner } = await import('../src/services/multiTargetScanner');
      const scanner = new MultiTargetScanner();
      
      expect(typeof scanner.pauseBulkScan).toBe('function');
      expect(typeof scanner.resumeBulkScan).toBe('function');
      expect(typeof scanner.cancelBulkScan).toBe('function');
    });

    it('should have status and queue methods', async () => {
      const { MultiTargetScanner } = await import('../src/services/multiTargetScanner');
      const scanner = new MultiTargetScanner();
      
      expect(typeof scanner.getQueueStatus).toBe('function');
      expect(typeof scanner.getQueueItems).toBe('function');
      expect(typeof scanner.isBulkScanRunning).toBe('function');
      expect(typeof scanner.isBulkScanPaused).toBe('function');
    });

    it('should have export and statistics methods', async () => {
      const { MultiTargetScanner } = await import('../src/services/multiTargetScanner');
      const scanner = new MultiTargetScanner();
      
      expect(typeof scanner.exportResults).toBe('function');
      expect(typeof scanner.getStatistics).toBe('function');
      expect(typeof scanner.getAggregateVulnerabilities).toBe('function');
    });

    it('should have concurrency setter', async () => {
      const { MultiTargetScanner } = await import('../src/services/multiTargetScanner');
      const scanner = new MultiTargetScanner();
      
      expect(typeof scanner.setConcurrency).toBe('function');
    });

    it('should create singleton instance', async () => {
      const { getMultiTargetScanner, resetMultiTargetScanner } = await import('../src/services/multiTargetScanner');
      resetMultiTargetScanner();
      
      const scanner1 = getMultiTargetScanner();
      const scanner2 = getMultiTargetScanner();
      
      expect(scanner1).toBe(scanner2);
    });
  });
});
