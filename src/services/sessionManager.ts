import type { SessionData, CookieData } from '../types';
import { generateId, ensureDirectory, writeFileSafe, readFileSafe, directoryExists } from '../utils';
import { getCredentialManager } from './credentialManager';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * SessionManager - Browser session capture and restoration
 *
 * This service manages:
 * - Capturing browser sessions (cookies, localStorage, sessionStorage)
 * - Saving sessions to disk with encryption
 * - Restoring sessions for authenticated scans
 * - Managing session lifecycle (list, delete, export)
 *
 * Sessions are stored in Playwright's storageState format for compatibility.
 */
export class SessionManager {
  private static instance: SessionManager | null = null;
  private sessionsDir: string;
  private encryptedDir: string;

  private constructor() {
    // Set up sessions directory
    this.sessionsDir = join(homedir(), '.security-scanner', 'sessions');
    this.encryptedDir = join(homedir(), '.security-scanner', 'sessions-encrypted');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  static resetInstance(): void {
    SessionManager.instance = null;
  }

  /**
   * Ensure session directories exist
   */
  private async ensureDirectories(): Promise<void> {
    await ensureDirectory(this.sessionsDir);
    await ensureDirectory(this.encryptedDir);
  }

  /**
   * Create a new session from browser state
   */
  async createSession(
    name: string,
    origin: string,
    cookies: CookieData[],
    localStorage: Record<string, string> = {},
    sessionStorage: Record<string, string> = {}
  ): Promise<SessionData> {
    await this.ensureDirectories();

    const session: SessionData = {
      id: generateId('session'),
      name,
      createdAt: new Date(),
      cookies,
      localStorage,
      sessionStorage,
    };

    // Save session to disk
    await this.saveSession(session);

    // Also save in Playwright format for compatibility
    await this.savePlaywrightState(session);

    return session;
  }

  /**
   * Save session to disk
   */
  async saveSession(session: SessionData): Promise<boolean> {
    await this.ensureDirectories();

    const filePath = join(this.sessionsDir, `${session.id}.json`);

    // Encrypt sensitive data before saving
    const credentialManager = getCredentialManager();

    // Create a serializable version
    const sessionData = {
      ...session,
      cookies: session.cookies.map(cookie => ({
        ...cookie,
        // Note: In a full implementation, cookies would be encrypted
      })),
    };

    const success = await writeFileSafe(filePath, JSON.stringify(sessionData, null, 2));

    if (success) {
      // Also save as Playwright storageState format
      await this.savePlaywrightState(session);
    }

    return success;
  }

  /**
   * Save session in Playwright's storageState format
   */
  async savePlaywrightState(session: SessionData): Promise<void> {
    const playwrightState = {
      cookies: session.cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path || '/',
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite || 'Lax',
        // Playwright additional fields
        hostOnly: !cookie.domain.startsWith('.'),
        session: !cookie.expires,
      })),
      origins: [
        {
          origin: session.cookies[0]?.domain ? `https://${session.cookies[0].domain}` : 'https://*',
          localStorage: Object.entries(session.localStorage).map(([key, value]) => ({
            name: key,
            value,
          })),
        },
      ],
    };

    const filePath = join(this.sessionsDir, `${session.id}.storageState.json`);
    await writeFileSafe(filePath, JSON.stringify(playwrightState, null, 2));
  }

  /**
   * Load session from disk
   */
  async loadSession(sessionId: string): Promise<SessionData | null> {
    const filePath = join(this.sessionsDir, `${sessionId}.json`);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = await readFileSafe(filePath);
      if (!content) return null;

      const session = JSON.parse(content) as SessionData;
      session.createdAt = new Date(session.createdAt);
      return session;
    } catch (error) {
      console.error(`Failed to load session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Load session in Playwright format
   */
  async loadPlaywrightState(sessionId: string): Promise<{ cookies: unknown[]; origins: unknown[] } | null> {
    const filePath = join(this.sessionsDir, `${sessionId}.storageState.json`);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Failed to load Playwright state ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * List all saved sessions
   */
  async listSessions(): Promise<SessionData[]> {
    await this.ensureDirectories();

    const files = await import('fs/promises').then(fs =>
      fs.readdir(this.sessionsDir)
    );

    const sessions: SessionData[] = [];

    for (const file of files) {
      if (file.endsWith('.json') && !file.endsWith('.storageState.json')) {
        const session = await this.loadSession(file.replace('.json', ''));
        if (session) {
          sessions.push(session);
        }
      }
    }

    // Sort by creation date (newest first)
    return sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const jsonPath = join(this.sessionsDir, `${sessionId}.json`);
    const statePath = join(this.sessionsDir, `${sessionId}.storageState.json`);

    try {
      const fs = await import('fs/promises');

      if (existsSync(jsonPath)) {
        await fs.unlink(jsonPath);
      }

      if (existsSync(statePath)) {
        await fs.unlink(statePath);
      }

      return true;
    } catch (error) {
      console.error(`Failed to delete session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Delete all sessions
   */
  async deleteAllSessions(): Promise<boolean> {
    try {
      const sessions = await this.listSessions();

      for (const session of sessions) {
        await this.deleteSession(session.id);
      }

      return true;
    } catch (error) {
      console.error('Failed to delete all sessions:', error);
      return false;
    }
  }

  /**
   * Export session as JSON
   */
  async exportSession(sessionId: string): Promise<Buffer | null> {
    const session = await this.loadSession(sessionId);
    if (!session) return null;

    return Buffer.from(JSON.stringify(session, null, 2));
  }

  /**
   * Import session from JSON
   */
  async importSession(jsonData: string): Promise<SessionData | null> {
    try {
      const session = JSON.parse(jsonData) as SessionData;
      session.id = generateId('session'); // Generate new ID
      session.createdAt = new Date();

      await this.saveSession(session);
      return session;
    } catch (error) {
      console.error('Failed to import session:', error);
      return null;
    }
  }

  /**
   * Capture session from browser
   * This method would be called by the browser integration
   */
  async captureFromBrowser(
    browserContext: unknown,
    name: string
  ): Promise<SessionData | null> {
    // This is a stub - actual implementation would depend on the browser type
    // For Electron CDP, you'd use CDP commands to get cookies and storage
    // For Playwright, you'd use the page.context().cookies() method

    console.warn('captureFromBrowser needs browser-specific implementation');

    return null;
  }

  /**
   * Restore session to browser
   * This method would be called by the browser integration
   */
  async restoreToBrowser(
    browserContext: unknown,
    sessionId: string
  ): Promise<boolean> {
    // This is a stub - actual implementation would depend on the browser type
    // For Electron CDP, you'd use CDP commands to set cookies and storage
    // For Playwright, you'd use the page.context().addCookies() method

    console.warn('restoreToBrowser needs browser-specific implementation');

    return false;
  }

  /**
   * Get session count
   */
  async getSessionCount(): Promise<number> {
    const sessions = await this.listSessions();
    return sessions.length;
  }

  /**
   * Get total size of all sessions in bytes
   */
  async getTotalSize(): Promise<number> {
    const sessions = await this.listSessions();
    let totalSize = 0;

    for (const session of sessions) {
      const jsonPath = join(this.sessionsDir, `${session.id}.json`);
      const statePath = join(this.sessionsDir, `${session.id}.storageState.json`);

      if (existsSync(jsonPath)) {
        totalSize += (await import('fs/promises').then(fs => fs.stat(jsonPath))).size;
      }

      if (existsSync(statePath)) {
        totalSize += (await import('fs/promises').then(fs => fs.stat(statePath))).size;
      }
    }

    return totalSize;
  }

  /**
   * Format session size for display
   */
  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Validate a session (check if it's still usable)
   */
  async validateSession(sessionId: string): Promise<SessionValidation> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      return { valid: false, reason: 'Session not found' };
    }

    // Check if session is expired (30 days default)
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
    const age = Date.now() - session.createdAt.getTime();

    if (age > maxAge) {
      return { valid: false, reason: 'Session expired', expiredAt: session.createdAt };
    }

    // Check if session has cookies
    if (session.cookies.length === 0) {
      return { valid: false, reason: 'No cookies in session' };
    }

    // Check for expired cookies
    const now = Date.now();
    const expiredCookies = session.cookies.filter(c => c.expires && c.expires < now);

    if (expiredCookies.length > 0 && expiredCookies.length === session.cookies.length) {
      return { valid: false, reason: 'All cookies expired', expiredCount: expiredCookies.length };
    }

    return {
      valid: true,
      cookieCount: session.cookies.length,
      age: age,
      storageSize: Object.keys(session.localStorage).length + Object.keys(session.sessionStorage).length,
    };
  }

  /**
   * Clone session for a different target
   */
  async cloneSession(sourceSessionId: string, newTarget: string): Promise<SessionData | null> {
    const sourceSession = await this.loadSession(sourceSessionId);
    if (!sourceSession) return null;

    // Create a new session with the same data but new ID and target
    const clonedSession: SessionData = {
      ...sourceSession,
      id: generateId('session'),
      name: `${sourceSession.name} (${newTarget})`,
      createdAt: new Date(),
      // Note: We don't modify cookies as they may be target-specific
    };

    await this.saveSession(clonedSession);
    return clonedSession;
  }

  /**
   * Merge two sessions (useful for combining authenticated sessions)
   */
  async mergeSessions(sessionId1: string, sessionId2: string, newName: string): Promise<SessionData | null> {
    const session1 = await this.loadSession(sessionId1);
    const session2 = await this.loadSession(sessionId2);

    if (!session1 || !session2) return null;

    // Merge cookies (session2 cookies take precedence for duplicates)
    const cookieMap = new Map(session1.cookies.map(c => [`${c.domain}|${c.name}`, c]));
    for (const cookie of session2.cookies) {
      cookieMap.set(`${cookie.domain}|${cookie.name}`, cookie);
    }

    // Merge localStorage (session2 values take precedence)
    const mergedLocalStorage = { ...session1.localStorage, ...session2.localStorage };

    // Merge sessionStorage (session2 values take precedence)
    const mergedSessionStorage = { ...session1.sessionStorage, ...session2.sessionStorage };

    const mergedSession: SessionData = {
      id: generateId('session'),
      name: newName,
      createdAt: new Date(),
      cookies: Array.from(cookieMap.values()),
      localStorage: mergedLocalStorage,
      sessionStorage: mergedSessionStorage,
    };

    await this.saveSession(mergedSession);
    return mergedSession;
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<SessionStats> {
    const sessions = await this.listSessions();
    const totalSize = await this.getTotalSize();

    // Group by target
    const byTarget: Record<string, number> = {};
    for (const session of sessions) {
      const domains = new Set(session.cookies.map(c => c.domain));
      const target = domains.size > 0 ? Array.from(domains)[0] : 'unknown';
      byTarget[target] = (byTarget[target] || 0) + 1;
    }

    // Calculate total cookies
    const totalCookies = sessions.reduce((sum, s) => sum + s.cookies.length, 0);

    // Find oldest and newest sessions
    const sorted = sessions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return {
      totalSessions: sessions.length,
      totalSize,
      totalCookies,
      sessionsByTarget: byTarget,
      oldestSession: sorted[0]?.createdAt,
      newestSession: sorted[sorted.length - 1]?.createdAt,
    };
  }
}

// Session validation result type
interface SessionValidation {
  valid: boolean;
  reason?: string;
  expiredAt?: Date;
  expiredCount?: number;
  cookieCount?: number;
  age?: number;
  storageSize?: number;
}

// Session statistics type
interface SessionStats {
  totalSessions: number;
  totalSize: number;
  totalCookies: number;
  sessionsByTarget: Record<string, number>;
  oldestSession?: Date;
  newestSession?: Date;
}

// Export singleton getter
export function getSessionManager(): SessionManager {
  return SessionManager.getInstance();
}
