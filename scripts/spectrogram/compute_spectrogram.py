#!/usr/bin/env python3
"""Compute compact spectrogram data for the Next.js upload endpoint.

Uses librosa when available for broad audio-format support. If librosa is not
installed, falls back to uncompressed WAV files with a small pure-Python STFT so
local development can still validate the endpoint without a Python environment.
"""

from __future__ import annotations

import json
import math
import struct
import sys
import wave
from pathlib import Path
from typing import Iterable, List, Sequence, Tuple

TARGET_SR = 22_050
MAX_DURATION = 20.0
MAX_BINS = 128
MAX_FRAMES = 240
MIN_DB = -80.0


def main() -> int:
    if len(sys.argv) != 2:
        print(json.dumps({"error": "usage: compute_spectrogram.py <audio-file>"}), file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    try:
        result = compute(path)
    except Exception as exc:  # pragma: no cover - returned to API caller
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1

    print(json.dumps(result, separators=(",", ":")))
    return 0


def compute(path: Path) -> dict:
    try:
        return compute_with_librosa(path)
    except ImportError:
        return compute_wav_fallback(path)
    except Exception as exc:
        # If librosa exists but cannot decode the file, WAV fallback may still help.
        if path.suffix.lower() == ".wav":
            return compute_wav_fallback(path)
        raise RuntimeError(
            f"Could not decode audio with librosa/soundfile. Install ffmpeg or upload WAV. Details: {exc}"
        ) from exc


def compute_with_librosa(path: Path) -> dict:
    import librosa  # type: ignore
    import numpy as np  # type: ignore

    y, sr = librosa.load(path, sr=TARGET_SR, mono=True, duration=MAX_DURATION)
    if y.size == 0:
        raise ValueError("Audio file contains no samples")

    n_fft = 1024
    hop_length = 256
    spectrogram = np.abs(librosa.stft(y, n_fft=n_fft, hop_length=hop_length))
    db = librosa.amplitude_to_db(spectrogram, ref=np.max)
    normalized = np.clip((db - MIN_DB) / abs(MIN_DB), 0.0, 1.0)
    values = downsample_matrix(normalized.tolist(), MAX_BINS, MAX_FRAMES)

    return {
        "engine": "librosa",
        "sampleRate": sr,
        "duration": round(float(len(y) / sr), 3),
        "frames": len(values[0]) if values else 0,
        "bins": len(values),
        "minDb": MIN_DB,
        "maxDb": 0,
        "values": values,
    }


def compute_wav_fallback(path: Path) -> dict:
    samples, sr = read_wav_mono(path)
    if not samples:
        raise ValueError("WAV file contains no samples")

    max_samples = int(min(MAX_DURATION, len(samples) / sr) * sr)
    samples = samples[:max_samples]
    if sr != TARGET_SR:
        samples = resample_linear(samples, sr, TARGET_SR)
        sr = TARGET_SR

    n_fft = 512
    frames = min(MAX_FRAMES, max(1, len(samples) // 256))
    hop = max(1, (len(samples) - n_fft) // max(1, frames - 1)) if len(samples) > n_fft else n_fft
    window = [0.5 - 0.5 * math.cos((2 * math.pi * n) / max(1, n_fft - 1)) for n in range(n_fft)]
    bins = MAX_BINS
    matrix: List[List[float]] = [[0.0 for _ in range(frames)] for _ in range(bins)]
    max_mag = 1e-12

    for frame in range(frames):
        start = min(frame * hop, max(0, len(samples) - n_fft))
        chunk = samples[start : start + n_fft]
        if len(chunk) < n_fft:
            chunk = chunk + [0.0] * (n_fft - len(chunk))
        for k in range(bins):
            # Spread selected bins across the lower half of the spectrum.
            freq_bin = int(k * (n_fft // 2 - 1) / max(1, bins - 1))
            real = 0.0
            imag = 0.0
            for n, sample in enumerate(chunk):
                angle = 2 * math.pi * freq_bin * n / n_fft
                w = sample * window[n]
                real += w * math.cos(angle)
                imag -= w * math.sin(angle)
            mag = math.sqrt(real * real + imag * imag)
            matrix[k][frame] = mag
            max_mag = max(max_mag, mag)

    values: List[List[float]] = []
    for row in matrix:
        normalized_row = []
        for mag in row:
            db = 20.0 * math.log10(max(mag / max_mag, 1e-8))
            normalized_row.append(max(0.0, min(1.0, (db - MIN_DB) / abs(MIN_DB))))
        values.append(normalized_row)

    return {
        "engine": "wav-fallback",
        "sampleRate": sr,
        "duration": round(len(samples) / sr, 3),
        "frames": frames,
        "bins": bins,
        "minDb": MIN_DB,
        "maxDb": 0,
        "values": values,
    }


def read_wav_mono(path: Path) -> Tuple[List[float], int]:
    try:
        with wave.open(str(path), "rb") as wav:
            channels = wav.getnchannels()
            width = wav.getsampwidth()
            sr = wav.getframerate()
            frames = wav.readframes(min(wav.getnframes(), int(wav.getframerate() * MAX_DURATION)))
    except wave.Error as exc:
        raise RuntimeError("Install librosa/soundfile for non-WAV uploads, or upload an uncompressed WAV file") from exc

    if width == 1:
        values = [(b - 128) / 128.0 for b in frames]
    elif width == 2:
        ints = struct.unpack("<" + "h" * (len(frames) // 2), frames)
        values = [v / 32768.0 for v in ints]
    elif width == 3:
        values = []
        for i in range(0, len(frames), 3):
            raw = frames[i : i + 3]
            if len(raw) < 3:
                continue
            signed = int.from_bytes(raw + (b"\xff" if raw[2] & 0x80 else b"\x00"), "little", signed=True)
            values.append(signed / 8388608.0)
    elif width == 4:
        ints = struct.unpack("<" + "i" * (len(frames) // 4), frames)
        values = [v / 2147483648.0 for v in ints]
    else:
        raise RuntimeError(f"Unsupported WAV sample width: {width} bytes")

    if channels > 1:
        mono = []
        for i in range(0, len(values), channels):
            mono.append(sum(values[i : i + channels]) / channels)
        values = mono
    return values, sr


def resample_linear(samples: Sequence[float], original_sr: int, target_sr: int) -> List[float]:
    if original_sr == target_sr:
        return list(samples)
    ratio = target_sr / original_sr
    out_len = max(1, int(len(samples) * ratio))
    out = []
    for i in range(out_len):
        pos = i / ratio
        left = int(math.floor(pos))
        right = min(left + 1, len(samples) - 1)
        frac = pos - left
        out.append(samples[left] * (1 - frac) + samples[right] * frac)
    return out


def downsample_matrix(values: Sequence[Sequence[float]], max_bins: int, max_frames: int) -> List[List[float]]:
    if not values:
        return []
    src_bins = len(values)
    src_frames = len(values[0]) if values[0] else 0
    dst_bins = min(max_bins, src_bins)
    dst_frames = min(max_frames, src_frames)
    if dst_frames == 0:
        return [[] for _ in range(dst_bins)]

    output: List[List[float]] = []
    for b in range(dst_bins):
        src_b0 = int(b * src_bins / dst_bins)
        src_b1 = max(src_b0 + 1, int((b + 1) * src_bins / dst_bins))
        row = []
        for f in range(dst_frames):
            src_f0 = int(f * src_frames / dst_frames)
            src_f1 = max(src_f0 + 1, int((f + 1) * src_frames / dst_frames))
            total = 0.0
            count = 0
            for rb in values[src_b0:src_b1]:
                for val in rb[src_f0:src_f1]:
                    total += float(val)
                    count += 1
            row.append(round(total / max(1, count), 4))
        output.append(row)
    return output


if __name__ == "__main__":
    raise SystemExit(main())
