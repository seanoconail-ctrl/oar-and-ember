# Stage 7 art, for review (decision DD-11: built without waiting, flagged here)

Every sheet below is in the game already; the user may still ask for changes.

| Folder | What it shows | How it was made |
|---|---|---|
| `people/` | The work loops `gather`, `fish`, `kneel`, `build` (6 frames each) and `sleep` (2 frames) for the steerer's two bodies (`steerer_a`, `steerer_b`), the heavy build and Hild: `<who>_<state>@1x.png` and `@4x.png` (rows s, n, e, w; every layer composited in draw order) and `<who>_<state>.gif` (south and east side by side at 3x, timed from the animation) | `python3 assets/art/authoring/people48.py`, adopted into `assets/art/sheets`, then `python3 assets/art/authoring/stage07_people.py` |
| `sheets/` | The proposed people sheets as text before adoption | `PROPOSED_OUT=docs/art/stage-07/sheets node src/tools/art/proposed.ts` |
| `other/` | The sheep (`graze` 4 frames, `lie` 2) and the camp fire (`flames` 6, `embers` 2) at 1x and 4x with GIFs | From the compiled atlases |

The broch, its S1 floor, the two sails, the camp's props, the stamina bar, the reason icons, the day
clock and the timing ring are painted by `assets/art/authoring/broch_art.py` and
`assets/art/authoring/ui_stage07.py`; they are seen in place in `docs/art/captures/stage-07/`.

## Weak spots (flagged)
- Hild's `kneel` reads more as sitting forward than kneeling.
- The sheep's north and south facings reuse the side views (a sheep is seen side-on).
- The work loops show a tool for each task (a stick of driftwood, the hand line, the mallet and
  stake); the kneel loop (lighting, cooking, tending) has no tool.
