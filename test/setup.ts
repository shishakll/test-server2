// Vitest setup file
import { beforeEach, afterEach, vi } from 'vitest';

// Mock window object for jsdom
global.window = {
  electronAPI: {
    getAppVersion: vi.fn().mockResolvedValue('1.0.0'),
    getPlatform: vi.fn().mockResolvedValue('darwin'),
    getResourcesPath: vi.fn().mockResolvedValue('/test/resources'),
  },
  browserAPI: {},
} as unknown as Window & typeof globalThis;

// Mock navigator
global.navigator = {
  userAgent: 'Mozilla/5.0 (Test) AppleWebKit/537.36',
  language: 'en-US',
} as unknown as Navigator;

// Mock document
global.document = {
  getElementById: vi.fn(),
  createElement: vi.fn(),
  title: 'Security Scanner',
} as unknown as Document;

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
  vi.resetAllMocks();
});

// Increase timeout for async tests
vi.setConfig({ testTimeout: 10000 });
