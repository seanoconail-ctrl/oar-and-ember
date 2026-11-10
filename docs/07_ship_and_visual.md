# Oar and Ember, Book 07: Ship and Visual Reference Guide

*Vessel progression, customisation, settlement appearance and pixel-art rules.*

The ship and the steading are the two places the player looks at most. Both should visibly carry every decision the player has made: patched planks, a chosen sail, a smoke-house that was not there last winter.

**How to use:** This book owns art detail and ship appearance. Final art is authored by Claude to these rules (section 11). Book 1's pixel-art contract is locked and overrides this book. Book 2 owns the manifest format and data types; Book 10 owns every number, including the ship statistics repeated here for reference.

_Specification. Dimensions and statistics are starting values for balancing. Historical ship types are used loosely for flavour and are not claims of archaeological accuracy._


## 01 / Art baseline
*A single coherent pixel scale for every asset. No mixing of old canvases with new ones.*

| Item | Specification |
|---|---|
| Renderer | WebGL2, nearest-neighbour textures, no filtering or mipmaps on pixel art |
| Logical viewport | 640 x 360 logical pixels; integer scaling to the screen; letterbox, never stretch |
| World tile | 24 x 24 logical pixels; about 1.4 m in world terms |
| Adult sprite | 32 x 40 canvas, about 18 x 30 occupied, foot anchor at bottom centre |
| Sampling | Nearest-neighbour; all positions snapped to whole logical pixels at draw time |
| Depth | Sort by foot anchor Y; tall objects provide an occlusion line and a cutaway or fade |
| Facings | Four authored facings for people; armed sprites are never mirrored |
| UI text | May render on an accessible overlay at native resolution, never blurred into the pixel layer |
| Sea map | Separate 16 x 16 tile set with ship tokens; never shown at the local-scene scale |

> Figure: the adult sprite canvas (drawn in the PDF version of this book).

### Animation targets
Idle 4 frames, walk 8 (a grounded cycle: contact, down, passing, up, for each foot), run 8, sneak 6, light attacks 5 to 7 each with a clear tell frame, charge hold 4 (looping, with a glint at level 1 and a stronger flash at level 2), heavy release 6, parry 3, riposte 5, block 3, guard broken 3, stagger 3, dodge 4, shove 4, hurt 2, finisher 8, carry walk 6, row 4, downed 2, surrendered 2, and a work loop of 4 to 8 frames for every homestead task. Fewer readable frames are acceptable in early stages if the tell, active and recovery frames are distinct. Animation events (hit start, hit end, footstep, oar catch) live in the manifest and must agree with collision and damage timing.

## 02 / Vessel progression
*One ship that grows: a repaired coastal boat, a karvi, then a choice between a war hull and a cargo hull. A second vessel can be owned from Chapter 6 but is managed only on the sea map.*

> Figure: hulls drawn to scale on a tile grid (drawn in the PDF version of this book).

| Tier | Length | Tiles | Oars | Berths | Rowing crew | Cargo | Draft | Sea | Oar / Sail |
|---|---|---|---|---|---|---|---|---|---|
| T1 Coastal boat | 9 to 10 m | 7 x 2 | 6 | 8 | 4 | 4 | Shallow | 2 | 2 / 3 |
| T2 Karvi | 16 m | 12 x 3 | 16 | 18 | 10 | 10 | Shallow | 3 | 3 / 4 |
| T3a Snekkja | 24 m | 18 x 3 | 26 | 30 | 16 | 8 | Medium | 3 | 5 / 4 |
| T3b Knarr | 17 m | 13 x 4 | 4 | 10 | 4 | 24 | Deep | 5 | 1 / 4 |

**Sea** is seaworthiness from 1 to 5. **Oar / Sail** are relative speeds from 1 to 5. **Rowing crew** is the minimum to row at full speed; fewer rowers reduce oar speed proportionally. Berths beyond the household's residents are filled by hired oarsmen or allied warriors, who do not count against the roster of sixteen.

