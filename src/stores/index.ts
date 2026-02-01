import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ScanConfig,
  ScanState,
  ScanPhase,
  Vulnerability,
  VulnerabilitySummary,
  SessionData,
  AppSettings,
  ScanError,
  ProxyConfig,
} from '../types';
import { generateId } from '../utils';

// Default settings
const defaultSettings: AppSettings = {
  zap: {
    port: 8080,
    proxyPort: 8080,
    enabled: true,
    homeDirectory: '',
  },
  nuclei: {
    templatesPath: '',
    rateLimit: 150,
    concurrency: 25,
  },
  playwright: {
    headless: true,
  },
  defectDojo: {
    url: '',
    apiKey: '',
  },
  general: {
    dataDirectory: '',
    reportsDirectory: '',
    autoUpdate: true,
    telemetry: false,
  },
};

// Default UI settings
const defaultUIState = {
  theme: 'dark' as 'dark' | 'light',
  language: 'en' as string,
  sidebarCollapsed: false,
};

// Default proxy settings
const defaultProxy: ProxyConfig = {
  enabled: false,
  host: '127.0.0.1',
  port: 8080,
  username: '',
  password: '',
  bypassRules: '',
};

// Default defect dojo settings
const defaultDefectDojo = {
  url: '',
  apiKey: '',
};

// Default AI settings
const defaultAI = {
  enabled: false,
  provider: 'openai',
  model: 'gpt-4',
};

// Default tool paths
const defaultToolPaths = {
  zap: '',
  nuclei: '',
  subfinder: '',
  amass: '',
  trivy: '',
  nmap: '',
  playwright: '',
};

// Scan Store
interface ScanStore {
  // State
  currentScan: ScanConfig | null;
  scanState: ScanState | null;
  vulnerabilities: Vulnerability[];
  scanHistory: Array<{
    id: string;
    targetUrl?: string;
    targetHosts?: string[];
    status: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;
  }>;
  isScanning: boolean;
  canCancel: boolean;

  // Actions
  startScan: (config: ScanConfig) => void;
  pauseScan: () => void;
  resumeScan: () => void;
  updateProgress: (phase: ScanPhase, progress: number, message: string, currentUrl?: string) => void;
  addVulnerabilities: (vulns: Vulnerability[]) => void;
  completeScan: (success: boolean, errors?: ScanError[]) => void;
  cancelScan: () => void;
  resetScan: () => void;
  updateUrlCount: (count: number) => void;
  updateAlertCount: (count: number) => void;
  updateNucleiCount: (count: number) => void;
  addError: (error: ScanError) => void;
}

