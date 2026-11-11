# Stage 7 mockup: the broch shelter and the camp, S0 and S1, day and night (for approval)

Book 3 Stage 7, first step. **Nothing here is in the game.** These are mockups painted by the
concept renderer in `docs/art/mockup-src/` (`broch.py`, `scene_broch.py`, `people48.py`), with the
approved palette (`assets/palette/book07.json`, the ramps of `palette.py`) at 1 logical pixel per
pixel: 640 x 360, 24 px tiles, people on their 32 x 48 canvases about 40 px tall. They are judged
against the approved targets in `docs/art/reference/` (Book 7 section 14). The loops are seamless
6.4-second loops at 12.5 frames a second, like the references.

## The files
| File | What it shows |
|---|---|
| `s0-day.png`, `s0-day.gif` | **S0, late afternoon.** The first camp inside the ruined broch: the torn sail as a lean-to against the north-west inner wall, a fire ring of beach stones, salvage heaped against the east wall, driftwood gathered. Hild sits by the fire with her shin bound and feeds it; the steerer stands at the fire, breathing, shifting weight and glancing round |
| `s0-night.png`, `s0-night.gif` | **S0, night, fire lit.** The same camp under a blue-grey moonlit grade. Hild tends the fire with a stick; the steerer sleeps in the lean-to's mouth, rolled in the cloak (the madder hem shows) |
| `s1-day.png`, `s1-day.gif` | **S1, late afternoon.** The broch shelter: the sail stretched across the north of the court on a ridge pole and two driftwood posts, a kerbed hearth on the old flagged floor with its smoke, drying lines of split fish, beds of heather and bracken, a woodpile of driftwood, a water skin on a post, the salvage sorted, and a driftwood door in the doorway. Hild cooks a fish on a stick at the hearth; the steerer stands at the hearth |
| `s1-night.png`, `s1-night.gif` | **S1, night, fire lit.** Hild tends the hearth; the steerer sleeps in the middle bed under the sail. Light shows at the door's open edge |
| `*-broch-4x.png` | A 4x crop (240 x 270 of the still, 960 x 1080) of the broch's court, the fire and the doorway, for inspecting the pixels |
| `*-motion.png` | The still with cells that do **not** keep moving tinted red, measured with the cloud shadows frozen (the stricter figure) |

The window is tiles (2.3 to 29, 4.4 to 19.4) of the steading plan (Book 9 section 04): the broch
with its centre at tile (12, 13), its court 9 tiles across inside a wall a tile thick, the door on
the south at (12, 18), the path north through a breach in the north wall and south from the door
to the shore, and the stream from the Kelda flowing south on the east of the view. Wind from the
west; a low sun in the west-south-west.