### How hulls are acquired
| Hull | Ways to get it | Chapter |
|---|---|---|
| T1 Coastal boat | Repaired on Wreck Strand | 1 |
| T2 Karvi | Bought from Gunnhild's yard; captured from a rival; or built in the Skarvholm boatshed over winter (timber, iron, Runa) | 3 to 4 |
| T3a Snekkja or T3b Knarr | Commissioned at Saltvik; captured from Orm's fleet; or built on the mainland | 5 to 7 |
| Consort | A second T2 or T3b, owned and crewed but sailed only on the sea map | 6 onwards |

### Continuity: what transfers to a new hull
The **name**, **sail mark**, **stem and stern carvings**, **trophies**, the **ship's history log** and up to two **fittings** carry over. The old hull can be sold, kept as the consort, broken for timber, or given to an ally as a gift. The crew should feel they moved house, not bought a different ship.

### The ship's history log
Every notable event is recorded against the ship: launches, raids, battles survived, storms ridden, famous passengers, damage taken and repaired. The log feeds dialogue ("the boat that came back from the Cauldron"), harbour reactions and the endings.

## 03 / Fittings and customisation
*Every fitting is a trade-off with a visible change on the hull. A good ship reflects a plan, not a shopping list.*

### Slots
T1 has three slots (bow, midship, stern). T2 has five (bow, two midship, stern, rig). T3 hulls have six. Hull modifications (draft, strength) are refits that use no slot but take days in a boatshed and materials.

| Fitting | Slot | Benefit | Drawback | On the sprite |
|---|---|---|---|---|
| Extended hold | Midship | +2 cargo (+1 on T1) | Oar speed -1; rowing crew +1 | Hides and sacks under lashings |
| Raised bow platform | Bow | Better boarding defence; archers gain range | Cargo -1 | Timber platform at the bow |
| Shield rack | Gunwale (free on T2+) | Missile cover when shields are up; intimidation | Reveals identity; shields can be lost | Shields along the gunwale |
| Grapnels and boarding planks | Stern | Faster, safer boarding | Cargo -1 | Coiled lines, a plank lashed aft |
| Awning and stores | Midship | +4 days of stores; rest at sea heals light wounds | Cargo -1 | Wadmal awning on spars |
| Bailing station | Midship | Storm and hull damage reduced | Cargo -1 | Buckets, a bailing well |
| Towing gear | Stern | Tow a captured boat for extra cargo | Speed -1 while towing | Tow line and bollard |
| Better sail and rigging | Rig | Sail speed +1; better against the wind | Needs a skilled shipwright to maintain | Brighter cloth, more lines |
| Carved beast-head | Bow (identity) | Intimidation bonus | Must be unshipped at friendly shores or land-spirits and locals take offence | A carved head on the stem |
| Gilt weather-vane | Mast (identity) | Trade prestige; wind forecast improves | Costly; very recognisable | A gilt vane catching light |

### Hull refits
| Refit | Benefit | Cost |
|---|---|---|
| Shallow draft | Loch, river and shallow landings | Seaworthiness -1; capacity -1 |
| Doubled strakes | Hull integrity +30% | Oar speed -1; timber and iron |
| Re-caulking | Removes accumulated leaks | Tar, moss and two days |

### Maintenance
Fittings and hulls wear. A shipwright resident keeps them in order as delegated work; without one, wear accumulates and is explained in the report ("the rigging is fraying; Runa could fix it in a day"). Nothing breaks without warning.

## 04 / Identity and cosmetics
*How the coast recognises the household, and how the player chooses to be recognised.*

### Sail marks
Sails are woven in panels and can be dyed. Patterns: plain undyed wool, broad stripes, narrow stripes, lozenge checks, quartered, or a single device (raven, serpent, wave, cross, sun-wheel). Dyes are madder red, woad blue, weld yellow and undyed. Changing a sail takes cloth, dye and time at a yard.
| Example | Owner | What it says |
|---|---|---|
| Black with a raven | Ulf Hrafnsson | Raiders; expect killing |
| Grey, plain | Orm's fleet | The Sea King's tribute ships |
| Red and white stripes | Saltvik traders | Merchants; usually peaceful |
| Undyed with a blue cross | Kilbrecc's boats | Church; sanctuary claimed |
| Player's choice | The household | Chosen at the launch in Chapter 1 |