export const useScanStore = create<ScanStore>((set, get) => ({
  currentScan: null,
  scanState: null,
  vulnerabilities: [],
  scanHistory: [],
  isScanning: false,
  canCancel: false,

  startScan: (config: ScanConfig) => {
    const scanId = generateId('scan');
    set({
      currentScan: config,
      scanState: {
        scanId,
        status: 'browser_init',
        progress: 0,
        currentUrl: config.targetUrl || '',
        urlsDiscovered: 0,
        alertsFound: 0,
        nucleiFindings: 0,
        startTime: new Date(),
        errors: [],
      },
      vulnerabilities: [],
      isScanning: true,
      canCancel: true,
    });
  },

  pauseScan: () => {
    set(state => ({
      scanState: state.scanState
        ? { ...state.scanState, status: 'paused' as ScanPhase }
        : null,
    }));
  },

  resumeScan: () => {
    set(state => ({
      scanState: state.scanState
        ? { ...state.scanState, status: 'navigating' as ScanPhase }
        : null,
      isScanning: true,
    }));
  },

  updateProgress: (phase: ScanPhase, progress: number, message: string, currentUrl?: string) => {
    set(state => ({
      scanState: state.scanState
        ? {
            ...state.scanState,
            status: phase,
            progress,
            currentUrl: currentUrl ?? state.scanState.currentUrl,
          }
        : null,
    }));
  },

  addVulnerabilities: (vulns: Vulnerability[]) => {
    set(state => ({
      vulnerabilities: [...state.vulnerabilities, ...vulns],
    }));
  },

  completeScan: (success: boolean, errors?: ScanError[]) => {
    const state = get();
    const endTime = new Date();
    const duration = state.scanState
      ? endTime.getTime() - new Date(state.scanState.startTime).getTime()
      : 0;

    // Add to history
    const historyEntry = {
      id: state.scanState?.scanId || generateId('scan'),
      targetUrl: state.currentScan?.targetUrl,
      targetHosts: state.currentScan?.targetHosts,
      status: success ? 'completed' : 'failed',
      startTime: state.scanState?.startTime || new Date(),
      endTime,
      duration,
    };

    set(state => ({
      scanHistory: [...state.scanHistory, historyEntry],
      scanState: state.scanState
        ? {
            ...state.scanState,
            status: success ? 'completed' : 'failed',
            progress: 100,
            endTime,
            errors: errors ?? state.scanState.errors,
          }
        : null,
      isScanning: false,
      canCancel: false,
    }));
  },

  cancelScan: () => {
    const state = get();
    const endTime = new Date();
    const duration = state.scanState
      ? endTime.getTime() - new Date(state.scanState.startTime).getTime()
      : 0;

    const historyEntry = {
      id: state.scanState?.scanId || generateId('scan'),
      targetUrl: state.currentScan?.targetUrl,
      targetHosts: state.currentScan?.targetHosts,
      status: 'cancelled',
      startTime: state.scanState?.startTime || new Date(),
      endTime,
      duration,
    };

    set(state => ({
      scanHistory: [...state.scanHistory, historyEntry],
      scanState: state.scanState
        ? {
            ...state.scanState,
            status: 'cancelled',
            endTime,
          }
        : null,
      isScanning: false,
      canCancel: false,
    }));
  },

  resetScan: () => {
    set({
      currentScan: null,
      scanState: null,
      vulnerabilities: [],
      isScanning: false,
      canCancel: false,
    });
  },

  updateUrlCount: (count: number) => {
    set(state => ({
      scanState: state.scanState
        ? { ...state.scanState, urlsDiscovered: count }
        : null,
    }));
  },

  updateAlertCount: (count: number) => {
    set(state => ({
      scanState: state.scanState
        ? { ...state.scanState, alertsFound: count }
        : null,
    }));
  },

  updateNucleiCount: (count: number) => {
    set(state => ({
      scanState: state.scanState
        ? { ...state.scanState, nucleiFindings: count }
        : null,
    }));
  },

  addError: (error: ScanError) => {
    set(state => ({
      scanState: state.scanState
        ? { ...state.scanState, errors: [...state.scanState.errors, error] }
        : null,
    }));
  },
}));

// Settings Store - Direct property access for UI convenience
interface SettingsStore {
  // Direct properties for UI convenience
  theme: string;
  language: string;
  proxy: ProxyConfig;
  defectDojo: { url: string; apiKey: string } | null;
  ai: { enabled: boolean; provider: string; model: string } | null;
  toolPaths: Record<string, string>;

  // Actions
  setTheme: (theme: string) => void;
  setLanguage: (language: string) => void;
  setProxy: (proxy: ProxyConfig) => void;
  setDefectDojo: (config: { url: string; apiKey: string } | null) => void;
  setAI: (ai: { enabled: boolean; provider: string; model: string } | null) => void;
  setToolPath: (tool: string, path: string) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultUIState,
      proxy: defaultProxy,
      defectDojo: null,
      ai: null,
      toolPaths: defaultToolPaths,

      setTheme: (theme: string) => {
        set({ theme });
      },

      setLanguage: (language: string) => {
        set({ language });
      },

      setProxy: (proxy: ProxyConfig) => {
        set({ proxy });
      },

      setDefectDojo: (defectDojo: { url: string; apiKey: string } | null) => {
        set({ defectDojo });
      },

      setAI: (ai: { enabled: boolean; provider: string; model: string } | null) => {
        set({ ai });
      },

      setToolPath: (tool: string, path: string) => {
        set(state => ({
          toolPaths: { ...state.toolPaths, [tool]: path },
        }));
      },