## How each meets Book 7 section 14
| Point | How it is met here | Weak spots |
|---|---|---|
| **Terrain** | No tile edges anywhere: the turf, the court's floor, the trodden ground, the paths, the mossy stream banks and the turfed rubble hummock of the fallen south-east wall are all noise-shaped. The broch is solid geometry ray-cast in the game's 3/4 view, so its outer face (with a batter), the inner face, the broken wall head, the breach, the gallery between its two skins and the passage under the lintel all agree, and nothing runs off a canvas (decision S6R-11). Drystone in irregular courses with pinning stones and dark joints; moss creeping up from the foot; lichen on the lit faces; a damp, mossy ring of shade at the wall foot inside and out; tumbled stones at its foot and in the turf | The outer face is busy at 1x close to the fallen section. The S0 trodden patch is a fairly even brown |
| **Decoration** | About 38 plants a tile on the turf outside (grass, tussocks, thrift, clover and trefoil in drifts, reeds by the stream), grass and thrift on the wall head, ferns in the shade at the inner wall foot, heather, stones in the turf, worn paths; in S1 the old flagged floor shows through the cleared earth, with bracken strewn where people sleep | |
| **Animation** | Motion with the camera still, measured as the references were (`measure_broch.py`, 20 x 20 cells): S0 day 99.8% (92.7% with cloud shadows frozen), S0 night 100% (94.1%), S1 day 99.5% (88.5%), S1 night 99.7% (87.2%). The references: 100% (89.2% and 93.1% frozen). What stays still with clouds frozen is solid stone: wall faces and the wall head | S1 by day has the most still wall face |
| **Movement** | Nobody walks in these loops (a camp at rest), so the walk, footprints and the parting grass are not shown here; they are the approved Stage 6 work | Not exercised |
| **Wind** | One west wind: gusts travel across the turf as patches with a sheen; every plant sways on its own phase; inside the court the plants and the steerer's cloak move less (the walls shelter it), while the wall-head grass takes the full wind. Smoke rises straight in the sheltered court and bends hard east once it clears the wall head; sparks follow it. Ripples run across the sail; the torn hem on the lean-to's oar lifts in the gusts; the fish and the water skin swing | No blown sand or rain (inland, fair weather) |
| **Water** | The stream from the Kelda: flow streaks drift downstream, foam at the narrows and round the stepping stones, glints of the low sun by day and of the moon by night, mossy banks and reeds | The sea is not in view: the broch stands about 19 tiles above the shingle |
| **Life** | By day three ewes graze outside, gulls wheel overhead with their shadows on the ground, and a wheatear bobs and turns its head on the east wall head. By night the ewes lie chewing and lift their heads, and moths circle the fire | No midges (no still water) |
| **Lighting** | Day: the late sun throws long shadows east-north-east; the west wall shades the west of the court and the tower's shadow lies long over the turf to the east; cloud shadows sweep over everything; the fire's small warm pool flickers. Night: the scene is readable in blue-grey shadow with moonlit cloud shadows drifting over it; the fire's light falls off in flickering, dithered bands on the floor; the inner faces of the wall catch it further out than the floor does; it spills through the open doorway in S0 and shows at the door's open edge in S1; the smoke is lit warm from below; fire and sparks are the warmest colours | No shafts of light (the sky is clear enough here) |
| **Camera feel** | A still camera for the mockup; the framing follows the plan. The camera's look-ahead and smoothing are the game's (Stage 6) and are not shown | Not shown |
| **Shadows** | A soft contact shadow under every person, creature and prop; long cast shadows from people, sheep, gulls, props and the tower by day; by night each figure's shadow falls on the floor away from the fire, and the firelight is blocked by the wall. Shadows are cool blue-violet, never black; grass blades in shadow take the shade | |
| **Idles** | The steerer breathes, shifts weight and glances round (the approved idle, shift and glance frames); Hild sits and breathes (the approved sit frames); the sleeper's cloak rises and falls; the ewes' heads dip and lift | |

## What is mockup-only (flagged)
- **Hild's work and the sleeper.** Hild has no work-loop frames yet (Stage 7 draws them). Her stick and the fish on it are drawn over her approved sit frames, and her bound shin is two pixels of linen over them. The sleeping steerer is a mockup pose hand-drawn from the approved colours (hair, skin, the cloak's ramp, the madder hem, the brooch); the game's sleep state needs its own sheet, shown for approval before it is wired in.
- **The broch** is not yet a game asset. When it is built, it needs the game's own sheets or tiles (S6R-11 held back the old doorway sheet). This mockup sets its look.

## Regenerating
```bash
cd docs/art/mockup-src
python3 scene_broch.py                 # all four: stills, loops and 4x crops
python3 scene_broch.py s1 night        # one of them
python3 measure_broch.py s1 night      # motion, with clouds moving and frozen, and the motion map
```
Needs Python 3 with numpy and Pillow. The people are read from `assets/art/sheets` and
`assets/art/layers` (the approved Stage 6 rework sheets, already in the book07 palette) by
`people48.py`. The GIFs use one palette for the whole loop. A pixel is stored again only when its
colour has moved by more than a sum of 18 over R, G and B, which keeps each GIF under about 5 MB.
