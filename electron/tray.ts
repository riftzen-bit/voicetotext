import { app, BrowserWindow, Menu, Tray, nativeImage } from "electron";
import path from "node:path";

let tray: Tray | null = null;

/**
 * Create a simple tray icon programmatically
 * This ensures we always have an icon even if files are missing
 */
function createTrayIcon(): Electron.NativeImage {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);

  // Create a simple circular icon with our accent color
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = 6;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - centerX + 0.5;
      const dy = y - centerY + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Inside the circle - champagne gold color
        const edgeFade = Math.max(0, 1 - (dist / radius) * 0.3);
        canvas[idx] = Math.round(196 * edgeFade);     // R
        canvas[idx + 1] = Math.round(160 * edgeFade); // G
        canvas[idx + 2] = Math.round(82 * edgeFade);  // B
        canvas[idx + 3] = 255;                         // A
      } else if (dist <= radius + 1) {
        // Anti-aliased edge
        const alpha = Math.max(0, 1 - (dist - radius));
        canvas[idx] = 196;
        canvas[idx + 1] = 160;
        canvas[idx + 2] = 82;
        canvas[idx + 3] = Math.round(255 * alpha);
      } else {
        // Outside - transparent
        canvas[idx] = 0;
        canvas[idx + 1] = 0;
        canvas[idx + 2] = 0;
        canvas[idx + 3] = 0;
      }
    }
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

/**
 * Create an application icon (larger, for taskbar)
 */
function createAppIcon(): Electron.NativeImage {
  const size = 32;
  const canvas = Buffer.alloc(size * size * 4);

  const centerX = size / 2;
  const centerY = size / 2;
  const outerRadius = 14;
  const innerRadius = 10;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - centerX + 0.5;
      const dy = y - centerY + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= innerRadius) {
        // Inner circle - champagne gold
        const brightness = 1 - (dy / innerRadius) * 0.15; // Subtle gradient
        canvas[idx] = Math.round(196 * brightness);
        canvas[idx + 1] = Math.round(160 * brightness);
        canvas[idx + 2] = Math.round(82 * brightness);
        canvas[idx + 3] = 255;
      } else if (dist <= outerRadius) {
        // Outer ring - dark background
        canvas[idx] = 20;
        canvas[idx + 1] = 19;
        canvas[idx + 2] = 17;
        canvas[idx + 3] = 255;
      } else if (dist <= outerRadius + 1) {
        // Anti-aliased edge
        const alpha = Math.max(0, 1 - (dist - outerRadius));
        canvas[idx] = 20;
        canvas[idx + 1] = 19;
        canvas[idx + 2] = 17;
        canvas[idx + 3] = Math.round(255 * alpha);
      } else {
        canvas[idx] = 0;
        canvas[idx + 1] = 0;
        canvas[idx + 2] = 0;
        canvas[idx + 3] = 0;
      }
    }
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

export function getAppIcon(): Electron.NativeImage {
  // Try to load from file first
  const iconPath = path.join(__dirname, "../assets/icons/icon.png");
  try {
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      return icon;
    }
  } catch {
    // Fall through to generated icon
  }

  return createAppIcon();
}

export function setupTray(overlayWin: BrowserWindow, settingsWin: BrowserWindow) {
  // Try to load tray icon from file, fall back to generated
  const trayIconPath = path.join(__dirname, "../assets/icons/tray.png");
  let icon: Electron.NativeImage;

  try {
    icon = nativeImage.createFromPath(trayIconPath);
    if (icon.isEmpty()) {
      icon = createTrayIcon();
    }
  } catch {
    icon = createTrayIcon();
  }

  tray = new Tray(icon);
  tray.setToolTip("VoiceToText");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Overlay",
      click: () => {
        overlayWin.show();
      },
    },
    {
      label: "Settings",
      click: () => {
        settingsWin.show();
        settingsWin.focus();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        overlayWin.destroy();
        settingsWin.destroy();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Click on tray opens settings
  tray.on("click", () => {
    settingsWin.show();
    settingsWin.focus();
  });
}
