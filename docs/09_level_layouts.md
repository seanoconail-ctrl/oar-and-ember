# Oar and Ember, Book 09: Level Layouts

*Tile-level plans for Skarvholm, the steading, Carrick Landing, the occupied island and the Hollow Cairn, with routes, sightlines, landing points and water depth; the mainland's sites, road legs and wilderness routes, and the dungeons, in outline; and the rule for how densely the world is filled.*

These plans are the ground truth for the first builds and the late-game return. Each one exists twice: as a drawing for people and as a character grid that an LLM can transcribe directly into tilemap data. Sections 10 to 12 and 14 set the mainland, the dungeons, the density of the world and the six wilderness routes at outline level; the tile plans for those places are drawn by the stages that build them and must agree with these outlines.

**How to use:** Coordinates are in tiles unless marked as blocks. The grids at the end of each section are authoritative; the drawings explain them. Distances, speeds and perception ranges come from Book 10. Any change to a grid needs a reachability test re-run and a decision-log entry.

_Layout specification. Grids are generated from the same source as the drawings and are internally consistent; they have not yet been playtested._


## 01 / Conventions
*One tile is 24 by 24 pixels. x runs east, y runs south, and (0, 0) is the north-west corner.*

| Term | Meaning |
|---|---|
| Tile | 24 x 24 px; about 1.4 m |
| Block | 8 x 8 tiles, used for the island-scale grids |
| Layers | ground, collision, objects, triggers, spawns, navigation, light |
| Landing point | A place a boat can beach or moor, with its tide condition |
| Route | A path with a length in tiles and a time at Book 10 speeds (a wilderness route, below, is a whole place) |
| Sightline | What an observer at a post can see, its range and its dead zones |
| Dead zone | Ground an observer cannot see because of cliffs, buildings, dunes or scrub |
| Depth band | How deep a water tile is for a person: wet, ankle, knee, waist or deep, at low and at high water |
| Site | One of the mainland's sixteen destinations explored on foot (section 10); like a Skarvholm zone, it is one or more streamed scenes |
| Wilderness route | One of the mainland's six long places between sites, crossed on foot whenever a journey passes through it (sections 10 and 14); one or more streamed scenes |
| Road leg | An off-screen stretch of road joining a site's road exit to another site or to a route's end (section 10) |
| Point of interest | A place worth stopping at: major (a village, dungeon, ruin, shrine or camp) or minor (section 12) |

### Transcribing a grid
Each character is one tile (or one block in island grids). The legend under each drawing maps characters to terrain. Collision comes from terrain: cliff, rock and walls block movement; deep water is the edge of the walkable ground unless the plan allows swimming there (below); dunes, scrub and woodland allow movement and hide sneaking actors. Buildings are solid except at the doors listed in each section. Height: headlands and hills (`^`) give observers the Book 10 height bonus, but no observer sees down past a cliff edge unless standing at it.

### Water depth bands
Water has five depth bands. A person's band decides how much of the sprite the water hides and how they move. Book 10 section 02 (Water depth bands) gives each band's speed, stamina drain and mask; Book 7 draws the waterline and its highlight, the ripple rings, the splashes and the darkened, dripping sprite after leaving the water.

| Band | On a person | Where plans put it |
|---|---|---|
| Wet | No change | Uncovered foreshore and flats, the swash, stream edges |
| Ankle | Feet hidden (3 px) | The waterline's edge, pools on the flats, most of a stream |
| Knee | 12 px of the sprite masked below a waterline; slower | The near shallows, a stream's pools, the flats as the tide turns |
| Waist | 22 px masked; carrying and fighting are harder; wading drains stamina | The outer shallows, the flats at high tide, a river at its ford |
| Deep | Swimming only, and only where the plan allows it | The sea beyond the shallows, lochs, river channels, flooded passages |

### How a plan marks depth
The grid characters say what kind of ground or water a tile is: `~` sea, `-` tidal flats, `w` stream, river or other fresh water, and shingle below the high-tide line is foreshore. The depth band is a second value on each such tile, and on the coast it moves with the tide. Where a plan says nothing, these are the bands:

| Water | At low water | At high water |
|---|---|---|
| Foreshore | Wet | Ankle at the top, knee at the foot |
| Tidal flats | Wet, with ankle pools | Knee, then waist towards the sea |
| Sea | Shelving out from the waterline: ankle, knee, waist, then deep | The same shelf, moved up the shore with the water |
| Stream | Ankle; knee in pools | The same: streams follow rain and season, not the tide |
| River | Knee or waist at a ford; deep in the channel | The same; a spate raises it (below) |

Between low and high water the bands move steadily up or down the shore with the tide (Book 10 section 02). Each plan draws its own shelf, and its feature table states any exception with its tide condition, as it does for landing points: a cliff foot or a jetty end that drops straight to deep water, a hollow that holds waist water at low tide, a ford. Every deep tile a person may enter is marked as swimming water; deep water that is not marked is the edge of the walkable ground. A plan never puts a required route through deep water: swims lead to secrets and short cuts (section 12).

### Streams, foam and waterfalls
- **Flow:** every stream and river tile carries a flow direction, downhill to the sea or a loch, and its surface visibly moves that way.
- **Foam** gathers where the plan puts rocks in the water and where the channel narrows; a narrow is where the flow is fastest.
- **Waterfalls:** where a stream drops over a bank or a cliff, the plan marks the lip, the falling sheet, the spray and the churned pool at the foot. The pool is knee to waist deep at its edge and deep in its middle unless the plan says otherwise. The falling sheet blocks movement.
- **Spate:** in spate (Book 4 section 03) a stream rises a band and a river at its ford becomes deep and fast. A person who enters spate water is swept downstream (Book 4 section 09), so a ford in spate is closed unless it is bridged.

## 02 / Skarvholm overview
*The whole island at block scale: 48 x 32 blocks, which is 384 x 256 tiles.*

> Figure: Skarvholm at block scale (drawn in the PDF version of this book).

### Landing points
| Point | Blocks | Condition | Seen from Rook Hill |
|---|---|---|---|
| N1 Wreck Strand | (20 to 24, 27) | Any tide; long carry at low tide | Yes |
| N2 Naust Cove | (33, 28) | Any tide; the boatshed landing | Yes |
| N3 Gull Geo | (11 to 12, 3 to 6) | Any tide; narrow; one small boat or a T2 at slack | **No**: hidden under the cliffs |
| N4 Seal Cave inlet | (43, 8) | High tide, small boats only | **No**: out of range |
| N5 Skerry of the Drowned | (42, 29) | Causeway to the shore at spring low tides | Yes |

### Routes
| Route | Length | Walk | Run | Notes |
|---|---|---|---|---|
| Main path loop: broch, Kelda, Rook Hill, Grey Men, cairn, Naust Cove, strand | 48 blocks (384 tiles) | 192 s | 64 s | The daily circuit |
| Cliff path: Rook Hill, hermit's cell, Hag's Seat | 23 blocks (184 tiles) | 92 s | 31 s | Narrow; falls possible in rain |
| Grey Men to Seal Cave | 15 blocks (122 tiles) | 61 s | 20 s | Across the bog's northern edge |
| Naust Cove to the Skerry causeway | 5 blocks (40 tiles) | 20 s | 7 s | Spring low tides only |

### Sightlines from the watch cairn
A manned cairn on Rook Hill sees 14 blocks from the summit (the ochre ring), which covers the strand, the machair, Naust Cove, the cairn and the Skerry. It cannot see Gull Geo (below the cliffs) or Seal Cave (out of range). A raider who knows the island lands at Gull Geo. Building a second post at the hermit's cell closes that gap; this is a choice the threat schedule rewards.

## 03 / Skarvholm zones in detail
*Each zone is a streamed scene of about 96 x 64 tiles. The zone list and its resources are in Book 4; this section fixes what is where.*

| Zone | Blocks | Layout notes |
|---|---|---|
| `ZONE_SK_STRAND` | (8 to 30, 22 to 31) | Shingle ribbon with tidal flats below; the wreck on the skerry at (14, 29) reachable on foot at low tide; driftwood lies in pieces at 12 spots (along the high-tide line at both ends, under the bank, among the rocks of both outcrops, by the stern) and washes up again at dawn, more after storms (Book 10 section 03, "Driftwood finds"; decision PT-2); the shallows where Hild is caught in the net in the opening (below); the wreckage on the way to her with the seax, Thorkel's chest in the wash, the broken mast with the stores, the rock pool with the arm-ring and the stern at the east end where the scavengers work at the first dusk (below; design addendum 2.4); Stage 11: the household's coastal boat drawn up under the bank at tiles (39 to 45, 25 to 26) of the zone, the salvaged boards on the shingle just east of it, and the wreck's rigging fouled on the skerry's north edge, reached over the flats at low water (decisions S11-1 and S11-5) |
| `ZONE_SK_MACHAIR` | (12 to 30, 17 to 24) | The steading plan (section 05) sits at blocks (14 to 21, 19 to 23); plots at (20 to 25, 21 to 22) |
| `ZONE_SK_KELDA` | (17 to 21, 17 to 21) | Spring pool at (19, 19); the stream flows south to the strand, ankle deep, with foam at its stones |
| `ZONE_SK_ROOK` | (16 to 28, 6 to 14) | Summit at (22, 9); heather slopes; the watch cairn plot |
| `ZONE_SK_BOG` | (27 to 37, 11 to 17) | Peat banks give cover to sneaking actors; soft ground slows movement in rain; the old offering lies near (34, 13) |
| `ZONE_SK_GREYMEN` | (25 to 29, 12 to 16) | Nine stones round (27, 14); the sunrise alignment points east-north-east |
| `ZONE_SK_CAIRN` | (29 to 33, 18 to 23) | Mound at (31, 20) with its sealed east door; sheepfold at (28, 22) |
| `ZONE_SK_CLIFFS` | (5 to 40, 3 to 9) | Climbing routes marked with hand-holds; eggs on ledges in spring; eagle stack offshore at (3, 12) |
| `ZONE_SK_GEO` | (9 to 14, 2 to 10) | The narrow geo, a steep path up to the hermit's cell at (11, 8) |
| `ZONE_SK_SEALCAVE` | (38 to 44, 5 to 12) | Cave mouth at (41, 9); a tidal back passage runs south-west under the bog to the cairn: the Seal Cave's deep passage, a small dungeon (section 11). Stage 11 builds its cove and mouth as a zone of blocks (34 to 45, 8 to 17), reached from the cairn's ground at its north-east corner; the mouth is drawn a block south, at (41, 10), the inner chamber's floor is tidal ground (dry round low water) and the scavengers' skiff lies in it; the deep passage waits for Stage 14 (decisions S11-18 and S11-19) |
| `ZONE_SK_HAGSEAT` | (2 to 9, 15 to 21) | The stone at (5, 18); kelp below; the windiest place on the island |
| `ZONE_SK_NAUST` | (30 to 43, 23 to 30) | Cove beach, boatshed plot, causeway to the Skerry |

### Wreck Strand's shallows
In the opening Hild is tangled in a net from the wreck, waist deep among the rocks in the shallows beyond the western rock outcrop, the waves washing over her and spray around her (Book 4 section 08, beat 3; drawn with the wading art and the net over it). The Wreck Strand plan lays a shelf of shallows there: from the foreshore the steerer wades through ankle and knee water to reach her where knee water meets waist water, cuts the net with the seax (a hold-to-cut, Book 10 section 25), then carries her back up to dry shingle above the tide line. Her spot (31.5, 35.6) can be seen from the steerer's waking place once they pass the eastern outcrop, and deep water stays beyond her, so the walk out and back never needs a swim. Her shallows stay at that depth for as long as she waits there, though the swell rises over her while she is caught.

