import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScanStore, useSettingsStore, useSessionStore, useUIStore } from '../src/stores';
import type { ScanConfig, Vulnerability } from '../src/types';

describe('Stores', () => {
  beforeEach(() => {
    // Reset all stores before each test
    useScanStore.setState({
      currentScan: null,
      scanState: null,
      vulnerabilities: [],
      isScanning: false,
      canCancel: false,
      scanProgress: null,
      currentPhase: '',
      error: null,
      scanConfig: {
        targetUrl: '',
        targetHosts: [],
        browser: [],
        securityTools: [],
        assetDiscovery: false,
        ai: { enabled: false },
      },
    });

    useSettingsStore.setState({
      theme: 'system',
      language: 'en',
      autoUpdate: true,
      telemetry: false,
      proxy: { enabled: false },
      toolPaths: {},
      defectDojo: null,
      ai: null,
    });

    useSessionStore.setState({
      sessions: [],
      currentSession: null,
    });

    useUIStore.setState({
      activeView: 'dashboard',
      sidebarOpen: true,
      notifications: [],
    });
  });

  describe('useScanStore', () => {
    it('should have initial state', () => {
      const store = useScanStore.getState();
      expect(store.isScanning).toBe(false);
      expect(store.vulnerabilities).toEqual([]);
      expect(store.scanConfig).toBeDefined();
    });

    it('should update scan config', () => {
      const newConfig: ScanConfig = {
        targetUrl: 'https://test.example.com',
        browser: ['cdp'],
        securityTools: ['zap'],
      };

      act(() => {
        useScanStore.setState({ scanConfig: newConfig });
      });

      expect(useScanStore.getState().scanConfig.targetUrl).toBe('https://test.example.com');
    });

    it('should add vulnerabilities', () => {
      const vuln: Vulnerability = {
        id: 'test-123',
        source: 'zap',
        name: 'Test Vulnerability',
        description: 'Test description',
        severity: 'high',
        confidence: 'high',
        url: 'https://test.example.com',
        method: 'GET',
        timestamp: new Date(),
      };

      act(() => {
        useScanStore.setState((state) => ({
          vulnerabilities: [...state.vulnerabilities, vuln],
        }));
      });

      expect(useScanStore.getState().vulnerabilities).toHaveLength(1);
      expect(useScanStore.getState().vulnerabilities[0].name).toBe('Test Vulnerability');
    });

    it('should clear vulnerabilities', () => {
      const vuln: Vulnerability = {
        id: 'test-123',
        source: 'zap',
        name: 'Test Vulnerability',
        description: 'Test description',
        severity: 'high',
        confidence: 'high',
        url: 'https://test.example.com',
        method: 'GET',
        timestamp: new Date(),
      };

      act(() => {
        useScanStore.setState((state) => ({
          vulnerabilities: [...state.vulnerabilities, vuln],
        }));
        useScanStore.setState({ vulnerabilities: [] });
      });

      expect(useScanStore.getState().vulnerabilities).toEqual([]);
    });
  });

  describe('useSettingsStore', () => {
    it('should have initial state', () => {
      const store = useSettingsStore.getState();
      expect(store.theme).toBe('system');
      expect(store.language).toBe('en');
      expect(store.proxy.enabled).toBe(false);
    });

    it('should update theme', () => {
      act(() => {
        useSettingsStore.setState({ theme: 'dark' });
      });
      expect(useSettingsStore.getState().theme).toBe('dark');
    });

    it('should update language', () => {
      act(() => {
        useSettingsStore.setState({ language: 'ko' });
      });
      expect(useSettingsStore.getState().language).toBe('ko');
    });

    it('should update proxy settings', () => {
      act(() => {
        useSettingsStore.setState({
          proxy: {
            enabled: true,
            host: '127.0.0.1',
            port: 8080,
          },
        });
      });

      const proxy = useSettingsStore.getState().proxy;
      expect(proxy.enabled).toBe(true);
      expect(proxy.host).toBe('127.0.0.1');
      expect(proxy.port).toBe(8080);
    });
  });

  describe('useSessionStore', () => {
    it('should have initial state', () => {
      const store = useSessionStore.getState();
      expect(store.sessions).toEqual([]);
      expect(store.currentSession).toBeNull();
    });

    it('should add session', () => {
      const session = {
        id: 'session-123',
        targetUrl: 'https://example.com',
        startTime: new Date(),
      };

      act(() => {
        useSessionStore.setState((state) => ({
          sessions: [...state.sessions, session],
        }));
      });

      expect(useSessionStore.getState().sessions).toHaveLength(1);
    });

    it('should set current session', () => {
      const session = {
        id: 'session-123',
        targetUrl: 'https://example.com',
        startTime: new Date(),
      };

      act(() => {
        useSessionStore.setState({ currentSession: session });
      });

      expect(useSessionStore.getState().currentSession).toEqual(session);
    });
  });

  describe('useUIStore', () => {
    it('should have initial state', () => {
      const store = useUIStore.getState();
      expect(store.activeView).toBe('dashboard');
      expect(store.sidebarOpen).toBe(true);
      expect(store.notifications).toEqual([]);
    });

    it('should change active view', () => {
      act(() => {
        useUIStore.setState({ activeView: 'scan' });
      });
      expect(useUIStore.getState().activeView).toBe('scan');
    });

    it('should toggle sidebar', () => {
      const initial = useUIStore.getState().sidebarOpen;
      
      act(() => {
        useUIStore.setState({ sidebarOpen: !initial });
      });
      expect(useUIStore.getState().sidebarOpen).toBe(!initial);
    });

    it('should add notification', () => {
      act(() => {
        useUIStore.setState((state) => ({
          notifications: [
            ...state.notifications,
            { id: 'notif-1', type: 'info', message: 'Test notification' },
          ],
        }));
      });
      expect(useUIStore.getState().notifications).toHaveLength(1);
    });
  });
});
