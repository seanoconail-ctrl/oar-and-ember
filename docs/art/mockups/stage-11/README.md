# Stage 11 mockup: Seal Cave on the north-east cliffs (flagged for review)

Book 3 asks a new place to start with a mockup. Under the standing authority of decision DD-11 the
build went on without waiting for approval, but unlike Stage 10 **this mockup was drawn before the
place was built** (decision S11-17): a painting at 640 x 360 made with the art-direction mockup's
own tools (`docs/art/mockup-src/sealcave.py`, the same palette ramps, plants, birds, fire, smoke,
spray, cloud shadows and grade as the approved strand and Kelda targets). The built place was then
made to it: its cliff face and the scavengers' skiff are drawn by the same functions
(`cave_face`, `cave_gloom`, `skiff`, imported by `assets/art/authoring/stage11_art.py`).

## The files
| File | What it shows |
|---|---|
| `sealcave.png` | **Seal Cave at low water on a grey morning.** The cliff in beds and joints with ledges, lichen and weed at its wet foot; the cave's arch in it, dark inside, light off the water rippling on its roof; the wreck-scavengers' skiff drawn up in the mouth, its steering oar lashed on the quarter; the cove's wet sand and pools in front; the sea running in from the east over a rock shelf with spray, a seal on the skerry and a cormorant drying its wings; the scavengers (Ketill, Svart and Conn) by their fire on the dry shingle to the west; the moor's turf and the path coming down through the bank |
| `sealcave-loop.gif` | The same, a 6.4-second loop (written at 6.25 fps to stay under 4 MB; motion measured on all 80 frames at 12.5 fps) |
| `sealcave-motion.png` | The still with the cells that do not keep moving tinted red |

The built place, for comparison: `docs/art/captures/stage-11/sealcave.png` (and `-loop.gif`,
`-motion.png`), and the walk down to it, `sealcave-walk.mp4`.

## How it meets Book 7 section 14
| Point | In the mockup | In the built place | Weak spots |
|---|---|---|---|
| **Terrain** | Organic edges everywhere; the cliff in irregular beds and joints, lit from the upper left, ledges with dark undercuts, wet dark rock with weed and barnacles at the foot | Dual-grid terrain from the zone plan (turf, shingle, foreshore, flats, rock, sea); the face is the mockup's painting cut into strips of two tiles, each sorted on its own foot | The cove's flats use the strand's flats tile, a regular rippled sand |
| **Decoration** | Pools on the sand, ripple marks, pebbles, wrack, marram by the bank | Pebbles, shells, wrack, stones at the rock's foot; the trodden path down from the cairn | |
| **Animation** | 92.9% of cells keep moving (threshold 80%): sea, foam, spray, kelp, grass, the fire and smoke, gulls, kittiwakes on the ledges, water seeping down the face, glints on the wet sand, sand blowing | 91.3% (`docs/art/captures/stage-11/README.md`): the sea, the cave's light, plants in the face's cracks and on its ledges, kittiwakes, the flats' water film (decision S11-21) | The face's rock itself is still, as Book 7 allows solid things to be |
| **Wind** | One wind from the west: the grass, thrift and marram lean and sway in travelling gusts; the smoke bends east; sand streams along the beach | The zone's own wind as the strand's | |
| **Water** | Swells banded to the shore, breaking in white lines, foam running up and back, spray on the rocks, the sky in the pools | The game's water (tide, swash, foam, sheen) | |
| **Life** | Gulls wheeling with their shadows, a seal lifting its head, a cormorant, kittiwakes | Gulls, two seals, a cormorant, kittiwakes standing on the ledges, a sheep on the moor | |
| **Light** | A grey morning grade; cloud shadows; the fire's warm pool | The game's grade by hour; cloud shadows | The cave's dark is drawn, not lit |
| **Shadows** | Contact shadows under the people; the cliff throws the top of the cove into shade | Contact and long shadows from the game; the face casts none of its own | |

## For the user's review
- The cave's mouth is one block south of Book 9's (41, 9), so that the cliff over it is in the view
  (decision S11-18).
- The inner chamber is drawn as the arch's dark with the skiff in its mouth; the deep passage
  beyond is not walkable until Stage 14.