### Wreck Strand's wreckage, the chest, the mast and the stern
The steerer wakes with nothing in hand (Book 10 section 21, "Starting weapons") at the edge of the surf at (70.5, 37.9). The strand holds the seax, Thorkel's chest and the opening's small rewards; the bow is not here, but in Thorkel's locked chest (Book 4 section 08, beat 14; decisions DE-17 to DE-19, DE-30). Positions are in the zone's fine tile coordinates (`content/zones/zone_sk_strand.plan.json`):

| Thing | Where | Notes |
|---|---|---|
| **The wreckage and the seax** | The seax at (65.5, 34.5), among broken planks and a split cask on dry shingle at (66.4, 34.0) | On the obvious path to Hild: the walk west from the waking place rounds the eastern outcrop on its north side and passes it, about 6 tiles from waking. Marked by a glint (Book 7 section 18), reached at any tide, so a player finds it before reaching Hild without being told. The planks prop moves here from (77, 34.4), and the old net debris at (74, 36) is taken out: the net is the one round Hild |
| **The rock pool and the silver arm-ring** | A pool in the crown of the eastern outcrop at (63.4, 35.6), reached from the shingle at (64.6, 35.3) | Just off the path, at any tide; the arm-ring glints in the water. It is worth 12 oz of silver (Book 10 section 04, "Silver arm-ring") and goes into the household's silver |
| **Thorkel's chest** | In the wash at (29.5, 35.0), 2 tiles west of Hild's spot | Locked and heavy (a heavy carry, Book 10 section 06). Placed once the steerer has reached Hild, so Hild can name it when it is first seen. It goes up the bank to the camp (section 04) |
| **The broken mast and the ship's stores** | The mast's foot wedged in the seaward side of the western outcrop at (40.4, 37.6), leaning out over the water (where the user was stuck in the third playtest, at night in the water: the outcrop's seaward foot, the mast's footprint and the stream's mouth where the bundle lands must leave a way out at every tide, by the no-trap rule of section 13 and Book 2 section 10; decision DG-20); the stores bundle lashed at its head, about 2.5 tiles (60 px) above the ground over (41.3, 38.6) | In sight from the first morning and out of reach: the rock cannot be climbed and the mast is too wet to. An arrow through the lashing drops the bundle into the shallows just off the outcrop's foot, on a spot that stays wadeable (ankle to knee deep) at every state of the tide, so it is fetched at once with no wait for low water (decision DF-82, superseding DE-64's tidal flats); the exact tile is set by the build to that rule. It is waded out for and carried up as one load (Book 10 section 03, `mastStores`) |
| **The stern** | (92.4, 35.9), at the east end, above the tide line on dry shingle | The curved stern-post and the last strakes, half buried. It holds no bow now. At the first dusk two scavengers strip it (Book 10 section 07, "The scavengers at dusk"): Svart at (93.8, 35.2) and Conn at (90.2, 34.8), at the gather loop, facing the stern. The tongue of dune grass on the bank above them (tiles 84 to 90 by 29 to 33) hides a sneaking steerer to within 2 tiles of Conn's back. This is a separate piece of the wreck from the section on the skerry at (14, 29), which holds the rigging for the Chapter 1 repair |
| **Oddi and the ship's silver** | Oddi at (23.6, 35.4), the strongbox at (21.3, 36.7) | Placed from the first dusk (Book 10 section 08, `searchesPlaced`). The iron-bound strongbox holds the ship's silver; Thorkel's own chest is the one carried up on the first morning. **Taken in sight** (the user's fourth playtest, decisions DH-12 to DH-16): the thief breaks from the dune grass up to 7 tiles north of the box, on the first open ground (Book 10 snatchStart), runs down to it, and makes off with it straight up the dunes to the strand's north edge (about 36 tiles of dune grass and sand, open at every tide), where he is gone; the way is clear of rock and water, so he can be run down on it |

**Life along the way** (Book 7 section 14), so curiosity is rewarded at once: a seal watching from the water at (50.5, 41.5), which sinks when the steerer comes within 6 tiles and rises again further off (the seal by the skerry at (26, 50.5) stays); crabs scuttling at (66.8, 36.9), (61, 38.6) and (37, 38.9); standing gulls at (67.5, 35.6), (58.4, 33.5), (56.0, 31.0) and (44.5, 30.5), each lifting when the steerer comes within 3 tiles and settling again further along; and gulls circling over Hild's spot and over the wreck on the skerry, which point the way.

### Exploration content
| Puzzle or secret | Where | Rule | Reward |
|---|---|---|---|
| Seal Cave tides | `ZONE_SK_SEALCAVE` | The inner chamber is dry only in the window around low water; the back passage opens only at spring lows | The scavengers' skiff in Chapter 1 (the skin boat they came over from Carrick in, with its Carrick goods: decision DH-137); later the passage towards the cairn |
| The Grey Men | `ZONE_SK_GREYMEN` | At sunrise on a festival morning, the shadow of the tallest stone falls on the cairn's east door | Opens the cairn's sealed east door |
| The hermit's niche | `ZONE_SK_GEO` | A loose stone behind the burned altar, found by reading the hermit's carved cross | A psalter page and a clue to Brecc |
| The bog offering | `ZONE_SK_BOG` | Peat cut in the right bank in summer exposes a bronze cauldron | Treasure, or an offended keeper if taken |
| The eggs | `ZONE_SK_CLIFFS` | Climbing routes; a fall costs vitality, not life | Food in spring |
| The Skerry of the Drowned | `ZONE_SK_NAUST` | Spring low tides only; the drowned stand there and can be spoken to | News of the dead; Thorkel if he drowned unburied |
| The rock pool | `ZONE_SK_STRAND` | A glint in a pool on the eastern outcrop, just off the path to Hild | A silver arm-ring (Chapter 1) |
| The stores on the mast | `ZONE_SK_STRAND` | Out of reach on the broken mast until an arrow cuts the lashing; the bundle falls into the shallows | Salt fish and the ship's cauldron (Chapter 1) |

### Chapter 1 finds
*The user's fourth playtest, request 24 (decisions DH-115 to DH-121): "Most areas get one or two more points of interest, off the obvious path." One or two small finds in each Chapter 1 zone (`content/finds.json`), each at least 4 tiles from the shortest ways between the zone's entries and its waking place, reached on foot at every tide, drawn as a prop of its own (Book 7 section 15) and found with Interact ("Look at" or "Take"), with its sound and its story caption. What each gives is Book 10 section 20, "Chapter 1 finds". None adds collision, so the no-trap edge walk is unchanged (section 13). Positions are in the zone's tiles, at the foot.*

| Find | Zone and place | Off the path because | Gives |
|---|---|---|---|
| Cowrie shells in the wrack | `ZONE_SK_STRAND` (6.5, 9.4) | The far west beach, north along the shore from the chest's wash, on the way to nothing | A collectible |
| A gull's nest with three eggs | `ZONE_SK_STRAND` (58.6, 24.4) | A blind gully under the bank east of the stream's mouth | Fresh eggs in spring and summer |
| The carved stone | `ZONE_SK_MACHAIR` (16.5, 9.5) | A fallen slab in the north-west grass, away from the broch and the way west | Its story: a ship cut long ago, a cross cut over it later |
| The waymark cairn | `ZONE_SK_MACHAIR` (78.5, 7.0) | The north-east rise, looking out to sea | Its story: the steerer adds a stone |
| The old offering | `ZONE_SK_HAGSEAT` (46.5, 10.2) | A cleft on the headland's northern tongue, north of the stone and its path | Its story: a bronze pin left for her; it is not taken |
| The cup-marked kerbstone | `ZONE_SK_CAIRN` (68.9, 19.8) | The mound's far, eastern flank, out of sight of the fold | Its story |
| The seal's skull ringed with shells | `ZONE_SK_SEALCAVE` (43.6, 22.6) | The cove's northern tip, west of the cave mouth | Its story: someone's sign (the Keepers') |
| The lost knife | `ZONE_SK_SEALCAVE` (53.6, 36.4) | The rocks at the cove's southern end, the far end from the cave | Its silver wire, into the household's silver |

## 04 / The steading plan
*The household's home ground at tile scale: 64 x 40 tiles around the broch, placed at blocks (14 to 21, 19 to 23).*

> Figure: the steading tile plan (drawn in the PDF version of this book).

### Designation plots
| Plot | Tiles | Footprint | Notes |
|---|---|---|---|
| Longhouse (L) | (32 to 47, 23 to 28) | 16 x 6 | East of the stream; doors on the long south side |
| Second house (M) | (49 to 62, 23 to 28) | 14 x 6 | |
| Forge (F) | (3 to 8, 24 to 28) | 6 x 5 | Downwind and away from thatch |
| Storehouse (S) | (30 to 37, 32 to 35) | 8 x 4 | Raised floor; near the path to the shore |
| Byre (Y) | (48 to 57, 31 to 35) | 10 x 5 | Near the plots and the grazing |
| Racks and smoke-house (R) | (4 to 11, 31 to 35) | 8 x 5 | By the shore for drying wind |
| Shrine (H) | (16 to 19, 4 to 6) | 4 x 3 | North of the broch; residents choose its form |

These are suggested plots, not fixed sites: the player can designate any building anywhere the placement rules allow. The broch (centre (12, 13), door on the south at (12, 18)) is the first shelter, later a storehouse and the last refuge. Barley plots 1 to 4 sit inside field dykes at the north-east. Paths run from the broch to the shore, east to Naust Cove and north to Rook Hill. The Kelda Spring is at (29 to 31, 3 to 5).

