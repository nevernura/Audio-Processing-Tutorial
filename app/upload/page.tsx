"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { SpectrogramCanvas, type SpectrogramData } from "@/components/SpectrogramCanvas";

type ApiResponse = {
  file: { name: string; type: string; size: number };
  storage?: { enabled: boolean; bucket?: string; path?: string; publicUrl?: string; error?: string };
  spectrogram: SpectrogramData;
};

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState("");
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
    setResult(null);

    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch("/api/spectrogram", { method: "POST", body });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Could not compute spectrogram.");
      }
      setResult(json as ApiResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not compute spectrogram.");
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
            This calls a server endpoint instead of relying on the browser microphone analyser. The endpoint
            uses librosa when available and falls back to WAV decoding for lightweight local testing.
          </p>

          <label className="dropzone">
            <input
              type="file"
              accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <span>
              <b>{file ? file.name : "Choose an audio file"}</b>
              <br />
              <span className="status">MP3/M4A/FLAC need librosa + decoder support; WAV works with fallback.</span>
            </span>
          </label>

          <div className="actions">
            <button className="button" type="submit" disabled={loading}>{loading ? "Computing..." : "Compute spectrogram"}</button>
            <button className="button ghost" type="button" onClick={() => { setFile(null); setResult(null); setError(""); }}>Reset</button>
          </div>

          {error && <p className="error">{error}</p>}

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
