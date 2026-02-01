import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateId,
  isValidUrl,
  getHostname,
  formatDuration,
  sleep,
  debounce,
  sanitizeFilename,
  maskSensitive,
} from '../src/utils';

describe('Utils', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
    it('should generate IDs with optional prefix', () => {
      const id = generateId('test');
      expect(id.startsWith('test-')).toBe(true);
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
    });
    it('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('getHostname', () => {
    it('should extract hostname from URL', () => {
      expect(getHostname('https://example.com/path')).toBe('example.com');
      expect(getHostname('http://localhost:3000/api')).toBe('localhost');
    });
    it('should return empty string for invalid URLs', () => {
      expect(getHostname('not-a-url')).toBe('');
    });
  });

  describe('formatDuration', () => {
    it('should format zero duration', () => {
      expect(formatDuration(0)).toBe('0ms');
    });
    it('should format milliseconds for small durations', () => {
      expect(formatDuration(30)).toBe('30ms');
    });
    it('should format seconds with decimal', () => {
      expect(formatDuration(30000)).toBe('30.0s');
    });
    it('should format minutes with decimal', () => {
      expect(formatDuration(90000)).toBe('1.5m');
    });
  });

  describe('sleep', () => {
    it('should resolve after specified time', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });
  });

  describe('sanitizeFilename', () => {
    it('should sanitize filenames by replacing non-alphanumeric chars', () => {
      expect(sanitizeFilename('my file.txt')).toBe('my_file_txt');
      expect(sanitizeFilename('../../etc/passwd')).toBe('_etc_passwd');
    });
  });

  describe('maskSensitive', () => {
    it('should mask sensitive patterns in data', () => {
      expect(maskSensitive('password=secret123')).toContain('***MASKED***');
      expect(maskSensitive('api_key=abc123')).toContain('***MASKED***');
    });
    it('should leave non-sensitive data unchanged', () => {
      expect(maskSensitive('hello world')).toBe('hello world');
    });
  });
});
