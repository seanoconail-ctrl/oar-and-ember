# Stage 14 mockups: the whole island (flagged for review)

Book 3 asks a new place to start with a mockup the user approves (Book 7 section 14; decision
S14-24). Under decision DH-2 Stages 13 to 16 make their mockups and flag them rather than wait, so
**these eight were painted before their places were built and are flagged for the user's review**.
They use the approved mockups' own tools and ramps (`docs/art/mockup-src/core.py`, `fx.py`,
`palette.py`) with a shared Stage 14 module, `docs/art/mockup-src/island14.py` (heather, bog
cotton, bracken, peat faces, cliff faces, stonework, the cell, the Grey Men, the eyrie, the
waterfall, the interiors' haze and the light off water). The game's art for these places is drawn
from the same painting functions (`assets/art/authoring/stage14_island_art.py`).

Each scene is a still (`<scene>.png`, and `<scene>-4x.png` at 4x), a 6.4-second loop
(`<scene>-loop.gif`, written at 6.25 fps; motion measured on all 80 frames at 12.5 fps), and a
motion map (`<scene>-motion.png`, the cells that do not keep moving tinted red). `measure.json`
holds the figures (threshold 80%, Book 7 section 14).

| Scene | Files | What it shows | Motion |
|---|---|---|---|
| Gull Geo and the hermit's cell (`ZONE_SK_GEO`) | `geo*` | The narrow geo from its east rim, the swell breaking on its head of shingle, the west wall's strata with fulmars and the sea cave's mouth, the dry cleft above it; the steep path to the cell, a roofless drystone ring with its doorway east, the burned altar, the cross on the slab, the fallen corbel; heather and thrift in a west wind; gulls | 96.2% |
| The west cliffs and the eagle stack (`ZONE_SK_CLIFFS`) | `cliffs*` | The cliff path along the top; the face in strata to the surf, the egg ledges with guillemots and kittiwakes; three marked climbs with drawn hand-holds and a waymark at each top; the stack offshore with the eyrie and the eagle, the other circling | 93.4% |
| Rook Hill and the waterfall (`ZONE_SK_ROOK`) | `rook*` | Heather in flower, bracken and hares; the upper stream falling over the lip of the high ground (lip, sheet, spray, churned pool, the dark ledge behind the sheet), running south over the grass; the watch cairn's plot; the prayer stone and its capstone | 94.4% |
| The bog and the Grey Men (`ZONE_SK_BOG`) | `bog*` | Peat banks with their cut faces and stacked turves, knee-deep pools holding the sky, bog cotton round them; the nine stones on the drier rise, the tallest east, the cup-and-ring stone north-west; midges, mist | 94.6% |
| Naust Cove (`ZONE_SK_NAUST`) | `naust*` | The boatshed plot pegged out on the turf with its first timbers; the line of old stones to the fallen naust and its lintel cut with a ship; the beach, the flats coming bare, the fishing rocks on both points, seals, a cormorant | 84.4% |
| The Skerry of the Drowned at a spring low (`ZONE_SK_SKERRY`) | `skerry*` | The causeway of weed-hung boulders from the shore to the low black skerry, the flats bare either side, seals; the drowned standing dripping on the skerry; the glint in the crack at the causeway's shore end | 84.2% |
| The Seal Cave's deep passage (`ZONE_SK_SEALCAVE_DEEP`) | `deep*` | Painted tile for tile from `docs/levels/sealcave_passage_tiles.txt`: the knee-deep pool, the mid chamber's bank, the alcove and its carving, the crawl under its slab, the fallen stone and its slot; the weed line, drips, light off the water on the walls, a damp haze on the draught | 91.0% |
| The Hollow Cairn's inside in Year 1 (`ZONE_SK_CAIRN_IN`) | `cairn_in*` | Painted from `docs/levels/hollow_cairn_tiles.txt` read as Year 1 (no shaft, no sea-light): the festival sun along the outer passage from the east door, dust turning in it; the grave cells and their goods; the great chamber whole and dark; the Door of Three Truths closed, its spiral unlit | 97.0% |

    python3 docs/art/mockup-src/geo14.py      # and cliffs14, rook14, bog14, naust14,
    python3 docs/art/mockup-src/interiors14.py # skerry14; interiors14 writes deep and cairn_in

## For the user's review
- **All eight are new places**, made and flagged under DH-2, not yet approved.
- **The drowned on the Skerry are drawn only in the mockup**, small and in a colder palette (Book 7
  section 09). They are characters: their sheets come with their own approval (Book 3), and are
  not part of this package.
- **The interiors' light.** Neither passage has a light of its own in Year 1. The mockups light
  the deep passage dimly from its way in and from the water, and the cairn's inside by the
  festival sun through its open door; the haze moving on the draught and the light off the water
  carry most of their motion (the walls are solid and may be still). How dark an interior is in
  play is for the user.
- **Where the art is weakest:** the rock stacks and boulders are still (solid things may be);
  the surf in the geo and on the Skerry is busier than on the strand; the Grey Men read as a ring
  only from close by.
