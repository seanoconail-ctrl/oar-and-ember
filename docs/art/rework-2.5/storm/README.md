# The storm opening (design addendum 2.5 section 3), captured from the real game

Written by `npm run capture -- rework-2.5-storm` (src/tools/art/captureStorm.ts) in capture mode,
the cold open played with the steering keys from its first frame.

- `storm-opening.gif`: 265 frames at 6 a second (a frame each 10 ticks), 3.97 MB; the middle 320 x 180 of the view at 1x. Near each strike frames are kept a tick or two apart so the double flicker shows.
- `storm-strip.png` (and @2x): a wave breaking, the storm, the mist and swells, the lightning, bright, the lightning fading, the strike.
- `views/storm.png`, `views/lightning.png` (and @4x): the whole view at 1x.

## Motion with the camera still (Book 7 section 14)

| View | Moving cells | Script ms a frame (stepped, smoothed) |
|---|---|---|
| The cold open (full detail) | 97.2% | 1.76 |
| The cold open (reduced motion, low detail) | 96.7% | 1.76 |
| Book 7 thresholds | 80.0% (50.0% reduced) | |
