import { EventEmitter } from 'events';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { generateId } from '../utils';
import type { Vulnerability, ScanConfig } from '../types';

/**
 * PolicyEngine - Security policy management and validation
 *
 * This service provides:
 * - Policy templates (OWASP Top 10, PCI-DSS, HIPAA, SOC2)
 * - Custom policy creation and management
 * - Vulnerability validation against policies
 * - Compliance reporting
 * - Policy version control
 */
export class PolicyEngine extends EventEmitter {
  private static instance: PolicyEngine | null = null;
  private policies: Map<string, SecurityPolicy> = new Map();
  private policyDir: string;

  private constructor() {
    super();
    this.policyDir = join(__dirname, '..', '..', 'policies');
    this.loadBuiltInPolicies();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PolicyEngine {
    if (!PolicyEngine.instance) {
      PolicyEngine.instance = new PolicyEngine();
    }
    return PolicyEngine.instance;
  }

  /**
   * Reset singleton instance
   */
  static resetInstance(): void {
    PolicyEngine.instance = null;
  }

  /**
   * Load built-in policy templates
   */
  private loadBuiltInPolicies(): void {
    // OWASP Top 10 2021
    this.policies.set('owasp-top10-2021', {
      id: 'owasp-top10-2021',
      name: 'OWASP Top 10 2021',
      description: 'OWASP Top 10 2021 Security Risks',
      version: '2021',
      createdAt: new Date('2021-01-01'),
      updatedAt: new Date('2021-01-01'),
      framework: 'OWASP',
      rules: [
        { id: 'A01', name: 'Broken Access Control', severity: 'critical', categories: ['access-control'] },
        { id: 'A02', name: 'Cryptographic Failures', severity: 'high', categories: ['cryptography'] },
        { id: 'A03', name: 'Injection', severity: 'critical', categories: ['injection'] },
        { id: 'A04', name: 'Insecure Design', severity: 'high', categories: ['design'] },
        { id: 'A05', name: 'Security Misconfiguration', severity: 'high', categories: ['config'] },
        { id: 'A06', name: 'Vulnerable and Outdated Components', severity: 'medium', categories: ['dependencies'] },
        { id: 'A07', name: 'Identification and Authentication Failures', severity: 'high', categories: ['auth'] },
        { id: 'A08', name: 'Software and Data Integrity Failures', severity: 'critical', categories: ['integrity'] },
        { id: 'A09', name: 'Security Logging and Monitoring Failures', severity: 'medium', categories: ['logging'] },
        { id: 'A10', name: 'Server-Side Request Forgery (SSRF)', severity: 'high', categories: ['ssrf'] },
      ],
      compliance: {
        owasp: true,
        pciDss: true,
        hipaa: false,
        soc2: true,
      },
    });

    // PCI-DSS 4.0
    this.policies.set('pci-dss-4.0', {
      id: 'pci-dss-4.0',
      name: 'PCI-DSS 4.0',
      description: 'Payment Card Industry Data Security Standard v4.0',
      version: '4.0',
      createdAt: new Date('2022-01-01'),
      updatedAt: new Date('2022-01-01'),
      framework: 'PCI-DSS',
      rules: [
        { id: 'PCI-1', name: 'Install and Maintain Network Firewall', severity: 'high', categories: ['network', 'firewall'] },
        { id: 'PCI-2', name: 'Do Not Use Vendor-Supplied Defaults', severity: 'critical', categories: ['config', 'default-creds'] },
        { id: 'PCI-3', name: 'Protect Stored Cardholder Data', severity: 'critical', categories: ['data-protection', 'cryptography'] },
        { id: 'PCI-4', name: 'Encrypt Transmission of Cardholder Data', severity: 'high', categories: ['tls', 'encryption'] },
        { id: 'PCI-5', name: 'Use and Regularly Update Anti-Virus', severity: 'medium', categories: ['malware'] },
        { id: 'PCI-6', name: 'Develop and Maintain Secure Systems', severity: 'high', categories: ['vulnerabilities', 'patching'] },
        { id: 'PCI-7', name: 'Restrict Access to Cardholder Data', severity: 'high', categories: ['access-control'] },
        { id: 'PCI-8', name: 'Identify Users and Authenticate Access', severity: 'high', categories: ['auth', 'mfa'] },
        { id: 'PCI-9', name: 'Restrict Physical Access', severity: 'medium', categories: ['physical'] },
        { id: 'PCI-10', name: 'Log and Monitor All Access', severity: 'medium', categories: ['logging', 'monitoring'] },
      ],
      compliance: {
        owasp: true,
        pciDss: true,
        hipaa: true,
        soc2: true,
      },
    });

    // HIPAA
    this.policies.set('hipaa', {
      id: 'hipaa',
      name: 'HIPAA Security Rule',
      description: 'Health Insurance Portability and Accountability Act Security Rule',
      version: '2023',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01'),
      framework: 'HIPAA',
      rules: [
        { id: 'HIPAA-164.308', name: 'Administrative Safeguards', severity: 'high', categories: ['admin'] },
        { id: 'HIPAA-164.310', name: 'Physical Safeguards', severity: 'medium', categories: ['physical'] },
        { id: 'HIPAA-164.312', name: 'Technical Safeguards', severity: 'high', categories: ['technical', 'encryption', 'access-control'] },
        { id: 'HIPAA-164.314', name: 'Organizational Requirements', severity: 'medium', categories: ['compliance'] },
        { id: 'HIPAA-164.316', name: 'Documentation Requirements', severity: 'low', categories: ['documentation'] },
      ],
      compliance: {
        owasp: true,
        pciDss: false,
        hipaa: true,
        soc2: true,
      },
    });

    // SOC 2 Type II
    this.policies.set('soc2', {
      id: 'soc2',
      name: 'SOC 2 Type II',
      description: 'Service Organization Control 2 Type II Trust Services Criteria',
      version: '2017',
      createdAt: new Date('2017-01-01'),
      updatedAt: new Date('2017-01-01'),
      framework: 'SOC2',
      rules: [
        { id: 'SOC2-CC1', name: 'Control Environment', severity: 'high', categories: ['governance'] },
        { id: 'SOC2-CC2', name: 'Communication and Information', severity: 'medium', categories: ['communication'] },
        { id: 'SOC2-CC3', name: 'Risk Assessment', severity: 'high', categories: ['risk-management'] },
        { id: 'SOC2-CC4', name: 'Monitoring Activities', severity: 'medium', categories: ['monitoring'] },
        { id: 'SOC2-CC5', name: 'Control Activities', severity: 'high', categories: ['control-activities'] },
        { id: 'SOC2-CC6', name: 'Logical and Physical Access', severity: 'critical', categories: ['access-control', 'physical'] },
        { id: 'SOC2-CC7', name: 'System Operations', severity: 'high', categories: ['operations'] },
      ],
      compliance: {
        owasp: true,
        pciDss: true,
        hipaa: true,
        soc2: true,
      },
    });

    // Quick Scan Policy
    this.policies.set('quick-scan', {
      id: 'quick-scan',
      name: 'Quick Scan',
      description: 'Fast security scan for CI/CD pipelines',
      version: '1.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      framework: 'Custom',
      rules: [
        { id: 'QS-001', name: 'Critical Vulnerabilities', severity: 'critical', categories: ['all'] },
        { id: 'QS-002', name: 'High Severity Issues', severity: 'high', categories: ['all'] },
        { id: 'QS-003', name: 'SQL Injection', severity: 'critical', categories: ['injection', 'sqli'] },
        { id: 'QS-004', name: 'XSS Vulnerabilities', severity: 'high', categories: ['xss'] },
        { id: 'QS-005', name: 'Default Credentials', severity: 'critical', categories: ['default-creds', 'auth'] },
      ],
      compliance: {
        owasp: false,
        pciDss: false,
        hipaa: false,
        soc2: false,
      },
    });

    this.emit('policiesLoaded', { count: this.policies.size });
  }

  /**
   * Get all available policies
   */
  getPolicies(): SecurityPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get a specific policy by ID
   */
  getPolicy(policyId: string): SecurityPolicy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * Create a new custom policy
   */
  createPolicy(policy: Omit<SecurityPolicy, 'id' | 'createdAt' | 'updatedAt'>): SecurityPolicy {
    const newPolicy: SecurityPolicy = {
      ...policy,
      id: generateId('policy'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.policies.set(newPolicy.id, newPolicy);
    this.emit('policyCreated', { policy: newPolicy });

    return newPolicy;
  }

  /**
   * Update an existing policy
   */
  updatePolicy(policyId: string, updates: Partial<SecurityPolicy>): SecurityPolicy | null {
    const existing = this.policies.get(policyId);
    if (!existing) return null;

    const updated: SecurityPolicy = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    this.policies.set(policyId, updated);
    this.emit('policyUpdated', { policy: updated });

    return updated;
  }

  /**
   * Delete a policy
   */
  deletePolicy(policyId: string): boolean {
    // Prevent deleting built-in policies
    const policy = this.policies.get(policyId);
    if (policy?.framework !== 'Custom') {
      return false;
    }

    const deleted = this.policies.delete(policyId);
    if (deleted) {
      this.emit('policyDeleted', { policyId });
    }
    return deleted;
  }

  /**
   * Validate vulnerabilities against a policy
   */
  validate(vulnerabilities: Vulnerability[], policyId: string): ValidationResult {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return {
        passed: false,
        policyId,
        violations: [],
        summary: { passed: 0, failed: 0, warnings: 0 },
        errors: [{ code: 'POLICY_NOT_FOUND', message: `Policy ${policyId} not found` }],
      };
    }

    const violations: Violation[] = [];
    const passed: Vulnerability[] = [];
    const warnings: Vulnerability[] = [];

    for (const vuln of vulnerabilities) {
      const matchingRules = policy.rules.filter(rule =>
        rule.severity === vuln.severity ||
        rule.categories.some(cat => vuln.name.toLowerCase().includes(cat.toLowerCase()))
      );

      if (matchingRules.length > 0) {
        for (const rule of matchingRules) {
          if (rule.severity === 'critical' && vuln.severity === 'critical') {
            violations.push({
              vulnerability: vuln,
              rule: rule,
              policyId: policy.id,
              severity: 'failed',
            });
          } else if (rule.severity === 'high' && vuln.severity === 'high') {
            violations.push({
              vulnerability: vuln,
              rule: rule,
              policyId: policy.id,
              severity: vuln.severity === 'critical' ? 'failed' : 'warning',
            });
          } else {
            warnings.push(vuln);
          }
        }
      } else {
        passed.push(vuln);
      }
    }

    const criticalCount = violations.filter(v => v.severity === 'failed').length;
    const highCount = violations.filter(v => v.severity === 'warning' && v.vulnerability.severity === 'high').length;

    return {
      passed: criticalCount === 0,
      policyId: policy.id,
      policyName: policy.name,
      violations,
      passedCount: passed.length,
      warningCount: warnings.length,
      summary: {
        passed: passed.length,
        failed: violations.filter(v => v.severity === 'failed').length,
        warnings: violations.filter(v => v.severity === 'warning').length,
      },
      errors: [],
    };
  }

  /**
   * Check if scan passes policy requirements
   */
  checkCompliance(vulnerabilities: Vulnerability[], policyId: string): ComplianceReport {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return {
        compliant: false,
        policyId,
        score: 0,
        issues: [],
        recommendations: ['Policy not found'],
      };
    }

    const validation = this.validate(vulnerabilities, policyId);
    const total = vulnerabilities.length;
    const passed = validation.passedCount;
    const score = total > 0 ? Math.round((passed / total) * 100) : 100;

    const issues: ComplianceIssue[] = [];

    // Check for critical violations
    const criticalViolations = validation.violations.filter(v => v.severity === 'failed');
    if (criticalViolations.length > 0) {
      issues.push({
        type: 'critical',
        title: 'Critical Security Violations',
        description: `Found ${criticalViolations.length} critical vulnerabilities that violate ${policy.name}`,
        vulnerabilities: criticalViolations.map(v => v.vulnerability),
        remediation: 'Address all critical vulnerabilities immediately',
      });
    }

    // Check for high severity issues
    const highViolations = validation.violations.filter(v =>
      v.severity === 'warning' && v.vulnerability.severity === 'high'
    );
    if (highViolations.length > 0) {
      issues.push({
        type: 'high',
        title: 'High Severity Issues',
        description: `Found ${highViolations.length} high severity vulnerabilities`,
        vulnerabilities: highViolations.map(v => v.vulnerability),
        remediation: 'Review and remediate high severity issues',
      });
    }

    return {
      compliant: validation.passed,
      policyId: policy.id,
      policyName: policy.name,
      framework: policy.framework,
      score,
      compliance: {
        owasp: policy.compliance.owasp && validation.passed,
        pciDss: policy.compliance.pciDss && validation.passed,
        hipaa: policy.compliance.hipaa && validation.passed,
        soc2: policy.compliance.soc2 && validation.passed,
      },
      issues,
      recommendations: this.generateRecommendations(validation, policy),
      validatedAt: new Date(),
    };
  }

  /**
   * Generate remediation recommendations
   */
  private generateRecommendations(validation: ValidationResult, policy: SecurityPolicy): string[] {
    const recommendations: string[] = [];

    const criticalCount = validation.violations.filter(v => v.severity === 'failed').length;
    const highCount = validation.violations.filter(v =>
      v.severity === 'warning' && v.vulnerability.severity === 'high'
    ).length;

    if (criticalCount > 0) {
      recommendations.push(`URGENT: Remediate ${criticalCount} critical vulnerabilities`);
    }
    if (highCount > 0) {
      recommendations.push(`Review and address ${highCount} high severity issues`);
    }

    // Add policy-specific recommendations
    if (policy.framework === 'OWASP') {
      recommendations.push('Review OWASP Top 10 categories for context-specific guidance');
    } else if (policy.framework === 'PCI-DSS') {
      recommendations.push('Ensure cardholder data protection measures are in place');
    } else if (policy.framework === 'HIPAA') {
      recommendations.push('Verify PHI access controls and encryption');
    }

    if (recommendations.length === 0) {
      recommendations.push('No immediate actions required. Continue regular security monitoring.');
    }

    return recommendations;
  }

  /**
   * Export policy to file
   */
  exportPolicy(policyId: string, outputPath?: string): string | null {
    const policy = this.policies.get(policyId);
    if (!policy) return null;

    const exportPath = outputPath || join(this.policyDir, `${policyId}.json`);

    try {
      mkdirSync(dirname(exportPath), { recursive: true });
      writeFileSync(exportPath, JSON.stringify(policy, null, 2), 'utf-8');
      return exportPath;
    } catch (error) {
      console.error(`Failed to export policy ${policyId}:`, error);
      return null;
    }
  }

  /**
   * Import policy from file
   */
  importPolicy(filePath: string): SecurityPolicy | null {
    try {
      if (!existsSync(filePath)) return null;

      const content = readFileSync(filePath, 'utf-8');
      const policy = JSON.parse(content) as SecurityPolicy;

      // Ensure required fields
      policy.id = policy.id || generateId('policy');
      policy.createdAt = policy.createdAt ? new Date(policy.createdAt) : new Date();
      policy.updatedAt = new Date();

      this.policies.set(policy.id, policy);
      this.emit('policyImported', { policy });

      return policy;
    } catch (error) {
      console.error(`Failed to import policy from ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Clone a policy
   */
  clonePolicy(policyId: string, newName: string): SecurityPolicy | null {
    const original = this.policies.get(policyId);
    if (!original) return null;

    return this.createPolicy({
      name: newName,
      description: `Clone of ${original.name}`,
      version: '1.0',
      framework: 'Custom',
      rules: [...original.rules],
      compliance: { ...original.compliance },
    });
  }
}

// Types
export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  framework: string;
  rules: PolicyRule[];
  compliance: ComplianceFlags;
}

export interface PolicyRule {
  id: string;
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  categories: string[];
}

export interface ComplianceFlags {
  owasp: boolean;
  pciDss: boolean;
  hipaa: boolean;
  soc2: boolean;
}

export interface ValidationResult {
  passed: boolean;
  policyId: string;
  policyName?: string;
  violations: Violation[];
  passedCount: number;
  warningCount: number;
  summary: {
    passed: number;
    failed: number;
    warnings: number;
  };
  errors: ValidationError[];
}

export interface Violation {
  vulnerability: Vulnerability;
  rule: PolicyRule;
  policyId: string;
  severity: 'failed' | 'warning';
}

export interface ValidationError {
  code: string;
  message: string;
}

export interface ComplianceReport {
  compliant: boolean;
  policyId: string;
  policyName: string;
  framework?: string;
  score: number;
  compliance: {
    owasp: boolean;
    pciDss: boolean;
    hipaa: boolean;
    soc2: boolean;
  };
  issues: ComplianceIssue[];
  recommendations: string[];
  validatedAt: Date;
}

export interface ComplianceIssue {
  type: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  vulnerabilities: Vulnerability[];
  remediation: string;
}

// Export singleton
export function getPolicyEngine(): PolicyEngine {
  return PolicyEngine.getInstance();
}

export function resetPolicyEngine(): void {
  PolicyEngine.resetInstance();
}