### Shields, carvings and trophies
Shield colours come in sets of two or three. Stem and stern carvings range from a plain curl to a beast-head. Trophies are earned and displayed: a captured enemy vane, a Glen Arra cattle bell, a piece of the lyngbakr's heather, the Ferryman's lamp-hook. Each trophy has an entry in the history log.

### Damage and repair
Damage shows as splintered strakes, torn sail panels and missing shields. Repairs leave visible patches in newer timber and cloth for the rest of the hull's life. A ship that has been through a lot should look like it.

### Identification
Recognition depends on what a witness could see: sail and device from far away, shields and carvings closer, faces and voices ashore. Repainting or changing a sail lowers identification on future deeds, not past ones, and costs some reputation with those who knew the old mark.

## 05 / Ship sprites and states
*Ships in local scenes are walkable places built from modular segments, drawn at true tile length.*

### Construction
Hulls are built from segments: **bow**, a repeatable **midship** segment (one per three to four tiles of length) and **stern**. The deck is a walkable layer with benches, mast step, cargo spaces and gunwale. Each tier has its own segment set; segments are never stretched.

### States
| System | States |
|---|---|
| Sail | Furled, half, full, reefed, torn, struck |
| Oars | Shipped, out, stroke (4 frames), backing, tangled |
| Hull | Sound, damaged (three visible levels), holed, beached, sinking |
| Loading | Each cargo lot shown as a sack, barrel, bale, chest or pen in its slot |
| Crew | Rowing, idle, bailing, shields up, boarding, wounded resting |
| Identity | Sail mark, shields, carvings, vane, trophies |

### Beaching, launching and boarding
Beaching shows the hull tilting onto shingle; launching shows the crew pushing and climbing aboard, part of the extraction in raids. Boarding planks and grapnel lines are drawn objects with collision. When two ships are lashed, their decks form one walkable area with a readable gap.

### Sea-map tokens
Each tier has a 16 x 16 or 24 x 16 token with eight headings, a sail-state frame, a wake and the household's sail colour. Fog dims tokens; unknown ships show a neutral sail until identified.

## 06 / Settlement appearance
*The steading and the mainland home are the player's progress made visible. Each culture builds differently, and those differences should read at a glance.*

### Skarvholm stages
| Stage | Appearance |
|---|---|
| S0 Wreck camp | A fire on the shingle, a lean-to from the torn sail, salvage in heaps above the tide line |
| S1 Broch shelter | Sail roof stretched across the broch's interior, hearth smoke, drying lines, a driftwood door |
| S2 Steading | A turf-walled longhouse with curved sides, a naust boatshed, fish racks, a small forge, a byre, the residents' shrine |
| S3 Prosperous | Carved door posts, a smoke-house, a second house, the watch cairn on Rook Hill, coloured cloth, benches outside |
| S4 Failing | Salt rime on the Kelda stones, a slumped landing, water standing in the field, emptied racks |
| S5 Outpost | One house and the watch cairn kept, or a respectful ruin with a marker for the dead |
| S6 Occupied | Late game: a stake palisade round the broch, grey banners, the burned boatshed, the longhouse as a barracks, beaches drowned to tidal flats, salt rime on the Kelda, sea-light at the cairn dig |

### Mainland home stages
| Stage | Appearance |
|---|---|
| M0 Camp | Tents and stacked timber inside a marked line; the ship drawn up on the strand |
| M1 Hall | A longhouse and boatshed; first fields; fences |
| M2 Defended home | Ditch, palisade, gate, watch platform, a landing jetty |
| M3 United home | A hall with guest benches for allies, a shared shrine with more than one sign of faith, a market strand |

