"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SpectrogramCanvas, type SpectrogramData } from "@/components/SpectrogramCanvas";

type ApiResponse = {
  file: { name: string; type: string; size: number };
  storage?: { enabled: boolean; bucket?: string; path?: string; publicUrl?: string; error?: string };
  spectrogram: SpectrogramData;
};

type Mode = "sweep" | "upload" | "mic";

type LiveSource = {
  context: AudioContext;
  analyser: AnalyserNode;
  oscillator?: OscillatorNode;
  gain?: GainNode;
  stream?: MediaStream;
  startedAt: number;
};

const MAX_BROWSER_DURATION = 24;
const TARGET_BINS = 128;
const TARGET_FRAMES = 240;
const FFT_SIZE = 1024;
const MIN_DB = -80;
const LIVE_FFT_SIZE = 2048;
const SWEEP_SECONDS = 7.5;

const MODES: Array<{ id: Mode; label: string; summary: string }> = [
  { id: "sweep", label: "Generated sweep", summary: "Always works and teaches the diagonal sweep pattern." },
  { id: "upload", label: "Upload audio", summary: "Uses the Python/librosa API first, then Web Audio fallback." },
  { id: "mic", label: "Microphone", summary: "Live analyser with clear permission/error state." },
];

export default function UploadPage() {
  const [mode, setMode] = useState<Mode>("sweep");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("Generated sweep is ready. Press Start to draw a live spectrogram.");
  const [loading, setLoading] = useState(false);
  const [liveRunning, setLiveRunning] = useState(false);
  const [liveLabel, setLiveLabel] = useState("Generated sweep · idle");
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveSourceRef = useRef<LiveSource | null>(null);
  const liveRafRef = useRef<number | null>(null);
  const liveColumnRef = useRef(0);

  const label = useMemo(() => {
    if (!result) return undefined;
    return `${result.file.name} · ${result.spectrogram.engine} · ${result.spectrogram.duration}s`;
  }, [result]);

  const stopLive = useCallback(async (resetCanvas = false) => {
    if (liveRafRef.current !== null) {
      cancelAnimationFrame(liveRafRef.current);
      liveRafRef.current = null;
    }

    const source = liveSourceRef.current;
    liveSourceRef.current = null;

    if (source?.oscillator) {
      try { source.oscillator.stop(); } catch {}
      source.oscillator.disconnect();
    }
    source?.gain?.disconnect();
    if (source?.stream) {
      source.stream.getTracks().forEach((track) => track.stop());
    }
    await source?.context.close().catch(() => undefined);

    setLiveRunning(false);
    if (resetCanvas) {
      liveColumnRef.current = 0;
      drawLivePlaceholder(liveCanvasRef.current, mode);
    }
  }, [mode]);

  useEffect(() => {
    drawLivePlaceholder(liveCanvasRef.current, mode);
    return () => {
      void stopLive(false);
    };
  }, [mode, stopLive]);

  function chooseMode(nextMode: Mode) {
    void stopLive(true);
    setMode(nextMode);
    setError("");
    setResult(null);
    setLoading(false);
    if (nextMode === "sweep") setNotice("Generated sweep is ready. Press Start to draw a live spectrogram.");
    if (nextMode === "upload") setNotice("Choose an audio file. Server spectrogram is tried first; browser fallback is automatic.");
    if (nextMode === "mic") setNotice("Press Start microphone and grant permission to draw live audio.");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose an audio file first.");
      return;
    }

    await stopLive(false);
    setLoading(true);
    setError("");
    setNotice("Computing spectrogram...");
    setResult(null);

    try {
      const serverResult = await computeSpectrogramOnServer(file);
      setResult(serverResult);
      setNotice(serverResult.storage?.enabled === false ? "Spectrogram computed on the server. Supabase storage is not configured, so the file was not saved." : "Spectrogram computed on the server.");
    } catch (serverError) {
      try {
        const browserSpectrogram = await computeSpectrogramInBrowser(file);
        setResult({
          file: {
            name: file.name,
            type: file.type || "application/octet-stream",
            size: file.size,
          },
          storage: { enabled: false },
          spectrogram: browserSpectrogram,
        });
        setNotice(`Server spectrogram failed, so the browser decoded and rendered this file locally. Server message: ${errorMessage(serverError)}`);
      } catch (browserError) {
        setError(`Could not compute a spectrogram. Server: ${errorMessage(serverError)} Browser fallback: ${errorMessage(browserError)}`);
        setNotice("");
      }
    } finally {
      setLoading(false);
    }
  }

  async function startSweep() {
    await stopLive(true);
    setError("");
    setNotice("Drawing generated sweep. The diagonal should climb as the pitch rises.");

    const context = await createAudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = LIVE_FFT_SIZE;
    analyser.smoothingTimeConstant = 0.45;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sawtooth";
    oscillator.frequency.value = 120;
    gain.gain.value = 0.11;
    oscillator.connect(gain);
    gain.connect(analyser);
    gain.connect(context.destination);
    oscillator.start();

    const source: LiveSource = { context, analyser, oscillator, gain, startedAt: context.currentTime };
    liveSourceRef.current = source;
    liveColumnRef.current = 0;
    setLiveRunning(true);
    drawLiveFrame(source, "sweep");
  }

  async function startMic() {
    await stopLive(true);
    setError("");
    setNotice("Requesting microphone permission...");

    try {
      const context = await createAudioContext();
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser does not expose microphone capture.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const analyser = context.createAnalyser();
      analyser.fftSize = LIVE_FFT_SIZE;
      analyser.smoothingTimeConstant = 0.62;
      const input = context.createMediaStreamSource(stream);
      input.connect(analyser);

      const source: LiveSource = { context, analyser, stream, startedAt: context.currentTime };
      liveSourceRef.current = source;
      liveColumnRef.current = 0;
      setLiveRunning(true);
      setNotice("Microphone is live. Speak, clap, or play music near the mic.");
      drawLiveFrame(source, "mic");
    } catch (micError) {
      setError(errorMessage(micError));
      setNotice("");
      await stopLive(true);
    }
  }

  function drawLiveFrame(source: LiveSource, sourceMode: "sweep" | "mic") {
    const canvas = liveCanvasRef.current;
    if (!canvas) return;

    if (sourceMode === "sweep" && source.oscillator) {
      const elapsed = source.context.currentTime - source.startedAt;
      const phase = (elapsed % SWEEP_SECONDS) / SWEEP_SECONDS;
      const frequency = 120 * Math.pow(8000 / 120, phase);
      source.oscillator.frequency.setTargetAtTime(frequency, source.context.currentTime, 0.015);
      setLiveLabel(`Generated sweep · ${Math.round(frequency)} Hz`);
    } else {
      setLiveLabel("Microphone · live analyser");
    }

    drawAnalyserColumn(canvas, source.analyser, liveColumnRef);
    liveRafRef.current = requestAnimationFrame(() => drawLiveFrame(source, sourceMode));
  }

  const activeMode = MODES.find((item) => item.id === mode) || MODES[0];

  return (
    <main className="shell">
      <nav className="nav">
        <Link className="brand" href="/">
          <span className="brand-mark" />
          Audio Signal Lab
        </Link>
        <div className="nav-links">
          <Link className="pill" href="/gallery">Synced gallery</Link>
        </div>
      </nav>

      <section className="grid-two">
        <div className="panel copy stack">
          <span className="kicker">Page 7 replacement</span>
          <h1 style={{ fontSize: "clamp(38px, 6vw, 64px)" }}>Spectrogram lab with three reliable modes.</h1>
          <p>
            Page 7 is now split by source: a generated sweep, uploaded audio, and microphone input. Each
            mode has its own pipeline and status messages, so failures are easier to understand and fix.
          </p>

          <div className="mode-tabs" role="tablist" aria-label="Spectrogram source modes">
            {MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === mode}
                className={`mode-tab ${item.id === mode ? "active" : ""}`}
                onClick={() => chooseMode(item.id)}
              >
                <b>{item.label}</b>
                <span>{item.summary}</span>
              </button>
            ))}
          </div>

          {mode === "sweep" && (
            <div className="stack">
              <p className="status">Sweep is generated in the browser and drawn with a Canvas 2D live analyser. It should work even when upload or mic permissions fail.</p>
              <div className="actions">
                <button className="button" type="button" onClick={liveRunning ? () => void stopLive(false) : startSweep}>{liveRunning ? "Stop sweep" : "Start sweep"}</button>
                <button className="button ghost" type="button" onClick={() => void stopLive(true)}>Clear</button>
              </div>
            </div>
          )}

          {mode === "upload" && (
            <form className="stack" onSubmit={submit}>
              <label className="dropzone">
                <input
                  type="file"
                  accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] || null);
                    setError("");
                    setNotice("File selected. Compute the spectrogram to render it.");
                    setResult(null);
                  }}
                />
                <span>
                  <b>{file ? file.name : "Choose an audio file"}</b>
                  <br />
                  <span className="status">Server uses librosa when available; browser fallback uses Web Audio decode support.</span>
                </span>
              </label>

              <div className="actions">
                <button className="button" type="submit" disabled={loading}>{loading ? "Computing..." : "Compute spectrogram"}</button>
                <button className="button ghost" type="button" onClick={() => { setFile(null); setResult(null); setError(""); setNotice("Choose an audio file. Server spectrogram is tried first; browser fallback is automatic."); }}>Reset</button>
              </div>
            </form>
          )}

          {mode === "mic" && (
            <div className="stack">
              <p className="status">Microphone mode needs HTTPS or localhost and browser permission. It never uploads your microphone audio.</p>
              <div className="actions">
                <button className="button" type="button" onClick={liveRunning ? () => void stopLive(false) : startMic}>{liveRunning ? "Stop microphone" : "Start microphone"}</button>
                <button className="button ghost" type="button" onClick={() => void stopLive(true)}>Clear</button>
              </div>
            </div>
          )}

          {error && <p className="error">{error}</p>}
          {notice && <p className="status">{notice}</p>}

          {mode === "upload" && result && (
            <div className="stack">
              <div className="metric-row">
                <span className="metric"><b>{result.spectrogram.duration}s</b> duration</span>
                <span className="metric"><b>{result.spectrogram.bins}</b> bins</span>
                <span className="metric"><b>{result.spectrogram.frames}</b> frames</span>
                <span className="metric"><b>{result.spectrogram.engine}</b> engine</span>
              </div>
              {result.storage?.enabled && (
                <p className="status">
                  Supabase storage: {result.storage.error ? `not saved (${result.storage.error})` : `saved to ${result.storage.bucket}/${result.storage.path}`}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="panel stage-card spectrogram-frame">
          {mode === "upload" ? (
            <SpectrogramCanvas data={result?.spectrogram || null} label={label || activeMode.label} />
          ) : (
            <canvas ref={liveCanvasRef} className="spectrogram-canvas" aria-label={`${activeMode.label} live spectrogram`} data-label={liveLabel} />
          )}
        </div>
      </section>
    </main>
  );
}

async function computeSpectrogramOnServer(file: File) {
  const body = new FormData();
  body.append("file", file);

  const response = await fetch("/api/spectrogram", { method: "POST", body });
  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(text || `Server returned HTTP ${response.status}`);
  }

  if (!response.ok) {
    const error = typeof json === "object" && json && "error" in json ? String((json as { error: unknown }).error) : `Server returned HTTP ${response.status}`;
    throw new Error(error);
  }

  return json as ApiResponse;
}

async function computeSpectrogramInBrowser(file: File): Promise<SpectrogramData> {
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error("This browser does not support Web Audio decoding.");
  }

  const audioContext = new AudioContextCtor();
  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const duration = Math.min(decoded.duration, MAX_BROWSER_DURATION);
    const sampleRate = decoded.sampleRate;
    const samples = mixDown(decoded, duration);
    const values = computeStft(samples, TARGET_BINS, TARGET_FRAMES);

    return {
      engine: "browser-web-audio",
      sampleRate,
      duration: Number(duration.toFixed(3)),
      frames: values[0]?.length || 0,
      bins: values.length,
      minDb: MIN_DB,
      maxDb: 0,
      values,
    };
  } finally {
    await audioContext.close().catch(() => undefined);
  }
}

