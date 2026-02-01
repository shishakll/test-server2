import { EventEmitter } from 'events';
import {
  ScanOrchestrator,
  getOrchestrator,
  resetOrchestrator,
} from './orchestrator';
import {
  MultiTargetScanner,
  getMultiTargetScanner,
  resetMultiTargetScanner,
} from './multiTargetScanner';
import {
  ZAPClient,
  getZAPClient,
  resetZAPClient,
} from './zapClient';
import {
  NucleiExecutor,
  getNucleiExecutor,
  resetNucleiExecutor,
} from './nucleiExecutor';
import {
  BrowserService,
  getBrowserService,
  resetBrowserService,
} from './browserService';
import {
  AssetDiscovery,
  getAssetDiscovery,
  resetAssetDiscovery,
} from './assetDiscovery';
import {
  ReportGenerator,
  getReportGenerator,
  resetReportGenerator,
} from './reportGenerator';
import {
  CredentialManager,
  getCredentialManager,
  resetCredentialManager,
} from './credentialManager';
import {
  SessionManager,
  getSessionManager,
  resetSessionManager,
} from './sessionManager';
import {
  PolicyEngine,
  getPolicyEngine,
  resetPolicyEngine,
} from './policyEngine';
import {
  DefectDojoClient,
  getDefectDojoClient,
  resetDefectDojoClient,
} from './defectDojoClient';

/**
 * ServiceInitializer - Central hub for wiring all services together
 *
 * This ensures:
 * 1. All services are properly initialized
 * 2. Dependencies are injected correctly
 * 3. Services can communicate with each other
 * 4. Clean startup and shutdown
 */
export class ServiceInitializer extends EventEmitter {
  private static instance: ServiceInitializer | null = null;
  private isInitialized = false;

  private constructor() {
    super();
  }

  static getInstance(): ServiceInitializer {
    if (!ServiceInitializer.instance) {
      ServiceInitializer.instance = new ServiceInitializer();
    }
    return ServiceInitializer.instance;
  }

  /**
   * Initialize all services and wire them together
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('ServiceInitializer: Already initialized');
      return;
    }

    console.log('ServiceInitializer: Starting initialization...');

    try {
      // Initialize Policy Engine first (used by other services)
      const policyEngine = getPolicyEngine();
      console.log('ServiceInitializer: PolicyEngine ready');

      // Initialize Core Services
      const zapClient = getZAPClient();
      const nucleiExecutor = getNucleiExecutor();
      const browserService = getBrowserService();
      const assetDiscovery = getAssetDiscovery();
      const reportGenerator = getReportGenerator();
      const credentialManager = getCredentialManager();
      const sessionManager = getSessionManager();
      const defectDojoClient = getDefectDojoClient();

      // Initialize Orchestrator
      const orchestrator = getOrchestrator();

      // Wire Orchestrator with services
      orchestrator.injectServices({
        browser: browserService,
        zap: zapClient,
        nuclei: nucleiExecutor,
        assetDiscovery: assetDiscovery,
        reportGenerator: reportGenerator,
      });
      console.log('ServiceInitializer: Orchestrator wired with services');

      // Initialize MultiTargetScanner
      const multiScanner = getMultiTargetScanner();
      multiScanner.injectOrchestrator(orchestrator);
      console.log('ServiceInitializer: MultiTargetScanner wired with Orchestrator');

      // Set up event forwarding between services
      this.setupEventForwarding(orchestrator, multiScanner);
      this.setupEventForwarding(zapClient, orchestrator);
      this.setupEventForwarding(nucleiExecutor, orchestrator);

      // Register policy engine with orchestrator for compliance checks
      this.registerPolicyListeners(orchestrator, policyEngine);

      this.isInitialized = true;
      console.log('ServiceInitializer: All services initialized successfully');

      this.emit('initialized');
    } catch (error) {
      console.error('ServiceInitializer: Initialization failed', error);
      throw error;
    }
  }

  /**
   * Set up event forwarding between services
   */
  private setupEventForwarding(source: EventEmitter, target: EventEmitter): void {
    source.on('vulnerabilities', (data) => {
      target.emit('vulnerabilities', data);
    });

    source.on('progress', (data) => {
      target.emit('progress', data);
    });

    source.on('error', (data) => {
      target.emit('error', data);
    });

    source.on('discovered', (data) => {
      target.emit('discovered', data);
    });
  }