```
    0         1         2         3         4         5         6   
    0123456789012345678901234567890123456789012345678901234567890123
  0 """"""""""="""""""""""""""""""""""""""""""""""""""""""""""""""""
  1 """"""""""="""""""""""""""""""""""""""""""""""""""""""""""""""""
  2 """"""""""="""""""""""""""""""""""""""""""""""""""""""""""""""""
  3 """""""""""="""""""""""""""""www""""""""""""""""""""""""""""""""
  4 ,,,,,,,,,,,=,,,,HHHH,,,,,,,,,www,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
  5 ,,,,,,,,,,,=,,,,HHHH,,,,,,,,,www,,,++++++++++++,++++++++++++,,,,
  6 ,,,,,,,,,,,,=,,,HHHH,,,,,,,,,,w,,,,+ffffffffff+,+ffffffffff+,,,,
  7 ,,,,,,,,,,,,=,,,,,,,,,,,,,,,,w,,,,,+ffffffffff+,+ffffffffff+,,,,
  8 ,,,,,,,,,,OO=OO,,,,,,,,,,,,,,w,,,,,+ffffffffff+,+ffffffffff+,,,,
  9 ,,,,,,,,,OO:::OO,,,,,,,,,,,,w,,,,,,+ffffffffff+,+ffffffffff+,,,,
 10 ,,,,,,,,OO:::::OO,,,,,,,,,,,w,,,,,,+ffffffffff+,+ffffffffff+,,,,
 11 ,,,,,,,OO:::::::OO,,,,,,,,,,w,,,,,,+ffffffffff+,+ffffffffff+,,,,
 12 ,,,,,,,O:::::::::O,,,,,,,,,w,,,,,,,++++++++++++,++++++++++++,,,,
 13 ,,,,,,,O:::::::::O,,,,,,,,,w,,,,,,,+++++++++++=,++++++++++++,,,,
 14 ,,,,,,,O:::::::::O,,,,,,,,w,,,,,,,,+ffffffff==+,+ffffffffff+,,,,
 15 ,,,,,,,OO:::::::OO,,,,,,,,w,,,,,,,,+fffffff=ff+,+ffffffffff+,,,,
 16 ,,,,,,,,OO:::::OO,,,,,,,,,w,,,,,,,,+fffff==fff+,+ffffffffff+,,,,
 17 ,,,,,,,,,OO:::OO,,,,,,,,,w,,,,,,,,,+ffff=fffff+,+ffffffffff+,,,,
 18 ,,,,,,,,,,OO:OO,,,,,,,,,,w,,,,,,,,,+ff==ffffff+,+ffffffffff+,,,,
 19 ,,,,,,,,,,,,=,,,,,,,,,,,,w,,,,,,,,,+f=ffffffff+,+ffffffffff+,,,,
 20 ,,,,,,,,,,,,=,,,,,,,,,,,w,,,,,,,,,,==++++++++++,++++++++++++,,,,
 21 ,,,,,,,,,,,,=,,,,,,,,,,,w,,,,,,,,,=,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
 22 ,,,,,,,,,,,,=,,,,,,,,,,,w,,,,,,,,=,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
 23 ,,,,,,,,,,,,=,,,,,,,,,,,w,,,,,,,=LLLLLLLLLLLLLLL,MMMMMMMMMMMMMM,
 24 ,,,FFFFFF,,,=,,,,,,,,,,w,,,,,,,,=LLLLLLLLLLLLLLL,MMMMMMMMMMMMMM,
 25 ,,,FFFFFF,,,,=,,,,,,,,,w,,,,,,,=LLLLLLLLLLLLLLLL,MMMMMMMMMMMMMM,
 26 ,,,FFFFFF,,,,=,,,,,,,,,w,,,,,,=,LLLLLLLLLLLLLLLL,MMMMMMMMMMMMMM,
 27 ,,,FFFFFF,,,,=,,,,,,,,w,,,,,,=,,LLLLLLLLLLLLLLLL,MMMMMMMMMMMMMM,
 28 ,,,FFFFFF,,,,=,,,,,,,,w,,,,,,=,,LLLLLLLLLLLLLLLL,MMMMMMMMMMMMMM,
 29 ,,,,,,,,,,,,,=,,,,,,,,w,,,,,=,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
 30 ,,,,,,,,,,,,,===================================================
 31 ,,,,RRRRRRRR,=,,,,,,,w,,,,,,,,,,,,,,,,,,,,,,,,,,YYYYYYYYYY,,,,,,
 32 ,,,,RRRRRRRR,,=,,,,,,w,,,,,,,,SSSSSSSS,,,,,,,,,,YYYYYYYYYY,,,,,,
 33 ,,,,RRRRRRRR,,=,,,,,,w,,,,,,,,SSSSSSSS,,,,,,,,,,YYYYYYYYYY,,,,,,
 34 ,,,,RRRRRRRR,,=,,,,,,w,,,,,,,,SSSSSSSS,,,,,,,,,,YYYYYYYYYY,,,,,,
 35 ,,,,RRRRRRRR,,=,,,,,,w,,,,,,,,SSSSSSSS,,,,,,,,,,YYYYYYYYYY,,,,,,
 36 ,,o,,,,,,,,,,,,=,,,,,w,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
 37 ...............=....w..................................o........
 38 ....................w...................oo......................
 39 --------------------w-------------------------------------------
```