### Architectural languages
| Culture or place | Buildings | Read at a glance by |
|---|---|---|
| Gaelic farms and ringforts | Roundhouses with conical thatch inside an earthen bank and ditch; a royal rath on a crag at Dún Fiach | Circles: round walls, round enclosures |
| Kilbrecc monastery | A tall round tower, a small stone church, a high cross, an enclosure wall, a guesthouse | The tower's silhouette |
| Norse households | Long rectangular houses with curved walls and turf or thatch roofs; boatsheds | Long low lines and boat shapes |
| Saltvik | Rectangular post-and-wattle houses in plots, plank walkways, jetties, a yard with hulls on stocks | Density and timber walkways |
| Glen Arra | Mixed: longhouses and shielings, cattle folds, a smithy with a cross and a hammer on the lintel | Cattle and mixed signs |
| Inis Rón | Low stone cells, seal rocks, carved standing stones, kelp drying | Seals and stone |
| Kaldness | A stockaded hall above a crowded harbour of grey sails | Grey sails, high timber walls |

### Designation and construction
A designated building appears as a dithered blueprint in undyed tones; cells that break a placement rule tint red with the reason shown in text. Construction has three visible stages (marked out, framed, finished) with material piles beside the plot. Residents use task-specific work animations at each station, so the player can watch a roof go on or a keel being shaped.

### Interiors
Buildings use roof cutaways or fades when the player enters. Hearths are the warm centre of every interior. A prosperous home shows hangings, carved benches, chests and clutter; a struggling one shows bare benches and cold corners.

## 07 / People sprites
*People are distinguished by silhouette, clothing and carried tools, not by colour alone.*

### Cultural silhouettes
| Group | Typical clothing and gear |
|---|---|
| Norse household | Knee-length tunic, trousers with wrap leg-bindings, cloak pinned at the shoulder, round shield, spear or axe; leaders may have mail and a plain rounded helmet |
| Gaelic farmers and warriors | Long linen tunic, a heavy rectangular cloak with a brooch, spears and small shields; riders on small horses |
| Monks | Undyed habits, the Insular tonsure shaved at the front of the head, satchels and staffs |
| Norse-Gaelic people | Mixed: Gaelic cloaks over Norse tunics, Norse brooches on Gaelic dress, both kinds of weapon |
| Keepers of Inis Rón | Seal-skin cloaks, bone and shell ornaments, bare feet on stone |
| Orm's men | Grey cloaks, more mail and helmets than anyone else, disciplined spacing |

### The steerer's body models
Two body models, A and B, offered side by side without labels. Both share the full animation set, every clothing, hair and gear option, and the same collision footprint. Nothing in art or text names a gender.

