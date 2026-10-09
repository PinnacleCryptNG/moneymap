# MoneyMap product demo video

A 40-second product demo built in Remotion (React). Every frame is code.

- `src/timeline.json`: the single source of timing for visuals and sound (120 BPM, every scene starts on a bar).
- `scripts/audio.mjs`: writes the original soundtrack and interface sounds to `public/soundtrack.wav`.
- `scripts/stills.mjs`: renders review frames. `scripts/render.mjs`: renders the final MP4s.

```bash
npm install
npm run audio     # soundtrack + UI sounds from the timeline
npm run stills    # review frames in out/stills
npm run render    # out/MoneyMap-demo-1920x1080.mp4 and out/MoneyMap-demo-1080x1920.mp4
```

All names and amounts are the app's made-up sample customer (Sarah): ₦450,000 in, ₦280,000 out, ₦170,000 left over, a ₦1,000,000 goal, a 95% match and ₦83,333 a month. Fonts (Geist, Geist Mono, Instrument Serif) are under the SIL Open Font License.
