/**
 * Utility functions for the Security Scanner application
 */

/**
 * Generate a unique ID for scans, sessions, etc.
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}-${timestamp}-${randomPart}` : `${timestamp}-${randomPart}`;
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Extract hostname from URL
 */
export function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Extract domain from hostname
 */
export function getDomain(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join('.');
}

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Format timestamp to readable date string
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Format timestamp to ISO string
 */
export function formatTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Get current timestamp
 */
export function now(): Date {
  return new Date();
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Get file extension from path
 */
export function getFileExtension(path: string): string {
  const parts = path.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

/**
 * Read file content safely
 */
export async function readFileSafe(path: string): Promise<string | null> {
  try {
    const fs = await import('fs/promises');
    return await fs.readFile(path, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Write file content safely
 */
export async function writeFileSafe(
  path: string,
  content: string
): Promise<boolean> {
  try {
    const fs = await import('fs/promises');
    await fs.writeFile(path, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Create directory if it doesn't exist
 */
export async function ensureDirectory(path: string): Promise<void> {
  try {
    const fs = await import('fs/promises');
    await fs.mkdir(path, { recursive: true });
  } catch (error) {
    console.error(`Failed to create directory: ${path}`, error);
  }
}

/**
 * Check if directory exists
 */
export async function directoryExists(path: string): Promise<boolean> {
  try {
    const fs = await import('fs/promises');
    const stat = await fs.stat(path);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Delete file safely
 */
export async function deleteFile(path: string): Promise<boolean> {
  try {
    const fs = await import('fs/promises');
    await fs.unlink(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * List files in directory
 */
export async function listFiles(
  directory: string,
  extensions?: string[]
): Promise<string[]> {
  try {
    const fs = await import('fs/promises');
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = entries
      .filter(entry => entry.isFile())
      .map(entry => entry.name);

    if (extensions && extensions.length > 0) {
      return files.filter(file => {
        const ext = getFileExtension(file);
        return extensions.includes(ext);
      });
    }

    return files;
  } catch {
    return [];
  }
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 255);
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert to title case
 */
export function toTitleCase(str: string): string {
  return str
    .split(/[\s-_]+/)
    .map(word => capitalize(word))
    .join(' ');
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitive(data: string): string {
  const sensitivePatterns = [
    /password["']?\s*[:=]\s*["']?[^"']+["']?/gi,
    /api[_-]?key["']?\s*[:=]\s*["']?[^"']+["']?/gi,
    /token["']?\s*[:=]\s*["']?[^"']+["']?/gi,
    /authorization["']?\s*[:=]\s*["']?[^"']+["']?/gi,
  ];

  let masked = data;
  for (const pattern of sensitivePatterns) {
    masked = masked.replace(pattern, match => {
      const parts = match.split(/[:=]/);
      if (parts.length > 1) {
        return `${parts[0]}: "***MASKED***"`;
      }
      return '"***MASKED***"';
    });
  }

  return masked;
}

/**
 * Parse User-Agent string to extract browser info
 */
export function parseUserAgent(ua: string): {
  browser: string;
  version: string;
  os: string;
} {
  const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/(\d+)/);
  const osMatch = ua.match(/\(([^)]+)\)/);

  return {
    browser: browserMatch?.[1] || 'Unknown',
    version: browserMatch?.[2] || 'Unknown',
    os: osMatch?.[1]?.split(';')[0]?.trim() || 'Unknown',
  };
}
