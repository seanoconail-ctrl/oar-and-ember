# The storm opening (design addendum 2.5 section 3), captured from the real game

Written by `npm run capture -- rework-2.5-storm` (src/tools/art/captureStorm.ts) in capture mode,
the cold open played with the steering keys from its first frame.

- `storm-opening.gif`: 322 frames at 7.5 a second (a frame each 8 ticks), 5.05 MB; the middle 320 x 180 of the view at 1x. Near each strike frames are kept a tick or two apart so the double flicker shows.
- `storm-strip.png` (and @2x): a wave breaking, the storm, the mist and swells, the lightning, bright, the lightning fading, the strike.
- `views/storm.png`, `views/lightning.png` (and @4x): the whole view at 1x.

## Motion with the camera still (Book 7 section 14)

| View | Moving cells | Script ms a frame (stepped, smoothed) |
|---|---|---|
| The cold open (full detail) | 98.8% | 2.13 |
| The cold open (reduced motion, low detail) | 97.6% | 1.87 |
| Book 7 thresholds | 80.0% (50.0% reduced) | |
