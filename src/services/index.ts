// Core Services
export { ScanOrchestrator, getOrchestrator, resetOrchestrator } from './orchestrator';
export { MultiTargetScanner, getMultiTargetScanner, resetMultiTargetScanner } from './multiTargetScanner';
export { CredentialManager, getCredentialManager, Credential, ZapCredential, DefectDojoCredential, ProxyCredential, CredentialType } from './credentialManager';
export { SessionManager, getSessionManager, SessionData, CookieData } from './sessionManager';

// Browser Services
export { BrowserService, getBrowserService, resetBrowserService } from './browserService';
export { CDPService, getCDPService, resetCDPService } from './cdpService';
export { PlaywrightManager, getPlaywrightManager, resetPlaywrightManager } from './playwrightManager';

// Security Tool Services
export { ZAPClient, getZAPClient, resetZAPClient } from './zapClient';
export { NucleiExecutor, getNucleiExecutor, resetNucleiExecutor } from './nucleiExecutor';

// Asset Discovery
export { AssetDiscovery, getAssetDiscovery, resetAssetDiscovery } from './assetDiscovery';

// Policy Engine
export { PolicyEngine, getPolicyEngine, resetPolicyEngine, SecurityPolicy, PolicyRule, ValidationResult, ComplianceReport } from './policyEngine';

// Reporting & Integration
export { ReportGenerator, getReportGenerator, resetReportGenerator } from './reportGenerator';
export { DefectDojoClient, getDefectDojoClient, resetDefectDojoClient } from './defectDojoClient';
