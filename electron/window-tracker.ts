import { execFile } from "node:child_process";

export interface FocusSnapshot {
  platform: NodeJS.Platform;
  capturedAt: number;
  windowId: string | null;
  appId: string | null;
  title: string | null;
}

function execFileAsync(
  file: string,
  args: string[],
  timeout = 3000
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout, windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function powershellEncodedCommand(script: string): string[] {
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  return ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded];
}

async function captureWindowsFocus(): Promise<FocusSnapshot | null> {
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class FocusInterop {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
}
"@
$handle = [FocusInterop]::GetForegroundWindow()
if ($handle -eq [IntPtr]::Zero) {
  Write-Output '{"windowId":null,"title":null}'
  exit 0
}
$sb = New-Object System.Text.StringBuilder 512
[void][FocusInterop]::GetWindowText($handle, $sb, $sb.Capacity)
$result = @{
  windowId = $handle.ToInt64().ToString()
  title = $sb.ToString()
}
$result | ConvertTo-Json -Compress
`;
  const { stdout } = await execFileAsync("powershell", powershellEncodedCommand(script));
  const parsed = JSON.parse(stdout.trim()) as { windowId?: string | null; title?: string | null };
  return {
    platform: process.platform,
    capturedAt: Date.now(),
    windowId: parsed.windowId ?? null,
    appId: null,
    title: parsed.title ?? null,
  };
}

async function restoreWindowsFocus(snapshot: FocusSnapshot): Promise<boolean> {
  if (!snapshot.windowId) {
    return false;
  }

  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class FocusInterop {
  [DllImport("user32.dll")]
  public static extern bool IsWindow(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
$handle = [IntPtr]::new([Int64]::Parse("${snapshot.windowId}"))
if (-not [FocusInterop]::IsWindow($handle)) {
  Write-Output "false"
  exit 0
}
[void][FocusInterop]::ShowWindowAsync($handle, 9)
$ok = [FocusInterop]::SetForegroundWindow($handle)
if ($ok) { Write-Output "true" } else { Write-Output "false" }
`;
  const { stdout } = await execFileAsync("powershell", powershellEncodedCommand(script), 3500);
  return stdout.trim().toLowerCase() === "true";
}

async function captureMacFocus(): Promise<FocusSnapshot | null> {
  const script = `
tell application "System Events"
  set frontProc to first application process whose frontmost is true
  return (name of frontProc)
end tell
`;
  const { stdout } = await execFileAsync("osascript", ["-e", script]);
  const appName = stdout.trim();
  return {
    platform: process.platform,
    capturedAt: Date.now(),
    windowId: null,
    appId: appName || null,
    title: appName || null,
  };
}

async function restoreMacFocus(snapshot: FocusSnapshot): Promise<boolean> {
  if (!snapshot.appId) {
    return false;
  }
  const script = `tell application "${snapshot.appId.replace(/"/g, '\\"')}" to activate`;
  await execFileAsync("osascript", ["-e", script]);
  return true;
}

// Detect which Linux focus tool is available
let linuxFocusTool: "xdotool" | "none" | null = null;

async function detectLinuxFocusTool(): Promise<"xdotool" | "none"> {
  if (linuxFocusTool !== null) return linuxFocusTool;

  try {
    await execFileAsync("which", ["xdotool"]);
    linuxFocusTool = "xdotool";
    return "xdotool";
  } catch {}

  // No tool available (Wayland without xdotool)
  // Note: ydotool cannot capture/restore window focus, only simulate input
  linuxFocusTool = "none";
  return "none";
}

async function captureLinuxFocus(): Promise<FocusSnapshot | null> {
  const tool = await detectLinuxFocusTool();

  if (tool === "xdotool") {
    try {
      const { stdout } = await execFileAsync("xdotool", ["getactivewindow"]);
      const windowId = stdout.trim();
      return {
        platform: process.platform,
        capturedAt: Date.now(),
        windowId: windowId || null,
        appId: null,
        title: null,
      };
    } catch {
      return null;
    }
  }

  // On Wayland without xdotool, we can't capture focus
  // Return a placeholder snapshot so paste still works (just without focus restore)
  return {
    platform: process.platform,
    capturedAt: Date.now(),
    windowId: null,
    appId: null,
    title: null,
  };
}

async function restoreLinuxFocus(snapshot: FocusSnapshot): Promise<boolean> {
  if (!snapshot.windowId) {
    // No window ID captured (Wayland) - can't restore, but not an error
    return false;
  }

  const tool = await detectLinuxFocusTool();

  if (tool === "xdotool") {
    try {
      await execFileAsync("xdotool", ["windowactivate", "--sync", snapshot.windowId]);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

export class WindowTracker {
  private snapshot: FocusSnapshot | null = null;

  get lastSnapshot(): FocusSnapshot | null {
    return this.snapshot;
  }

  async recordFocusedWindow(): Promise<FocusSnapshot | null> {
    try {
      let snapshot: FocusSnapshot | null = null;
      if (process.platform === "win32") {
        snapshot = await captureWindowsFocus();
      } else if (process.platform === "darwin") {
        snapshot = await captureMacFocus();
      } else {
        snapshot = await captureLinuxFocus();
      }
      if (snapshot) {
        this.snapshot = snapshot;
      }
      return snapshot;
    } catch (err) {
      console.error("Failed to capture focused window:", err);
      return null;
    }
  }

  async restoreFocus(): Promise<boolean> {
    if (!this.snapshot) {
      return false;
    }

    try {
      if (this.snapshot.platform === "win32") {
        return await restoreWindowsFocus(this.snapshot);
      }
      if (this.snapshot.platform === "darwin") {
        return await restoreMacFocus(this.snapshot);
      }
      return await restoreLinuxFocus(this.snapshot);
    } catch (err) {
      console.error("Failed to restore focus:", err);
      return false;
    }
  }
}
