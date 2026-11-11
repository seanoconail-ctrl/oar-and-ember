# Oar and Ember, Book 09: Level Layouts

*Tile-level plans for Skarvholm, the steading, Carrick Landing, the occupied island and the Hollow Cairn, with routes, sightlines, landing points and water depth; the mainland's twenty areas and the dungeons in outline; and the rule for how densely the world is filled.*

These plans are the ground truth for the first builds and the late-game return. Each one exists twice: as a drawing for people and as a character grid that an LLM can transcribe directly into tilemap data. Sections 10 to 12 set the mainland, the dungeons and the density of the world at outline level; the tile plans for those places are drawn by the stages that build them and must agree with these outlines.

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
| Route | A path with a length in tiles and a time at Book 10 speeds |
| Sightline | What an observer at a post can see, its range and its dead zones |
| Dead zone | Ground an observer cannot see because of cliffs, buildings, dunes or scrub |
| Depth band | How deep a water tile is for a person: wet, ankle, knee, waist or deep, at low and at high water |
| Area | One of the mainland's twenty places on foot (section 10); like a Skarvholm zone, it is one or more streamed scenes |

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
| `ZONE_SK_STRAND` | (8 to 30, 22 to 31) | Shingle ribbon with tidal flats below; the wreck on the skerry at (14, 29) reachable on foot at low tide; driftwood spawns along the high-tide line after storms; the shallows where Hild stands in the opening (below) |
| `ZONE_SK_MACHAIR` | (12 to 30, 17 to 24) | The steading plan (section 05) sits at blocks (14 to 21, 19 to 23); plots at (20 to 25, 21 to 22) |
| `ZONE_SK_KELDA` | (17 to 21, 17 to 21) | Spring pool at (19, 19); the stream flows south to the strand, ankle deep, with foam at its stones |
| `ZONE_SK_ROOK` | (16 to 28, 6 to 14) | Summit at (22, 9); heather slopes; the watch cairn plot |
| `ZONE_SK_BOG` | (27 to 37, 11 to 17) | Peat banks give cover to sneaking actors; soft ground slows movement in rain; the old offering lies near (34, 13) |
| `ZONE_SK_GREYMEN` | (25 to 29, 12 to 16) | Nine stones round (27, 14); the sunrise alignment points east-north-east |
| `ZONE_SK_CAIRN` | (29 to 33, 18 to 23) | Mound at (31, 20) with its sealed east door; sheepfold at (28, 22) |
| `ZONE_SK_CLIFFS` | (5 to 40, 3 to 9) | Climbing routes marked with hand-holds; eggs on ledges in spring; eagle stack offshore at (3, 12) |
| `ZONE_SK_GEO` | (9 to 14, 2 to 10) | The narrow geo, a steep path up to the hermit's cell at (11, 8) |
| `ZONE_SK_SEALCAVE` | (38 to 44, 5 to 12) | Cave mouth at (41, 9); a tidal back passage runs south-west under the bog to the cairn: the Seal Cave's deep passage, a small dungeon (section 11) |
| `ZONE_SK_HAGSEAT` | (2 to 9, 15 to 21) | The stone at (5, 18); kelp below; the windiest place on the island |
| `ZONE_SK_NAUST` | (30 to 43, 23 to 30) | Cove beach, boatshed plot, causeway to the Skerry |

### Wreck Strand's shallows
In the opening Hild stands knee to waist deep in the shallows beyond the western rock outcrop, partly submerged, calling, with ripples and spray around her (Book 4 section 08). The Wreck Strand plan lays a shelf of shallows there: from the foreshore the steerer wades through ankle and knee water to reach her where knee water meets waist water, then carries her back up to dry shingle above the tide line. Her spot can be seen from the steerer's waking place once they pass the outcrop, and deep water stays beyond her, so the walk out and back never needs a swim. Her shallows stay at that depth for as long as she waits there.