### Rules
- No horned helmets. No generic fantasy plate. No modern props.
- Residents differ by silhouette, hair, clothing and the tool they carry (Runa's adze, Bran's ladle, Áine's bow).
- Faction markers use shape and clothing as well as colour.
- Ally, enemy, surrendered and downed actors are distinguishable without relying on colour: surrendered actors kneel with empty hands; downed actors lie flat; enemies carry their weapon on the far side; allies show a small shape-coded marker when selected.
- Readable at 1x and 2x scale.

## 08 / Palette, light and weather
*Grey-green sea, heather and machair, weathered timber, warm hearths, and restrained colour in cloth.*

> Figure: the colour palette (drawn in the PDF version of this book).

### Light
Day is cool and clear; first and last light are a grey half-light, a little warm, and low sun casts long shadows; night uses lantern and hearth pools with the rest of the scene readable in blue shadow (the full grade is in section 14). Fire and hearth are the warmest colours in the game. Reserved accents (sea-light, sídhe glamour, corpse-light, danger tell) never appear in ordinary scenery.

### Weather
Rain is a light overlay that never hides an actionable threat. Fog uses layered dithering and reduces sight ranges in the simulation, not only visually. Storm scenes add spray, tilt the horizon a pixel or two and darken the palette, but threats and the ship's edge remain readable.

## 09 / Supernatural visual language
*The supernatural begins as one wrong detail. Only important phenomena earn strong luminous colour.*

| Power | First wrong detail | Full manifestation |
|---|---|---|
| Rán | Ripples moving against the current | Pale green sea-light below the surface; nets of light; the drowned standing in the shallows |
| Manannán | Fog moving against the wind | A grey-cloaked figure in a small boat; foam shaped like horses |
| The Cailleach | Frost on one stone only | A hag-shaped cloud over the Cauldron; hail out of season |
| The Blue Men | Blue shapes in the wave troughs | Blue-skinned figures riding the swell, speaking verse |
| Aos sí and landvættir | Flowers out of season; shadows falling the wrong way | Tall figures at the edge of light, too still |
| Draugr | Wet footprints with no one there | Dripping figures hung with weed, colder palette, no gore |
| Fetch and fylgja | A resident's double one step behind them, slightly desaturated | An animal that follows one person and no one else |
| Washer at the ford | A woman kneeling at a stream at dawn | Shirts in her hands that belong to named residents |
| Each-uisce | A fine horse standing in the shallows, mane wet | Weed in the mane; it walks into deep water |
| Lyngbakr | An island with no birds and no surf | The "island" tilting and sliding under |
| The Long Swimmer | A wake behind the ship with nothing making it | A long back breaking the surface far off |
| The Door of Three Truths | Carvings that seem to listen; dust that settles when someone lies | A seam of pale light opening down the stone |
| Manannán's Cup | A plain grey cup that holds no reflection | Mist rising from it; the sea-light around it dims |

Supernatural actors still obey collision, visibility and attack timing unless a specific signalled ability says otherwise.

## 10 / Interface and sea map style
*The interface should feel like wood, cloth and carved bone, and stay easy to read.*

- Panels use simple framed borders in timber and wool colours; text sits on calm backgrounds with high contrast.
- The sea map shows coasts, known routes, wind and tide indicators, fog, known threats and the household's token. Unknown places show as coastline only until discovered.
- Icons are shape-coded (a wave for tide, an arrow for wind, a sail for ships, a cross, hammer or stone for sacred places).
- Text size is adjustable; all speech is subtitled; colour-blind presets swap reserved accents without changing shape cues.
- The steward's morning report and the post-raid summary use plain sentences, not percentages.

## 11 / Asset manifest, naming and art QA
*Every asset is listed in a manifest with its frames, pivot, footprint and events. Book 2 owns the schema.*

### Naming
| Asset type | Pattern | Example |
|---|---|---|
| Person | `actor_<id>_<state>_<facing>` | `actor_c_hild_walk_s` |
| Ship segment | `ship_<tier>_<part>_<state>` | `ship_t2_mid_damaged2` |
| Ship token | `token_<tier>_<heading>_<sail>` | `token_t1_ne_full` |
| Tile | `tile_<biome>_<variant>` | `tile_machair_03` |
| Building | `bld_<culture>_<type>_<stage>` | `bld_norse_longhouse_s3` |
| Effect | `fx_<power>_<name>`, or `fx_<place>` for a place's particles and prints | `fx_ran_sealight`, `fx_strand` |
| Animal | `actor_<animal>` | `actor_gull` |
| Plant | `plant_<place>` (states `<kind><variant>`, frames lean -3 to +3) | `plant_strand` |
| Decoration | `decal_<place>` or `decal_<name>_<variant>` | `decal_strand`, `decal_blood_01` |
| Prop | `prop_<name>` | `prop_boulder` |

### The art pipeline: authored by Claude
- **Palette file:** the Book 7 palette plus blood reds, as indexed colours; sources may use only these indices.
- **Sources:** one text file per sheet: frame size, frame list, and each frame as rows of single-character palette codes, with pivot, footprint and animation events. Deterministic generator scripts are allowed for tiles and variations and are committed with their output.
- **Style rules:** one-pixel ink outline on characters and props (not on terrain); light from the upper left; three tones per material (shadow, base, highlight) chosen from the hue-shifted ramps of section 14, plus a fourth for metal glints; ordered dithering only for fog, mist, gradients in sky and water, and sand drying after the water.
- **Compile and check:** the art compiler packs atlases and manifests. Claude renders every new or changed sheet at 1x and 4x, inspects the images against these rules, and records the check in the stage report.
- **Review:** the user reviews art at each build gate; changes requested there are logged and applied before the next gate.

### Placeholder rules for LLM-built stages
- Never replace missing art with permanent circles, boxes or emoji.
- Temporary silhouettes are allowed only with `placeholder: true` in the manifest and a line in the stage report.
- Placeholders are replaced before the art gate in Book 3.

### Art QA checklist
- All sprites snap to whole logical pixels at 1x, 2x and 3x scale.
- Foot anchors and collision footprints agree; no sliding feet.
- Attack tells precede active frames by at least 6 ticks at normal combat speed.
- Ally, enemy, surrendered and downed actors are distinguishable in greyscale.
- Night, fog and rain never hide an actionable threat.
- Ship states are complete for every tier in use; no stretched segments.
- Every reserved accent appears only where this book allows it.
- The place meets the terrain art standard (section 14), and its capture has been compared with the reference.

## 12 / Blood and gore
*The game is for adults. Violence should look costly and ugly, drawn in the same pixel language as everything else.*

### Elements
| Element | Specification |
|---|---|
| Blood palette | Fresh `#B32424`, dark `#8E1B1B`, dried `#5A0F12`, highlight `#D9483B` |
| Hit spray | 4 to 10 particles of 1 to 2 px, direction from the blow, heavier for heavy and riposte hits |
| Decals | Drops, pools under the downed and dead, smears and drag trails when bodies or wounded are carried |
| Bloodied state | Overlay on actors below half vitality; clothing darkens at the wound side |
| Dismemberment | Separate pieces (arm, leg, head) for killing blows from heavy cutting weapons; pieces bounce once and settle; the body uses a matching corpse pose |
| Corpses | A corpse pose per facing for each body type and animal; corpses persist for the scene and, at home, until buried or burned |
| Animals | Wolves, boar, cattle, sheep and seals bleed and leave carcasses that can be butchered |

### The gore setting
**Full:** everything above. **Low:** no dismemberment, fewer and darker decals, corpses fade after a minute. **Off:** no blood, hit flashes only, corpses fade. The setting changes presentation only; deeds and consequences are identical.

### Restraint where it matters
Gore serves weight, not spectacle. There are no slow-motion kill cameras and no rewards for gore. Children never appear as actors, so they never appear in violence.

## 13 / Wilderness and exploration art
*On-foot exploration needs varied, readable ground that changes with the seasons.*

### Tile sets
| Set | Contents |
|---|---|
| Island coast | Shingle, sand, tidal flats with wet sheen, skerries, kelp, cliffs with climbable ledges, sea caves with tide marks |
| Machair and moor | Machair grass and flowers, heather, bracken, peat banks and cuttings, bog pools, plank roads |
| Woodland | Oakwood and pinewood floors, trunks with occlusion, undergrowth that hides sneaking actors, clearings |
| Upland | Corrie walls, scree, high pasture, shieling huts, summit cairns |
| Waters | Lake shore, river fords, holy well, salt pans |
| Sites | Stone rings, burial mounds, ringfort banks, souterrain and cairn interiors, the hermit's cell |

### Seasons and weather
Every outdoor set has four seasonal variants: spring green with flowers, summer full and dry, autumn bracken-brown with fallen leaves, winter frost, snow patches and ice on bog pools. Weather overlays (rain, fog, snow) follow Book 7 section 08 and never hide an actionable threat.

### Interactive and puzzle objects
Anything the player can climb, pull, light, read, align or take has a consistent one-pixel highlight edge when in range. Hand-holds on climbable cliffs are drawn, not implied. Puzzle objects show their state visually (a stone's shadow, a water line, an unlit brazier).

### Wildlife
Wolf, boar, red deer, hare, seal, otter, gulls, cormorants, a sea eagle, sheep and small black cattle, each with four facings and the states they need (walk, run, attack or flee, eat, sleep, dead).

## 14 / Terrain art standard
*The approved look of every place the player walks (art-direction pass, 2026-11-10). It is permanent: every stage that adds or changes something visible meets it, and is not done until it does (CLAUDE.md).*

The standard was set by mockups the user approved; they are the reference every capture is compared with:

| Reference | What it shows |
|---|---|
| [`wreck-strand-target.png`](art/reference/wreck-strand-target.png), [`.gif`](art/reference/wreck-strand-target.gif) | Wreck Strand, grey and windswept, late afternoon: a 6.4-second loop |
| [`kelda-summer-target.png`](art/reference/kelda-summer-target.png), [`.gif`](art/reference/kelda-summer-target.gif) | The Kelda spring and the machair in summer: a 6.4-second loop |
| [`target-walk.mp4`](art/reference/target-walk.mp4) | Ten seconds of the steerer walking the waterline, climbing the cut and crossing the machair |
| [`palette-proposed.png`](art/reference/palette-proposed.png) | The palette: 37 hue-shifted ramps, 226 colours (in `assets/palette/book07.json`) |
| [`current-walk.mp4`](art/reference/current-walk.mp4) | The Stage 6 build before the pass, for contrast: what the standard replaced |

The mockups' sources and their notes are in `docs/art/` (`README.md`, `mockup-src/`). The tone is a darker North Atlantic: grey-green sea, cool sand, wet stone, weathered timber; warmth comes from fire, low sun and cloth, never from the whole scene.

### Palette
- Colours come from named, hue-shifted ramps (shadows cooler and bluer, highlights warmer), five to eleven steps each: sea, sky, wet and dry sand, two stones, grass, moss, marram, fern, bracken, kelp, driftwood, tar, earth, fire, smoke, flowers, skins, hair, dyes, wool and the animals. Sources name a ramp and a step (`material.X: <ramp> <shadow> <base> <highlight>`), not a raw colour.
- Shadows are cool blue-violet and never black. Ink outlines use the ink ramp.

### Terrain
- **Organic transitions.** Ground is drawn on a dual grid: each visual tile sits half a tile off the world grid, so its four corners are four world tiles, and inside it each pixel takes the highest terrain whose blended coverage, plus world-periodic noise, passes one half. No boundary follows a tile edge; no boundary runs straight for more than two thirds of a tile (16 px). Collision still uses the world tiles.
- **Variants.** Every terrain that covers ground has at least 8 distinct plain tiles (the noise pattern repeats every 5 tiles, so up to 25), with tonal clusters and calm patches, never an even speckle.
- **Edges carry detail:** the grass lip and its dark undercut over a bank; strata, ledges and a shadowed foot on a bank face; a damp line where dry sand meets the foreshore; wet, weedy, barnacled rock bases; a textured sea bed visible through the shallows.
- **Height.** Banks and cliffs have a face with ledges and a shadow at their foot, broken by cuts where paths climb.
- **Rocks** have dark wet bases, hanging weed, barnacles, lichen on lit faces, and smaller stones round them.

### Decoration
- A decoration layer over the ground: pebble clusters with calm sand between, shells, a wrack line of kelp and twigs along the top of the tide, driftwood and debris, worn footpaths through the grass, stones in the turf.
- Plants are sprites that move: grass sward, tussocks, marram on the dunes, thrift on the bank's lip, clover and trefoil in drifts. Grass carries at least 6 plants a tile on average and no two-by-two block of grass is bare (at least 3 plants or decals).
- Open ground is broken up with paths, rocks, bushes (heather), walls and bogs where the place has them.

### Animation and movement
- **Motion with the camera still:** at least 80% of the screen keeps moving, measured as the mockups were (20 x 20 pixel cells; a cell counts if at least 2% of its pixels change visibly between at least a quarter of consecutive frames). The approved strand mockup measures 89.2% with its cloud shadows frozen and 100% with them. Solid things (a wall, a boulder's crown, a bank face) may be still; nothing else.
- **People** walk at the Book 10 walk speed (2.0 tiles a second) with a grounded 8-frame cycle whose planted foot keeps pace with the ground: no sliding, no floating. Runs bounce; carrying is heavier.
- **Idles:** a breath, a weight shift, looking round after a few seconds still, bracing and holding the cloak in a strong gust.
- **Secondary motion** on hair, cloaks and bags (the cloak flutters in the wind).
- **Footfalls** leave prints in sand (wet prints hold water and are taken by the tide; dry ones fade), raise dust when running on dry ground, splash and ripple in water, part the grass round the legs, and sound by surface (sand, wet sand, shingle, grass, rock, water).
- **Residents are shown at their tasks**, never standing idle in a row (from the first stage that has residents).

### Wind
- One wind per place drives everything. Gusts travel downwind across the ground as bands broken into patches; every plant leans with the steady wind, eases into each gust, and sways on its own phase so neighbours never move in step; flowers bob.
- The same wind bends smoke, drifts dry sand along the beach in streamers, slants rain, lifts cloaks and flogs loose cloth, and runs a faint sheen over grass in each gust.

### Water
- Colour darkens from pale shallows over the sand to the deep, in ordered-dithered palette steps; broad swells lie in bands parallel to the shore and roll in, breaking into white lines in a surf zone.
- Foam runs up the beach with each wave and back; the sand behind it is dark and sheened, then dries in steps; above the reach of the waves, sand wet from the tide dries over a few minutes.
- The tide rises and falls as the calendar says; what is drawn never disagrees with where the simulation lets the player walk (the flats are always under water while the tidal ground is closed).
- Kelp sways under the surface; glints flicker on crests in sunlight; spray bursts where waves meet rock; ripples ring anyone standing in water.
- Streams flow (streaks drifting downstream), foam along their banks and at narrows; springs bubble.

### Life
- Every outdoor place has animals going about their lives: here gulls wheeling with their shadows on the ground, a gull standing and turning its head, a cormorant drying its wings, a seal lifting its head, crabs scuttling; midges in still air by water. Elsewhere sheep, cattle, insects and birds as Book 7 section 13 lists. Wildlife is visual unless a stage makes it more.

### Light
- A grade by time of day and weather: cool clear days; first and last light a grey half-light, a little warm; low sun warms the light and cools the shadows; night readable in blue shadow with lantern and hearth pools.
- Every character, creature and prop has a soft contact shadow; when the sun is up its silhouette also casts a long shadow away from the sun, longest when it is low. Flying creatures cast their shadow on the ground below them.
- Cloud shadows drift across land and sea with the wind; shafts of light fall through broken cloud when the sun is low; fire and lanterns flicker and throw light pools; lightning flashes in storms; fog and mist drift in layers.

### Camera feel
- The camera follows smoothly with a look-ahead in the direction of travel, and moves with the steerer by whole pixels so nothing jitters. Hits shake it briefly.

### Accessibility
- **Reduced motion** (from the system's preference, `?motion=reduced`, or the system menu): no camera shake or flashes, calmer plant sway, half the blown sand and insects. The world still moves (at least 50% of cells with the camera still).

### Engineering limits
- Visual only: the renderer, shaders and visual state never change the simulation, and use no `Math.random`.
- Within the Book 2 frame budget: building a frame's scene and draw list under 4 ms in the test runner; the script's share of a browser frame under 5.5 ms.
- 640 x 360 logical pixels, 24-pixel tiles and 32 x 40 people are unchanged.
- On a machine too slow for the full effects (frames slower than ten a second), the effects step down to lite and then low detail so the game stays playable; the standard is judged at full detail, and low detail with reduced motion still keeps half the screen moving.

### How the standard is enforced
- **Art lint** (`npm run lint`, so every build and CI) fails if an actor or prop sheet has no `shadow:` header, a zone has a terrain boundary straight for more than 16 px, a terrain has fewer than 8 plain tile variants, or grass is under-decorated (`src/tools/art/standard.ts`).
- **Tests:** `tests/unit/standard.test.ts` checks shadows under everything drawn, transitions, variants, density and the frame budget; `tests/browser/standard.spec.ts` measures motion with the camera still, with and without reduced motion, and the script time per frame.
- **Captures:** `npm run capture -- stage-NN` writes `docs/art/captures/stage-NN/` (a still at 1x and 2x, a 10-second walk at 25 fps, the reference beside the capture, a motion map and the figures). Each stage report compares the capture with `docs/art/reference/`.
- **New places** start with a mockup the user approves before they are built (Book 3).