### The camp in the broch (Chapter 1)
In the machair zone's coordinates (`content/zones/zone_sk_machair.plan.json`; the broch's centre is (35.5, 31.5) there, decision S7-3). Before the shelter is raised, the folded sail and three oars lie at the lean-to's place, (33.1, 29.3). **The marked spot** where the frame and the sail are worked (the user's fourth playtest, decisions DH-10 and DH-11) is (35.0, 29.65), by the right post's foot, beside the lean-to's bed (32.3 to 34.25 by 29.0 to 30.0) and never on it, so the bed stood on is always the bed and the spot stood on is always the shelter; on the second morning the finishing's mark is at its build site, (32.4, 30.4). The shelter goes up there in stages over two days (the user's third playtest, decision DG-12; Book 10 section 03, `shelterFrame`, `shelterSail`, `shelterFinish`): the frame (two oars as shears against the inner wall, the third as the ridge, the guys pegged within 1.5 tiles of it), then the sail lashed over it, a lean-to whose open end has the flap; on the second day the finished shelter spreads across the court on the oars and the wall-heads, and the broch's door is hung. No stage's footprint may close the way from the door to the fire ring or to the beds, and every stage passes the no-trap test (section 13). **Thorkel's chest** has its home against the inner wall beside the shelter at (32.2, 31.4), where its faint outline shows while it is carried near (Book 10 section 25, `homeOutline`); the salvage heap's own chest prop at S0 (38.3, 29.7) becomes a second cask, so Thorkel's is the only chest in the camp. The fire ring is at (35.4, 31.75); the cauldron from the mast stands by it once brought up (the S1 pot at (36.25, 31.35)). **The steerer's bed** (the user's fourth playtest, the bed the user could not go to; decisions DH-3 and DH-100 to DH-104) is in one place at S0 and S1: under the lean-to by the west wall, its foot at (33.3, 29.7), and it covers the ground from (32.3, 29.0) to (34.25, 30.0) (2 tiles by 1, Book 7 section 01); standing anywhere on it, Interact (or a click on any tile of it) sleeps there once a bed ends the day, before anything else in reach. No one else's sleeping place lies on it at either stage: Hild sleeps in the north row at (35.1, 28.85) at S1, and the household's other S1 places are (36.5, 28.85), (37.6, 30.85) and (37.4, 33.35). It is marked on the floor (Book 7 section 06) and walked to from every side in the tests (section 13).

### Doors in Chapter 1
Every door and hide flap opens visibly when walked into or clicked, closes behind after a moment, and blocks movement, sight and missiles while closed (Book 2 section 10; Book 10 section 25, "Doors"). These are the doors of Chapter 1 (decision DE-26):

| Door | Zone and place | Kind | When |
|---|---|---|---|
| The broch's door | `ZONE_SK_MACHAIR`, the south doorway at (35.5, 36.95) | A driftwood door on rope hinges | From camp stage S1; at S0 the doorway stands open |
| The sail shelter's flap | `ZONE_SK_MACHAIR`, the lean-to's open end at about (34.2, 29.8) | A flap of sail cloth, weighted with a stone | From the shelter's raising (S0); at S1 the sail roof spans the court and the broch's door closes it instead |

No other doorway in Chapter 1 has a door: the broch's north breach is a gap in the wall, the fold's gateway stands open with its hurdle down, and the Hollow Cairn's sealed east door is a stone, not a door, until the Grey Men open it (section 03).

## 05 / The island grid
*Skarvholm at block scale, as transcribable characters.*

```
    0         1         2         3         4       
    012345678901234567890123456789012345678901234567
  0 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  1 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  2 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  3 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  4 ~~~~~~~~~~~~~~~~~~~~###~~#####~~~~~~~~~~~~~~~~~~
  5 ~~~~~~~~~~~~~~##~~###"####"""#####~~~~~###~~~~~~
  6 ~~~~~~~~~~~~G######""^^^"""""""""###~~##"##~~~~~
  7 ~~~~~~~~~~~~##""""^^^^^^^^^""""""""####"""##~~~~
  8 ~~~~~~~~~~#X#""""^^^^^^^^^^^"""""""""""""""#~~~~
  9 ~~~~~~~~~##"""""^^^^^^R^^^^^^""""""""""""S##~~~~
 10 ~~~~~~~~##""""""^^^^^^^^^^^^^""""""""""""##~~~~~
 11 ~~~~~~~~#"""""""^^^^^^^^^^^^^"bbbbb"""""##~~~~~~
 12 ~~~E~~~##""""""""^^^^^^^^^^^bbbbbbbbb"""r~~~~~~~
 13 ~~~~~~##""""""""""^^^^^^^^^"bbbbbbbbb"""rrr~~~~~
 14 ~~~~~~#""""""""""""""^^^"""obbbbbbbbb"""""rr~~~~
 15 ~~~~~~#,,,,,,,,,,,,,,,,,,,,,bbbbbbbbb,,,,,,r~~~~
 16 ~~~~###,,,,,,,,,,,,,,,,,,,,,bbbbbbbbb,,,,,rr~~~~
 17 ~~~##,,,,,,,,,,,,,,,,,,,,,,,,,bbbbb,,,,,,,r~~~~~
 18 ~~~#,H,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,rr~~~~~
 19 ~~~##,,,,,,,,,,,,,,K,,,,,,,,,,,,,,,,,,,,,r~~~~~~
 20 ~~~~#####,,,,,,,,,w,,,,,,,,,,,,C,,,,,,,,,r~~~~~~
 21 ~~~~~~~~##,,,,,,,,w,ffffff,,,,,,,,,,,,,,rr~~~~~~
 22 ~~~~~~~~-.,,,,,,,Bw,ffffff,,p,,,,,,,,,,.r~~~~~~~
 23 ~~~~~~~~-..,,,,,,,w,,,,,,,,,,,,,,,,,,,..-~~~~~~~
 24 ~~~~~~~~--.....,,,w,,,,,,,,,,,,.N......--~~~~~~~
 25 ~~~~~~~~~-----.,,,,,,,,,,,,,,,..-----.=-~~~~~~~~
 26 ~~~~~~~~~~~~~-.,.....,,,,,,,,,.--~~~---=~~~~~~~~
 27 ~~~~~~~~~~~~~-...---........,..-~~~~~~~~=~~~~~~~
 28 ~~~~~~~~~~~r~-----~--..----...--~~~~~~~~~=r~~~~~
 29 ~~~~~~~~~~~~r~Wr~~~~----~~-----~~~~~~~~~~rrr~~~~
 30 ~~~~~~~~~~~~~r~~r~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 31 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```

## 06 / Carrick Landing plan
*The first raid site at tile scale: 96 x 64 tiles. Sea to the west, the headland to the north, the track to Ardcarn leaving east.*

> Figure: Carrick Landing tile plan (drawn in the PDF version of this book).

### Features and doors
| Feature | Tiles | Notes |
|---|---|---|
| Storehouse | (40 to 47, 24 to 30) | Main door west at (40, 27); loading hatch east at (47, 27), barred from inside |
| Keeper's house | (50 to 57, 32 to 38) | Door west at (50, 35); Colla sleeps here; the hidden silver under the hearth at (54, 35) |
| Byre | (50 to 57, 20 to 26) | Door south at (53, 26); the herdsman sleeps in the loft |
| Drying racks | (34 to 38, 36 to 40) | Cover when crouched |
| Yard fire | (46, 33) | Night guard's seat; light radius 4 |
| Watch post | (34, 8) | On the headland; manned by day only |
| Jetty | (8 to 30, 27 to 28) | Reaches water at x 8 at low tide; boats moor at x 22 at high tide |
| Keeper's currach | (9 to 10, 29) | Can be towed |
| Field | (61 to 77, 19 to 33) | Gate at (69, 33) |
| River | Rows 50 to 55, full width | Boats with shallow draft can enter at high tide to (30, 52) |

### Landing points
| Point | Tiles | Condition | Notes |
|---|---|---|---|
| L1 Jetty | (22, 27) high tide; (8, 27) low tide | Any tide | Closest to the storehouse; in G1's sight |
| L2 Main beach | (23, 40 to 46) high; (6, 40 to 46) low | Any tide | Open; where Ulf's crew lands (U) |
| L3 North cove | (14 to 17, 3 to 7) | Any tide | Under the cliffs: hidden from the watch post; gully up at (17, 5) |
| L4 River mouth | (24, 50 to 55) to (30, 52) | High tide, shallow draft | Out of most sightlines; a long walk to the storehouse |

## 07 / Carrick routes, sightlines and timings
*The numbers a raid plan depends on. Speeds and ranges are Book 10's.*

### Routes
| Route | Length | Time | Notes |
|---|---|---|---|
| Storehouse door to the high-tide jetty berth | 18 tiles | 10 s carrying | Low tide doubles it: 32 tiles, 18 s |
| Storehouse door to L2 waterline | 23 tiles high, 38 low | 13 s or 21 s carrying | |
| Stealth route: L3, gully, headland, scrub, back hatch | 42 tiles | 24 s sneaking | Outside every day cone; dunes and scrub hide a sneaking party |
| Open approach: L1 to storehouse door | 10 tiles | 5 s walking | In the jetty and storehouse cones |
| Runner: byre to the east edge | 50 tiles | 8.4 s running | Leaves the map at (95, 35) |
| Ardcarn horn after the runner leaves | | 60 s | Visible and audible warning |
| Fiachra's patrol arrives | | 120 s after the runner leaves | Enters at (95, 35) |

### Sightlines by day
| Observer | Position | Facing and range | Sees | Dead zones |
|---|---|---|---|---|
| Watch post (G3) | (34, 8), height | South-west, 110 degrees, 22 tiles | The beach, intertidal and jetty from y 9 to 30 | The north cove below the cliff; the scrub and back of the storehouse |
| Jetty guard (G1) | (30, 30) | West, 110 degrees, 15 tiles | Jetty, intertidal, the sea approach | Dunes to the north; everything east of the storehouse |
| Storehouse guard (G2) | (39, 26) | West, 110 degrees, 15 tiles | The path, beach front and dune face | The scrub and hatch on the east side |

G1 patrols from the jetty root south along the beach to (27, 46) and back every 60 seconds.

### At night
One guard sits at the yard fire (46, 33). Inside its light radius he sees as by day; outside it, 5 tiles. He sleeps at the turn of the tide unless alarmed. G2 and G3 sleep in the keeper's house and wake on a shout or the dogs. The watch post is empty. The back hatch is 6 tiles from the fire: just outside the light and beyond the unlit range, so a sneaking party is unseen there.

### After a first raid
Two more guards by day, and two dogs at the keeper's house that hear with three times the normal noise radius and bark (Book 10). The north cove gains a night watcher on the headland edge at (20, 9), who can see down into the cove.

## 08 / The occupied island
*The late game. Long after the household left, Orm's garrison holds Skarvholm, Gróa is digging into the Hollow Cairn, and Rán's tides have drowned the beaches. The household must return for Manannán's Cup (Book 6 scenario 9).*

> Figure: the occupied island (drawn in the PDF version of this book).

### What has changed
- Every beach is now tidal flat, under water at high tide in the waist and deep bands (section 01). The wreck still shows at low water.
- The Kelda Spring is salt. The only fresh water left is the spring under the cairn.
- The broch is a fort with a stake palisade, holding any residents left as an outpost as captives.
- The longhouse is a barracks; the boatshed is burned; two of Orm's ships lie at Naust Cove.
- The household's watch cairn on Rook Hill is manned by Orm's men with a horn, using the sightline the household built.
- Sharpened stakes are driven into the drowned strand; a hull landing there at high tide is holed.
- A sentry watches from the hermit's cell at night: Orm's men have learned of Gull Geo, though not of the Seal Cave passage.

### Garrison
| Post | Position (blocks) | Strength | Notes |
|---|---|---|---|
| Broch fort | (17, 22) | Kolgrím and 9 huscarls, 3 dogs | Captives held inside |
| Barracks | (24, 23) | 12 raiders | Asleep at night unless the horn sounds |
| Watch cairn | (22, 9) | 2, a horn and a beacon | Sees 14 blocks; the beacon brings Orm's attack, the final battle, 5 days earlier and raises the pressure faster, while the battle stays a gate (Book 10 sections 07 and 22) |
| Hermit's cell | (11, 8) | 1 sentry at night | Sees down into Gull Geo |
| Naust Cove ships | (32, 25) | 6 on watch | Their crews join a fight in 2 minutes |
| The dig at the cairn | (31, 20) | Gróa, 4 guards, 6 conscripted diggers | Sea-light at night; the diggers are civilians |
| Patrol | Broch, Kelda, cairn, Naust, strand | 3 | One loop every 4 minutes |

### Approaches
| Route | Landing | Window | Strength | Risk |
|---|---|---|---|---|
| A Gull Geo at night | N3 | Night, any tide | Quiet; needs the cell sentry silenced | The cliff path passes within the watch cairn's ring near Rook Hill's west flank; the bog's peat banks give cover |
| B Seal Cave passage | N4 | Spring low tide only | Arrives inside the cairn below Gróa's dig, bypassing the garrison | The passage floods as the tide turns; known only if found in Year 1 |
| C Skerry causeway | N5 | Spring low tide | Puts the party beside Orm's ships: burn them to stop pursuit | Close to the Naust watch and the patrol |
| D Diversion | Allied ships at N2 | Any, by day or dusk | Draws the garrison to Naust Cove while a small party goes in | Allies take losses; the horn sounds at once |

## 09 / The Hollow Cairn interior
*48 x 30 tiles. The cairn-builders' passages, Gróa's broken-in chamber, the Door of Three Truths and the Cup.*

> Figure: the Hollow Cairn interior (drawn in the PDF version of this book).

### Layout
| Feature | Tiles | Notes |
|---|---|---|
| Sealed east door | (47, 14) | Opens from outside only with the Grey Men alignment (Year 1 puzzle), or from inside |
| Outer passage | (30 to 46, 13 to 15) | Three grave cells off it; taking grave goods is `SACRILEGE` and wakes their keepers |
| Broken chamber | (18 to 29, 10 to 18) | Where Gróa's shaft from the surface (23, 2) breaks in; sea-light; her drowned diggers |
| Door of Three Truths | (12, 14) | Speaks from either side; see Book 6 scenario 9 |
| Inner chamber and the Cup | (4 to 11, 9 to 19); Cup at (7, 14) | The Cup will not leave its stone until the truths are spoken |
| Spring room | (6 to 9, 20 to 22) | The island's last fresh water, untouched by Rán. Its outflow channel, (10, 22) to (19, 24), joins the Seal Cave passage at (20, 24): the spring-room passage, which spares whoever holds the cairn door (Book 4 section 14) if the party has found it |
| Seal Cave passage | From (20, 24) to (47, 28) | Tidal; floods within the Book 10 surge time once the Cup is lifted |

### Grid: the occupied island (blocks)
```
    0         1         2         3         4       
    012345678901234567890123456789012345678901234567
  0 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  1 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  2 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  3 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  4 ~~~~~~~~~~~~~~~~~~~~###~~#####~~~~~~~~~~~~~~~~~~
  5 ~~~~~~~~~~~~~~##~~###"####"""#####~~~~~###~~~~~~
  6 ~~~~~~~~~~~~G######""^^^"""""""""###~~##"##~~~~~
  7 ~~~~~~~~~~~~##""""^^^^^^^^^""""""""####"""##~~~~
  8 ~~~~~~~~~~#X#""""^^^^^^^^^^^"""""""""""""""#~~~~
  9 ~~~~~~~~~##"""""^^^^^^R^^^^^^""""""""""""S##~~~~
 10 ~~~~~~~~##""""""^^^^^^^^^^^^^""""""""""""##~~~~~
 11 ~~~~~~~~#"""""""^^^^^^^^^^^^^"bbbbb"""""##~~~~~~
 12 ~~~E~~~##""""""""^^^^^^^^^^^bbbbbbbbb"""r~~~~~~~
 13 ~~~~~~##""""""""""^^^^^^^^^"bbbbbbbbb"""rrr~~~~~
 14 ~~~~~~#""""""""""""""^^^"""obbbbbbbbb"""""rr~~~~
 15 ~~~~~~#,,,,,,,,,,,,,,,,,,,,,bbbbbbbbb,,,,,,r~~~~
 16 ~~~~###,,,,,,,,,,,,,,,,,,,,,bbbbbbbbb,,,,,rr~~~~
 17 ~~~##,,,,,,,,,,,,,,,,,,,,,,,,,bbbbb,,,,,,,r~~~~~
 18 ~~~#,H,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,rr~~~~~
 19 ~~~##,,,,,,,,,,,,,,K,,,,,,,,,,,,,,,,,,,,,r~~~~~~
 20 ~~~~#####,,,,,,,,,w,,,,,,,,,,,,C,,,,,,,,,r~~~~~~
 21 ~~~~~~~~##.,,,,,,,w,ffffff,,,,,,,,,,,,..rr~~~~~~
 22 ~~~~~~~~--..,,,,,Bw,ffffff,,p,,,,,,,,..-r~~~~~~~
 23 ~~~~~~~~---.....,,w,,,,,,,,,,,........---~~~~~~~
 24 ~~~~~~~~-------.,,w,,,,,,,,,,..-N--------~~~~~~~
 25 ~~~~~~~~~------.......,,,,,,,.--------=-~~~~~~~~
 26 ~~~~~~~~~~~~~--.-----.........---~~~---=~~~~~~~~
 27 ~~~~~~~~~~~~~---------------.---~~~~~~~~=~~~~~~~
 28 ~~~~~~~~~~~r~-----~-------------~~~~~~~~~=r~~~~~
 29 ~~~~~~~~~~~~r~Wr~~~~----~~-----~~~~~~~~~~rrr~~~~
 30 ~~~~~~~~~~~~~r~~r~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 31 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```

### Grid: the Hollow Cairn (tiles)
```
    0         1         2         3         4       
    012345678901234567890123456789012345678901234567
  0 ################################################
  1 ################################################
  2 ######################,g,#######################
  3 ######################,,,#######################
  4 ######################,,,....###################
  5 ######################,,,....###################
  6 ######################,,,.b..##......###########
  7 ######################,,,....##......###########
  8 ######################,,,....##..b...###########
  9 ####........##########,,,....##...b..###########
 10 ####........######............#......###########
 11 ####........######..+.........#......###########
 12 ####........######............###..#############
 13 ####........#..................................#
 14 ####...C....D..................................E
 15 ####........#..................................#
 16 ####........######....+.......###..#############
 17 ####........######.........+..#......###########
 18 ####........######............#......###########
 19 ####........###################..b...###########
 20 ######....#####################...b..###########
 21 ####www...#####################......###########
 22 ######....ww###################......###########
 23 ############ww##################################
 24 ##############wwwwwwssss########################
 25 ####################sssssssss###################
 26 #######################sssssssssssssssssssssss##
 27 ############################ssssssssssssssssssss
 28 #############################################sss
 29 ###############################################s
```

### Grid: Carrick Landing (tiles)
```
    0         1         2         3         4         5         6         7         8         9     
    012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345
  0 ~~~~~~####^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,tttt,tttt,tttt,tttt,
  1 ~~~~~~####^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,tttt,tttt,tttt,tttt
  2 ~~~~~~~~~~~~~~#####^^^^^^^^^^^^^^^^^^^^^^^^^^,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,t,tttt,tttt,tttt,ttt
  3 ~~~~~~~~~~~~~~....#^^^^^^^^^^^^^^^^^^^^^^^^^^,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,tt,tttt,tttt,tttt,tt
  4 ~~~~~~~~~~~~~~....#^^^^^^^^^^^^^^^^^^^^^^^^^^,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,ttt,tttt,tttt,tttt,t
  5 ~~~~~~~~~~~~~~...,,^^^^^^^^^^^^^^^^^^^^^^^^^^,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,tttt,tttt,tttt,tttt,
  6 ~~~~~~~~~~~~~~...,,,,,^^^^^^^^^^^^^^^^^^^^^^^,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,tttt,tttt,tttt,tttt
  7 ~~~~~~~~~~~~~~....,,,,,^^^^^^^^^^^^^^^^^^^^^^,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,t,tttt,tttt,tttt,ttt
  8 ~~~~~~~~~~~~~~#####^^,,,,^^^^^^^^^P^^^^^^^^^^,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,tt,tttt,tttt,tttt,tt
  9 ~~~~~~####^^^^^^^^^^^^,,,,^^^^^^^^^^^^^^^^^^^,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,ttt,tttt,tttt,tttt,t
 10 ~~~~~~####^^^^^^^^^^^^^^,,^^^^^^^^^^^^^^^^^^^,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,tttt,tttt,tttt,tttt,
 11 ~~~~~~####^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,tttt,tttt,tttt,tttt
 12 ~~~~~~#####################^^^^^^^^^^^^^^^^^^,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,t,tttt,tttt,tttt,ttt
 13 ~~~~~~#####################^^^^^^^^^^^^^^^^^^,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,tt,tttt,tttt,tttt,tt
 14 ~~~~~~------------------.....""""",,,,sssss,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,ttt,tttt,tttt,tttt,t
 15 ~~~~~~------------------....""""""",,sssssss,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,tttt,tttt,tttt,tttt,
 16 ~~~~~~------------------..."""""""""sssssssss,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,tttt,tttt,tttt,tttt
 17 ~~~~~~------------------..""""""""""sssssssss,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,t,tttt,tttt,tttt,ttt
 18 ~~~~~~------------------..""""""""""sssssssss,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,tt,tttt,tttt,tttt,tt
 19 ~~~~~~------------------.."""""""""""sssssss,,,,,,,,,,,,,,,,,+++++++++++++++++,,,,,,,,,,,,,,,,,,
 20 ~~~~~~------------------..""""""""""",sssss,,,,,,,YYYYYYYY,,,+fffffffffffffff+,,,,,,,,,,,,,,,,,,
 21 ~~~~~~------------------..""""""""""",,,,,,,,,,,,,YYYYYYYY,,,+fffffffffffffff+,,,,,,,,,,,,,,,,,,
 22 ~~~~~~------------------...""""""""",,,,,,,,,,,,,,YYYYYYYY,,,+fffffffffffffff+,,,,,,,,,,,,,,,,,,
 23 ~~~~~~------------------....""""""",,,,,,,,,,,,,,,YYYYYYYY,,,+fffffffffffffff+,,,,,,,,,,,,,,,,,,
 24 ~~~~~~------------------.....""""",,,,,,SSSSSSSS,,YYYYYYYY,,,+fffffffffffffff+,,,,,,,,,,,,,,,,,,
 25 ~~~~~~------------------.......,,,,,,,,,SSSSSSSS,,YYYYYYYY,,,+fffffffffffffff+,,,,,,,,,,,,,,,,,,
 26 ~~~~~~------------------.......,,,,,,,,,SSSSSSSS,,YYYYYYYY,,,+fffffffffffffff+,,,,,,,,,,,,,,,,,,
 27 ~~~~~~--JJJJJJJJJJJJJJJJJJJJJJJ,,,,,====SSSSSSSS,,,,,=,,,,,,,+fffffffffffffff+,,,,,,,,,,,,,,,,,,
 28 ~~~~~~--JJJJJJJJJJJJJJJJJJJJJJJ=====,,,,SSSSSSSS,,,,,=,,,,,,,+fffffffffffffff+,,,,,,,,,,,,,,,,,,
 29 ~~~~~~---bb-------------.......,,,,,,,,,SSSSSSSS,,,,,=,,,,,,,+fffffffffffffff+,,,,,,,,,,,,,,,,,,
 30 ~~~~~~------------------.......,,,,,,,,,SSSSSSSS=,,,,=,,,,,,,+fffffffffffffff+,,,,,,,,,,,,,,,,,,
 31 ~~~~~~------------------.......,,,,,,,,,,,,,,,,,=,,,,=,,,,,,,+fffffffffffffff+,,,,,,,,,,,,,,,,,,
 32 ~~~~~~------------------.......,,,,,,,,,,,,,,,,,,=KKKKKKKK,,,+fffffffffffffff+,,,,,,,,,,,,,,,,,,
 33 ~~~~~~------------------.......,,,,,,,,,,,,,,,o,,=KKKKKKKK,,,++++++++,++++++++,,,,,,,,,,,,,,,,,,
 34 ~~~~~~------------------.......,,,,,,,,,,,,,,,,,,,KKKKKKKK,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
 35 ~~~~~~------------------.......,,,,,,,,,,,,,,,,,,,KKKKKKKK======================================
 36 ~~~~~~------------------.......,,,RRRRR,,,,,,,,,,,KKKKKKKK,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
 37 ~~~~~~------------------.......,,,RRRRR,,,,,,,,,,,KKKKKKKK,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
 38 ~~~~~~------------------.......,,,RRRRR,,,,,,,,,,,KKKKKKKK,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
 39 ~~~~~~------------------.......,,,RRRRR,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
 40 ~~~~~~------------------.......,,,RRRRR,,,,,,,,,,,,,,,,,,,,,,sssss,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
 41 ~~~~~~------------------.......,,,,,,,,,,,,,,,,,,,,,,,,,,,,sssssssss,,,,,,,,,,,,,,,,,,,,,,,,,,,,
 42 ~~~~~~------------------.......,,,,,,,,,,,,,,,,,,,,,,,,,,,,sssssssss,,,,,,,,,,,,,,,,,,,,,,,,,,,,
 43 ~~~~~~------------------.......,,,,,,,,,,,,,,,,,,,,,,,,,,,sssssssssss,,,,,,,,,,,,,,,,,,,,,,,,,,,
 44 ~~~~~~------------------.......,,,,,,,,,,,,,,,,,,,,,,,,,,,sssssssssss,,,,,,,,,,,,,,,,,,,,,,,,,,,
 45 ~~~~~~------------------.......,,,,,,,,,,,,,,,,,,,,,,,,,,,sssssssssss,,,,,,,,,,,,,,,,,,,,,,,,,,,
 46 ~~~~~~------------------.......,,,,,,,,,,,,,,,,,,,,,,,,,,,,sssssssss,,,,,,,,,,,,,,,,,,,,,,,,,,,,
 47 ~~~~~~------------------.......,,,,,,,,,,,,,,,,,,,,,,,,,,,,sssssssss,,,,,,,,,,,,,,,,,,,,,,,,,,,,
 48 ~~~~~~------------------.......,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,sssss,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
 49 ~~~~~~------------------.......,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
 50 ~~~~~~wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
 51 ~~~~~~wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww
 52 ~~~~~~wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww
 53 ~~~~~~wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww
 54 ~~~~~~wwwwwwwwwwwwwwwwwwwwwwwww,,,,,,,,,,wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww
 55 ~~~~~~------------------.......,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
 56 ~~~~~~------------------.......,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
 57 ~~~~~~------------------.......,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,ttt,ttt,ttt,ttt,ttt,ttt,ttt,tt
 58 ~~~~~~------------------.......,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,ttt,ttt,ttt,ttt,ttt,ttt,ttt,t
 59 ~~~~~~------------------.......,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,t,ttt,ttt,ttt,ttt,ttt,ttt,ttt,
 60 ~~~~~~------------------.......,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,tt,ttt,ttt,ttt,ttt,ttt,ttt,ttt
 61 ~~~~~~------------------.......,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,ttt,ttt,ttt,ttt,ttt,ttt,ttt,tt
 62 ~~~~~~------------------.......,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,ttt,ttt,ttt,ttt,ttt,ttt,ttt,t
 63 ~~~~~~------------------.......,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,t,ttt,ttt,ttt,ttt,ttt,ttt,ttt,
```

## 10 / The mainland overview
*The mainland's sixteen sites and six wilderness routes at overview scale: how road legs join them, where each route's ends lie, where ships land and what blocks the way. Book 4 section 03 holds what is in each place.*

The mainland (`REG_MAINLAND`) is one region on the Irish coast, the same for every player. It has two kinds of playable place: **sites**, explored in full on foot, and **wilderness routes**, long places between sites that a journey crosses on foot. **Road legs** join sites and route ends off screen (Book 4 section 03). This section fixes how they fit together. Each site's and route's tile plan is drawn by the stage that builds it, starting from a mockup the user approves (Book 3), and must agree with this overview; section 14 outlines the routes. Carrick Landing's plan (sections 06 and 07) is the first of them.

### Sites and routes
| ID | Place | Kind | Coast and landing | Layout notes |
|---|---|---|---|---|
| `MAIN_CARRICK_STRAND` | Carrick Strand | Site | Coast; beach landing | Shore farmland beside Carrick Landing; home site A |
| `MAIN_CARRICK_LANDING` | Carrick Landing | Site | Coast; landings L1 to L4 (section 06) | The raid site plan; the road to Ardcarn leaves east at (95, 35) |
| `MAIN_ARDCARN` | Ardcarn | Site | Inland; reached from the sea through Carrick Landing | Farms, fields and the guesthouse; the hub of the western roads |
| `MAIN_LOCH_CARN` | Loch Carn and Brigid's Well | Site | Inland | Loch shore with a shelf of shallows and deep water beyond; the well beside it |
| `MAIN_KILBRECC_FARMS` | The tenant farms | Site | Inland | Tithe barns, the bondmen's houses and the pilgrims' road to Kilbrecc |
| `MAIN_KILBRECC` | Kilbrecc | Site | Coast; landing below the headland | Round tower, church, guesthouse, workshops |
| `MAIN_BLACKWOOD_EDGE` | The Black Wood path | **Route** | Inland | Oakwood path from Ardcarn's road to Móin Mhór's; the hill-folk's gate to the heart lies off it (section 14) |
| `MAIN_BLACKWOOD_HEART` | Fiodh Dubh: the heart | Site, dungeon | Inland; entered from the Black Wood path | Old forest round the hill-folk's ringfort and its souterrain (section 11) |
| `MAIN_MOIN_MHOR` | Móin Mhór: the turf village and bog edge | Site | Inland | The turf village, peat banks and bog pools at the Great Bog's edge; the plank road's west end and the moor road's north end are near |
| `MAIN_PLANK_ROAD` | The plank road across the Great Bog | **Route** | Inland | Timber trackway across open bog; the Trackway branches off it (section 14) |
| `MAIN_TRACKWAY` | The Drowned Trackway | Site, dungeon | Inland; entered from the plank road | The sunken trackway and its shrine (section 11) |
| `MAIN_SLIABH_CARN` | Sliabh Carn | Site | Inland | Shielings on the lower slopes; marked climbs to the summit cairn |
| `MAIN_CAILLEACH_CAVE` | The Cailleach's Cave | Site, dungeon | Inland | Cave mouth high on the mountain (section 11) |
| `MAIN_HIGH_PASS` | The High Pass | **Route** | Inland | A pass road between scree slopes and a gorge; the landslide (below) |
| `MAIN_DUN_FIACH` | Dún Fiach | Site | Coast; landing below the crag | The royal rath on its crag; gate on the landward side |
| `MAIN_RIDGE_ROAD` | The Ridge Road | **Route** | Inland | A road along the ridge with a toll post and three ends: west, east and the south branch |
| `MAIN_FORD` | The river path and the Ford | **Route** | Inland | A river path, the ford-keeper's house, the Ford and the bridge plot beside it |
| `MAIN_SALT_PANS` | Ottar's farms and salt pans | Site | Coast; beach landing | Salt pans on the shore, farms behind them |
| `MAIN_SALTVIK` | Saltvik | Site | Coast; the harbour | Market, yards, jetties and the guards' posts |
| `MAIN_SALTNESS` | Saltness headland | Site | Coast; landing in the cove | The headland, with sea caves below it; home site B |
| `MAIN_MOOR_ROAD` | The moor road | **Route** | Inland | Heather moor with standing stones; the turn to the Mound Field lies off it (section 14) |
| `MAIN_MOUND_FIELD` | The Mound Field | Site, dungeons | Inland; entered from the moor road | The Norse mounds and the Barrow-King's mound; the outlaws' hill-fort beyond (section 11) |

From Chapter 3 the seven coastal sites (Carrick Strand, Carrick Landing, Kilbrecc, Dún Fiach, the salt pans, Saltvik and Saltness) are landings on the sea map; the other nine sites and all six routes are reached only on foot, through the routes.

### The network
Road legs are off screen. A site has a **road exit** for each road leg that leaves it, and a route has an **end** for each: the party walks to a road exit or an end, the travel map shows the journey's chain, and the next place it plays is the next route's end or the destination's road exit. The two ends of a road leg are its exits below. Times are in Book 4 section 03 and Book 10 section 14 ("Network").

| Road leg | Leaves by | Arrives by | Condition |
|---|---|---|---|
| Carrick Strand to Carrick Landing | The shore path | Carrick Landing's shore, at an edge exit placed when Carrick Strand's plan is drawn | |
| Carrick Landing to Ardcarn | The road east from (95, 35) | Ardcarn's west road | |
| Ardcarn to Loch Carn | Ardcarn's track up to the loch | The loch's lower shore | |
| Ardcarn to Kilbrecc farms | The field lanes | The farms' west lane | |
| Kilbrecc farms to Kilbrecc | The pilgrims' road | Kilbrecc's gate | |
| Ardcarn to the Black Wood path | A cattle track to the trees | The path's south end | |
| The Black Wood path to Móin Mhór | The path's north end | The turf village's wood road | |
| Móin Mhór to the plank road | The bog edge | The plank road's west end | |
| The plank road to Sliabh Carn | The plank road's east end | The drove road at the mountain's foot | |
| Sliabh Carn to the Cailleach's Cave | A marked climb | The cave mouth | Closed by snow in winter |
| Sliabh Carn to the High Pass | The drove road | The pass's north end | |
| The High Pass to Dún Fiach | The pass's south end | The rath's landward gate | |
| Kilbrecc to the Ridge Road | The road up from the monastery | The Ridge Road's west end | |
| The Ridge Road to Dún Fiach | The Ridge Road's east end | The king's road to the gate | Guards attack if Dún Fiach is hostile |
| The Ridge Road to the river path | The Ridge Road's south branch | The river path's north end | |
| The river path to the salt pans | The river path's south end | The farms behind the pans | |
| Salt pans to Saltvik | The shore road | Saltvik's land gate | |
| Saltvik to Saltness | The headland path | The headland's neck | |
| Salt pans to the moor road | A moor track inland | The moor road's south end | |
| The moor road to Móin Mhór | The moor road's north end | The turf village's moor track | |

A road exit or a route end is drawn as the road leaving the plan, with a waymark beside it; it must not open a new approach inside a raid site's sightlines (section 07). A route's main path joins its ends; its side paths, pockets and branches do not leave the route except through a dungeon's or a site's entry (section 14). There is no quick travel through a route: a journey through it is walked.

### Journey-event scenes
A road leg's journey event (Book 4 section 03) plays in a short road scene drawn for the country the leg crosses: a farm lane, a wood's edge, a bog edge, open moor, a hill road or a shore road. Each is a small plan with the road through it, cover to either side and an exit at each end, and meets the same art standard and density rule as any other scene. When the event ends, the leg goes on.

### Blocks
| Block | Where | Layout | How it opens |
|---|---|---|---|
| The landslide | The High Pass, across its main path near the south end | A slope of fallen rock and broken timber across the pass road; not climbable; seen from both sides; no side path or shortcut gets round it | Cleared by a work party, by Fiachra's men after an alliance, or by the Cailleach's maul; the cleared pass is a second state of the route |
| The Ford in spate | The river path's crossing | The Ford's tiles are knee or waist deep at most times and deep and fast in spate, sweeping a person downstream (section 01); the path either side stays walkable, so the route is closed only at the crossing | Wait for the water to fall, or build the timber bridge on its plot beside the Ford, which crosses at every level |
| The hill-folk's gate | Off the Black Wood path, at the end of a side path | The side path loops back to the main path past the same split oak until leave is given; the sign is visible on the second pass | The hill-folk's leave (Book 4 section 03) |
| The Drowned Trackway | Its branch off the plank road | The sunken trackway lies under deep bog water in spring and winter, and at ankle to knee depth in summer and autumn; a cold snap freezes it to walkable ice | Season, or a cold snap |
| The bog in winter flood | The plank road's side paths | Off the planks, the bog's pools rise to deep water; the planks themselves stay at ankle depth | Spring, or a cold snap |
| Snow on the climb | Sliabh Carn to the Cailleach's Cave | Drifts close the marked climb in winter | Spring |

A closed way is shown on the travel map with its reason, and the journey goes round it where the network allows. Hostile ground is never blocked: guards stand at the territory's edges (the Ridge Road's toll post, Dún Fiach's gate, Saltvik's jetties) and attack on sight while the faction is hostile (Book 2 section 10).

