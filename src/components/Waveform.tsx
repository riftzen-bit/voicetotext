import { useEffect, useRef } from "react";

interface WaveformProps {
  level: number;
  active: boolean;
  width?: number;
  height?: number;
}

const BAR_COUNT = 20;
const BAR_GAP = 1.5;

export default function Waveform({ level, active, width = 120, height = 24 }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barsRef = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const root = document.documentElement;
    // Resolve once per effect run — getComputedStyle inside the RAF loop
    // thrashes the style engine and shows up in profiles on low-end GPUs.
    const activeColor =
      getComputedStyle(root).getPropertyValue("--status-recording").trim() || "#FF453A";
    const idleColor =
      getComputedStyle(root).getPropertyValue("--text-muted").trim() || "rgba(235,235,245,0.22)";

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const bars = barsRef.current;
      const barW = (width - (BAR_COUNT - 1) * BAR_GAP) / BAR_COUNT;

      ctx.fillStyle = active ? activeColor : idleColor;

      for (let i = 0; i < BAR_COUNT; i++) {
        if (active) {
          // Breathing sine wave blended with live audio level.
          const time = Date.now() / 150;
          const basePulse = 0.05 + Math.sin(time + i * 0.4) * 0.03;
          const target = Math.max(basePulse, Math.min(1, level * 1.5) * (0.4 + Math.random() * 0.6));
          bars[i] += (target - bars[i]) * 0.35;
        } else {
          bars[i] *= 0.82;
        }

        const barH = Math.max(1.5, bars[i] * height);
        const x = i * (barW + BAR_GAP);
        const y = (height - barH) / 2;

        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, 1);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [level, active, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, flexShrink: 0 }}
    />
  );
}
