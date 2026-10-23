# RetailPulse AI — product video

"Retail, Reimagined with AI": a 2:00, 1920×1080 explainer built with [Remotion](https://remotion.dev) from real screenshots of
the running app, a synthesized voiceover and a generated music bed.

| Scene | Time | Shows |
|---|---|---|
| 01 Vision | 0:00–0:14 | Disconnected retail touchpoints connect into RetailPulse AI |
| 02 Intelligent shopping | 0:14–0:41 | Storefront, stock by store, a real recommendation with filters, prices and stock |
| 03 Trustworthy AI | 0:41–1:05 | A cited policy answer, then the "could not verify" fallback |
| 04 AI-powered operations | 1:05–1:36 | Support ticket proposed → confirmed, low-stock alerts, approved stock update, audit log |
| 05 Closing | 1:36–2:00 | Montage, architecture, brand frame |

```bash
npm install
node scripts/music.mjs                       # writes public/audio/music.wav (generated, not in Git)
npm run dev                                  # Remotion Studio: http://localhost:3000/RetailPulseAI
npx remotion render RetailPulseAI out/RetailPulseAI.mp4
```

## Regenerating the assets

- **Footage** (`public/footage/*.png` + `manifest.json` with element boxes): `node scripts/capture.mjs customer manager asking`.
  It drives the app at `APP_URL` (default `http://localhost:5180`) with Chrome at 1440×810 @2x. The default points at a second
  frontend whose `/api` goes to a backend on :8001 using a copy of the demo database (`retailpulse_video`), because the run
  creates a support ticket and changes stock. Re-check the highlight boxes in `src/scenes/*` after recapturing, since the
  AI's wording (and so the layout) can change.
- **Voiceover** (`public/voice/*.wav`, `src/voice-durations.json`): edit `src/narration.json`, then
  `../backend/.venv/bin/python scripts/voiceover.py --only <ids>`. Uses OpenAI `gpt-4o-mini-tts` with the key in `backend/.env`.
  Each line's `start` (seconds into its scene) places it; captions are timed from the clip lengths.
- **Music** (`public/audio/music.wav`): `node scripts/music.mjs`, synthesized, so there's nothing to license. The output is
  identical on every run, so the WAV is git-ignored; generate it once before rendering.