### Exploration content
| Puzzle or secret | Where | Rule | Reward |
|---|---|---|---|
| Seal Cave tides | `ZONE_SK_SEALCAVE` | The inner chamber is dry only in the window around low water; the back passage opens only at spring lows | The scavengers' skiff in Chapter 1; later the passage towards the cairn |
| The Grey Men | `ZONE_SK_GREYMEN` | At sunrise on a festival morning, the shadow of the tallest stone falls on the cairn's east door | Opens the cairn's sealed east door |
| The hermit's niche | `ZONE_SK_GEO` | A loose stone behind the burned altar, found by reading the hermit's carved cross | A psalter page and a clue to Brecc |
| The bog offering | `ZONE_SK_BOG` | Peat cut in the right bank in summer exposes a bronze cauldron | Treasure, or an offended keeper if taken |
| The eggs | `ZONE_SK_CLIFFS` | Climbing routes; a fall costs vitality, not life | Food in spring |
| The Skerry of the Drowned | `ZONE_SK_NAUST` | Spring low tides only; the drowned stand there and can be spoken to | News of the dead; Thorkel if he drowned unburied |

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
| Watch cairn | (22, 9) | 2, a horn and a beacon | Sees 14 blocks; the beacon brings Orm's fleet early (Book 10) |
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
| Spring room | (6 to 9, 20 to 22) | The island's last fresh water, untouched by Rán |
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
*The mainland's twenty areas at overview scale: how they join, how long each link takes to walk, where ships land and what blocks the way. Book 4 section 03 holds what is in each area.*

The mainland (`REG_MAINLAND`) is one region of twenty areas on the Irish coast, the same for every player. This section fixes how the areas fit together. Each area's tile plan is drawn by the stage that builds it, starting from a mockup the user approves (Book 3), and must agree with this overview. Carrick Landing's plan (sections 06 and 07) is the first of them.

### Areas
| # | ID | Area | Coast and landing | Layout notes |
|---|---|---|---|---|
| 1 | `MAIN_CARRICK_STRAND` | Carrick Strand | Coast; beach landing | Shore farmland beside Carrick Landing; home site A |
| 2 | `MAIN_CARRICK_LANDING` | Carrick Landing | Coast; landings L1 to L4 (section 06) | The raid site plan; the track to Ardcarn leaves east at (95, 35) |
| 3 | `MAIN_ARDCARN` | Ardcarn | Inland; reached from the sea through Carrick Landing | Farms, fields and the guesthouse; the hub of the western roads |
| 4 | `MAIN_LOCH_CARN` | Loch Carn and Brigid's Well | Inland | Loch shore with a shelf of shallows and deep water beyond; the well beside it |
| 5 | `MAIN_KILBRECC` | Kilbrecc | Coast; landing below the headland | Round tower, church, guesthouse, workshops |
| 6 | `MAIN_KILBRECC_FARMS` | The tenant farms | Inland | Tithe barns and the pilgrims' road to Kilbrecc |
| 7 | `MAIN_BLACKWOOD_EDGE` | Fiodh Dubh: the edge | Inland, wilderness | Oakwood with clearings, charcoal burners' hearths and outlaw lookouts |
| 8 | `MAIN_BLACKWOOD_HEART` | Fiodh Dubh: the heart | Inland, dungeon | Old forest round the hill-folk's ringfort and its souterrain (section 11) |
| 9 | `MAIN_MOIN_MHOR` | Móin Mhór, the Great Bog | Inland, wilderness | Peat banks, bog pools and the plank road; floods in winter |
| 10 | `MAIN_TRACKWAY` | The Drowned Trackway | Inland, dungeon | The sunken trackway and its shrine (section 11) |
| 11 | `MAIN_SLIABH_CARN` | Sliabh Carn | Inland, wilderness | Shielings on the lower slopes; marked climbs to the summit cairn |
| 12 | `MAIN_CAILLEACH_CAVE` | The Cailleach's Cave | Inland, dungeon | Cave mouth high on the mountain (section 11) |
| 13 | `MAIN_HIGH_PASS` | The High Pass | Inland, wilderness | A pass road between scree slopes; the landslide (below) |
| 14 | `MAIN_DUN_FIACH` | Dún Fiach | Coast; landing below the crag | The royal rath on its crag; gate on the landward side |
| 15 | `MAIN_RIDGE_ROAD` | The Ridge Road | Inland | A road along the ridge with a toll post; Fiachra's riders patrol it |
| 16 | `MAIN_FORD` | The River Ford | Inland | The ford, the ford-keeper's post and the bridge plot beside the ford |
| 17 | `MAIN_SALT_PANS` | Ottar's farms and salt pans | Coast; beach landing | Salt pans on the shore, farms behind them |
| 18 | `MAIN_SALTVIK` | Saltvik | Coast; the harbour | Market, yards, jetties and the guards' posts |
| 19 | `MAIN_SALTNESS` | Saltness headland | Coast; landing in the cove | The headland, with sea caves below it; home site B |
| 20 | `MAIN_MOUND_FIELD` | The Mound Field and the moor | Inland, wilderness and dungeons | The Norse mounds and the Barrow-King's mound; the moor and the outlaws' hill-fort beyond (section 11) |

