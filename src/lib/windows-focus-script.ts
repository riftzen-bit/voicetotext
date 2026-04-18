// Builds the PowerShell body used to restore focus to a Win32 window after
// auto-paste. Lives here (not inside electron/window-tracker.ts) so unit
// tests can inspect the generated script without pulling in the electron
// module graph.
//
// The critical invariant: SW_RESTORE (9) must only fire for minimized
// windows. Running SW_RESTORE on a fullscreen window kicks it back to
// windowed — which was the bug users hit when auto-paste targeted a
// fullscreen app. The IsIconic guard keeps fullscreen apps fullscreen.

export function buildWindowsFocusRestoreScript(windowIdDecimal: string): string {
  return `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class FocusInterop {
  [DllImport("user32.dll")]
  public static extern bool IsWindow(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
$handle = [IntPtr]::new([Int64]::Parse("${windowIdDecimal}"))
if (-not [FocusInterop]::IsWindow($handle)) {
  Write-Output "false"
  exit 0
}
# Only SW_RESTORE (9) when the window is minimized. Running SW_RESTORE on a
# fullscreen window kicks it back to windowed mode, which is the bug users
# hit when auto-paste targeted a fullscreen app.
if ([FocusInterop]::IsIconic($handle)) {
  [void][FocusInterop]::ShowWindowAsync($handle, 9)
}
$ok = [FocusInterop]::SetForegroundWindow($handle)
if ($ok) { Write-Output "true" } else { Write-Output "false" }
`;
}
