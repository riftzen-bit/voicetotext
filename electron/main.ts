import { app, BrowserWindow, ipcMain, screen } from "electron";
import path from "node:path";
import { setupTray, getAppIcon } from "./tray";
import { registerHotkeyHandlers } from "./hotkey";
import { registerClipboardHandlers } from "./clipboard-paste";
import { PythonBridge } from "./python-bridge";
import { registerIpcHandlers } from "./ipc-handlers";
import { WindowTracker } from "./window-tracker";
import { store } from "./store";
import { loadHistory } from "./history";
import { loadKeywords } from "./keywords";

const VITE_DEV_URL = process.env.VITE_DEV_SERVER_URL;
const DIST_PATH = path.join(__dirname, "../dist");
const PRELOAD_PATH = path.join(__dirname, "preload.js");

let overlayWin: BrowserWindow | null = null;
let settingsWin: BrowserWindow | null = null;
let pythonBridge: PythonBridge | null = null;
let windowTracker: WindowTracker | null = null;

function createOverlayWindow(): BrowserWindow {
  const { width: screenW } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: 320,
    height: 72,
    x: screenW - 340,
    y: 20,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.once("ready-to-show", () => {
    win.show();
  });

  if (VITE_DEV_URL) {
    win.loadURL(`${VITE_DEV_URL}#/overlay`);
  } else {
    win.loadFile(path.join(DIST_PATH, "index.html"), { hash: "/overlay" });
  }

  return win;
}

function createSettingsWindow(): BrowserWindow {
  const appIcon = getAppIcon();

  const win = new BrowserWindow({
    width: 840,
    height: 720,
    show: false,
    frame: false,
    resizable: true,
    icon: appIcon,
    backgroundColor: "#111111",
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once("ready-to-show", () => {
    win.show();
  });

  if (VITE_DEV_URL) {
    win.loadURL(`${VITE_DEV_URL}#/settings`);
  } else {
    win.loadFile(path.join(DIST_PATH, "index.html"), { hash: "/settings" });
  }

  win.on("close", (e) => {
    e.preventDefault();
    win.hide();
  });

  return win;
}

app.whenReady().then(async () => {
  store.init();
  loadHistory();
  loadKeywords();
  windowTracker = new WindowTracker();
  pythonBridge = new PythonBridge();
  await pythonBridge.start();

  overlayWin = createOverlayWindow();
  settingsWin = createSettingsWindow();

  setupTray(overlayWin, settingsWin);
  registerHotkeyHandlers(overlayWin, windowTracker);
  registerClipboardHandlers(windowTracker);
  registerIpcHandlers(overlayWin, settingsWin, pythonBridge);

  ipcMain.on("open-settings", () => {
    settingsWin?.show();
    settingsWin?.focus();
  });

  ipcMain.on("resize-overlay", (_e, w: number, h: number) => {
    overlayWin?.setSize(w, h, true);
  });

  // Window controls for frameless settings window
  ipcMain.on("window-minimize", () => {
    settingsWin?.minimize();
  });

  ipcMain.on("window-maximize", () => {
    if (settingsWin?.isMaximized()) {
      settingsWin.unmaximize();
    } else {
      settingsWin?.maximize();
    }
  });

  ipcMain.on("window-close", () => {
    settingsWin?.hide();
  });

  ipcMain.handle("window-is-maximized", () => {
    return settingsWin?.isMaximized() ?? false;
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  pythonBridge?.stop();
  settingsWin?.destroy();
  overlayWin?.destroy();
});