### Season and tide on the mainland
Every site and route changes with season and tide (Book 4 section 03), so every plan has a state for each season where Book 4 says it changes: the Ford in spate, the bog flooded in winter or frozen in a cold snap, snow on the high climbs and in the pass, the shielings occupied in summer, harvest work in the farms in autumn, fairs and pilgrims on the Ridge Road in summer. The coastal sites follow the tide like Skarvholm, with landing conditions and depth bands at low and high water.

## 11 / Dungeon layouts in outline
*Eight dungeons, two on Skarvholm and six on the mainland. Each is planned around a lead, puzzles from the world, fair traps with signs and a guardian room.*

### Rules for every dungeon
- **A lead outside it:** the dungeon is found by following something in the world (a story, a sign, an object), never by stumbling into its door.
- **A threshold:** the entrance can be seen and judged before the party commits to it, with a way back out.
- **Puzzles from the world:** tides, seasons, words, light and objects (Book 2 section 10, puzzles); never sliding blocks.
- **Fair traps with signs:** each trap shows its sign in view on the approach, before it can trigger, and can be avoided, disarmed or survived. A trap never sits on the only route without a visible way past.
- **A guardian room:** the guardian can be seen or heard before the party enters, and the room has a way out, so withdrawal is always possible.
- **Lore and the reward:** lore along the way explains the reward and its cost before it is taken (Book 4 section 10).
- **The small dungeons** behind the four routes' secret entrances (the fallen-oak souterrain, the cave behind the falls, the heather barrow and the otter-cave) follow the same rules on a smaller plan, one to four chambers with one obstacle or trap and no guardian room; their places and hints are in section 14 and their insides in Book 6 section 13.

