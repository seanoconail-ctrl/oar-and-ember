# Stage 13 mockup: the wreck on Sgeir Dhubh (flagged for review)

Book 3 asks a new place to start with a mockup. Under decision DH-2 the stage runs on without
waiting for approval, but **this mockup was painted before the place was built** (decision
S13-58), with the approved mockups' own tools (`docs/art/mockup-src/sea_wreck.py`: the same palette
ramps, plants, birds, spray, cloud shadows and grade as the strand, Kelda and Seal Cave mockups).
The built place was made to it: the wreck, the cask, the iron, spray, kelp and the sail awash are
drawn by its painting functions (imported by `assets/art/authoring/stage13_wreck_art.py`).

## The files
| File | What it shows |
|---|---|
| `sea-wreck.png` | **Sgeir Dhubh on a grey windy afternoon.** The spine of black rock stacks with standing gulls and a cormorant on the offshore stack; the crown of salt turf and thrift; the shingle back, the weed-dark foreshore and the shelf of flats; the swell breaking white along the reef, spray on the rocks, kelp in the shallows, a seal; the *Faoileán* broken-backed on the south-western tip, her sail awash, the cask and the iron in the wash; Fínán holding her gunwale waist deep, Derbáil shivering on the shingle, Ívar lying hurt; the steerer; and the household's boat lying alongside to the east, the crew at their oars |
| `sea-wreck-loop.gif` | The same, a 6.4-second loop (written at 6.25 fps; motion measured on all 80 frames at 12.5 fps) |
| `sea-wreck-motion.png` | The still with the cells that do not keep moving tinted red |
| `measure.json` | The measure: continuous motion 87.8% (87.2% with the cloud shadows frozen; threshold 80%) |

The built place: `?view=play&camp=broch&crew=1&wreck=1` (decision S13-56); in the browser it
measures 97.6% continuous motion with the camera still (`tests/browser/seaWreck.spec.ts`).

## How it meets Book 7 section 14
| Point | In the mockup | In the built place | Weak spots |
|---|---|---|---|
| **Terrain** | Organic edges; rock stacks lit from the upper left with weed and barnacles at their wet feet; shingle, foreshore and flats in bands | Dual-grid terrain from the Book 9 tile grid (rock, turf, shingle, foreshore, flats, sea) | The reef's rock is the strand's rock tile |
| **Decoration** | Pebbles, sand, pools, weed, barnacled rock | Pebbles, shells, wrack, stones; debris from the wreck (planks, rope, net) | |
| **Animation** | 87.8%: sea, surf, spray, kelp, the sail awash, the wreck's water, the boat bobbing, the survivors shivering, gulls, spindrift | 97.6% | The rock stacks are still (solid things may be) |
| **Wind** | One wind from the south-west: turf and thrift lean and sway; spindrift blows east | The zone's own wind (1.5 times the strand's) | |
| **Water** | Swells from the south-west, breaking white along the reef; foam on the foreshore; pools | The game's water; Fínán masked waist deep with ripples | |
| **Life** | Gulls wheeling with shadows, standing gulls, a cormorant, a seal, crabs | Gulls (three circling, two standing), a cormorant, two seals, two crabs | |
| **Light** | A grey afternoon grade; cloud shadows | The game's grade by hour; cloud shadows | |
| **Shadows** | Contact shadows under people; rocks cast | Every prop and person casts (unit-tested) | |

## For the user's review
- The whole scenario is new content (Book 6 section 19): the survivors, their words, the four answers.
- The reef lies in Rán's Reach, its zone listed with Skarvholm's (decision S13-48).
