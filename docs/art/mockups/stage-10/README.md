# Stage 10 mockups: the Hag's Seat and the sheepfold under the Hollow Cairn (flagged for review)

Book 3 asks a new place to start with a mockup and wait for approval. Under the standing authority
of decision DD-11 the build went on without waiting, so **these mockups are renders of the places as
built**: the game's own renderer, from the authored art (`assets/art/authoring/southern_art.py`,
`people48.py`) and the zone plans, at 1 logical pixel per pixel (640 x 360, 24 px tiles), the camera
held, the overlay hidden (decision S10-19). They were made by `npm run capture -- stage-10` and
copied here; the same views with their motion maps are in `docs/art/captures/stage-10/`. They are
judged against the approved targets in `docs/art/reference/` (Book 7 section 14) and the approved
Stage 7 mockup. The Kelda Spring is not mocked up apart: it is a pool in the machair, next to the
approved steading, drawn with the approved stream.

## The files
| File | What it shows |
|---|---|
| `hagseat.png`, `hagseat-loop.gif` | **The Hag's Seat, 11:00, the stone weeping** (4-second loop, 25 fps). The standing stone, dark and wet, water running down it and the pale light hanging by it; Runa hurt below it, kneeling with her adze, her tool chest beside her; the trodden paths meeting on the headland; the rock ridges of the neck to the east, their crevices full of thrift and grass; the sea in the geo to the north-east and the cliff path's shingle at the foot of the view. The steerer stands on the turf |
| `fold.png`, `fold-loop.gif` | **The sheepfold, 10:00** (4-second loop). The drystone fold, capped with moss and turf, its gate on the west; Thorkel lies in it, Bran stands guard by him; the three wreck-scavengers wait outside the gate (Ketill with axe and shield, Svart with his spear, Conn with his bow); a ewe grazes to the north-east; paths lead west to the machair and east past the cairn. The steerer stands outside the east wall |

## How each meets Book 7 section 14
| Point | How it is met here | Weak spots |
|---|---|---|
| **Terrain** | No tile edges: turf, trodden paths, the rock ridges and the geo's rock rims are noise-shaped dual-grid terrain (the art lint's straight-edge check passes). The stone, the fold and the cairn are solid geometry drawn in the game's 3/4 view: the fold's walls in courses with dark joints, lit caps and a hard east edge on the north-south runs (decision S10-18); the cairn ray-cast with its kerb and sealed door | The cairn's mound reads as a mound mostly by its turf and kerb; its shading is gentle |
| **Decoration** | The sward, tussocks in clumps, drifts of clover and trefoil, thrift and grass in the rock crevices (S10-20), stones in the turf, worn paths | The fold's inside is plain turf (sheep keep it short) |
| **Animation** | Motion with the camera still (`docs/art/captures/stage-10/README.md`): the Hag's Seat 88.4%, the neck 89.9%, the fold 81.6%, the cairn 91.0%, the Kelda Spring 93.8% (threshold 80%). What stays still: wall faces, the stone, the trodden paths | The fold is the nearest the threshold: its walls and paths are a good share of the view |
| **Movement** | Not in the loops; the Hag's Seat clip (`hagseat-walk.mp4`) shows the steerer walking the headland through the grass | |
| **Wind** | The one wind (S10-21): gusts travel across the turf; every plant sways on its own phase; the thrift in the rock nods | The Hag's Seat is no windier to look at than the strand: a stronger push pinned the grass flat and still. Its gale is heard |
| **Water** | The geo's sea with its foam rims; the Kelda Spring's pool with bubbles welling up and its stream to the burn | |
| **Life** | Gulls over the headland, a cormorant and a seal on the coast; sheep at the fold | No life on the cairn itself |
| **Lighting** | Late morning light; cloud shadows sweep over everything; the pale light by the weeping stone has a small cool light pool | In daylight the light pool is faint |
| **Camera feel** | A still camera for the mockup | Not shown |
| **Shadows** | A contact shadow under every person, the stone and the chests | The walls cast no shadow on the turf |
| **Idles** | Bran and the wreckers breathe and shift; Runa kneels; Thorkel lies still | |