### Outlines
| Dungeon | Lead | Layout | Puzzles | Traps and their signs | Guardian room |
|---|---|---|---|---|---|
| The Hollow Cairn (Skarvholm) | The sealed east door, the Grey Men and the cairn's keepers | Section 09 | The Grey Men alignment; the Door of Three Truths | Grave goods that wake their keepers (the cells are marked by carvings that seem to listen) | The inner chamber and the Cup behind the Door |
| The Seal Cave's deep passage (Skarvholm) | The scavengers' skiff in the inner chamber, and the back passage that shows at spring lows | The inner chamber, then the tidal passage under the bog to the cairn (section 09) | Reading the tide; a stretch of waist-deep wading at the passage's lowest point | The rising tide: a weed line on the walls shows how high the water comes, and the passage grows loud as the tide turns | None but the tide; the passage comes out below the cairn's broken chamber |
| The Black Wood souterrain (the heart) | The hill-folk's leave; the hermit's psalter; the charcoal burners' warnings on the Black Wood path | The ringfort's bank and ditch in the old forest, and under it a souterrain of narrow stone passages, low creeps and small chambers | Riddling doors that open to the right answer; the psalter holds the hints | Passages that lead back to their start, marked by flowers out of season; a door that shuts on a wrong answer, with a longer way round | The champion's chamber past the last door, where fog fills the room |
| The Barrow-King's mound (the Mound Field) | Ottar's family stories; grave-light seen from the moor road | A long mound with a passage, side cells of grave goods and the court hall | The order in which the goods were laid; what Hrolf will hear at his court | Roof props that give way (dust trickles and timbers creak first); draugar that wake when goods are taken (frost forms on the goods) | Hrolf's court: his chair among his goods, his draugar round the walls |
| The Drowned Trackway (off the plank road) | The peat-cutters' warnings; an old offering in a cut bank | A branch off the plank road (section 14), then the sunken trackway to the shrine on an islet | The season, and the safe steps marked by old posts | Bog holes (bright moss and bubbles); rotten planks (dark and sagging) | The shrine on its islet, with deep bog water round it, so the fight stays on the planks |
| The outlaws' hill-fort (beyond the Mound Field) | Outlaw scouts on the Black Wood path, robbed travellers on the moor road, a captured outlaw | An old hill-fort on the moor: bank, ditch, gate, huts and a lookout; open to a stealth raid or an assault (Book 1 section 05) | Finding a way in unseen; the lookout's blind side | Snares and deadfalls on the paths (bent saplings, cut twine, a log hung high) | Faolán's hall, where the Frankish sword is kept |
| The Cailleach's Cave (above Sliabh Carn) | The herders' stories on Sliabh Carn; frost on one stone only | A marked climb to the cave mouth, ice galleries, a wind passage and an inner hall of old stone | Crossing between the gusts, which come in a rhythm; ice that a fire melts | Falling ice (creaking and drip lines below it); gusts that push towards an edge (snow streamers in the air before each one) | The inner hall, where the Cailleach shows herself after the wind and ice |
| Loch Carn, a quest | Ardcarn's fears; Brigid's Well and its offerings | The loch shore, the well, the shallows where the horse stands and deep water beyond | The well's offerings and the binding | The horse's offer of a ride (weed in its mane; it walks into deep water) | The water's edge where the each-uisce stands; the bridle is won at the well |

## 12 / Exploration density
*Every site and route is worth walking through slowly. Plans are filled to a rule, not by eye.*

### The rule
- **Something worth stopping for** lies every 20 to 30 seconds of walking along every path, a wilderness route's main path and side paths included (Book 10 section 20): an item, a detail, a creature, a view or a resource. A plan is checked by walking each path at walking speed and measuring the gaps.
- **A real secret or small puzzle** sits in every site, every wilderness route and every Skarvholm zone. On a wilderness route and in a wild site there is also one resource worth the trip, one story (a traveller, a ruin, a grave) and one danger (Book 4 section 09).
- **Return value:** every site and route changes with season and tide (section 10), so each plan lists what is different in each season and at low and high water.
- **Collectibles** are placed as stopping points: shells, carved stones, the hermit's psalter pages, the names of the dead, songs learned and lore for each power.
- **Objectives:** the current goal is always shown, and a side discovery is always close to the route towards it.

### Points of interest
Every mainland site and wilderness route places its points of interest to this rule (Book 4 section 03):

| Place | Major points of interest | Minor points of interest |
|---|---|---|
| A site | One or two: a village, dungeon, ruin, shrine or camp with people and quests | 4 to 8 |
| A wilderness route | One (section 14) | 4 to 8 |

- **Minor points of interest** are things such as a cairn, a wreck, a carved stone, a hermit's hut, a hidden cache, a viewpoint, an eagle's nest, a herb patch, a grave or a burned farm. They count towards the stopping rule above.
- **Off the beaten track:** the best minor rewards lie off the obvious paths, behind a climb, a wade, a hazard or a puzzle (the movement verbs below), and reward curiosity with food, materials, lore, collectibles or equipment. At least one minor point of interest in every site and route is placed this way.
- **Fair guarding:** hazards guard many of the best finds, and each one shows its sign from the path before it can hurt anyone (Book 4 section 09). An off-path reward is visible, or hinted, from somewhere a curious player will stand.
- **Gathering spots** (herbs, nuts, berries, timber, peat, fish in streams) and **camp spots** are placed with the points of interest but are not counted as them.

