"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { SpectrogramCanvas, type SpectrogramData } from "@/components/SpectrogramCanvas";

type ApiResponse = {
  file: { name: string; type: string; size: number };
  storage?: { enabled: boolean; bucket?: string; path?: string; publicUrl?: string; error?: string };
  spectrogram: SpectrogramData;
};

const MAX_BROWSER_DURATION = 24;
const TARGET_BINS = 128;
const TARGET_FRAMES = 240;
const FFT_SIZE = 1024;
const MIN_DB = -80;

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const label = useMemo(() => {
    if (!result) return undefined;
    return `${result.file.name} · ${result.spectrogram.engine} · ${result.spectrogram.duration}s`;
  }, [result]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose an audio file first.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");
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
      }
    } finally {
      setLoading(false);
    }
  }

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
        <form className="panel copy stack" onSubmit={submit}>
          <span className="kicker">Page 7 replacement</span>
          <h1 style={{ fontSize: "clamp(38px, 6vw, 64px)" }}>Upload audio. See its spectrogram.</h1>
          <p>
            This calls a server endpoint first. If the deployment cannot decode your file server-side,
            the page falls back to Web Audio in your browser and still renders a spectrogram locally.
          </p>

          <label className="dropzone">
            <input
              type="file"
              accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setError("");
                setNotice("");
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
            <button className="button ghost" type="button" onClick={() => { setFile(null); setResult(null); setError(""); setNotice(""); }}>Reset</button>
          </div>

          {error && <p className="error">{error}</p>}
          {notice && <p className="status">{notice}</p>}

          {result && (
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
        </form>

        <div className="panel stage-card spectrogram-frame">
          <SpectrogramCanvas data={result?.spectrogram || null} label={label} />
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
