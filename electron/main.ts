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
  const display = screen.getPrimaryDisplay();
  const { x: boundsX, y: boundsY, width: boundsW } = display.bounds;
  const workAreaTop = display.workArea.y;
  const overlayW = 180;
  const overlayH = 40;

  const win = new BrowserWindow({
    width: overlayW,
    height: overlayH,
    x: boundsX + Math.round((boundsW - overlayW) / 2),
    y: Math.max(boundsY, workAreaTop) + 10,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (VITE_DEV_URL) {
    win.loadURL(`${VITE_DEV_URL}#/overlay`);
  } else {
    win.loadFile(path.join(DIST_PATH, "index.html"), { hash: "/overlay" });
  }

  return win;
}

function createSettingsWindow(): BrowserWindow {
  const appIcon = getAppIcon();
  const isMac = process.platform === "darwin";
  const isWin = process.platform === "win32";

  // Liquid Glass chrome: macOS uses native vibrancy (under-window tint);
  // Windows 11 uses DWM acrylic via backgroundMaterial. Both require
  // frame:false and a non-opaque background on the window. Acrylic
  // needs transparent:false (DWM composes behind an opaque hole);
  // vibrancy wants transparent:true so AppKit sees the window backing.
  const win = new BrowserWindow({
    width: 900,
    height: 760,
    minWidth: 720,
    minHeight: 560,
    show: true,
    frame: false,
    resizable: true,
    icon: appIcon,
    titleBarStyle: isMac ? "hiddenInset" : "hidden",
    trafficLightPosition: isMac ? { x: 16, y: 16 } : undefined,
    backgroundColor: isWin ? "#00000000" : undefined,
    transparent: isMac,
    vibrancy: isMac ? "under-window" : undefined,
    visualEffectState: isMac ? "active" : undefined,
    backgroundMaterial: isWin ? "acrylic" : undefined,
    roundedCorners: true,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
    },
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
