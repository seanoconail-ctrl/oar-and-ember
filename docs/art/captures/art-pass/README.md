# Capture: art-pass

Made by `npm run capture -- art-pass` (src/tools/art/capture.ts). Compare with
`docs/art/reference/` (Book 7 section 14).

| File | What it is |
|---|---|
| `still.png`, `still@2x.png` | Wreck Strand where the steerer wakes, at 1x and 2x |
| `walk.mp4` | 10 seconds at 2x, 25 fps: up the strand, through the cut, onto the machair |
| `compare.png` | The approved reference (left) beside the capture (right), both at 2x |
| `motion.png` | The still view; cells without continuous motion are marked red |

## Motion with the camera still

| Clip | Continuous motion |
|---|---|
| This capture (41 frames over 6.4 s) | 96.0% |
| Reference: Wreck Strand target | 100.0% |
| Reference: Wreck Strand target, cloud shadows frozen | 89.2% |
| Book 7 threshold | 80.0% |

Meets the threshold.
