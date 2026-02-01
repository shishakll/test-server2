import { contextBridge, ipcRenderer } from 'electron';

/**
 * Browser Preload Script
 * Provides secure bridge between renderer process and browser service
 */

// Expose browser API to renderer
contextBridge.exposeInMainWorld('browserAPI', {
  // Navigation
  navigate: (url: string) => ipcRenderer.invoke('browser:navigate', url),
  reload: () => ipcRenderer.invoke('browser:reload'),
  goBack: () => ipcRenderer.invoke('browser:go-back'),
  goForward: () => ipcRenderer.invoke('browser:go-forward'),

  // URL and state
  getUrl: () => ipcRenderer.invoke('browser:get-url'),
  getTitle: () => document.title,

  // Cookies and storage
  getCookies: () => ipcRenderer.invoke('browser:get-cookies'),
  setCookie: (cookie: {
    name: string;
    value: string;
    domain: string;
    path?: string;
    expires?: string;
  }) => ipcRenderer.invoke('browser:set-cookie', cookie),
  clearCookies: () => ipcRenderer.invoke('browser:clear-cookies'),

  // Local storage
  getLocalStorage: () => ipcRenderer.invoke('browser:get-local-storage'),
  setLocalStorage: (key: string, value: string) =>
    ipcRenderer.invoke('browser:set-local-storage', key, value),
  clearLocalStorage: () => ipcRenderer.invoke('browser:clear-local-storage'),

  // Session storage
  getSessionStorage: () => ipcRenderer.invoke('browser:get-session-storage'),
  setSessionStorage: (key: string, value: string) =>
    ipcRenderer.invoke('browser:set-session-storage', key, value),
  clearSessionStorage: () => ipcRenderer.invoke('browser:clear-session-storage'),

  // JavaScript execution
  executeScript: (code: string) => ipcRenderer.invoke('browser:execute-script', code),

  // DevTools
  openDevTools: (mode?: 'detach' | 'right' | 'bottom') =>
    ipcRenderer.invoke('browser:open-devtools', mode),
  closeDevTools: () => ipcRenderer.invoke('browser:close-devtools'),

  // Events (listeners)
  onRequest: (callback: (data: unknown) => void) => {
    ipcRenderer.on('browser:request', (_event, data) => callback(data));
  },
  onResponse: (callback: (data: unknown) => void) => {
    ipcRenderer.on('browser:response', (_event, data) => callback(data));
  },
  onNavigation: (callback: (data: unknown) => void) => {
    ipcRenderer.on('browser:navigation', (_event, data) => callback(data));
  },
  onConsole: (callback: (data: unknown) => void) => {
    ipcRenderer.on('browser:console', (_event, data) => callback(data));
  },

  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(`browser:${channel}`);
  },
});