  /**
   * Register policy-related listeners
   */
  private registerPolicyListeners(orchestrator: ScanOrchestrator, policyEngine: PolicyEngine): void {
    // Listen for scan completion and validate against default policy
    orchestrator.on('completed', async (data: { scanId: string; success: boolean }) => {
      if (data.success) {
        const vulnerabilities = (orchestrator as any).vulnerabilities || [];
        if (vulnerabilities.length > 0) {
          const result = policyEngine.validate(vulnerabilities, 'quick-scan');
          console.log(`Policy validation: ${result.compliance}% compliant`);
        }
      }
    });
  }

  /**
   * Get all service instances for external access
   */
  getServices(): {
    orchestrator: ScanOrchestrator;
    multiScanner: MultiTargetScanner;
    zapClient: ZAPClient;
    nucleiExecutor: NucleiExecutor;
    browserService: BrowserService;
    assetDiscovery: AssetDiscovery;
    reportGenerator: ReportGenerator;
    credentialManager: CredentialManager;
    sessionManager: SessionManager;
    policyEngine: PolicyEngine;
    defectDojoClient: DefectDojoClient;
  } {
    if (!this.isInitialized) {
      throw new Error('ServiceInitializer not initialized. Call initialize() first.');
    }

    return {
      orchestrator: getOrchestrator(),
      multiScanner: getMultiTargetScanner(),
      zapClient: getZAPClient(),
      nucleiExecutor: getNucleiExecutor(),
      browserService: getBrowserService(),
      assetDiscovery: getAssetDiscovery(),
      reportGenerator: getReportGenerator(),
      credentialManager: getCredentialManager(),
      sessionManager: getSessionManager(),
      policyEngine: getPolicyEngine(),
      defectDojoClient: getDefectDojoClient(),
    };
  }

  /**
   * Check if services are ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Shutdown all services gracefully
   */
  async shutdown(): Promise<void> {
    console.log('ServiceInitializer: Shutting down...');

    // Shutdown in reverse order
    resetMultiTargetScanner();
    resetOrchestrator();
    resetDefectDojoClient();
    resetPolicyEngine();
    resetSessionManager();
    resetCredentialManager();
    resetReportGenerator();
    resetAssetDiscovery();
    resetBrowserService();
    resetNucleiExecutor();
    resetZAPClient();

    this.isInitialized = false;
    console.log('ServiceInitializer: All services shut down');
    this.emit('shutdown');
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  static reset(): void {
    if (ServiceInitializer.instance) {
      ServiceInitializer.instance.shutdown();
      ServiceInitializer.instance = null;
    }
  }
}

// Singleton accessor
export function getServiceInitializer(): ServiceInitializer {
  return ServiceInitializer.getInstance();
}

// Initialize on import (lazy initialization pattern)
// Services will be initialized when first accessed
let servicesAccessed = false;

export function initializeServices(): Promise<void> {
  const initializer = getServiceInitializer();
  return initializer.initialize();
}

export function useServices(): typeof import('./index') {
  // Ensure services are initialized on first use
  if (!servicesAccessed) {
    servicesAccessed = true;
    initializeServices().catch(console.error);
  }
  return {
    // Re-export all services for convenience
    ScanOrchestrator,
    getOrchestrator,
    resetOrchestrator,
    MultiTargetScanner,
    getMultiTargetScanner,
    resetMultiTargetScanner,
    CredentialManager,
    getCredentialManager,
    SessionManager,
    getSessionManager,
    BrowserService,
    getBrowserService,
    ZAPClient,
    getZAPClient,
    NucleiExecutor,
    getNucleiExecutor,
    AssetDiscovery,
    getAssetDiscovery,
    PolicyEngine,
    getPolicyEngine,
    resetPolicyEngine,
    ReportGenerator,
    getReportGenerator,
    DefectDojoClient,
    getDefectDojoClient,
    ServiceInitializer,
    getServiceInitializer,
    initializeServices,
  };
}