From Chapter 3 the seven coastal areas (1, 2, 5, 14, 17, 18 and 19) are landings on the sea map; the other thirteen are reached only on foot.

### Links and walking times
Each link is a route on foot between two areas, entered at an edge exit (Book 2 section 10, FootLink). Times are real time at walking speed, from Book 10 section 14.

| Link | Walk | Route | Condition |
|---|---|---|---|
| Carrick Strand to Carrick Landing | 1 min | Along the shore | |
| Carrick Landing to Ardcarn | 1.5 min | The track east from (95, 35) | |
| Ardcarn to Loch Carn | 2 min | A track up to the loch | |
| Ardcarn to Kilbrecc farms | 2 min | Field lanes | |
| Kilbrecc farms to Kilbrecc | 1 min | The pilgrims' road | |
| Ardcarn to Black Wood edge | 2.5 min | A cattle track into the oakwood | |
| Black Wood edge to Black Wood heart | 3 min | A path that leads back to the edge until the hill-folk give leave | The hill-folk's leave |
| Black Wood edge to Móin Mhór | 2.5 min | Down out of the trees to the bog's edge | |
| Móin Mhór to Drowned Trackway | 2 min | The plank road, then the sunken trackway | Summer and autumn, or a winter cold snap |
| Móin Mhór to Sliabh Carn | 3 min | A climbing path off the bog | |
| Sliabh Carn to Cailleach's Cave | 2 min | A marked climb | Closed by snow in winter |
| Sliabh Carn to High Pass | 2 min | The drove road | |
| High Pass to Dún Fiach | 2.5 min | The pass road down to the rath | The landslide, until cleared |
| Kilbrecc to Ridge Road | 2 min | The road up from the monastery | |
| Ridge Road to Dún Fiach | 2 min | The king's road to the gate | Guards attack if Dún Fiach is hostile |
| Ridge Road to River Ford | 2.5 min | The road down to the river | |
| River Ford to Salt pans | 2 min | Across the ford | Closed in spate unless bridged |
| Salt pans to Saltvik | 1 min | The shore road | |
| Saltvik to Saltness | 1 min | The headland path | |
| Salt pans to Mound Field and moor | 2.5 min | A moor track inland | |
| Mound Field and moor to Móin Mhór | 3 min | A moor track to the bog | Wolves in winter |

The link from Carrick Strand leaves the Carrick Landing plan at an edge exit placed when Carrick Strand's plan is drawn; it must not open a new approach inside the raid's sightlines (section 07). Each area places a **waymark** where a road leaves it; quick travel runs between known waymarks when it is safe, at the game-time cost in Book 10 section 14. A link's time is the walk from one area's waymark to the other's, through the ground between them; that ground is drawn in the two areas' plans, so the walking is spent in places worth stopping in (section 12).

