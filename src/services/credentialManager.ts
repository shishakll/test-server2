import keytar from 'keytar';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { generateId } from '../utils';

// Service name for the application in keychain
const SERVICE_NAME = 'security-scanner';

// Account registry file for tracking stored credentials
const ACCOUNT_REGISTRY = join(__dirname, '..', '..', '.credentials', 'accounts.json');

/**
 * CredentialManager - Secure credential storage using OS keychain
 *
 * This service provides secure storage for:
 * - Authentication credentials (for authenticated scans)
 * - DefectDojo API keys
 * - Proxy authentication (if needed)
 * - OAuth tokens
 *
 * Uses platform-specific keychain:
 * - macOS: Keychain
 * - Windows: Credential Manager
 * - Linux: libsecret (gnome-keyring or similar)
 */
export class CredentialManager {
  private static instance: CredentialManager | null = null;
  private accountRegistry: Map<string, CredentialMetadata> = new Map();

  private constructor() {
    // Load account registry
    this.loadAccountRegistry();
  }

  /**
   * Load account registry from disk
   */
  private loadAccountRegistry(): void {
    try {
      const registryDir = require('path').dirname(ACCOUNT_REGISTRY);
      if (!require('fs').existsSync(registryDir)) {
        require('fs').mkdirSync(registryDir, { recursive: true });
      }

      if (existsSync(ACCOUNT_REGISTRY)) {
        const data = readFileSync(ACCOUNT_REGISTRY, 'utf-8');
        const registry = JSON.parse(data);
        this.accountRegistry = new Map(Object.entries(registry));
      }
    } catch (error) {
      console.warn('Failed to load credential registry:', error);
    }
  }