### Movement verbs in a plan
| Verb | How a plan marks it | Layout rule |
|---|---|---|
| Walk, run, sneak, carry | Ordinary ground | Routes and timings at Book 10 speeds; scrub, dunes and woodland hide a sneaking party |
| Climb | Marked routes with hand-holds, as on Skarvholm's cliffs | Only marked routes are climbable. Each has a ledge to rest on within what a full stamina bar allows (Book 10 section 06); a climber who runs out slides to the last ledge or the foot of the route |
| Wade | Depth bands (section 01) | Waist water drains stamina, so a wade that must be crossed has a shallower step or a bank to rest on within what a full bar allows |
| Swim | Deep water marked as swimming water (section 01) | Every swim reaches water no deeper than the waist, or a rock to stand on, within what a full bar allows; a swimmer who runs out starts to sink and must reach it. No required route needs a swim |
| Jump | A short gap with a marked take-off and landing | Only short gaps; the far side is visible from the take-off |
| Crawl | A low gap under rock, through a creep or through a hedge | Nothing heavy and no carried person passes through a crawl, so carrying routes go round |
| Push and pull | A heavy object and the line of tiles it can move along | An object a puzzle needs can always be put back where it started, so no puzzle can be left unsolvable |
| Ride | Lochs, bogs and rivers the water-horse may cross | Only with the kelpie bridle (Book 4 section 10), and never near water at night |

## 13 / Layout tests
- Reachability: every landing, objective and exit is reachable under its stated tide condition, for Skarvholm, the steading, Carrick, the occupied island and the cairn.
- Sightline tests: scripted observers at each post see exactly the zones listed, and none of the dead zones.
- Timing tests: carry routes and runner routes match section 07 within 5% at Book 10 speeds.
- Placement tests: every suggested plot passes the Book 2 placement rules.
- The occupied island: approach B is impassable outside spring low tides; approach A is impossible without dealing with the cell sentry or slipping past him in fog.
- **No trap** (the user's third playtest, decision DG-20; Book 2 sections 10 and 23; numbers in Book 10 section 25, "No trap"): in every zone, the edges of every collision shape (solid tiles, walls, props' footprints, closed doors, deep water and closed tidal ground) are walked at Book 10's probe step at low water, half tide rising, high water and half tide falling, with the tidal window open and closed and the doors open and shut, and from every point just outside an edge where the steerer can stand, the steerer gets clear in some direction within Book 10's time. No gap narrower than the footprint plus the margin is a dead end. Someone on tidal ground as the window closes, or in water as it deepens, can always wade off. The western outcrop on Wreck Strand (the mast's foot at (40.4, 37.6), its seaward foot and the stream's mouth at (37.5, 37.0)) has a named test at night at every tide, the case of the user's screenshot. A plan that fails is changed (the gap widened or closed, a rock moved), never the test.
- **The steerer's bed** (the user's fourth playtest; decision DH-104): walked to from every side (eight directions), with the lean-to folded, framed, up and the shelter finished, at 18:00 onwards, the steerer sleeps in it; it is the same place before and after the shelter is finished, and no other sleeping place lies on it.
- **Chapter 1 finds** (decision DH-121): each find is reached on foot from every entry of its zone at high and low water, lies at least 4 tiles from the shortest ways between them, and adds no collision.
- The fold's overheard talk (decision DG-26): from the cairn zone's approach to the fold there is at least one way to come within the talk's overhearing range (Book 10 section 07, "At the fold") of Ketill at the gate while unseen at dusk and by day (behind the fold's west wall or the mound's flank), and the east wall Bran climbs out over is out of the band's sight from their posts.
- The sea burial (decision DG-14): below the gathering place on the strand (33, 35.6), the water's edge at every tide is reached by walking, and the water beyond it is deep enough within 6 tiles for the bier to sink there.
- Water: every water tile has a depth band at low and at high water; no required route crosses deep water; every deep tile a person can enter is marked as swimming water; in the opening, Hild's spot on Wreck Strand is knee to waist deep and reachable from dry shingle without a swim.
- The opening (design addendum 2.4): the seax lies on the shortest walkable path from the waking place to Hild, within 2 tiles of it; Thorkel's chest can be carried from the wash to its outline in the broch at any tide; the stores bundle on the mast is out of reach on foot and in an arrow's line from dry shingle, and where it falls is reachable without a swim; the rock pool is reached at any tide; a sneaking steerer can reach Conn's back at the stern through the dune grass unseen at dusk; every Chapter 1 door opens, closes, and blocks movement and sight while closed.
- The mainland: every site, route and road leg is reachable under its stated season, tide and block conditions, and closed when they say so (the landslide on the High Pass, the Ford in spate, the hill-folk's gate before leave, the Trackway branch out of season, the plank road's side paths in winter flood, the snow on the climb); the network's legs and the shortest journeys between sites match Book 10 section 14 ("Network", "Shortest journeys") within its stated tolerance; every journey between two inland sites passes through the routes the network puts between them; the seven coastal sites, and only they, have sea-map landings.
- Wilderness routes: each route's direct path, walked from end to end at walking speed, takes 1.5 to 2.5 real minutes and matches its Book 10 section 14 time within tolerance, and walking every side path and pocket as well takes about twice that or less; each has a main path joining all its ends, at least one shortcut that shortens the crossing, one or two camp spots, and its waystation spot on one of them; the hill-folk's gate, the Trackway branch and the Mound Field turn lie off their routes' main paths; no side path or shortcut gets round a block; every ambush place has its sign in view from the main path before the ambush point.
- Points of interest: every site has one or two major and 4 to 8 minor points of interest, and every route one major and 4 to 8 minor; at least one minor point of interest in each sits behind a climb, a wade, a hazard or a puzzle off the obvious paths; every hazard guarding a find shows its sign from the path.
- Dungeons: each passes reachability with its traps armed; every trap's sign is in view on the approach before its trigger; every guardian room has a way out.
- Secret entrances: each of the four can be found from its route's paths and entered under its conditions (the falls' ice broken in winter, the weir only out of spate); each hint sign is in view from a path on the approach and points at its entrance; every true rumour's landmark leads to it, and each wrong rumour's leads to a harmless place; none lies on a main path or gets round a block.
- Density: walking every path at walking speed, the gap between stopping points stays within Book 10 section 20; every site, route and zone has at least one secret or small puzzle; every climb and swim has a rest point within a full stamina bar (Book 10 section 06).

## 14 / Wilderness route layouts in outline
*The six wilderness routes that a journey crosses on foot: long places with a clear main path, side paths, pockets, camp spots and a shortcut to find. Each is planned around its ends, its major point of interest and the branches that lead off it.*

