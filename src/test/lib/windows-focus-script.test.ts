import { describe, it, expect } from "vitest";
import { buildWindowsFocusRestoreScript } from "../../lib/windows-focus-script";

describe("buildWindowsFocusRestoreScript", () => {
  it("embeds the window id as decimal argument to Int64::Parse", () => {
    const s = buildWindowsFocusRestoreScript("123456");
    expect(s).toContain('[Int64]::Parse("123456")');
  });

  it("declares the full Win32 FocusInterop surface including IsIconic", () => {
    // IsIconic is the critical one — it's how we avoid SW_RESTORE on a
    // fullscreen window. Regression guard.
    const s = buildWindowsFocusRestoreScript("1");
    expect(s).toContain("IsWindow");
    expect(s).toContain("IsIconic");
    expect(s).toContain("ShowWindowAsync");
    expect(s).toContain("SetForegroundWindow");
  });

  it("guards ShowWindowAsync behind an IsIconic check", () => {
    // Must not call ShowWindowAsync unconditionally. Running it on a
    // fullscreen window with SW_RESTORE (nCmdShow=9) kicks it out of
    // fullscreen — the exact bug this guard prevents.
    const s = buildWindowsFocusRestoreScript("1");

    // The whole conditional opener must appear verbatim. Regression guard
    // against someone dropping the `if` and leaving the IsIconic call as a
    // bare expression whose result gets discarded.
    expect(s).toMatch(/if \(\s*\[FocusInterop\]::IsIconic\(\$handle\)\s*\)/);

    const ifIdx = s.search(/if \(\s*\[FocusInterop\]::IsIconic/);
    const showIdx = s.indexOf("ShowWindowAsync($handle");
    expect(ifIdx).toBeGreaterThan(-1);
    expect(showIdx).toBeGreaterThan(ifIdx);

    // Nothing between the IsIconic `if` and the ShowWindowAsync call should
    // close the `if` block (no `}` before the call).
    const between = s.slice(ifIdx, showIdx);
    expect(between).not.toContain("}");
  });

  it("returns false early when the handle is no longer a valid window", () => {
    const s = buildWindowsFocusRestoreScript("42");
    expect(s).toMatch(/if \(-not \[FocusInterop\]::IsWindow\(\$handle\)\)/);
    expect(s).toMatch(/Write-Output "false"/);
  });

  it("always attempts SetForegroundWindow (focus restore is the actual goal)", () => {
    const s = buildWindowsFocusRestoreScript("1");
    expect(s).toContain("SetForegroundWindow($handle)");
  });
});
