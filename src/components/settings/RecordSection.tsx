import { useEffect, useState } from "react";
import { useSettings } from "../../hooks/useSettings";
import { Section, Row, Toggle, Segmented, KeyCapture } from "./primitives";

export default function RecordSection() {
  const { settings, loaded, updateSetting } = useSettings();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((list) => {
        if (cancelled) return;
        setDevices(list.filter((d) => d.kind === "audioinput"));
      })
      .catch(() => {});
    const onChange = () => {
      navigator.mediaDevices?.enumerateDevices().then((list) => {
        if (cancelled) return;
        setDevices(list.filter((d) => d.kind === "audioinput"));
      });
    };
    navigator.mediaDevices?.addEventListener("devicechange", onChange);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener("devicechange", onChange);
    };
  }, []);

  if (!loaded) return null;

  return (
    <Section
      num="01"
      eyebrow="Capture"
      title="Record"
      lede="Tune how VoiceToText listens. Pick a shortcut, choose an input, and decide how the recording behaves."
    >
      <Row label="Trigger" hint="Hold the hotkey to dictate, or tap it to toggle.">
        <Segmented
          value={settings.hotkeyMode}
          options={[
            { value: "ptt", label: "Push to talk" },
            { value: "ttt", label: "Tap to toggle" },
          ]}
          onChange={(v) => updateSetting("hotkeyMode", v)}
        />
      </Row>

      <Row label="Record hotkey">
        <KeyCapture
          value={settings.hotkey}
          onChange={(v) => updateSetting("hotkey", v)}
        />
      </Row>

      <Row label="Cancel hotkey">
        <KeyCapture
          value={settings.cancelHotkey}
          onChange={(v) => updateSetting("cancelHotkey", v)}
        />
      </Row>

      <Row label="Code-mode hotkey" hint="Press once to skip AI refinement on the next dictation.">
        <KeyCapture
          value={settings.codeModeHotkey || ""}
          onChange={(v) => updateSetting("codeModeHotkey", v)}
        />
      </Row>

      <Row label="Auto-paste" hint="Paste the transcript into the focused field the moment it arrives.">
        <Toggle
          checked={settings.autoPaste}
          onChange={(v) => updateSetting("autoPaste", v)}
        />
      </Row>

      <div className="subheading">Input</div>

      <Row label="Microphone">
        <select
          className="select-input"
          value={settings.audioDevice}
          onChange={(e) => updateSetting("audioDevice", e.target.value)}
        >
          <option value="default">System default</option>
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Device ${d.deviceId.slice(0, 6)}`}
            </option>
          ))}
        </select>
      </Row>

      <Row label="Noise gate" hint="Silences microphone input below a threshold.">
        <Toggle
          checked={settings.noiseGateEnabled}
          onChange={(v) => updateSetting("noiseGateEnabled", v)}
        />
      </Row>

      {settings.noiseGateEnabled && (
        <Row label="Gate threshold" hint="Lower values let quieter sounds through.">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="range"
              min={-60}
              max={-20}
              step={1}
              value={settings.noiseGateThresholdDb}
              onChange={(e) =>
                updateSetting("noiseGateThresholdDb", Number(e.target.value))
              }
              style={{ width: 160 }}
            />
            <span className="mono text-muted" style={{ fontSize: 12, minWidth: 48 }}>
              {settings.noiseGateThresholdDb} dB
            </span>
          </div>
        </Row>
      )}

      <Row label="Normalize volume" hint="Bring all recordings to a consistent loudness.">
        <Toggle
          checked={settings.audioNormalizeEnabled}
          onChange={(v) => updateSetting("audioNormalizeEnabled", v)}
        />
      </Row>

      {settings.audioNormalizeEnabled && (
        <Row label="Target level">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="range"
              min={-12}
              max={0}
              step={1}
              value={settings.audioNormalizeTargetDb}
              onChange={(e) =>
                updateSetting("audioNormalizeTargetDb", Number(e.target.value))
              }
              style={{ width: 160 }}
            />
            <span className="mono text-muted" style={{ fontSize: 12, minWidth: 48 }}>
              {settings.audioNormalizeTargetDb} dB
            </span>
          </div>
        </Row>
      )}
    </Section>
  );
}
