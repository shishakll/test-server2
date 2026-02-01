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
  getDomain,
  formatDate,
  formatTimestamp,
  now,
  deepClone,
  throttle,
  getFileExtension,
  capitalize,
  toTitleCase,
  truncate,
  parseUserAgent,
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

  describe('debounce', () => {
    it('should delay function execution', async () => {
      let count = 0;
      const debouncedFn = debounce(() => { count++; }, 100);

      debouncedFn();
      expect(count).toBe(0);

      await sleep(150);
      expect(count).toBe(1);
    });

    it('should only call function once for multiple rapid calls', async () => {
      let count = 0;
      const debouncedFn = debounce(() => { count++; }, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      await sleep(150);
      expect(count).toBe(1);
    });

    it('should pass arguments to function', async () => {
      let result: unknown[] = [];
      const debouncedFn = debounce((...args: unknown[]) => { result = args; }, 100);

      debouncedFn('arg1', 'arg2', 123);

      await sleep(150);
      expect(result).toEqual(['arg1', 'arg2', 123]);
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

  describe('getDomain', () => {
    it('should extract domain from hostname', () => {
      expect(getDomain('example.com')).toBe('example.com');
      expect(getDomain('sub.example.com')).toBe('example.com');
      expect(getDomain('sub.sub.example.com')).toBe('example.com');
    });
  });

  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date(2024, 0, 15, 10, 30);
      const result = formatDate(date);
      expect(result).toContain('Jan');
      expect(result).toContain('15');
    });
    it('should handle string date input', () => {
      const result = formatDate('2024-01-15T10:30:00Z');
      expect(result).toContain('Jan');
    });
  });

  describe('formatTimestamp', () => {
    it('should format timestamp to ISO string', () => {
      const date = new Date(2024, 0, 15, 10, 30, 0);
      const result = formatTimestamp(date);
      expect(result).toContain('2024-01-15');
      expect(result).toContain('T');
    });
  });

  describe('now', () => {
    it('should return current date', () => {
      const before = new Date();
      const result = now();
      const after = new Date();
      expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('deepClone', () => {
    it('should deep clone objects', () => {
      const original = { a: 1, b: { c: 2 } };
      const cloned = deepClone(original);
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.b).not.toBe(original.b);
    });
    it('should deep clone arrays', () => {
      const original = [1, 2, { a: 3 }];
      const cloned = deepClone(original);
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
    });
  });

  describe('throttle', () => {
    it('should limit function calls', async () => {
      let count = 0;
      const throttled = throttle(() => { count++; }, 50);

      throttled();
      throttled();
      throttled();
      expect(count).toBe(1);

      await sleep(60);
      throttled();
      expect(count).toBe(2);
    });
  });

  describe('getFileExtension', () => {
    it('should extract file extension', () => {
      expect(getFileExtension('file.txt')).toBe('txt');
      expect(getFileExtension('path/to/file.tsx')).toBe('tsx');
      expect(getFileExtension('noextension')).toBe('');
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('HELLO')).toBe('HELLO'); // only first letter is capitalized
      expect(capitalize('')).toBe('');
    });
  });

  describe('toTitleCase', () => {
    it('should convert to title case', () => {
      expect(toTitleCase('hello world')).toBe('Hello World');
      expect(toTitleCase('hello-world')).toBe('Hello World');
      expect(toTitleCase('hello_world')).toBe('Hello World');
    });
  });

  describe('truncate', () => {
    it('should truncate long strings', () => {
      expect(truncate('hello world', 8)).toBe('hello...');
      expect(truncate('hi', 8)).toBe('hi');
      expect(truncate('', 5)).toBe('');
    });
  });

  describe('parseUserAgent', () => {
    it('should parse Chrome user agent', () => {
      const result = parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      expect(result.browser).toBe('Chrome');
      expect(result.version).toBe('120');
      expect(result.os).toBe('Windows NT 10.0');
    });
    it('should parse Firefox user agent', () => {
      const result = parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0');
      expect(result.browser).toBe('Firefox');
      expect(result.version).toBe('121');
    });
  });
});
