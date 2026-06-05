"use client";

import { useEffect, useRef } from "react";

export type SpectrogramData = {
  engine: string;
  sampleRate: number;
  duration: number;
  frames: number;
  bins: number;
  minDb: number;
  maxDb: number;
  values: number[][];
};

type Props = {
  data: SpectrogramData | null;
  cursor?: number | null;
  label?: string;
};

const FALLBACK_WIDTH = 820;
const FALLBACK_HEIGHT = 500;

export function SpectrogramCanvas({ data, cursor = null, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function draw() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const parentRect = canvas.parentElement?.getBoundingClientRect();
      const cssWidth = rect.width || parentRect?.width || FALLBACK_WIDTH;
      const cssHeight = rect.height || parentRect?.height || FALLBACK_HEIGHT;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(cssWidth * dpr));
      canvas.height = Math.max(1, Math.round(cssHeight * dpr));

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "#07101f");
      gradient.addColorStop(1, "#111c3a");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawGrid(ctx, canvas.width, canvas.height, dpr);

      if (!data || !data.values.length || !data.values[0]?.length) {
        drawEmptyState(ctx, canvas.width, canvas.height, dpr);
        return;
      }

      drawSpectrogram(ctx, data.values, canvas.width, canvas.height);

      if (cursor !== null && data.duration > 0) {
        const x = Math.max(0, Math.min(1, cursor / data.duration)) * canvas.width;
        ctx.strokeStyle = "rgba(255,216,77,.96)";
        ctx.lineWidth = 3 * dpr;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(237,246,255,.82)";
      ctx.font = `${12 * dpr}px Spline Sans Mono, monospace`;
      ctx.textAlign = "left";
      ctx.fillText(label || `${data.engine} · ${data.bins} bins · ${data.frames} frames`, 16 * dpr, 26 * dpr);
    }

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, [data, cursor, label]);

  return <canvas ref={canvasRef} className="spectrogram-canvas" aria-label="Spectrogram visualization" />;
}

function drawEmptyState(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number) {
  ctx.fillStyle = "rgba(237,246,255,.72)";
  ctx.font = `${15 * dpr}px Spline Sans Mono, monospace`;
  ctx.textAlign = "center";
  ctx.fillText("Upload audio to render a spectrogram", width / 2, height / 2);
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number) {
  ctx.strokeStyle = "rgba(255,255,255,.07)";
  ctx.lineWidth = dpr;
  for (let i = 0; i <= 8; i += 1) {
    const x = (i / 8) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let i = 0; i <= 6; i += 1) {
    const y = (i / 6) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawSpectrogram(ctx: CanvasRenderingContext2D, values: number[][], width: number, height: number) {
  const bins = values.length;
  const frames = values[0]?.length || 0;
  if (!bins || !frames) return;

  const cellWidth = width / frames;
  const cellHeight = height / bins;

  for (let b = 0; b < bins; b += 1) {
    const row = values[b];
    const y = height - (b + 1) * cellHeight;
    for (let f = 0; f < frames; f += 1) {
      ctx.fillStyle = colorRamp(row[f] || 0);
      ctx.fillRect(f * cellWidth, y, Math.ceil(cellWidth) + 1, Math.ceil(cellHeight) + 1);
    }
  }
}

function colorRamp(value: number) {
  const v = Math.max(0, Math.min(1, value));
  const stops = [
    [7, 16, 31],
    [38, 40, 112],
    [196, 50, 120],
    [255, 130, 76],
    [255, 216, 77],
  ];
  const scaled = v * (stops.length - 1);
  const idx = Math.min(stops.length - 2, Math.floor(scaled));
  const t = scaled - idx;
  const a = stops[idx];
  const b = stops[idx + 1];
  const rgb = a.map((channel, i) => Math.round(channel + (b[i] - channel) * t));
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}
