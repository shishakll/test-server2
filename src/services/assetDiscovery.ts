import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import type { Vulnerability } from '../types';
import { generateId } from '../utils';

/**
 * AssetDiscovery - Subdomain enumeration and asset discovery
 *
 * This service provides:
 * - Subdomain enumeration via Subfinder and Amass
 * - API endpoint discovery via Kiterunner
 * - Technology stack detection via httpx
 * - Container image scanning via Trivy
 * - Port scanning via Nmap
 */
export class AssetDiscovery extends EventEmitter {
  // Tool paths
  private subfinderPath: string = '';
  private amassPath: string = '';
  private kiterunnerPath: string = '';
  private httpxPath: string = '';
  private trivyPath: string = '';
  private nmapPath: string = '';

  // Configuration
  private timeout = 60;
  private isRunning = false;

  constructor() {
    super();
  }

  /**
   * Initialize asset discovery with tool paths
   */
  async initialize(config?: {
    subfinderPath?: string;
    amassPath?: string;
    kiterunnerPath?: string;
    httpxPath?: string;
    trivyPath?: string;
    nmapPath?: string;
    timeout?: number;
  }): Promise<void> {
    this.subfinderPath = config?.subfinderPath || 'subfinder';
    this.amassPath = config?.amassPath || 'amass';
    this.kiterunnerPath = config?.kiterunnerPath || 'kr';
    this.httpxPath = config?.httpxPath || 'httpx';
    this.trivyPath = config?.trivyPath || 'trivy';
    this.nmapPath = config?.nmapPath || 'nmap';
    this.timeout = config?.timeout || this.timeout;

    this.emit('initialized', { config });
  }

  /**
   * Discover subdomains for a domain
   */
  async discoverSubdomains(domain: string, options?: {
    useSubfinder?: boolean;
    useAmass?: boolean;
    timeout?: number;
  }): Promise<string[]> {
    const results = new Set<string>();

    if (options?.useSubfinder !== false) {
      try {
        const subdomains = await this.runSubfinder(domain, options?.timeout);
        subdomains.forEach(s => results.add(s));
      } catch (error) {
        this.emit('subfinderError', { error });
      }
    }

    if (options?.useAmass !== false) {
      try {
        const subdomains = await this.runAmass(domain, options?.timeout);
        subdomains.forEach(s => results.add(s));
      } catch (error) {
        this.emit('amassError', { error });
      }
    }

    const sortedResults = Array.from(results).sort();
    this.emit('subdomainsDiscovered', { domain, count: sortedResults.length });

    return sortedResults;
  }

  /**
   * Run Subfinder for subdomain discovery
   */
  private async runSubfinder(domain: string, timeout?: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const args = ['-d', domain, '-o', '-', '-json'];
      const process = spawn(this.subfinderPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: (timeout || this.timeout) * 1000,
      });

