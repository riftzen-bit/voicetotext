import { describe, it, expect } from "vitest";
import { planDelivery } from "../../lib/clipboard-plan";

describe("planDelivery", () => {
  it("returns a noop plan when both toggles are off", () => {
    const p = planDelivery({ autoPaste: false, copyToClipboard: false });
    expect(p).toEqual({
      noop: true,
      saveClipboard: false,
      writeTranscript: false,
      simulatePaste: false,
      restoreClipboard: false,
      startMonitoring: false,
    });
  });

  it("copies without pasting when only copyToClipboard is on", () => {
    const p = planDelivery({ autoPaste: false, copyToClipboard: true });
    expect(p).toMatchObject({
      noop: false,
      writeTranscript: true,
      simulatePaste: false,
      saveClipboard: false,
      restoreClipboard: false,
      startMonitoring: false,
    });
  });

  it("pastes without persisting when autoPaste is on alone", () => {
    const p = planDelivery({ autoPaste: true, copyToClipboard: false });
    // This is the round-trip: save user's clipboard, write transcript,
    // paste, restore the user's original clipboard.
    expect(p).toEqual({
      noop: false,
      saveClipboard: true,
      writeTranscript: true,
      simulatePaste: true,
      restoreClipboard: true,
      startMonitoring: false,
    });
  });

  it("writes transcript and pastes without restoring when both are on", () => {
    const p = planDelivery({ autoPaste: true, copyToClipboard: true });
    expect(p).toEqual({
      noop: false,
      saveClipboard: false,
      writeTranscript: true,
      simulatePaste: true,
      restoreClipboard: false,
      startMonitoring: true,
    });
  });

  it("only starts clipboard monitoring when both toggles are on", () => {
    // Monitoring watches for the user manually editing pasted text in the
    // target app so we can learn keyword corrections. It must not fire when
    // we're restoring the user's clipboard (would create false positives).
    expect(
      planDelivery({ autoPaste: true, copyToClipboard: true }).startMonitoring,
    ).toBe(true);
    expect(
      planDelivery({ autoPaste: true, copyToClipboard: false }).startMonitoring,
    ).toBe(false);
    expect(
      planDelivery({ autoPaste: false, copyToClipboard: true }).startMonitoring,
    ).toBe(false);
    expect(
      planDelivery({ autoPaste: false, copyToClipboard: false }).startMonitoring,
    ).toBe(false);
  });

  it("restoreClipboard only fires when we overwrote the clipboard for paste", () => {
    // Restore only makes sense when we saved first. Save+restore must be
    // symmetric or the user's prior clipboard is lost forever.
    for (const autoPaste of [true, false]) {
      for (const copyToClipboard of [true, false]) {
        const p = planDelivery({ autoPaste, copyToClipboard });
        expect(p.saveClipboard).toBe(p.restoreClipboard);
      }
    }
  });
});