### Blocks
| Block | Where | Layout | How it opens |
|---|---|---|---|
| The landslide | The High Pass, on the road to Dún Fiach | A slope of fallen rock and broken timber across the pass road; not climbable; seen from both sides | Cleared by a work party, by Fiachra's men after an alliance, or by the Cailleach's maul; the cleared pass is a second state of the scene |
| The ford in spate | The River Ford | The ford tiles are knee or waist deep at most times and deep and fast in spate, sweeping a person downstream (section 01) | Wait for the water to fall, or build the timber bridge on its plot beside the ford, which crosses at every level |
| The Black Wood heart | The edge's path into the heart | The path loops back to the edge past the same split oak until leave is given; the sign is visible on the second pass | The hill-folk's leave (Book 4 section 03) |
| The Drowned Trackway | The end of the plank road | The sunken trackway lies under deep bog water in spring and winter, and at ankle to knee depth in summer and autumn; a cold snap freezes it to walkable ice | Season, or a cold snap |
| Snow on the climb | Sliabh Carn to the Cailleach's Cave | Drifts close the marked climb in winter | Spring |

Hostile ground is never blocked: guards stand at the territory's edges (the Ridge Road's toll post, Dún Fiach's gate, Saltvik's jetties) and attack on sight while the faction is hostile (Book 2 section 10).

### Season and tide on the mainland
Every area changes with season and tide (Book 4 section 03), so every area plan has a state for each season where Book 4 says it changes: the ford in spate, the bog flooded in winter or frozen in a cold snap, snow on the high climbs, the shielings occupied in summer, harvest work in the farms in autumn. The coastal areas follow the tide like Skarvholm, with landing conditions and depth bands at low and high water.

## 11 / Dungeon layouts in outline
*Eight dungeons, two on Skarvholm and six on the mainland. Each is planned around a lead, puzzles from the world, fair traps with signs and a guardian room.*

### Rules for every dungeon
- **A lead outside it:** the dungeon is found by following something in the world (a story, a sign, an object), never by stumbling into its door.
- **A threshold:** the entrance can be seen and judged before the party commits to it, with a way back out.
- **Puzzles from the world:** tides, seasons, words, light and objects (Book 2 section 10, puzzles); never sliding blocks.
- **Fair traps with signs:** each trap shows its sign in view on the approach, before it can trigger, and can be avoided, disarmed or survived. A trap never sits on the only route without a visible way past.
- **A guardian room:** the guardian can be seen or heard before the party enters, and the room has a way out, so withdrawal is always possible.
- **Lore and the reward:** lore along the way explains the reward and its cost before it is taken (Book 4 section 10).

