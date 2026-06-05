"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ExampleId = "tone" | "two" | "chirp" | "percussion" | "voice";

type Example = {
  id: ExampleId;
  title: string;
  description: string;
  duration: number;
  color: string;
};

const EXAMPLES: Example[] = [
  { id: "tone", title: "Pure tone", description: "One steady stripe at 440 Hz.", duration: 3, color: "#ffd84d" },
  { id: "two", title: "Two tones", description: "Two simultaneous horizontal stripes.", duration: 3, color: "#25d8d0" },
  { id: "chirp", title: "Chirp", description: "A pitch sweep draws a rising diagonal.", duration: 3.4, color: "#ff5c9d" },
  { id: "percussion", title: "Percussion", description: "Kicks are low blobs; snares are wide bursts.", duration: 3, color: "#3d7cff" },
  { id: "voice", title: "Singing voice", description: "A harmonic ladder wobbles with vibrato.", duration: 3.2, color: "#8b5cf6" },
];

const SAMPLE_RATE = 44_100;
const MAX_FREQ = 3_200;

export default function GalleryPage() {
  const [activeId, setActiveId] = useState<ExampleId>("tone");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startedAtRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const active = useMemo(() => EXAMPLES.find((example) => example.id === activeId) || EXAMPLES[0], [activeId]);

  const stop = useCallback((reset = false) => {
    if (sourceRef.current) {
      sourceRef.current.onended = null;
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsPlaying(false);
    if (reset) setCurrentTime(0);
  }, []);

  const tick = useCallback(() => {
    const context = audioContextRef.current;
    if (!context) return;
    const elapsed = Math.min(active.duration, Math.max(0, context.currentTime - startedAtRef.current));
    setCurrentTime(elapsed);
    if (elapsed < active.duration) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [active.duration]);

  async function play() {
    stop(false);
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    const context = audioContextRef.current || new AudioContextCtor();
    audioContextRef.current = context;
    if (context.state === "suspended") await context.resume();

    const seek = currentTime >= active.duration ? 0 : currentTime;
    const buffer = createAudioBuffer(context, active.id, active.duration);
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = 0.18;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(context.destination);
    source.onended = () => {
      setIsPlaying(false);
      setCurrentTime(active.duration);
      sourceRef.current = null;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    source.start(0, seek);
    sourceRef.current = source;
    startedAtRef.current = context.currentTime - seek;
    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  }

  function chooseExample(id: ExampleId) {
    stop(true);
    setActiveId(id);
  }

  function scrub(value: number) {
    stop(false);
    setCurrentTime(value);
  }

  useEffect(() => {
    return () => stop(true);
  }, [stop]);

  useEffect(() => {
    drawSyncedVisual(canvasRef.current, active, currentTime);
  }, [active, currentTime]);

  return (
    <main className="shell">
      <nav className="nav">
        <Link className="brand" href="/">
          <span className="brand-mark" />
          Audio Signal Lab
        </Link>
        <div className="nav-links">
          <Link className="pill" href="/upload">Upload spectrogram</Link>
        </div>
      </nav>

      <section className="grid-two">
        <div className="panel copy stack">
          <span className="kicker">Page 9 replacement</span>
          <h1 style={{ fontSize: "clamp(38px, 6vw, 64px)" }}>Gallery visuals locked to sound.</h1>
          <p>
            Each sound is synthesized in the browser and the visual is revealed using the same playback
            clock. The cursor, stripes, sweeps, and bursts now move because the audio is playing.
          </p>

          <div className="example-list">
            {EXAMPLES.map((example) => (
              <button
                key={example.id}
                className={`example-button ${example.id === active.id ? "active" : ""}`}
                type="button"
                onClick={() => chooseExample(example.id)}
              >
                <b>{example.title}</b>
                <span>{example.description}</span>
              </button>
            ))}
          </div>

          <div className="actions">
            <button className="button" type="button" onClick={isPlaying ? () => stop(false) : play}>
              {isPlaying ? "Pause" : currentTime > 0 && currentTime < active.duration ? "Resume" : "Play synced sound"}
            </button>
            <button className="button ghost" type="button" onClick={() => stop(true)}>Reset</button>
          </div>

          <input
            className="scrubber"
            type="range"
            min={0}
            max={active.duration}
            step={0.01}
            value={currentTime}
            onChange={(event) => scrub(Number(event.target.value))}
            aria-label="Playback position"
          />
          <p className="mono">{currentTime.toFixed(2)}s / {active.duration.toFixed(2)}s · {active.title}</p>
        </div>

        <div className="panel stage-card spectrogram-frame">
          <canvas ref={canvasRef} aria-label="Synced gallery visualization" />
        </div>
      </section>
    </main>
  );
}

function createAudioBuffer(context: AudioContext, id: ExampleId, duration: number) {
  const length = Math.floor(duration * SAMPLE_RATE);
  const buffer = context.createBuffer(1, length, SAMPLE_RATE);
  const channel = buffer.getChannelData(0);
  let seed = 2;

  for (let i = 0; i < length; i += 1) {
    const t = i / SAMPLE_RATE;
    channel[i] = synthSample(id, t, duration, () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    });
  }

  return buffer;
}

function synthSample(id: ExampleId, t: number, duration: number, random: () => number) {
  if (id === "tone") return 0.65 * Math.sin(2 * Math.PI * 440 * t);
  if (id === "two") return 0.42 * (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 660 * t));
  if (id === "chirp") {
    const f0 = 180;
    const f1 = 1800;
    const phase = 2 * Math.PI * (f0 * t + ((f1 - f0) / (2 * duration)) * t * t);
    return 0.62 * Math.sin(phase);
  }
  if (id === "percussion") return percussionSample(t, random);

  const vibrato = 1 + 0.035 * Math.sin(2 * Math.PI * 5.5 * t);
  const f0 = 220 * vibrato;
  let value = 0;
  for (let k = 1; k <= 10; k += 1) {
    value += Math.sin(2 * Math.PI * f0 * k * t) / (k * 1.25);
  }
  const envelope = Math.min(1, t / 0.12, (duration - t) / 0.22);
  return 0.34 * value * Math.max(0, envelope);
}

function percussionSample(t: number, random: () => number) {
  let value = 0;
  for (let beat = 0; beat < 4; beat += 1) {
    const kickT = t - beat * 0.68;
    if (kickT >= 0 && kickT < 0.22) {
      const freq = 130 * Math.exp(-16 * kickT) + 38;
      value += Math.sin(2 * Math.PI * freq * kickT) * Math.exp(-18 * kickT);
    }
    const snareT = t - (beat * 0.68 + 0.34);
    if (snareT >= 0 && snareT < 0.16) {
      value += (random() * 2 - 1) * Math.exp(-26 * snareT) * 0.72;
    }
  }
  return Math.max(-1, Math.min(1, value * 0.75));
}

function drawSyncedVisual(canvas: HTMLCanvasElement | null, example: Example, time: number) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const progress = Math.max(0, Math.min(1, time / example.duration));
  const revealX = progress * width;

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#07101f");
  bg.addColorStop(1, "#172554");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height, dpr);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, revealX, height);
  ctx.clip();

  if (example.id === "tone") drawStripe(ctx, width, height, 440, example.color, dpr);
  if (example.id === "two") {
    drawStripe(ctx, width, height, 440, "#ffd84d", dpr);
    drawStripe(ctx, width, height, 660, "#25d8d0", dpr);
  }
  if (example.id === "chirp") drawChirp(ctx, width, height, example.duration, dpr);
  if (example.id === "percussion") drawPercussion(ctx, width, height, dpr);
  if (example.id === "voice") drawVoice(ctx, width, height, example.duration, dpr);

  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.fillRect(revealX, 0, width - revealX, height);
  ctx.strokeStyle = "rgba(255,216,77,.96)";
  ctx.lineWidth = 3 * dpr;
  ctx.beginPath();
  ctx.moveTo(revealX, 0);
  ctx.lineTo(revealX, height);
  ctx.stroke();

  ctx.fillStyle = "rgba(237,246,255,.88)";
  ctx.font = `${16 * dpr}px Spline Sans Mono, monospace`;
  ctx.fillText(example.title, 20 * dpr, 34 * dpr);
  ctx.font = `${11 * dpr}px Spline Sans Mono, monospace`;
  ctx.fillStyle = "rgba(237,246,255,.6)";
  ctx.fillText("time ->   frequency up   brightness = energy", 20 * dpr, height - 22 * dpr);
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