      let output = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0 || code === 1) {
          const subdomains = this.parseSubfinderOutput(output);
          resolve(subdomains);
        } else {
          reject(new Error(`Subfinder exited with code ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  /**
   * Parse Subfinder JSON output
   */
  private parseSubfinderOutput(output: string): string[] {
    const subdomains: string[] = [];

    for (const line of output.trim().split('\n')) {
      if (!line.trim()) continue;

      try {
        const result = JSON.parse(line);
        if (result.hostname) {
          subdomains.push(result.hostname);
        }
      } catch {
        // Try to extract subdomain from line
        const match = line.match(/^[a-zA-Z0-9.-]+\.[a-zA-Z]+$/);
        if (match) {
          subdomains.push(line.trim());
        }
      }
    }

    return subdomains;
  }

  /**
   * Run Amass for subdomain discovery
   */
  private async runAmass(domain: string, timeout?: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const args = ['enum', '-d', domain, '-json', '-'];
      const process = spawn(this.amassPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: (timeout || this.timeout) * 1000,
      });

      let output = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0 || code === 1) {
          const subdomains = this.parseAmassOutput(output);
          resolve(subdomains);
        } else {
          reject(new Error(`Amass exited with code ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  /**
   * Parse Amass JSON output
   */
  private parseAmassOutput(output: string): string[] {
    const subdomains: string[] = [];

    for (const line of output.trim().split('\n')) {
      if (!line.trim()) continue;

      try {
        const result = JSON.parse(line);
        if (result.name) {
          subdomains.push(result.name);
        }
      } catch {
        // Ignore parse errors
      }
    }

    return subdomains;
  }

  /**
   * Discover API endpoints for a domain
   */
  async discoverAPIs(domain: string, options?: {
    wordlist?: string;
    extensions?: string[];
    threads?: number;
    timeout?: number;
  }): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const args = [
        'scan',
        '-d', domain,
        '-w', options?.wordlist || 'assets/kiterunner/routes.kite',
        '-o', 'json',
        '-',
      ];

      const timeoutMs = (options?.timeout || this.timeout) * 1000;

      const process = spawn(this.kiterunnerPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';

      // Timeout handler
      const timeoutHandle = setTimeout(() => {
        process.kill('SIGTERM');
        resolve([]);
      }, timeoutMs);

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        clearTimeout(timeoutHandle);
        if (code === 0 || code === 1) {
          const endpoints = this.parseKiterunnerOutput(output);
          resolve(endpoints);
        } else {
          // Kiterunner might not be available, return empty
          resolve([]);
        }
      });

      process.on('error', () => {
        clearTimeout(timeoutHandle);
        resolve([]); // Tool not available
      });
    });
  }

  /**
   * Parse Kiterunner JSON output
   */
  private parseKiterunnerOutput(output: string): string[] {
    const endpoints: string[] = [];

    for (const line of output.trim().split('\n')) {
      if (!line.trim()) continue;

      try {
        const result = JSON.parse(line);
        if (result.path) {
          endpoints.push(result.path);
        }
      } catch {
        // Ignore parse errors
      }
    }

    return endpoints;
  }

  /**
   * Scan hosts for technology stack
   */
  async scanHosts(hosts: string[], options?: {
    ports?: string[];
    techStack?: boolean;
    statusCode?: boolean;
  }): Promise<HostScanResult[]> {
    return new Promise((resolve, reject) => {
      const args = [
        '-l', '-',
        '-json',
      ];

      if (options?.ports) {
        args.push('-p', options.ports.join(','));
      }

      if (options?.techStack) {
        args.push('-tech-detect');
      }

      const process = spawn(this.httpxPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: (this.timeout * hosts.length) * 1000,
      });

      let output = '';
      const input = hosts.join('\n');

      process.stdin.write(input);
      process.stdin.end();

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        // Ignore stderr
      });

      process.on('close', (code) => {
        if (code === 0) {
          const results = this.parseHttpxOutput(output);
          resolve(results);
        } else {
          resolve([]); // Tool might not be available
        }
      });

      process.on('error', () => {
        resolve([]); // Tool not available
      });
    });
  }

  /**
   * Parse httpx JSON output
   */
  private parseHttpxOutput(output: string): HostScanResult[] {
    const results: HostScanResult[] = [];

    for (const line of output.trim().split('\n')) {
      if (!line.trim()) continue;

      try {
        const result = JSON.parse(line);
        results.push({
          url: result.url || result.input,
          ip: result.ip,
          title: result.title,
          statusCode: result.status_code,
          technologies: result.technologies || [],
          webServer: result.web_server,
          contentType: result.content_type,
        });
      } catch {
        // Ignore parse errors
      }
    }

    return results;
  }

  /**
   * Scan container image for vulnerabilities
   */
  async scanContainerImage(image: string, options?: {
    severity?: string[];
    format?: 'json' | 'table';
  }): Promise<Vulnerability[]> {
    return new Promise((resolve, reject) => {
      const args = [
        'image',
        image,
        '--format', options?.format || 'json',
      ];

      if (options?.severity) {
        args.push('--severity', options.severity.join(','));
      }

      const process = spawn(this.trivyPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: (this.timeout * 2) * 1000, // Longer timeout for container scans
      });

      let output = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          const vulnerabilities = this.parseTrivyOutput(output, image);
          resolve(vulnerabilities);
        } else {
          resolve([]); // Tool might not be available
        }
      });

      process.on('error', () => {
        resolve([]); // Tool not available
      });
    });
  }

  /**
   * Parse Trivy JSON output
   */
  private parseTrivyOutput(output: string, image: string): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];

    try {
      const result = JSON.parse(output);

      if (result.Results) {
        for (const res of result.Results) {
          if (res.Vulnerabilities) {
            for (const vuln of res.Vulnerabilities) {
              vulnerabilities.push({
                id: generateId('trivy'),
                source: 'trivy',
                name: vuln.VulnerabilityID,
                description: vuln.Description || '',
                severity: this.mapTrivySeverity(vuln.Severity),
                confidence: 'high',
                url: image,
                method: 'IMAGE_SCAN',
                timestamp: new Date(),
                remediation: vuln.InstalledVersion,
              });
            }
          }
        }
      }
    } catch {
      // Not valid JSON
    }

    return vulnerabilities;
  }

  /**
   * Map Trivy severity to internal severity
   */
  private mapTrivySeverity(severity: string): 'critical' | 'high' | 'medium' | 'low' | 'informational' {
    const map: Record<string, 'critical' | 'high' | 'medium' | 'low' | 'informational'> = {
      CRITICAL: 'critical',
      HIGH: 'high',
      MEDIUM: 'medium',
      LOW: 'low',
      UNKNOWN: 'informational',
    };
    return map[severity.toUpperCase()] || 'informational';
  }

  /**
   * Scan target for open ports
   */
  async scanPorts(target: string, options?: {
    ports?: string;
    flags?: string[];
  }): Promise<PortScanResult> {
    return new Promise((resolve) => {
      const args = [
        '-oX', '-', // XML output to stdout
        '-p', options?.ports || '1-1000', // Default to common ports
      ];

      if (options?.flags) {
        args.push(...options.flags);
      }

      args.push(target);

      const process = spawn(this.nmapPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: this.timeout * 1000,
      });

      let output = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        // Ignore stderr
      });

      process.on('close', (code) => {
        if (code === 0) {
          const result = this.parseNmapOutput(output);
          resolve(result);
        } else {
          resolve({ target, ports: [], error: 'Scan failed' });
        }
      });

      process.on('error', () => {
        resolve({ target, ports: [], error: 'Tool not available' });
      });
    });
  }

  /**
   * Parse Nmap XML output
   */
  private parseNmapOutput(output: string): PortScanResult {
    const ports: PortInfo[] = [];

    // Simple regex-based parsing for common ports
    const portRegex = /<port\s+id="(\d+)"\s+protocol="(\w+)"[^>]*>[\s\S]*?<state\s+state="([^"]+)"[^>]*\/>/gi;
    let match;

    while ((match = portRegex.exec(output)) !== null) {
      const portId = parseInt(match[1], 10);
      const protocol = match[2];
      const state = match[3];

      if (state === 'open') {
        // Extract service info
        const serviceRegex = new RegExp(`<port[^>]*id="${portId}"[^>]*>[\\s\\S]*?<service[^>]*name="([^"]+)"[^>]*>`, 'i');
        const serviceMatch = serviceRegex.exec(output);

        const serviceInfo = output.substring(match.index).match(/<service[^>]*name="([^"]+)"[^>]*>/i);

        ports.push({
          port: portId,
          protocol: protocol as 'tcp' | 'udp',
          state: 'open',
          service: serviceInfo?.[1] || 'unknown',
        });
      }
    }

    // Extract hostname if available
    const hostnameMatch = output.match(/<hostname\s+name="([^"]+)"[^>]*\/>/i);

    return {
      target: hostnameMatch?.[1] || '',
      ports,
    };
  }

  /**
   * Run full asset discovery
   */
  async runFullDiscovery(domain: string): Promise<DiscoveryResult> {
    this.isRunning = true;
    const result: DiscoveryResult = {
      domain,
      subdomains: [],
      apiEndpoints: [],
      hostScans: [],
      portScans: [],
      vulnerabilities: [],
      timestamp: new Date(),
    };

    try {
      // Discover subdomains
      this.emit('phase', { name: 'subdomain-enumeration' });
      result.subdomains = await this.discoverSubdomains(domain);

      // If subdomains found, scan them
      if (result.subdomains.length > 0) {
        this.emit('phase', { name: 'host-scanning' });
        result.hostScans = await this.scanHosts(result.subdomains);
      }

      // Discover API endpoints
      this.emit('phase', { name: 'api-discovery' });
      result.apiEndpoints = await this.discoverAPIs(domain);

      // Scan ports for main domain
      this.emit('phase', { name: 'port-scanning' });
      const portScan = await this.scanPorts(domain);
      result.portScans = [portScan];

      this.emit('completed', result);
    } catch (error) {
      this.emit('error', { error });
    } finally {
      this.isRunning = false;
    }

    return result;
  }

  /**
   * Cancel running discovery
   */
  cancel(): void {
    this.isRunning = false;
    this.emit('cancelled');
  }

  /**
   * Check if discovery is running
   */
  isDiscoveryRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.removeAllListeners();
  }
}

// Types
interface HostScanResult {
  url: string;
  ip?: string;
  title?: string;
  statusCode?: number;
  technologies: string[];
  webServer?: string;
  contentType?: string;
}

interface PortScanResult {
  target: string;
  ports: PortInfo[];
  error?: string;
}

interface PortInfo {
  port: number;
  protocol: 'tcp' | 'udp';
  state: 'open' | 'closed' | 'filtered';
  service?: string;
}

interface DiscoveryResult {
  domain: string;
  subdomains: string[];
  apiEndpoints: string[];
  hostScans: HostScanResult[];
  portScans: PortScanResult[];
  vulnerabilities: Vulnerability[];
  timestamp: Date;
}

// Export singleton
let assetDiscoveryInstance: AssetDiscovery | null = null;

export function getAssetDiscovery(): AssetDiscovery {
  if (!assetDiscoveryInstance) {
    assetDiscoveryInstance = new AssetDiscovery();
  }
  return assetDiscoveryInstance;
}

export function resetAssetDiscovery(): void {
  if (assetDiscoveryInstance) {
    assetDiscoveryInstance.dispose();
    assetDiscoveryInstance = null;
  }
}
