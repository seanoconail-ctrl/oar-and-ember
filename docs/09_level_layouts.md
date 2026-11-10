# Oar and Ember, Book 09: Level Layouts

*Tile-level plans for Skarvholm, the steading, Carrick Landing, the occupied island and the Hollow Cairn, with routes, sightlines and landing points.*

These plans are the ground truth for the first builds and the late-game return. Each one exists twice: as a drawing for people and as a character grid that an LLM can transcribe directly into tilemap data.

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

### Transcribing a grid
Each character is one tile (or one block in island grids). The legend under each drawing maps characters to terrain. Collision comes from terrain: cliff, rock, walls and deep water block movement; dunes, scrub and woodland allow movement and hide sneaking actors. Buildings are solid except at the doors listed in each section. Height: headlands and hills (`^`) give observers the Book 10 height bonus, but no observer sees down past a cliff edge unless standing at it.

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
| `ZONE_SK_STRAND` | (8 to 30, 22 to 31) | Shingle ribbon with tidal flats below; the wreck on the skerry at (14, 29) reachable on foot at low tide; driftwood spawns along the high-tide line after storms |
| `ZONE_SK_MACHAIR` | (12 to 30, 17 to 24) | The steading plan (section 05) sits at blocks (14 to 21, 19 to 23); plots at (20 to 25, 21 to 22) |
| `ZONE_SK_KELDA` | (17 to 21, 17 to 21) | Spring pool at (19, 19); stream south to the strand |
| `ZONE_SK_ROOK` | (16 to 28, 6 to 14) | Summit at (22, 9); heather slopes; the watch cairn plot |
| `ZONE_SK_BOG` | (27 to 37, 11 to 17) | Peat banks give cover to sneaking actors; soft ground slows movement in rain; the old offering lies near (34, 13) |
| `ZONE_SK_GREYMEN` | (25 to 29, 12 to 16) | Nine stones round (27, 14); the sunrise alignment points east-north-east |
| `ZONE_SK_CAIRN` | (29 to 33, 18 to 23) | Mound at (31, 20) with its sealed east door; sheepfold at (28, 22) |
| `ZONE_SK_CLIFFS` | (5 to 40, 3 to 9) | Climbing routes marked with hand-holds; eggs on ledges in spring; eagle stack offshore at (3, 12) |
| `ZONE_SK_GEO` | (9 to 14, 2 to 10) | The narrow geo, a steep path up to the hermit's cell at (11, 8) |
| `ZONE_SK_SEALCAVE` | (38 to 44, 5 to 12) | Cave mouth at (41, 9); a tidal back passage runs south-west under the bog to the cairn |
| `ZONE_SK_HAGSEAT` | (2 to 9, 15 to 21) | The stone at (5, 18); kelp below; the windiest place on the island |
| `ZONE_SK_NAUST` | (30 to 43, 23 to 30) | Cove beach, boatshed plot, causeway to the Skerry |

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
- Every beach is now tidal flat, under water at high tide. The wreck still shows at low water.
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

## 10 / Layout tests
- Reachability: every landing, objective and exit is reachable under its stated tide condition, for Skarvholm, the steading, Carrick, the occupied island and the cairn.
- Sightline tests: scripted observers at each post see exactly the zones listed, and none of the dead zones.
- Timing tests: carry routes and runner routes match section 07 within 5% at Book 10 speeds.
- Placement tests: every suggested plot passes the Book 2 placement rules.
- The occupied island: approach B is impassable outside spring low tides; approach A is impossible without dealing with the cell sentry or slipping past him in fog.
