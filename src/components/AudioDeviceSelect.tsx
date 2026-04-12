import { useEffect, useState } from "react";

interface AudioDeviceSelectProps {
  value: string;
  onChange: (deviceId: string) => void;
}

interface DeviceInfo {
  deviceId: string;
  label: string;
}

export default function AudioDeviceSelect({ value, onChange }: AudioDeviceSelectProps) {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);

  useEffect(() => {
    async function loadDevices() {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const all = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = all
          .filter((d) => d.kind === "audioinput")
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
          }));
        setDevices(audioInputs);
      } catch {
        setDevices([]);
      }
    }
    loadDevices();
  }, []);

  return (
    <select
      className="form-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="default">Default Microphone</option>
      {devices.map((d) => (
        <option key={d.deviceId} value={d.deviceId}>
          {d.label}
        </option>
      ))}
    </select>
  );
}
