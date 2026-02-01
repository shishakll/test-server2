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
});