      resetSettings: () => {
        set({
          ...defaultUIState,
          proxy: defaultProxy,
          defectDojo: null,
          ai: null,
          toolPaths: defaultToolPaths,
        });
      },
    }),
    {
      name: 'security-scanner-settings',
    }
  )
);

// Session Store
interface SessionStore {
  sessions: SessionData[];
  activeSessionId: string | null;
  saveSession: (session: SessionData) => void;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  getSession: (id: string) => SessionData | undefined;
  listSessions: () => SessionData[];
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,

      saveSession: (session: SessionData) => {
        const sessions = get().sessions;
        const existingIndex = sessions.findIndex(s => s.id === session.id);
        if (existingIndex >= 0) {
          sessions[existingIndex] = session;
          set({ sessions: [...sessions] });
        } else {
          set({ sessions: [...sessions, session] });
        }
      },

      deleteSession: (id: string) => {
        set(state => ({
          sessions: state.sessions.filter(s => s.id !== id),
          activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
        }));
      },

      setActiveSession: (id: string | null) => {
        set({ activeSessionId: id });
      },

      getSession: (id: string) => {
        return get().sessions.find(s => s.id === id);
      },

      listSessions: () => {
        return get().sessions;
      },
    }),
    {
      name: 'security-scanner-sessions',
    }
  )
);

// UI Store
interface UIStore {
  sidebarCollapsed: boolean;
  activeView: 'dashboard' | 'scan' | 'results' | 'settings' | 'sessions';
  activeTab: 'config' | 'progress' | 'results' | 'settings' | 'sessions';
  theme: 'dark' | 'light';
  notifications: Array<{
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    timestamp: Date;
  }>;
  toggleSidebar: () => void;
  setActiveView: (view: 'dashboard' | 'scan' | 'results' | 'settings' | 'sessions') => void;
  setActiveTab: (tab: 'config' | 'progress' | 'results' | 'settings' | 'sessions') => void;
  setTheme: (theme: 'dark' | 'light') => void;
  addNotification: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      activeView: 'dashboard',
      activeTab: 'config',
      theme: 'dark',
      notifications: [],

      toggleSidebar: () => {
        set(state => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      setActiveView: (view: 'dashboard' | 'scan' | 'results' | 'settings' | 'sessions') => {
        set({ activeView: view });
        // Also update activeTab for backwards compatibility
        if (view === 'dashboard') set({ activeTab: 'config' });
        if (view === 'scan') set({ activeTab: 'progress' });
        if (view === 'results') set({ activeTab: 'results' });
        if (view === 'settings') set({ activeTab: 'settings' });
        if (view === 'sessions') set({ activeTab: 'sessions' });
      },

      setActiveTab: (tab: 'config' | 'progress' | 'results' | 'settings' | 'sessions') => {
        set({ activeTab: tab });
      },

      setTheme: (theme: 'dark' | 'light') => {
        set({ theme });
      },

      addNotification: (type: 'info' | 'success' | 'warning' | 'error', message: string) => {
        const notification = {
          id: generateId('notif'),
          type,
          message,
          timestamp: new Date(),
        };
        set(state => ({
          notifications: [...state.notifications, notification].slice(-50),
        }));
      },

      removeNotification: (id: string) => {
        set(state => ({
          notifications: state.notifications.filter(n => n.id !== id),
        }));
      },

      clearNotifications: () => {
        set({ notifications: [] });
      },
    }),
    {
      name: 'security-scanner-ui',
    }
  )
);

// Selectors
export const selectVulnerabilitySummary = (state: ScanStore): VulnerabilitySummary => {
  const vulns = state.vulnerabilities;
  return {
    critical: vulns.filter(v => v.severity === 'critical').length,
    high: vulns.filter(v => v.severity === 'high').length,
    medium: vulns.filter(v => v.severity === 'medium').length,
    low: vulns.filter(v => v.severity === 'low').length,
    informational: vulns.filter(v => v.severity === 'informational').length,
    total: vulns.length,
  };
};

export const selectScanDuration = (state: ScanStore): number | null => {
  if (!state.scanState?.startTime) return null;
  const endTime = state.scanState.endTime ?? new Date();
  return endTime.getTime() - state.scanState.startTime.getTime();
};
