# The user's third playtest: the story, captured from the real game

Written by `npm run capture -- playtest-3-story` (src/tools/art/captureStory.ts). The bots play
in the page through a player's commands; every kept frame is a real frame of the game.

- `thorkel-taken.gif`: 273 frames at 10 a second (27.3 s), 7.94 MB; the middle 480 x 270 of the view at 1x, from the bier lifted at the rite's place to a moment after control returns. the bier borne down at 0.60 s; set at the water at 7.32 s; the first wave round it at 8.73 s; the second over it at 11.35 s; the third lifts it at 13.97 s; drifting, riding lower at 18.48 s; sinking at 20.80 s; the ring of foam at 22.52 s.
- `thorkel-taken@4x.png`: the second wave over the bier, the whole view at 4x.
- `thorkel-taken-strip.png` (and @2x): the bier borne down, set at the water, the first wave round it, the second over it, the third lifts it, drifting, riding lower, sinking, the ring of foam.
- `shelter-stages.gif`: 176 frames at 10 a second, 1.69 MB; the middle 320 x 180 at 1x: the frame and the sail at their own pace (a frame every 6 ticks), the second day's finishing sped up (a frame every 30 ticks of its work). The night between is skipped by setting the clock to the second dawn. finished on day 2.
- `shelter-stages-strip.png` (and @2x): each stage as it was reached (FOLDED, FRAME, SAIL, FINISHED).

## Motion with the camera still (Book 7 section 14)

| View | Moving cells |
|---|---|
| frame-day | 84.2% |
| leanto-night | 93.1% |
| s1-day | 83.7% |
| s1-under-night | 92.2% |
| Book 7 threshold | 80.0% |

Every view meets the threshold.
