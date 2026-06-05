import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { getAudioBucketName, getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 24 * 1024 * 1024;

type PythonResult = {
  engine: string;
  sampleRate: number;
  duration: number;
  frames: number;
  bins: number;
  minDb: number;
  maxDb: number;
  values: number[][];
};

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload an audio file using the 'file' field." }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Upload must be 24 MB or smaller for this prototype." }, { status: 413 });
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "audio-spectrogram-"));
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "upload.wav";
  const uploadPath = path.join(tempDir, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(uploadPath, buffer);

  try {
    const [spectrogram, storage] = await Promise.all([
      runSpectrogramWorker(uploadPath),
      maybeStoreUpload(buffer, safeName, file.type),
    ]);

    return NextResponse.json({
      file: {
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
      },
      storage,
      spectrogram,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not compute spectrogram." },
      { status: 422 },
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function runSpectrogramWorker(uploadPath: string) {
  const workerPath = path.join(process.cwd(), "scripts/spectrogram/compute_spectrogram.py");
  const result = await runProcess("python3", [workerPath, uploadPath]);

  if (result.code !== 0) {
    throw new Error(parsePythonError(result.stderr) || "Spectrogram worker failed.");
  }

  try {
    return JSON.parse(result.stdout) as PythonResult;
  } catch (error) {
    throw new Error(`Spectrogram worker returned invalid JSON: ${error instanceof Error ? error.message : error}`);
  }
}

function runProcess(command: string, args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function parsePythonError(stderr: string) {
  const trimmed = stderr.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed.split("\n").at(-1) || trimmed) as { error?: string };
    return parsed.error || trimmed;
  } catch {
    return trimmed;
  }
}

async function maybeStoreUpload(buffer: Buffer, fileName: string, contentType: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { enabled: false };
  }

  const bucket = getAudioBucketName();
  const storagePath = `uploads/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${fileName}`;
  const { error } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    contentType: contentType || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    return { enabled: true, bucket, error: error.message };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return { enabled: true, bucket, path: storagePath, publicUrl: data.publicUrl };
}