function freqY(freq: number, height: number) {
  const minFreq = 60;
  const ratio = Math.log(freq / minFreq) / Math.log(MAX_FREQ / minFreq);
  return height - Math.max(0, Math.min(1, ratio)) * height;
}

function drawStripe(ctx: CanvasRenderingContext2D, width: number, height: number, freq: number, color: string, dpr: number) {
  const y = freqY(freq, height);
  ctx.strokeStyle = color;
  ctx.lineWidth = 5 * dpr;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18 * dpr;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawChirp(ctx: CanvasRenderingContext2D, width: number, height: number, duration: number, dpr: number) {
  ctx.strokeStyle = "#ff5c9d";
  ctx.lineWidth = 5 * dpr;
  ctx.lineCap = "round";
  ctx.shadowColor = "#ff5c9d";
  ctx.shadowBlur = 18 * dpr;
  ctx.beginPath();
  for (let i = 0; i <= 180; i += 1) {
    const u = i / 180;
    const t = u * duration;
    const freq = 180 + (1800 - 180) * (t / duration);
    const x = u * width;
    const y = freqY(freq, height);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawPercussion(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number) {
  for (let beat = 0; beat < 4; beat += 1) {
    const kickX = (beat * 0.68 / 3) * width;
    const snareX = ((beat * 0.68 + 0.34) / 3) * width;
    const kickY = freqY(110, height);
    const kick = ctx.createRadialGradient(kickX, kickY, 1, kickX, kickY, 52 * dpr);
    kick.addColorStop(0, "rgba(255,216,77,.95)");
    kick.addColorStop(1, "rgba(255,216,77,0)");
    ctx.fillStyle = kick;
    ctx.fillRect(kickX - 70 * dpr, kickY - 70 * dpr, 140 * dpr, 140 * dpr);

    const snare = ctx.createLinearGradient(snareX, 0, snareX, height);
    snare.addColorStop(0, "rgba(61,124,255,.72)");
    snare.addColorStop(.55, "rgba(255,92,157,.48)");
    snare.addColorStop(1, "rgba(61,124,255,.03)");
    ctx.fillStyle = snare;
    ctx.fillRect(snareX - 13 * dpr, 38 * dpr, 30 * dpr, height - 76 * dpr);
  }
}

function drawVoice(ctx: CanvasRenderingContext2D, width: number, height: number, duration: number, dpr: number) {
  for (let harmonic = 1; harmonic <= 8; harmonic += 1) {
    ctx.strokeStyle = harmonic % 2 ? "#8b5cf6" : "#25d8d0";
    ctx.lineWidth = 2.6 * dpr;
    ctx.beginPath();
    for (let i = 0; i <= 180; i += 1) {
      const u = i / 180;
      const t = u * duration;
      const f0 = 220 * (1 + 0.035 * Math.sin(2 * Math.PI * 5.5 * t));
      const x = u * width;
      const y = freqY(f0 * harmonic, height);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
