# Development setup

This repository now contains a Next.js + Python audio prototype in addition to the static tutorial assets.

## One-command setup

Run this from the repository root:

```bash
npm run setup:dev
```

The setup script will:

1. Verify `python3` and `npm` are available.
2. Install Node dependencies with `npm install`.
3. Install Python audio dependencies from `requirements.txt` with `python3 -m pip install --user -r requirements.txt`.
4. Run the standard validation commands:
   - `npm run typecheck`
   - `npm run check:python`
   - `npm run build`

## Manual setup

If you prefer to run each step yourself:

```bash
npm install
python3 -m pip install --user -r requirements.txt
npm run typecheck
npm run check:python
npm run build
```

## Running locally

```bash
npm run dev
```

Then open the URL printed by Next.js. Important prototype routes:

- `/upload` - upload audio and compute a spectrogram through the API route.
- `/gallery` - synced synthesized audio and visual gallery.
- `/api/spectrogram` - multipart upload endpoint used by `/upload`.

## Supabase configuration

Supabase is optional for now. To enable upload persistence, copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_AUDIO_BUCKET=audio-uploads
```

Without those values, the spectrogram endpoint still computes uploaded audio but skips Supabase storage.

## Python audio support

The spectrogram worker uses `librosa` when installed. If Python dependencies are not installed, the endpoint can still process uncompressed WAV files through its fallback decoder.