  /**
   * Save account registry to disk
   */
  private saveAccountRegistry(): void {
    try {
      const registryDir = require('path').dirname(ACCOUNT_REGISTRY);
      if (!require('fs').existsSync(registryDir)) {
        require('fs').mkdirSync(registryDir, { recursive: true });
      }

      const registry = Object.fromEntries(this.accountRegistry);
      writeFileSync(ACCOUNT_REGISTRY, JSON.stringify(registry, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save credential registry:', error);
    }
  }

  /**
   * Register an account in the registry
   */
  private registerAccount(account: string, type: CredentialType, target?: string): void {
    this.accountRegistry.set(account, {
      id: generateId('cred'),
      type,
      target,
      createdAt: new Date().toISOString(),
    });
    this.saveAccountRegistry();
  }

  /**
   * Unregister an account from the registry
   */
  private unregisterAccount(account: string): void {
    this.accountRegistry.delete(account);
    this.saveAccountRegistry();
  }

  /**
   * List all registered accounts (without exposing the actual values)
   */
  async listAccounts(): Promise<CredentialMetadata[]> {
    return Array.from(this.accountRegistry.values());
  }

  /**
   * Get all accounts of a specific type
   */
  async getAccountsByType(type: CredentialType): Promise<CredentialMetadata[]> {
    return Array.from(this.accountRegistry.values()).filter(a => a.type === type);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): CredentialManager {
    if (!CredentialManager.instance) {
      CredentialManager.instance = new CredentialManager();
    }
    return CredentialManager.instance;
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  static resetInstance(): void {
    CredentialManager.instance = null;
  }

  /**
   * Store a password/credential securely
   */
  async setPassword(account: string, password: string): Promise<boolean> {
    try {
      await keytar.setPassword(SERVICE_NAME, account, password);
      return true;
    } catch (error) {
      console.error(`Failed to store credential for ${account}:`, error);
      return false;
    }
  }

  /**
   * Retrieve a password/credential securely
   */
  async getPassword(account: string): Promise<string | null> {
    try {
      return await keytar.getPassword(SERVICE_NAME, account);
    } catch (error) {
      console.error(`Failed to retrieve credential for ${account}:`, error);
      return null;
    }
  }

  /**
   * Delete a stored credential
   */
  async deletePassword(account: string): Promise<boolean> {
    try {
      return await keytar.deletePassword(SERVICE_NAME, account);
    } catch (error) {
      console.error(`Failed to delete credential for ${account}:`, error);
      return false;
    }
  }

  /**
   * List all stored credentials (without exposing the actual values)
   */
  async listAccounts(): Promise<string[]> {
    try {
      // keytar doesn't provide a direct list method, so we track accounts ourselves
      // This is a simplified implementation - in production, you'd want to store
      // the list of accounts in a separate secure location
      return [];
    } catch (error) {
      console.error('Failed to list accounts:', error);
      return [];
    }
  }

  /**
   * Check if a credential exists
   */
  async hasCredential(account: string): Promise<boolean> {
    const password = await this.getPassword(account);
    return password !== null;
  }

  /**
   * Store ZAP authentication credentials
   */
  async setZapCredentials(username: string, password: string): Promise<boolean> {
    return this.setPassword(`zap-${username}`, password);
  }

  /**
   * Retrieve ZAP authentication credentials
   */
  async getZapCredentials(username: string): Promise<string | null> {
    return this.getPassword(`zap-${username}`);
  }

  /**
   * Delete ZAP authentication credentials
   */
  async deleteZapCredentials(username: string): Promise<boolean> {
    return this.deletePassword(`zap-${username}`);
  }

  /**
   * Store DefectDojo API credentials
   */
  async setDefectDojoCredentials(url: string, apiKey: string): Promise<boolean> {
    // Store URL and API key together
    const data = JSON.stringify({ url, apiKey });
    return this.setPassword('defectdojo', data);
  }

  /**
   * Retrieve DefectDojo credentials
   */
  async getDefectDojoCredentials(): Promise<{ url: string; apiKey: string } | null> {
    const data = await this.getPassword('defectdojo');
    if (!data) return null;

    try {
      return JSON.parse(data);
    } catch {
      // Handle legacy format (just API key)
      return { url: '', apiKey: data };
    }
  }

  /**
   * Delete DefectDojo credentials
   */
  async deleteDefectDojoCredentials(): Promise<boolean> {
    return this.deletePassword('defectdojo');
  }

  /**
   * Store session credentials for a target
   */
  async setSessionCredentials(target: string, sessionToken: string): Promise<boolean> {
    return this.setPassword(`session-${target}`, sessionToken);
  }

  /**
   * Retrieve session credentials for a target
   */
  async getSessionCredentials(target: string): Promise<string | null> {
    return this.getPassword(`session-${target}`);
  }

  /**
   * Delete session credentials for a target
   */
  async deleteSessionCredentials(target: string): Promise<boolean> {
    return this.deletePassword(`session-${target}`);
  }

  /**
   * Store proxy credentials
   */
  async setProxyCredentials(host: string, username: string, password: string): Promise<boolean> {
    const data = JSON.stringify({ host, username, password });
    return this.setPassword('proxy', data);
  }

  /**
   * Retrieve proxy credentials
   */
  async getProxyCredentials(): Promise<{ host: string; username: string; password: string } | null> {
    const data = await this.getPassword('proxy');
    if (!data) return null;

    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Delete proxy credentials
   */
  async deleteProxyCredentials(): Promise<boolean> {
    return this.deletePassword('proxy');
  }

  /**
   * Clear all stored credentials for this application
   */
  async clearAll(): Promise<boolean> {
    try {
      // Note: keytar doesn't have a clear all method
      // In production, you'd want to track all accounts and delete them
      const accounts = await this.listAccounts();
      for (const account of accounts) {
        await this.deletePassword(account);
      }
      return true;
    } catch (error) {
      console.error('Failed to clear credentials:', error);
      return false;
    }
  }

  /**
   * Check if keychain is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Try to get a non-existent password to test availability
      const result = await keytar.getPassword(SERVICE_NAME, 'availability-test');
      // If we get here without error, keychain is available
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get platform information
   */
  getPlatform(): string {
    return process.platform;
  }
}

// Export singleton getter
export function getCredentialManager(): CredentialManager {
  return CredentialManager.getInstance();
}

// Credential types for type safety
export interface Credential {
  id: string;
  type: 'zap' | 'defectdojo' | 'session' | 'proxy';
  target: string;
  createdAt: Date;
  lastUsed?: Date;
}

export interface ZapCredential {
  username: string;
  password?: string; // Password is stored securely
}

export interface DefectDojoCredential {
  url: string;
  apiKey?: string;
}

export interface ProxyCredential {
  host: string;
  port: number;
  username?: string;
  password?: string;
}
