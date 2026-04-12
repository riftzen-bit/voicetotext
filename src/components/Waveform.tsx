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

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const bars = barsRef.current;
      const barW = (width - (BAR_COUNT - 1) * BAR_GAP) / BAR_COUNT;
      const root = document.documentElement;

      for (let i = 0; i < BAR_COUNT; i++) {
        if (active) {
          // Add a "breathing" sine wave effect mixed with the actual audio level
          const time = Date.now() / 150;
          const basePulse = 0.05 + Math.sin(time + i * 0.4) * 0.03;
          const target = Math.max(basePulse, Math.min(1, level * 1.5) * (0.4 + Math.random() * 0.6));
          bars[i] += (target - bars[i]) * 0.35; // faster, smoother easing
        } else {
          bars[i] *= 0.82; // faster drop-off
        }

        const barH = Math.max(1.5, bars[i] * height);
        const x = i * (barW + BAR_GAP);
        const y = (height - barH) / 2;

        ctx.fillStyle = active
          ? getComputedStyle(root).getPropertyValue("--red").trim()
          : getComputedStyle(root).getPropertyValue("--fg-4").trim();

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
