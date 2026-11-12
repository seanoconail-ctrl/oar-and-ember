# The first five minutes (design addendum 2.4), captured from the real game

Written by `npm run capture -- rework-2.4-opening` (src/tools/art/captureOpening.ts). The cold
open and the waking are played with the keys from the naming screen; from the waking on, the
opening's bot plays in the page through a player's commands, each tick a real frame.

- `first-five-minutes.gif`: 288 frames at 10 a second (28.8 s), 3.72 MB; the middle 320 x 180 of the view at 1x. Key moments play at their own pace (a frame every 6 ticks); the walks between are sped up (a frame every 200 ticks).
- `first-five-minutes-strip.png` (and @2x): cold open, the strike, waking, the net cut, Hild carried up, Thorkel's chest, the first fire, Hild walks up, the sail raised, under the sail.
- The bot's play ended at game tick 13262 (3.68 minutes of game time from the cold open's first frame, the cold open and waking included); moments, from the same start: the net cut 75.8 s; Hild carried up 77.3 s; Thorkel's chest 81.0 s; the first fire 170.9 s; Hild walks up 212.6 s; the sail raised 214.0 s.

## Motion with the camera still (Book 7 section 14)

| View | Moving cells |
|---|---|
| net | 93.4% |
| camp-day | 85.8% |
| shelter-night | 90.3% |
| broch-door | 82.3% |
| Book 7 threshold | 80.0% |

Every view meets the threshold.
