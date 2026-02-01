import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'path';
import { URL } from 'url';

let mainWindow: BrowserWindow | null = null;
const DEBUG = process.env.NODE_ENV === 'development' || !app.isPackaged;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a2e',
    show: false,
  });

  // Configure proxy for ZAP
  session.defaultSession.setProxy({
    proxyRules: 'http://localhost:8080',
    proxyBypassRules: '<local>',
  });

  // Load the app
  if (DEBUG) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handlers for main process
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-platform', () => {
  return process.platform;
});

ipcMain.handle('get-resources-path', () => {
  return process.resourcesPath;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
