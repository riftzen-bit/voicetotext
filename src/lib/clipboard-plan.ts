// Pure planning logic for "what to do when a transcript is ready", given
// the user's autoPaste + copyToClipboard settings. Lives in src/lib rather
// than inside the electron main process so unit tests can exercise every
// branch without spinning up Electron.
//
// The 2x2 of (autoPaste, copyToClipboard) maps to four concrete plans:
//   - off/off   : noop
//   - off/on    : put transcript on clipboard, don't paste
//   - on/off    : round-trip — save user's clipboard, paste transcript,
//                 restore user's clipboard so their Ctrl+V queue is intact
//   - on/on     : write transcript, paste, leave transcript on clipboard

export interface DeliveryPlan {
  noop: boolean;
  saveClipboard: boolean;
  writeTranscript: boolean;
  simulatePaste: boolean;
  restoreClipboard: boolean;
  startMonitoring: boolean;
}

export function planDelivery(opts: {
  autoPaste: boolean;
  copyToClipboard: boolean;
}): DeliveryPlan {
  const { autoPaste, copyToClipboard } = opts;

  if (!autoPaste && !copyToClipboard) {
    return {
      noop: true,
      saveClipboard: false,
      writeTranscript: false,
      simulatePaste: false,
      restoreClipboard: false,
      startMonitoring: false,
    };
  }

  if (autoPaste && !copyToClipboard) {
    return {
      noop: false,
      saveClipboard: true,
      writeTranscript: true,
      simulatePaste: true,
      restoreClipboard: true,
      startMonitoring: false,
    };
  }

  if (autoPaste && copyToClipboard) {
    return {
      noop: false,
      saveClipboard: false,
      writeTranscript: true,
      simulatePaste: true,
      restoreClipboard: false,
      startMonitoring: true,
    };
  }

  // !autoPaste && copyToClipboard
  return {
    noop: false,
    saveClipboard: false,
    writeTranscript: true,
    simulatePaste: false,
    restoreClipboard: false,
    startMonitoring: false,
  };
}