### Rules for every route
- **Shape:** long rather than square, with a clear main path joining the route's ends, side paths, pockets, one or two camp spots and at least one shortcut to find. A route is one or more streamed scenes.
- **Length:** the direct path takes about 1.5 to 2.5 real minutes of walking (2 to 3 game hours at the Book 10 clock); exploring off it can double that. Each route's time is in Book 10 section 14 ("Network"), and the plan's main path is drawn to match it at walking speed. Time runs at its normal rate.
- **Ends:** each end is where a road leg arrives (section 10), with a waymark and a clear view of the main path setting off. The party can leave by any end, including the one it came in by.
- **Contents:** one major point of interest, 4 to 8 minor ones (section 12), wildlife ground, gathering spots, hazards and camp spots. The major point of interest is on the main path or plainly signposted from it; the best minor finds are off it.
- **Shortcut:** at least one, off the main path and not obvious, that once found shortens later crossings. A shortcut may need a climb, a wade or a jump; it never needs a swim, and it never gets round a block.
- **Camp spots and the waystation spot:** one or two sheltered camp spots by water. One of them is marked as the route's waystation spot, with room for the hut and its store, so a waystation is built where the plan expects it (Book 4 section 03).
- **Ambush places:** a few stretches of the main path with cover close on both sides. Each has room for its sign (a fallen tree across the path, a crows' roost that rises, fresh tracks in soft ground) in view from the path before the ambush point.
- **Branches:** a site entered from a route (the heart of the Black Wood, the Drowned Trackway, the Mound Field) lies at the end of a side path, never on the main path, with its threshold visible before the party commits (section 11).
- **Secret entrances:** four routes (the Black Wood path, the High Pass, the river path and the moor road) hide a secret entrance to a small dungeon (Book 4 section 03; Book 6 section 13). It lies off the main path, never on it, and never gets round a block. It has no marker until found, but its hint signs are placed on the approach so that a curious player standing on a path sees at least one of them: a carved mark beside the path where the way to it leaves; a draught at the crack itself, seen within 3 tiles; birds flying in and not out, seen from the path; and the spot where a keen-eyed companion within 4 tiles remarks on it (Book 10 section 20). A rumour names a real landmark on the plan, so a true one leads to the entrance and a wrong one to a harmless place.
- **Art:** every route meets the terrain art standard set at Stage 6 (Book 7 section 14): wind, moving plants, light, water and wildlife.
- **Seasons:** each plan has a state for each season where Book 4 section 03 says the route changes.

### The Black Wood path (`MAIN_BLACKWOOD_EDGE`)
| Part | Layout |
|---|---|
| Ends | The south end, where the cattle track from Ardcarn arrives; the north end, where the wood road leaves for Móin Mhór |
| Main path | An old cart track winding north through oakwood and holly, through shafts of light in small clearings, crossing two streams on stepping stones at ankle depth |
| Side paths and pockets | A stream valley running east; a ring of old oaks; a holly-dark hollow that holds fog; a hazel coppice |
| Shortcut | A deer trail across a stream bend, found by following deer or their slots in the mud, which cuts the main path's long loop round the hollow |
| Camp spots | The charcoal burners' clearing; a dry knoll by the northern stream, the waystation spot |
| Major point of interest | The charcoal burners' camp beside the main path, about a third of the way north: hearths, turf huts, people and quests |
| The hill-folk's gate | About two thirds of the way north, a side path leaves the main path into the oldest trees, to a gap between two hollies by a split oak. Until the hill-folk give leave it loops back to the main path past the same split oak (section 10, Blocks); with their leave it leads into the heart (`MAIN_BLACKWOOD_HEART`) |
| Minor points of interest | An outlaw lookout platform high in an oak, with a cache, reached by a marked climb; an empty hermit's hut with a carved cross; a charcoal burner's grave by a cold hearth; a fallen oak bridging the eastern stream to a bank of honey and mushrooms; a wild bees' nest in a hollow oak; a rock outcrop above the canopy, a climb, with a view to Móin Mhór |
| Gathering | Hazelnuts and acorns, mushrooms in autumn, herbs, deadfall timber, fish in the streams, honey |
| Hazards | Boar ground (rooted earth, a snort in the undergrowth); fog in the hollow; getting lost off the path; wolves in winter; the hill-folk's rules near the gate |
| Secret entrance | **The fallen-oak souterrain**, a small dungeon of its own, not a way into the heart: under the root-plate of a fallen oak on the far side of the ring of old oaks, east of the main path between the charcoal burners' camp and the hill-folk's gate. Hints on the approach: a cross cut in a holly where the side path to the ring leaves the main path; leaf litter stirring at the roots, and on cold mornings a breath of mist from the crack; a dressed lintel stone among the roots that a keen-eyed companion remarks on. The wrong rumour's place, the holly-dark hollow, holds only fog. Inside: a creep and three low chambers (Book 6 section 13) |

### The plank road (`MAIN_PLANK_ROAD`)
| Part | Layout |
|---|---|
| Ends | The west end at Móin Mhór's bog edge; the east end at the drove road below Sliabh Carn |
| Main path | The timber trackway of split planks on brushwood, in long straight reaches between islands of firmer ground, across open bog with pools and cotton grass either side |
| Side paths and pockets | Peat-cutters' tracks out to the cut banks; a birch island; a string of pools where otters fish |
| Shortcut | Where the planks swing round a deep pool, a line of old marker posts crosses firm ground: the peat-cutters' safe steps, found by asking them or by watching where the moss is dull |
| Camp spots | The turf-cutters' shelter; the birch island near the east end, the waystation spot |
| Major point of interest | The turf-cutters' shelter on an island of firm ground about halfway, and the branch to the Drowned Trackway beside it |
| The Trackway branch | From beside the shelter, old posts lead out across the bog to where the sunken trackway begins (`MAIN_TRACKWAY`). It is reachable in summer and autumn, or over ice in a cold snap, and under deep bog water otherwise (section 10, Blocks) |
| Minor points of interest | A body in a cut bank, old and dark, best left (lore); a keg of bog butter in the peat, which is the Bog King's if taken (Book 4 section 07); a sunk cart with iron fittings, reached by a wade past a bog hole; a cairn on the one hummock, with a view of Sliabh Carn; an otter's holt; a broken reach of planks where the bog has taken them, with a way round on firm tussocks |
| Gathering | Peat at the cut banks, bog cotton, bog myrtle and herbs, cranberries in late summer, eels in the pools |
| Hazards | Bog holes off the planks (bright moss, bubbles); rotten planks (dark and sagging); mist; will-o'-the-wisps that draw a walker off the planks; the Bog King's drowned near the branch at night |

### The High Pass (`MAIN_HIGH_PASS`)
| Part | Layout |
|---|---|
| Ends | The north end, where the drove road from Sliabh Carn arrives; the south end, where the pass road falls towards Dún Fiach |
| Main path | A pass road climbing between scree slopes beside a stream in a gorge, over a windy saddle, then down in long bends |
| Side paths and pockets | The gorge floor along the stream; a high shelf under the crags; a hollow below the saddle out of the wind |
| Shortcut | A goat track over a shoulder of the crag that cuts the northern bends: a marked climb with a ledge to rest on (section 12) |
| Camp spots | The sheltered hollow below the saddle, the waystation spot; the ruined watchtower |
| Major point of interest | The landslide across the pass road near the south end (section 10, Blocks), until it is cleared; and a ruined watchtower on a knoll above the saddle |
| Minor points of interest | An eagle's nest on a crag, reached by a climb; a wayside cairn where travellers add a stone; an overhang with old bones and an outlaws' cache; a waterfall pool in the gorge, reached by a wade; a pedlar's grave with his pack; the saddle's view to the sea and Dún Fiach |
| Gathering | Herbs and juniper on the crags, trout in the gorge pools |
| Hazards | Rockfall and scree; cold, on high ground in any season; wolves; Faolán's outlaws; new slides after rain; lightning on the saddle in storms |
| Seasons | Snow drifts on the saddle slow it in winter |
| Secret entrance | **The cave behind the falls**, behind the waterfall over the gorge pool (the minor point of interest above): a wade across the pool's edge, knee to waist deep with a rock to rest on, then a wet ledge behind the falling water. In winter the falls freeze into a curtain of ice, broken with an axe or the Cailleach's maul. Hints on the approach: dippers flying into the falls and not coming out, seen from the gorge path; the watchmen's chevron cut on the watchtower's lintel and again on a stone by the pool; in winter, a dark hollow showing through the ice. The wrong rumour's place, the watchtower's floor, is an empty pit. Inside: a dry outer cave and an inner store (Book 6 section 13) |

### The Ridge Road (`MAIN_RIDGE_ROAD`)
| Part | Layout |
|---|---|
| Ends | Three: the west end, from Kilbrecc; the east end, to Dún Fiach; and the south branch, down to the river path |
| Main path | A road along an open ridge of heather with cairns and long views to the sea, which forks at Fiachra's toll post: east to Dún Fiach and south down to the river |
| Side paths and pockets | A corrie below the ridge with a lochan; the crest path to a summit cairn; a pilgrims' path to a holy stone; a hollow where the summer fair is held |
| Shortcut | A drove path on the ridge's lee from the west end to the south branch, which does not pass the toll post: the smugglers' way, and a way round the riders when Dún Fiach is hostile |
| Camp spots | The lochan in the corrie, the waystation spot; a sheepfold by the south branch |
| Major point of interest | Fiachra's toll post at the fork: a hut, a bar across the road, riders and tolls |
| Minor points of interest | A pilgrims' cross-slab with offerings; a burial cairn; a beacon stance with the view over the sea; a shepherd's bothy; a dead horse and a rider's lost satchel; the summit cairn, reached by a climb |
| Gathering | Heather, bilberries in summer, peat, hares |
| Hazards | Fiachra's riders if Dún Fiach is hostile; toll disputes; wind, cold and fog on the crest; lightning in storms |
| Seasons | Busiest in summer, with fairs in the hollow and pilgrims on the road |

### The river path and the Ford (`MAIN_FORD`)
| Part | Layout |
|---|---|
| Ends | The north end, from the Ridge Road's south branch; the south end, towards the salt pans |
| Main path | A path along the riverbank through alder and willow, down to the Ford, where stepping stones and a gravel bar cross the wide brown river, then on along the far bank |
| Side paths and pockets | An otters' backwater; a willow island reached by a wade; an eel weir; a water meadow in an oxbow |
| Shortcut | A cut across the oxbow meadow that saves the path's long bend on the north bank |
| Camp spots | A terrace above the flood line by Cuán's ford-house, the waystation spot; the willow island |
| Major point of interest | Cuán's ford-house and the crossing, with the bridge plot beside the Ford (section 10, Blocks) |
| Minor points of interest | A smugglers' cache under a cut bank, reached by a wade; the eel weir; a drowned man's cairn; a heronry; a carved stone at the Ford marked with old flood heights; a sunken boat in the backwater |
| Gathering | Fish and eels, willow withies, alder timber, watercress, herbs |
| Hazards | Spate; the river itself, deep in its channel (section 01); smugglers |
| Seasons | Closed at the Ford in spate unless bridged; the path either side stays open |
| Secret entrance | **The otter-cave behind the weir**: behind the eel weir where it meets the rock of the north bank, reached along the top of the weir at low water, knee deep; closed in spate. Hints on the approach: otters slipping behind the weir and not coming out, seen from the bank path; a ship cut into an alder beside the path above the weir; Cuán's story at the ford-house. The wrong rumour's place, the stepping stones at the Ford, holds only the river. Inside: a crawl through the otters' holt to a dry inner chamber (Book 6 section 13) |

### The moor road (`MAIN_MOOR_ROAD`)
| Part | Layout |
|---|---|
| Ends | The south end, from the salt pans; the north end, towards Móin Mhór |
| Main path | A track over heather moor past standing stones and a gallows tree, dipping to cross peaty burns |
| Side paths and pockets | A burn running down to a ruined shieling; a low ridge with a ring cairn; a hollow of bog cotton |
| Shortcut | A sheep trod over the moor's shoulder that cuts the road's long curve, passing close under the gallows tree |
| Camp spots | The ruined shieling, the waystation spot; a burnside hollow |
| Major point of interest | The standing stones, and the turn to the Mound Field beside them |
| The Mound Field turn | From the standing stones a side path runs off over the moor to the mounds (`MAIN_MOUND_FIELD`); grave-light on the Barrow-King's mound can be seen from the road at night (section 11) |
| Minor points of interest | The gallows tree and what was left under it; a burned farm; the ring cairn; a boundary stone carved with ogham; a merlin's nest; a view over the salt pans to the sea |
| Gathering | Heather, peat, bilberries, grouse, trout in the burns |
| Hazards | Wolves in winter; outlaws; the barrow-dead near the turn at night; bog holes in the burn hollows; fog |
| Seasons | Long dark nights in winter |
| Secret entrance | **The heather barrow**: a long, low hump in the heather beside the sheep trod shortcut, about halfway along it, with one spiral-carved kerbstone showing at its south end. Hints on the approach: the spirals, seen from the trod; wheatears going in and out between the kerbstones; a cold draught from the gap at its north end. The wrong rumour's place, the ring cairn on the low ridge, is empty. Inside: a crawl through the gap, a short passage with a sill stone and one chamber (Book 6 section 13) |

## 15 / The wreck on Sgeir Dhubh (`ZONE_SEA_WRECK`)
*The voyage interruption of Book 6 section 19 (Stage 13, decisions S13-40 to S13-59): a reef in Rán's Reach on the Skarvholm to Carrick crossing, played on foot while the voyage waits. One zone of 48 x 32 tiles, read tile for tile from its grid, `docs/levels/sea_wreck_tiles.txt`, by the zone expander (`content/zones/zone_sea_wreck.plan.json`), which adds the tide line, the decoration and the props as for every zone.*

### Layout
Sgeir Dhubh is a low reef about 40 tiles long, lying west-south-west to east-north-east in open sea. Along its north side runs a **spine of black rock stacks** (rock, blocking), broken by two narrow gaps down to a **weed-covered shelf** (tidal flats) on the north. Under the spine lies a **crown of salt turf and thrift** (about 30 tiles of grass) where the gulls stand; south of it the reef's **shingle back**, and below that the **foreshore** and a wide **shelf of flats** to the south and west, bare at low water and under the sea at high. Deep water lies all round, and is the zone's edge everywhere (there are no links: the way off is the boat).

| Feature | Tiles (x, y) | Notes |
|---|---|---|
| The household's boat, lying alongside | foot (42.6, 22.4), hull about x 39 to 46 | The coastal boat afloat (`ship_t1_launch`), its crew at their oars aboard; Hild by the stern. The steerer comes ashore beside it at (38.6, 19.4), facing west |
| The boat's side (where Hild asks) | within Book 10 `boardReachTiles` of (39.8, 20.2) | On the landing spit's foreshore, dry above half tide |
| The wreck of the *Faoileán* | foot (8.4, 21.7) | Broken-backed on the south-western tip, on the flats; her sail in the surf to the west (5.2, 22.6); the cask (12.6, 21.3) and the iron (11.5, 22.1) in the wash beside her |
| Fínán, holding the gunwale | (11.0, 20.85), facing west | On the foreshore at the tongue's end: dry at low water, waist deep at high; reached within talk range from the shingle at every tide |
| Derbáil, on the rocks above | (13.6, 18.4), facing east | On the dry shingle under the spine's western stacks |
| Ívar, lying hurt | (16.4, 19.6), facing north | On the dry shingle of the tongue; carried to the boat by the steerer (about 23 tiles of carrying, 13 real seconds at Book 10's carry speed) |
| The spine | x 12 to 42, y 11 to 15 | Rock stacks; two gaps at x 27 and x 33 lead down to the north shelf at low water |
| The turf crown | x 18 to 31, y 14 to 17 | Salt turf and thrift; two standing gulls |
| Seals, a cormorant, crabs | (21.5, 23.4), (31.5, 10.4); the offshore stack (30, 7); the shingle | Wildlife, drawn only |

### Tide and depth
- **Low water** (the tidal window open): the flats are bare all round; the steerer can walk to the wreck's side and out along the north shelf.
- **High water**: the flats are under the sea and blocking; the foreshore is knee to waist deep at its upper edge and deep at its foot; the walkable reef is the shingle back, the crown and the upper foreshore. Fínán stands waist deep at the wreck, within talk range of the dry shingle.
- The boat lies in deep water at every tide; nobody wades to it: the boat's side is reached on the landing spit.

### Layout tests
- **Reachability** (section 13): from the steerer's landing place, the boat's side, every survivor's talk spot and the wreck's side are reached on foot at high and at low water (`tests/reachability/seaWreck.test.ts`).
- **No trap** (section 13): the reef's every collision edge is walked at every tide state with the window open and closed (`tests/unit/noTrap.test.ts` walks every zone).
- **Carrying Ívar**: from where he lies to the boat's side is carried without a swim at both tides.
- **No child** is placed in the scene; its people are the three adults of Book 5 section 02 and the household aboard.