### Outlines
| Dungeon | Lead | Layout | Puzzles | Traps and their signs | Guardian room |
|---|---|---|---|---|---|
| The Hollow Cairn (Skarvholm) | The sealed east door, the Grey Men and the cairn's keepers | Section 09 | The Grey Men alignment; the Door of Three Truths | Grave goods that wake their keepers (the cells are marked by carvings that seem to listen) | The inner chamber and the Cup behind the Door |
| The Seal Cave's deep passage (Skarvholm) | The scavengers' skiff in the inner chamber, and the back passage that shows at spring lows | The inner chamber, then the tidal passage under the bog to the cairn (section 09) | Reading the tide; a stretch of waist-deep wading at the passage's lowest point | The rising tide: a weed line on the walls shows how high the water comes, and the passage grows loud as the tide turns | None but the tide; the passage comes out below the cairn's broken chamber |
| The Black Wood souterrain (area 8) | The hill-folk's leave; the hermit's psalter; the charcoal burners' warnings | The ringfort's bank and ditch in the old forest, and under it a souterrain of narrow stone passages, low creeps and small chambers | Riddling doors that open to the right answer; the psalter holds the hints | Passages that lead back to their start, marked by flowers out of season; a door that shuts on a wrong answer, with a longer way round | The champion's chamber past the last door, where fog fills the room |
| The Barrow-King's mound (area 20) | Ottar's family stories; grave-light seen from the moor track | A long mound with a passage, side cells of grave goods and the court hall | The order in which the goods were laid; what Hrolf will hear at his court | Roof props that give way (dust trickles and timbers creak first); draugar that wake when goods are taken (frost forms on the goods) | Hrolf's court: his chair among his goods, his draugar round the walls |
| The Drowned Trackway (area 10) | The peat-cutters' warnings; an old offering in a cut bank | The plank road from Móin Mhór's edge, then the sunken trackway to the shrine on an islet | The season, and the safe steps marked by old posts | Bog holes (bright moss and bubbles); rotten planks (dark and sagging) | The shrine on its islet, with deep bog water round it, so the fight stays on the planks |
| The outlaws' hill-fort (area 20, moor) | Outlaw scouts in the Black Wood, robbed travellers, a captured outlaw | An old hill-fort on the moor: bank, ditch, gate, huts and a lookout; open to a stealth raid or an assault (Book 1 section 05) | Finding a way in unseen; the lookout's blind side | Snares and deadfalls on the paths (bent saplings, cut twine, a log hung high) | Faolán's hall, where the Frankish sword is kept |
| The Cailleach's Cave (area 12) | The herders' stories on Sliabh Carn; frost on one stone only | A marked climb to the cave mouth, ice galleries, a wind passage and an inner hall of old stone | Crossing between the gusts, which come in a rhythm; ice that a fire melts | Falling ice (creaking and drip lines below it); gusts that push towards an edge (snow streamers in the air before each one) | The inner hall, where the Cailleach shows herself after the wind and ice |
| Loch Carn (area 4), a quest | Ardcarn's fears; Brigid's Well and its offerings | The loch shore, the well, the shallows where the horse stands and deep water beyond | The well's offerings and the binding | The horse's offer of a ride (weed in its mane; it walks into deep water) | The water's edge where the each-uisce stands; the bridle is won at the well |

## 12 / Exploration density
*Every area is worth walking through slowly. Plans are filled to a rule, not by eye.*

### The rule
- **Something worth stopping for** lies every 20 to 30 seconds of walking along every route (Book 10 section 20): an item, a detail, a creature, a view or a resource. A plan is checked by walking each route at walking speed and measuring the gaps.
- **A real secret or small puzzle** sits in every area and every Skarvholm zone. In a wilderness area there is also one resource worth the trip, one story (a traveller, a ruin, a grave) and one danger (Book 4 section 09).
- **Return value:** every area changes with season and tide (section 10), so each plan lists what is different in each season and at low and high water.
- **Collectibles** are placed as stopping points: shells, carved stones, the hermit's psalter pages, the names of the dead, songs learned and lore for each power.
- **Objectives:** the current goal is always shown, and a side discovery is always close to the route towards it.

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
- Water: every water tile has a depth band at low and at high water; no required route crosses deep water; every deep tile a person can enter is marked as swimming water; in the opening, Hild's spot on Wreck Strand is knee to waist deep and reachable from dry shingle without a swim.
- The mainland: every area and link is reachable under its stated season, tide and block conditions, and closed when they say so (the landslide, the ford in spate, the Black Wood heart before leave, the Drowned Trackway out of season, the snow on the climb); each link's walk matches Book 10 section 14 within its stated tolerance; the seven coastal areas, and only they, have sea-map landings.
- Dungeons: each passes reachability with its traps armed; every trap's sign is in view on the approach before its trigger; every guardian room has a way out.
- Density: walking every route at walking speed, the gap between stopping points stays within Book 10 section 20; every area and zone has at least one secret or small puzzle; every climb and swim has a rest point within a full stamina bar (Book 10 section 06).