function mixDown(buffer: AudioBuffer, duration: number) {
  const channels = buffer.numberOfChannels;
  const sampleCount = Math.min(buffer.length, Math.floor(duration * buffer.sampleRate));
  const mixed = new Float32Array(sampleCount);

  for (let channel = 0; channel < channels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < sampleCount; i += 1) {
      mixed[i] += data[i] / channels;
    }
  }

  return mixed;
}

function computeStft(samples: Float32Array, bins: number, maxFrames: number) {
  const frameCount = Math.max(1, Math.min(maxFrames, Math.ceil(samples.length / 512)));
  const hop = frameCount > 1 ? Math.max(1, Math.floor((samples.length - FFT_SIZE) / (frameCount - 1))) : FFT_SIZE;
  const windowValues = new Float32Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i += 1) {
    windowValues[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / Math.max(1, FFT_SIZE - 1));
  }

  const magnitudes = Array.from({ length: bins }, () => new Float32Array(frameCount));
  let maxMagnitude = 1e-12;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = Math.min(Math.max(0, frame * hop), Math.max(0, samples.length - FFT_SIZE));
    for (let bin = 0; bin < bins; bin += 1) {
      const frequencyBin = Math.round((bin / Math.max(1, bins - 1)) * (FFT_SIZE / 2 - 1));
      let real = 0;
      let imag = 0;
      for (let n = 0; n < FFT_SIZE; n += 1) {
        const sample = (samples[start + n] || 0) * windowValues[n];
        const angle = (2 * Math.PI * frequencyBin * n) / FFT_SIZE;
        real += sample * Math.cos(angle);
        imag -= sample * Math.sin(angle);
      }
      const magnitude = Math.sqrt(real * real + imag * imag);
      magnitudes[bin][frame] = magnitude;
      maxMagnitude = Math.max(maxMagnitude, magnitude);
    }
  }

  return magnitudes.map((row) => Array.from(row, (magnitude) => {
    const db = 20 * Math.log10(Math.max(magnitude / maxMagnitude, 1e-8));
    return Number(Math.max(0, Math.min(1, (db - MIN_DB) / Math.abs(MIN_DB))).toFixed(4));
  }));
}

