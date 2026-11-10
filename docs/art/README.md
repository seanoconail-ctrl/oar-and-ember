# Art direction targets (Step 1 of the art pass, awaiting approval)

These are mockups of the new environment standard. They are not the game yet. They are painted
with the proposed palette at 1 logical pixel per pixel (640 x 360, 24 px tiles, 32 x 40 people)
by a concept renderer in `mockup-src/`. That renderer applies the same kinds of pass the WebGL
renderer will get in Step 2: soft cast shadows and contact occlusion, cloud shadows, light pools
and a colour grade. The people are the game's own sprites, recoloured with the new ramps.

| File | What it is |
|---|---|
| `wreck-strand-target.png` / `.gif` | Wreck Strand, grey and windswept, late afternoon: a 6.4-second seamless loop |
| `kelda-summer-target.png` / `.gif` | The Kelda Spring and the machair in summer: a 6.4-second seamless loop |
| `target-walk.mp4` | 10 seconds of the target: the steerer walks the wet sand at the waterline, climbs the cut in the bank and crosses the machair, with the camera following (2x, 25 fps) |
| `current-walk.mp4` | 10 seconds of the current build (Stage 6) doing a similar walk from the strand onto the grass, for comparison |
| `palette-proposed.png` | The proposed palette: 37 hue-shifted ramps, 226 colours |

## What to look at
- **Terrain:**
  - Boundaries are organic, not tile-edged.
  - Calm areas sit between clusters of pebbles and shells.
  - The wrack line runs along the top of the beach.
  - Wet sand at the waterline darkens and shines, then dries after each wave.
  - The low cliff bank has a real face, ledges, an undercut grass lip and a shadow at its foot.
  - Rocks have dark wet bases, hanging weed, barnacles and lichen, with smaller stones round them.
- **Water:**
  - Colour darkens from the shallows to the deep, and swells lie in layers.
  - Foam runs up the sand and back.
  - Sun glints flicker on the swell, and spray bursts on the rocks and the wreck.
  - Kelp sways under the surface.
  - At Kelda: the spring bubbles, and the stream flows, with foam at its narrows and at the stepping stones.
- **Wind:** one wind from the west drives everything.
  - Gusts visibly travel across the grass and marram.
  - Every plant sways out of step with its neighbours, and flowers bob.
  - The fire's smoke bends away downwind; sand blows along the dry beach and rain slants.
  - The wreck's torn sail flogs, and cloaks lift.
- **Life:**
  - Strand: gulls circle with their shadows on the sand; a gull on the log turns its head; a cormorant dries its wings; a seal lifts its head; a crab scuttles.
  - Kelda: sheep graze; bees and butterflies work the flowers; seed fluff drifts.
- **Light:**
  - Long low shadows run east from the late sun.
  - Cloud shadows sweep over land and sea.
  - Firelight flickers on the sand and on the people by the fire.
  - Soft shafts of light fall at Kelda.
  - Shadows turn cool blue-violet and are never black.
- **People:**
  - Everyone has a soft ground shadow and a long cast shadow.
  - The steerer by the fire shifts weight and looks round.
  - Hild is shown at a task: filling a pail at the spring.
  - In the walk: footprints stay in the sand (wet ones hold water), dry sand puffs at each step, the swash splashes and ripples round the feet, the grass parts round the legs, and the walk bounces.

## Motion with the camera still
Measured by `mockup-src/measure.py`. The frame is cut into 576 cells of 20 x 20 pixels. A cell
counts if it keeps changing: at least 2% of its pixels change visibly between at least a quarter
of consecutive frames, so a one-off change such as a light switch does not count.

| Clip | Continuous motion |
|---|---|
| Current build (Stage 6), standing still on Wreck Strand | 21.2% of cells: only the sea tiles and the steerer's breathing |
| Wreck Strand target | 99.8% |
| Kelda target | 98.8% |
| Wreck Strand target, cloud shadows frozen | see the Step 1 report in the commit message |
| Kelda target, cloud shadows frozen | see the Step 1 report in the commit message |

## Regenerating
```bash
python3 docs/art/mockup-src/make_strand.py     # wreck-strand-target.png and .gif
python3 docs/art/mockup-src/scene_kelda.py     # kelda-summer-target.png and .gif
python3 docs/art/mockup-src/walk.py            # target-walk.mp4 (needs ffmpeg)
python3 docs/art/mockup-src/measure.py docs/art/wreck-strand-target.gif
```
Needs Python 3 with numpy and Pillow; the people come from `assets/art/maps` through
`mockup-src/export_people.ts` (run with Node 22).