async function createAudioContext() {
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error("This browser does not support Web Audio.");
  }
  const context = new AudioContextCtor();
  if (context.state === "suspended") await context.resume();
  return context;
}

function drawLivePlaceholder(canvas: HTMLCanvasElement | null, mode: Mode) {
  if (!canvas) return;
  const { ctx, width, height, dpr } = prepareLiveCanvas(canvas);
  if (!ctx) return;
  drawLiveBackground(ctx, width, height, dpr);
  ctx.fillStyle = "rgba(237,246,255,.76)";
  ctx.font = `${15 * dpr}px Spline Sans Mono, monospace`;
  ctx.textAlign = "center";
  const text = mode === "mic" ? "Start microphone to draw live energy" : "Start sweep to draw a live spectrogram";
  ctx.fillText(text, width / 2, height / 2);
}

function drawAnalyserColumn(canvas: HTMLCanvasElement, analyser: AnalyserNode, columnRef: { current: number }) {
  const { ctx, width, height, dpr } = prepareLiveCanvas(canvas, true);
  if (!ctx) return;

  if (columnRef.current === 0) {
    drawLiveBackground(ctx, width, height, dpr);
  }

  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);

  const x = columnRef.current % width;
  const columnWidth = Math.max(2, Math.floor(2 * dpr));
  if (x < columnWidth) {
    drawLiveBackground(ctx, width, height, dpr);
  }

  for (let y = 0; y < height; y += columnWidth) {
    const bin = Math.floor((1 - y / height) * (data.length - 1));
    const value = data[Math.max(0, Math.min(data.length - 1, bin))] / 255;
    ctx.fillStyle = colorRamp(value);
    ctx.fillRect(x, y, columnWidth, columnWidth + 1);
  }

  ctx.fillStyle = "rgba(7,16,31,.82)";
  ctx.fillRect(0, 0, width, 44 * dpr);
  ctx.fillStyle = "rgba(237,246,255,.82)";
  ctx.font = `${12 * dpr}px Spline Sans Mono, monospace`;
  ctx.textAlign = "left";
  ctx.fillText(canvas.dataset.label || "Live spectrogram", 16 * dpr, 27 * dpr);

  ctx.strokeStyle = "rgba(255,216,77,.95)";
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath();
  ctx.moveTo(x + columnWidth, 0);
  ctx.lineTo(x + columnWidth, height);
  ctx.stroke();

  columnRef.current = (x + columnWidth) % width;
}

function prepareLiveCanvas(canvas: HTMLCanvasElement, keepSize = false) {
  const rect = canvas.getBoundingClientRect();
  const parentRect = canvas.parentElement?.getBoundingClientRect();
  const cssWidth = rect.width || parentRect?.width || 820;
  const cssHeight = rect.height || parentRect?.height || 500;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(cssWidth * dpr));
  const height = Math.max(1, Math.round(cssHeight * dpr));
  if (!keepSize || canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { ctx: canvas.getContext("2d"), width: canvas.width, height: canvas.height, dpr };
}

function drawLiveBackground(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#07101f");
  gradient.addColorStop(1, "#172554");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
