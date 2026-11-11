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
| World tile | 24 x 24 logical pixels; about 1.4 m for ground, buildings' footprints and hulls; things people use are drawn at people scale (below) |
| Adult sprite | 32 x 48 canvas; adults about 40 px tall (about 1.7 tiles), about 18 x 40 occupied (the heavy build up to about 4 px wider, section 16); foot anchor at bottom centre |
| People layers | Body, clothing, cloak, helmet, armour, shield and weapon as layered sheets sharing the body's frames, fitted to each body build (sections 07 and 16) |
| Ground shadow | A soft, semi-transparent oval under every person, animal and prop (section 14) |
| Sampling | Nearest-neighbour; all positions snapped to whole logical pixels at draw time |
| Depth | Sort by foot anchor Y; tall objects provide an occlusion line and a cutaway or fade |
| Facings | Four authored facings for people; armed sprites are never mirrored |
| UI text | May render on an accessible overlay at native resolution, never blurred into the pixel layer |
| Sea map | Separate 16 x 16 tile set with ship tokens; never shown at the local-scene scale |

> Figure: the adult sprite canvas (drawn in the PDF version of this book).

### Animation targets
Idle 4 frames (breathing), with weight-shift and glance idles of 4 and a gust idle of 4 (section 14); walk 6 (right contact, right down, passing, left contact, left down, passing: the torso and head drop exactly 1 px on the two down frames, 1 to 2 px for the heavy build, and the arms swing well forward and back to show weight); run 8 (contact, down, passing, suspension for each leg, as section 17 sets out), with a run start of 1 (the lean into the start) and a run stop of 2 (the skid and settle); sneak 6; light attacks 5 to 7 each with a clear tell frame; charge hold 4 (looping, with a glint at level 1 and a stronger flash at level 2); heavy release 6; parry 3; riposte 5; block 3; guard broken 3; stagger 3; dodge 4; shove 4; hurt 2; finisher 8; carry walk 6 (its own heavy gait, also used for carrying a downed ally); row 4; downed 2; surrendered 2; and a work loop of 4 to 8 frames for every homestead task (section 07). Starting targets for the other movement verbs: draw and loose (bow, thrown spear) 4, drawn standing still with no walking variant (section 18), climb 4, slide 2, swim 6, sink 2 (laboured), jump 4, crawl 4, push and pull 4; wading uses the walk with a heavier stride under the water mask. Every body build (the steerer's models A and B, each resident's own body and the heavy build) has the same states, facings, frame counts and timing, so all animation logic is shared (section 16). Fewer readable frames are acceptable in early stages if the tell, active and recovery frames are distinct. Animation events (hit start, hit end, footstep, oar catch, splash) live in the manifest and must agree with collision and damage timing.

### Scale
People are drawn a little larger than the ground's metres, and everything people sit on, walk through, hold or carry is drawn to the 40 px adult, not to the tile. At people scale a metre is about 23 px, close to one tile. Ground, building footprints and hull lengths keep their tile sizes (Book 10 owns the hull tiles); doors, furniture, tools, loads and ship benches follow this table.

| Thing | Rule against the 40 px adult |
|---|---|
| Adult | 40 px from sole to crown, about 18 px across the shoulders; 8 px of canvas above the head for hair, helmets and raised arms |
| Doorway | Clear opening at least 46 px tall (head room over the adult) and at least 20 px wide; a door leaf fills it. Only souterrain passages and the meanest huts are lower, and people duck through them in a crawl or stoop |
| Eaves | The lowest eave edge at least 44 px above the ground at a door and along any path, so heads clear it |
| Bed and box bed | 2 tiles long and 1 tile wide (a lying adult with room); platform top 8 to 10 px above the floor |
| Bench and stool | Seat 10 to 12 px above the floor (knee height); a seated adult is about 30 px tall; benches 1 tile deep |
| Table and workstation | Working surface 17 to 21 px (about the hip): workbench, quern table, cutting board, net frame |
| Anvil and forge | Anvil face on its block 14 to 16 px; forge hearth lip 16 to 20 px |
| Loom | Warp-weighted loom uprights 46 to 52 px, leaning against the wall |
| Hand tools | Hammer and ladle 8 to 12 px; axe, adze and sickle 12 to 18 px; spade and peat iron 24 to 28 px; scythe and hay rake 32 to 38 px |
| Weapons | Seax 8 to 10 px; sword 20 to 22 px; Dane axe 32 to 36 px; spear 44 to 56 px; bow 34 to 38 px; round shield 18 to 20 px across |
| Carried loads | A sack or small barrel 12 to 16 px; a chest 18 px long; a timber or bundle on the shoulder up to 2 tiles long; a carried person across the shoulders reads as one adult |
| Ship deck | Gunwale 14 to 16 px above the deck; rowing benches (sea chests) 9 to 10 px high, 1 tile apart along the hull with one oar each side per bench (T1 three benches, T2 eight, T3a thirteen, T3b two), the first and last at least a tile from stem and stern; a clear walkway at least 1 tile wide along the hull |


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
Hulls are built from segments: **bow**, a repeatable **midship** segment (one per three to four tiles of length) and **stern**. The deck is a walkable layer with benches, mast step, cargo spaces and gunwale, drawn to the people scale of section 01 (gunwale height, bench height and spacing, the walkway). Each tier has its own segment set; segments are never stretched. The coastal boat on Wreck Strand is redrawn to the people scale at Stage 11, with its repairs (decision DB-1); until then it keeps its earlier drawing.

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
Doorways, eaves, beds, benches and workstations follow the people scale of section 01: every door is taller than an adult with head room, and eaves clear heads. Buildings use roof cutaways or fades when the player enters. Hearths are the warm centre of every interior. A prosperous home shows hangings, carved benches, chests and clutter; a struggling one shows bare benches and cold corners.

## 07 / People sprites
*People are distinguished by silhouette, clothing and carried tools, not by colour alone. They move with weight, wear what they own, and are shown at their work.*

### Size and movement
- Adults are about 40 px tall on a 32 x 48 canvas (section 01), with the foot anchor at bottom centre; the steerer's two body models and Hild were redrawn at this size before any other people (the Stage 6 rework). Both steerer models are approved as they are (decision DB-1).
- **Builds:** most people are drawn on an ordinary build; some residents and enemies are drawn on the **heavy build** (section 16), never the steerer.
- **Walk:** 6 frames with an exact 1 px drop of torso and head on the down frames (1 to 2 px for the heavy build) and a strong, weighted arm swing; the planted foot keeps pace with the ground (section 14). **Run:** 8 frames with forward tilt, suspension, a deep knee bend, a high knee drive, a heel kick, a 90-degree arm pump and trailing hair and hem, with a lean into the start and a skid on stopping (section 17). **Idles:** breathing, occasional weight shifts and glances round.
- **Secondary motion:** hair, braids, cloaks, sashes and bags lag a frame behind the body and settle after it stops; cloaks also take the wind (section 14).
- **Ground shadows:** every person, animal and prop has a soft, semi-transparent oval ground shadow under it, darker at its centre, with the long sun shadow of section 14 as well when the sun is up.
- **Effort reads:** a steerer low on stamina breathes harder and moves heavily; sliding down a climb and sinking in deep water have their own frames (section 01), so the danger is visible before it is felt.
- **Carrying the downed:** a downed ally is carried across the shoulders and reads as one adult (section 01), with the carry's own heavy gait and no weapon in hand, so it is plain the carrier cannot fight.

### Equipment layers (paper doll)
- Body, clothing, cloak, helmet, armour, shield and weapon are separate layered sheets that share the body's frames and foot anchor, so whatever a person wears or carries is visible and changes when it changes. Book 2 section 19 owns the format and the draw order per facing.
- Weapon and shield layers may use a larger canvas round the same anchor for long weapons (spears, Dane axes, bows), so nothing is cut off. Weapons are carried distinctly: spears upright or sloped, axes at the belt or shoulder, swords at the hip, seaxes across the front, bows on the back or in hand.
- A layer is drawn only for what a person owns and carries. The steerer wakes with nothing in hand: no weapon layer and no bow on the back until the seax and the bow are picked up on Wreck Strand (section 18).
- **Iron helmets are rare.** Leaders and veterans wear them; most people do not; Orm's men have the most. The steerer starts with none.
- Every layer the steerer can wear is drawn for both body models, and every layer a heavy person wears is drawn for the heavy build (section 16).

### Readability
- **The steerer** carries a madder-red accent from the `madder` ramp (the palette's Madder red), so they stand out against sand and grass at 1x. The approved colours (decision DB-1) are a brown tunic, a dark wool cloak, and a madder sash and hem. Every clothing and cloak layer the steerer can wear keeps the accent. **Green stays away from the steerer**: no green clothing, cloak or trim on either body model.
- **Each resident** has one signature colour and one silhouette detail, so they read at a glance and in greyscale: Hild's blond braid and woad-blue dress (her signature colour is woad blue, Book 5; decision DB-1), Bran's ladle, Runa's adze, Áine's bow. A resident's signature colour comes from the dye, wool and hair ramps, is unlike every other resident's, and is never madder.

### Cultural detail
Where it fits: braids, beards, fur mantles in winter (a seasonal cloak layer), and distinct weapon carriage. No horned helmets and no costume-Viking excess.

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
Two body models, A and B, offered side by side without labels. Both share the full animation set, every clothing, hair and equipment layer, and the same collision footprint. Nothing in art or text names a gender.

### People in water
- **Depth bands** (Book 10 section 02, "Water depth bands"): **wet**, no change; **ankle**, feet hidden; **knee**, the sprite masked below a waterline at the band's height; **waist**, masked higher, with the arms held up when carrying; **deep**, swimming only where allowed, head and shoulders above the water.
- Where the water cuts the sprite it draws a **waterline** with a highlight that moves with the small waves. **Ripple rings** expand from the feet on every step and slowly while standing; **splashes** burst on entering the water and when running in it; movement is visibly slower.
- After leaving the water, people are **darkened and dripping** for a few seconds, leaving wet prints.
- **Hild in the opening** stands knee to waist deep in the shallows, partly submerged, calling, with ripples and spray round her.

### Work loops and particles
Every homestead task has a readable work loop of 4 to 8 frames, the same for the steerer and residents (Book 2 section 07), with its tool drawn to the scale of section 01:

| Task | The loop reads as | Particles |
|---|---|---|
| Felling and splitting timber | A full overhead swing and the bite; the split halves falling | Wood chips |
| Cutting peat | The peat iron pushed in with a foot, the turf lifted and stacked | Peat crumbs |
| Sowing, weeding, watering the kale | A broadcast swing from the seed bag; stooping and pulling; tipping a pail along the rows | Seed, soil, water drops |
| Harvesting and threshing | A sickle sweep and the sheaf bound; the flail swung over the floor | Chaff |
| Building | Hammering, raising a beam with a heave, laying thatch from a ladder | Wood chips, straw |
| Smithing | Hammer on the anvil, the bellows, quenching | Sparks, steam |
| Carpentry and repairing the ship | Adze strokes along a plank, the auger, caulking a seam | Shavings |
| Net-mending and fishing | The needle through the mesh; casting and hauling a line or net | Water drops |
| Herding, milking, shearing | Walking the flock with a staff; seated at the cow with a pail; the shears along a held sheep | Wool tufts |
| Cooking and tending wounds | Stirring at the hearth, ladling; kneeling and binding | Steam, hearth smoke |

Other particles: dust kicked up when running on sand and dry earth, footprints in sand and snow, and splashes in shallows and streams.

### Rules
- No horned helmets. No generic fantasy plate. No modern props.
- Residents differ by silhouette, hair, clothing, signature colour and the tool they carry (Runa's adze, Bran's ladle, Áine's bow).
- Faction markers use shape and clothing as well as colour.
- Ally, enemy, surrendered and downed actors are distinguishable without relying on colour: surrendered actors kneel with empty hands; downed actors lie flat but alive (a slow breath, a hand that moves), unlike the still dead; enemies carry their weapon on the far side; allies show a small shape-coded marker when selected.
- **The finishing warning:** a berserker or a named cruel enemy about to finish a downed ally stands over them with the weapon raised high for the whole warning (Book 10 section 06, "Downed and carried"), a pose no other attack uses, with a shout and its information caption, so the player sees it in time.
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
- The steward's morning report, the homecoming report and the post-raid summary use plain sentences, not percentages.
- The **travel map** of the mainland is drawn in the same style as the sea map: sites as small drawn pictograms, routes as drawn paths, road legs as plain lines with their time in words, camp spots and waystations as shape-coded icons, blocks with their reason, and the chosen journey's chain picked out before the player sets out (Book 2 section 10).

### Subtitles and captions
- **Two kinds of line that look different.** **Speech** is upright: the speaker's name, a colon and the words (`Hild: Here! Over here, past the rocks!`). **Information** (sounds, directions, cues) is italic, with no speaker and no quotation marks (*Hild, calling from the west*; *Surf breaking on the rocks*).
- **A real italic.** Information uses a real italic face of the caption font, never a slant synthesised by the browser or the renderer, so it is crisp at 1x with no blurred, skewed letters. If the captions ever use a pixel font, its italic is a hand-made slanted variant drawn pixel by pixel.
- **Placement:** captions sit low and centred on the native-resolution text overlay (section 01), each line on its own dark, calm backing (information on a slightly lighter one); when both kinds show, information lines sit above speech lines.
- A speaker the player has not met is named by what they appear to be ("Monk:", "Stranger:", "Ardcarn guard:") until introduced, and a hidden identity is never given away by a subtitle name (Book 2 section 18). Information captions can be turned off separately from speech.

### Hotbar, cursor and aim
- **Hotbar:** a strip of 12 slots (Book 10 section 21, `hotbarSlots`) along the bottom edge in carved-wood frames, each showing its tool, seed, item or weapon as a drawn icon with a small count; the selected slot is raised with a bright rim and its name appears briefly above the strip. Slot numbers sit in the frame corners.
- **Target tile:** the tile the next action will work is outlined with a one-pixel rim in the interactive highlight of section 13, with corner ticks, and a faint fill; it shows the selected tool's action as a small icon (axe, spade, seed, pail, hammer, hook, sword).
- **Out of reach:** the cursor tile dims and its rim turns to a broken red edge, and a short refusal word appears beside it ("Too far", "Nothing to cut"); it is never shown by sound alone or by colour alone (the broken edge is a shape cue).
- **Aim line:** while drawing a bow or aiming a spear, a dotted line runs from the hand towards the cursor, its dots spaced wider as the draw grows, ending in a small cross; it never passes through solid tiles in a way that lies about the shot.
- **Melee facing:** when a melee attack is aimed with the cursor, a small arrow at the steerer's feet shows which of the four facings it will take.
- **Pickups and tooltips:** a thing worth picking up shows its glint, and the first pickup of each kind shows its tooltip; arrows have their own icon and count (section 18).

### Stamina bar
- The bar's frame is as long as the current maximum. To its right, the capacity lost is shown as an empty, darker groove up to the full length, cut into one segment for each reason it is smaller, each with its drawn icon: frost for cold, an empty bowl for hunger, a bound cloth for wounds, a fevered brow for sickness, a closed eye for lack of sleep, a bent back for a hard day's work. Hovering, or the character panel, gives the plain word ("Cold", "Hungry").
- When a restorer lifts a reason (a hot meal, a warm fire, full rest, a feast), its segment glows warm and the bar grows into it.
- While climbing, swimming or wading waist deep, the bar also shows small beside the steerer; an empty bar flashes its frame once before a slide or a sink (no flash with reduced flashes).
- Icons are shape-coded and drawn from the palette, never emoji, and readable in the colour-blind presets.

## 11 / Asset manifest, naming and art QA
*Every asset is listed in a manifest with its frames, pivot, footprint and events. Book 2 owns the schema.*

### Naming
| Asset type | Pattern | Example |
|---|---|---|
| Person | `actor_<id>_<state>_<facing>` | `actor_c_hild_walk_s` |
| Shared heavy body | `actor_heavy` (section 16) | `actor_heavy` |
| Equipment layer | `layer_<slot>_<name>_<body>`, where `<body>` is `a`, `b`, `heavy` or a person's own body | `layer_cloak_grey_wool_a`, `layer_cloak_wool_heavy` |
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
- **Style rules:** one-pixel ink outline on characters and props (not on terrain), checked on each person as composited from its layers, in every frame, so cloth that meets skin is not double-outlined (decision S6R-6); light from the upper left; three tones per material (shadow, base, highlight) chosen from the hue-shifted ramps of section 14, plus a fourth for metal glints; ordered dithering only for fog, mist, gradients in sky and water, and sand drying after the water.
- **Compile and check:** the art compiler packs atlases and manifests. Claude renders every new or changed sheet at 1x and 4x, inspects the images against these rules, and records the check in the stage report.
- **Review:** the user reviews art at each build gate; changes requested there are logged and applied before the next gate.

### Placeholder rules for LLM-built stages
- Never replace missing art with permanent circles, boxes or emoji.
- Temporary silhouettes are allowed only with `placeholder: true` in the manifest and a line in the stage report.
- Placeholders are replaced before the art gate in Book 3.

### Art QA checklist
- All sprites snap to whole logical pixels at 1x, 2x and 3x scale.
- Foot anchors and collision footprints agree; no sliding feet.
- People are 32 x 48 canvases about 40 px tall (the heavy build up to about 4 px wider); things they use follow the scale of section 01; every layer sheet matches its body's frames and anchor, and is fitted to its build.
- The walk drops 1 px on its down frames (1 to 2 px heavy); the run meets section 17 in every facing and build, with a suspension frame per stride and the torso drop on its down frames.
- The steerer wears no green.
- The steerer's madder accent and each resident's signature reads at 1x against sand and grass.
- People in water are masked at their band's waterline, with a highlight, ripples and splashes.
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

### The cruelty of every tradition
Every tradition in the game is shown with its cruelty as well as its comfort, even-handedly, through what its believers do (Book 1; Books 4 to 6): thralls killed to follow a chieftain into death and hostages drowned by Orm's men; the abbey's bondmen at the tithe farms, a public flogging for penance and a smashed shrine of the older faith; a hostage starved when a treaty breaks; the sick left on a skerry for the sea to judge and the Bog King's drowned offerings in the peat. Where the art shows them:
- **Shown, not glorified.** They are drawn in the same plain pixel language and palette as everything else: no reserved accents, no dramatic light, no close-up, no slow motion, no lingering camera, and nothing the player collects or is rewarded for. Much is shown by its signs and aftermath (a grave mound with a thrall's small cairn beside it, an empty skerry with a cairn of stones, a stake in a bog pool, a broken shrine stone) rather than the act.
- **Never one-sided.** Every tradition's cruelty is drawn with the same restraint, and its believers are drawn as people too: some kind, some doubtful, some ashamed (a monk who turns away from the flogging, a woman who will not watch at the drowning).
- **Hard limits hold in the art:** no children as actors, so none in any scene of cruelty; no sexual violence, drawn or implied; no player torture, and no torture shown as spectacle.

## 13 / Wilderness and exploration art
*On-foot exploration needs varied, readable ground that changes with the seasons.*

### Tile sets
| Set | Contents |
|---|---|
| Island coast | Shingle, sand, tidal flats with wet sheen, skerries, kelp, cliffs with climbable ledges, sea caves with tide marks |
| Machair and moor | Machair grass and flowers, heather, bracken, peat banks and cuttings, bog pools, plank roads |
| Woodland | Oakwood and pinewood floors, holly and moss, trunks with occlusion, undergrowth that hides sneaking actors, clearings, streams |
| Upland | Corrie walls, scree, high pasture, shieling huts, summit cairns |
| Waters | Lake shore, river fords, streams, waterfalls with plunge pools, holy well, salt pans, depth bands from wet sand to deep water |
| Sites | Stone rings, burial mounds, ringfort banks, souterrain and cairn interiors, the hermit's cell |

### Seasons and weather
Every outdoor set has four seasonal variants: spring green with flowers, summer full and dry, autumn bracken-brown with fallen leaves, winter frost, snow patches and ice on bog pools. Weather overlays (rain, fog, snow) follow Book 7 section 08 and never hide an actionable threat.

### Interactive and puzzle objects
Anything the player can climb, pull, light, read, align or take has a consistent one-pixel highlight edge when in range. Hand-holds on climbable cliffs are drawn, not implied. Puzzle objects show their state visually (a stone's shadow, a water line, an unlit brazier).

### Wildlife
Wolf, boar, red deer, hare, seal, otter, gulls, cormorants, ravens and crows, a sea eagle, sheep and small black cattle, each with four facings and the states they need (walk, run, attack or flee, eat, sleep, dead).

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
- **People** walk at the Book 10 walk speed (2.0 tiles a second) with a grounded 6-frame cycle (section 01: the torso and head drop exactly 1 px on the down frames) whose planted foot keeps pace with the ground: no sliding, no floating. Runs follow the run cycle of section 17 (8 frames, timed from the run speed so the feet never skate); carrying has its own heavier gait; wading is slower at the band's speed. The heavy build moves heavier (section 16).
- **Idles:** a breath, a weight shift, glancing round after a few seconds still, bracing and holding the cloak in a strong gust.
- **Secondary motion** on hair, cloaks, sashes and bags, lagging a frame behind the body and settling over 1 to 2 frames after it stops (the cloak flutters in the wind, and trails harder running into a headwind, section 17).
- **Missiles** fly as drawn sprites rotated along their flight, with a shadow under the arc, and stay where they strike (section 18).
- **Footfalls** leave prints in sand (wet prints hold water and are taken by the tide; dry ones fade), raise dust when running on dry ground, splash and ripple in water, part the grass round the legs, and sound by surface (sand, wet sand, shingle, grass, rock, water).
- **Residents are shown at their tasks**, never standing idle in a row (from the first stage that has residents).

### Wind
- One wind per place drives everything. Gusts travel downwind across the ground as bands broken into patches; every plant leans with the steady wind, eases into each gust, and sways on its own phase so neighbours never move in step; flowers bob.
- The same wind bends smoke, drifts dry sand along the beach in streamers, slants rain, lifts cloaks and flogs loose cloth, and runs a faint sheen over grass in each gust.

### Water
- Colour darkens from pale shallows over the sand to the deep, in ordered-dithered palette steps; broad swells lie in bands parallel to the shore and roll in, breaking into white lines in a surf zone.
- Foam runs up the beach with each wave and back; the sand behind it is dark and sheened, then dries in steps; above the reach of the waves, sand wet from the tide dries over a few minutes.
- The tide rises and falls as the calendar says; what is drawn never disagrees with where the simulation lets the player walk (the flats are always under water while the tidal ground is closed).
- Kelp sways under the surface; glints flicker on crests in sunlight; spray bursts where waves meet rock.
- **People in water** (section 07): masked below a waterline at their depth band, with a moving highlight on the waterline, ripple rings expanding from the feet on every step and slowly while standing, splashes on entering and running, and darkened, dripping sprites for a few seconds after leaving. No one stands in water without ripples.
- Streams flow visibly (streaks drifting downstream), foam gathers along their banks, at rocks and at narrows; springs bubble; waterfalls have falling sheets, spray and a churned pool.

### Life
- Every outdoor place has animals going about their lives: here gulls wheeling with their shadows on the ground, a gull standing and turning its head, a cormorant drying its wings, a seal lifting its head, crabs scuttling; midges in still air by water. Elsewhere sheep, cattle, insects and birds as Book 7 section 13 lists. Wildlife is visual unless a stage makes it more.

### Light
- A grade by time of day and weather: cool clear days; first and last light a grey half-light, a little warm; low sun warms the light and cools the shadows; night readable in blue shadow with lantern and hearth pools.
- Every character, creature and prop has a soft, semi-transparent oval ground shadow; when the sun is up its silhouette also casts a long shadow away from the sun, longest when it is low. Flying creatures cast their shadow on the ground below them.
- Cloud shadows drift across land and sea with the wind; shafts of light fall through broken cloud when the sun is low; fire and lanterns flicker and throw light pools; lightning flashes in storms; fog and mist drift in layers.

### Camera feel
- The camera follows smoothly with a look-ahead towards the mouse cursor (capped at about 3 tiles, more while aiming a bow or spear; Book 10 section 21 "Controls and camera"), or in the direction of travel without a pointer. It is smoothed below the pixel and only its final offset snaps to whole logical pixels, with a dead zone and hysteresis, so nothing jitters and the view never steps one pixel back and forth. Hits shake it briefly.

### Accessibility
- **Reduced motion** (from the system's preference, `?motion=reduced`, or the system menu): no camera shake or flashes, calmer plant sway, half the blown sand and insects. The world still moves (at least 50% of cells with the camera still).

### Engineering limits
- Visual only: the renderer, shaders and visual state never change the simulation, and use no `Math.random`.
- Within the Book 2 frame budget: building a frame's scene and draw list under 4 ms in the test runner; the script's share of a browser frame under 5.5 ms.
- 640 x 360 logical pixels and 24-pixel tiles are unchanged; people are 32 x 48 canvases about 40 px tall (section 01; the decision log records the change from 32 x 40), and sight ranges are unchanged by it.
- Effects fit the machine: play starts at low detail and steps up to lite and full once frames prove fast, and steps back down if frames slow below ten a second, so the game stays playable everywhere; the standard is judged at full detail, and low detail with reduced motion still keeps half the screen moving.

### How the standard is enforced
- **Art lint** (`npm run lint`, so every build and CI) fails if an actor or prop sheet has no `shadow:` header, a zone has a terrain boundary straight for more than 16 px, a terrain has fewer than 8 plain tile variants, or grass is under-decorated (`src/tools/art/standard.ts`). It also fails a standing person sheet that is not a 32 x 48 canvas about 18 x 40 occupied (the heavy build up to about 4 px wider), a walk that is not 6 frames with the 1 px drop on its down frames (1 to 2 px for the heavy build), a run that is not 8 frames with both feet at least 1 px above the ground line on each suspension frame and a torso drop of 1 to 2 px on each down frame (section 17), a layer sheet whose frames or anchor differ from its body's, or a person composite (every layers file, every frame) without an ink outline all round (decision S6R-6).
- **Tests:** `tests/unit/standard.test.ts` checks shadows under everything drawn, transitions, variants, density and the frame budget, and that a person standing in each depth band is masked at that band's waterline and rings with ripples; `tests/browser/standard.spec.ts` measures motion with the camera still, with and without reduced motion, the script time per frame, and that a still cursor leaves the camera still. The thresholds above are the floor and are never lowered to pass.
- **Captures:** `npm run capture -- stage-NN` writes `docs/art/captures/stage-NN/` (a still at 1x and 2x, a 10-second walk at 25 fps, the reference beside the capture, a motion map and the figures). Each stage report compares the capture with `docs/art/reference/`.
- **New places** start with a mockup the user approves before they are built (Book 3).

## 15 / Mainland routes and points of interest
*The six wilderness routes are long places the player crosses on foot. Each has its own look, meets the terrain art standard of section 14, and changes with the seasons; every place's points of interest read at a glance.*

The mainland's sites are explored on foot; between them, road legs pass off screen and the wilderness routes are crossed in play (Book 2 section 10; Book 4; route plans in Book 9; times and encounter rates in Book 10 section 14). A route is long rather than square: a clear main path, side paths, pockets, camp spots and at least one shortcut to find. Each route starts with a mockup the user approves (Book 3), and each must meet section 14 in full: organic terrain and decoration, at least 80% of the screen moving, one wind driving plants, smoke, cloth and water, a light grade by time and weather, and life going about its business.

### The six routes
| Route | Look | Major point of interest | Dangers, and how they read | Seasons |
|---|---|---|---|---|
| The Black Wood path (`MAIN_BLACKWOOD_EDGE`) | Old oakwood, holly and moss; shafts of light through the canopy; streams | The charcoal burners' camp (a smoking clamp, stacked cordwood); the hill-folk's gate to the heart, marked by one wrong detail (section 09) | Boar (rooted ground, a crashing in the undergrowth); outlaw scouts; wolves in winter; getting lost off the path (side paths fade into trees that look alike) | Nuts, mushrooms and falling leaves in autumn; bare and dark in winter |
| The plank road (`MAIN_PLANK_ROAD`) | Open bog, dark pools, cotton grass, the timber trackway across it | The turf-cutters' shelter; the branch to the Drowned Trackway | Sinking ground off the planks (a too-bright, wet-sheened moss); mist drifting in layers; will-o'-the-wisps (the corpse-light accent, here only as the supernatural sign it is); the Bog King's drowned | Planks awash in winter floods; ice on the pools in cold snaps |
| The High Pass (`MAIN_HIGH_PASS`) | Scree, crags, a stream in a gorge, and wind | The landslide until it is cleared (raw stone, snapped trees, settling dust); a ruined watchtower | Rockfall (pebbles trickling and dust falling first); cold; wolves; Faolán's outlaws | Snow in winter, drifting on the wind and slowing the way |
| The Ridge Road (`MAIN_RIDGE_ROAD`) | Open ridge, heather and cairns, long views down to the sea | Fiachra's toll post (riders, a fire, a flag flogging in the wind) | Fiachra's riders when Dún Fiach is hostile; toll disputes | Busiest in summer, with fairs and pilgrims on the road |
| The river path and the Ford (`MAIN_FORD`) | Alder and willow, a wide brown river, stepping stones | Cuán's ford-house and the crossing | Spate (the river high, brown and carrying branches); the river itself (its depth bands drawn as section 14 asks); smugglers | Closed in spate until bridged; the bridge, once built, drawn in place |
| The moor road (`MAIN_MOOR_ROAD`) | Heather moor, standing stones, a gallows tree | The standing stones; the turn to the Mound Field | Wolves in winter; outlaws; the barrow-dead at night, in the draugr's language (section 09) | Long dark nights in winter |

### Each route against the standard
- **Wind:** the Black Wood's canopy and fern stir with dappled light moving under them; cotton grass bobs and gusts run a sheen over the bog pools; the High Pass has the strongest wind in the game, flattening grass, streaming cloud off the crags and drifting snow in winter; heather moves in long gust bands on the Ridge Road and the moor; willow fronds stream over the river.
- **Moving plants:** oak, holly, fern and bracken in the wood; cotton grass, heather and moss on the bog; wind-bent grass and rowan in the gorge; heather and grass on the ridge and the moor; alder, willow and reeds by the river.
- **Light:** shafts of light through the wood that move with the boughs; wide skies over the bog with cloud shadows racing across it and low sun glinting off the pools; sun breaking over the pass; long views from the ridge with the sea glinting far off; the standing stones' long shadows at dusk on the moor. Night on every route is readable in blue shadow (section 14).
- **Water:** streams flowing in the wood and the gorge, with foam at stones and a waterfall's spray in the gorge; the bog pools rippling in wind and rain, and water welling between the planks; the river flowing in visible streaks, eddying at the stepping stones; the distant sea from the ridge; peat burns and pools on the moor.
- **Life:** deer, boar, hares, wolves, ravens and crows, otters and eagles by route and season (section 13), with midges over still water; an eagle wheeling over the pass with its shadow on the scree; otters on the river; ravens at the gallows tree; travellers, pilgrims, pedlars, herders, charcoal burners and patrols on the path (Book 2 section 25).

### Points of interest
- **Major points of interest** (one or two in each site, one on each route: a village, dungeon, ruin, shrine or camp with people and quests) read at a glance from a distance: a strong silhouette against the sky or the trees, smoke bent by the wind, firelight at night, people moving about it.
- **Minor points of interest** (a cairn, a wreck, a carved stone, a hermit's hut, a hidden cache, a viewpoint, an eagle's nest, a herb patch, a grave, a burned farm; 4 to 8 in each site and route, Book 9 places them) are drawn as distinct props, never as plain ground.
- **Off-path rewards are visible but guarded.** The best finds can be seen, or hinted at, from the path (a glint on a ledge, a nest on a crag, a cache's marker stone across a ford) together with what guards them: the climb with its drawn hand-holds, the wade with its depth, the hazard with its sign (Book 2 section 10), or the puzzle object in its visible state (section 13).
- **Ambush signs are drawn to be read:** a fallen tree across the path, crows rising ahead in a flock, a stretch gone too quiet (the birds and insects gone from it), fresh tracks in mud or snow (Book 10 section 14 gives the distance).
- **Camp spots and waystations:** a camp spot shows a fire ring with old ash and a sheltered patch; a waystation is a small turf-roofed shelter with a store and a hearth, built in stages like any building (section 06).
- **Secret entrances are hidden but hinted** (Book 4 section 03; Book 9 section 14). An entrance is drawn as part of the ground (a root-plate, a waterfall, a hump of heather, a weir), with no highlight until found; its hints are drawn to be read by a careful eye: a cut mark on a trunk or stone, leaf litter stirring or a breath of mist at a crack on a cold morning, birds flying into the falls or the weir and not coming out. Once found, its threshold takes the interactive highlight (section 13).
- **Route state shows on the ground:** a waymarked route has cairns or carved posts along its main path; a cleared route's outlaw camp lies burned or empty; a route held by a hostile faction shows that faction's shields and colours at its posts and on its patrols, by shape as well as colour (section 07); found shortcuts stay readable (a fallen log across the stream, a goat track up the scree).

## 16 / Body builds: the heavy build
*A third build for some residents and enemies, drawn in the same cell with the same frames, so all animation logic is shared. The steerer keeps the two existing models.*

- **Proportions:** broad shoulders, a thick torso and limbs, big hands; men and women both. It fits the same 32 x 48 cell and foot anchor as every person, using up to about 4 px more width, and stays about 40 px tall.
- **The same frame set:** the heavy build has exactly the states, facings, frame counts and timing of the other builds (section 01), and its animation events (footsteps and the rest) fall on the same frames.
- **It moves heavier:** deeper down frames and more torso drop (the walk drops 1 to 2 px on its down frames, the run 2 px), a shorter flight on the run (both feet at least 1 px clear on the suspension frames, against 2 px for the ordinary builds), and a slightly slower arm swing within the shared timing. Its run meets section 17 in full.
- **Equipment layers are fitted to each build:** every clothing, cloak, helmet, armour, shield and weapon layer a heavy person wears is drawn for the heavy build (`layer_<slot>_<name>_heavy`, section 11) and matches its frames, as every layer matches its body. The shared body is `actor_heavy`; a heavy resident is drawn on it with their own layers and keeps their signature colour and silhouette detail (section 07).
- **Who (Book 5):** residents Bran, Kolbeinn and Tófi One-Eye; enemies Kolgrím the Burner, some of Orm's grey-cloaks, Fiachra's champion and the berserkers; and about one in six generated people, farmers and smiths as well as fighters (Book 10 section 24, `share`). It is occasional, never the norm.
- **In play** the heavy build has more poise, slower wind-ups, heavier hits, a slightly slower run, and carries loads and downed allies faster but tires sooner when running (Book 10 section 24; Book 2 section 12). The art shows this through weight, not through extra effects.

## 17 / The run cycle
*Vital, and the same for every character who runs, in every facing and every build: the body thrown forward, both feet off the ground once a stride, knees that bend and drive, arms that pump, and hair and cloth that trail.*

- **Frames:** eight per facing: contact, down, passing, suspension, then the same for the other leg. Frame timing comes from the run speed in `content/balance.json`, so the feet never skate.
- **Momentum:** the torso tilts forward 1 to 2 px for the whole run, with the head and shoulders ahead of the hips.
- **Suspension:** one frame per stride (two per cycle) with **both feet clear of the ground**. The ground shadow stays on the ground and shrinks by 1 px.
- **Knees, never stiff:**
  - On the down frames, the leading knee bends deeply to take the weight, and the whole torso drops 1 to 2 px.
  - On the forward swing, the knee drives up high with the leg folded tight.
  - After push-off, the trailing heel kicks up high behind the body.
- **Arms:** elbows bent to about 90 degrees. Fists pump up to chest height on the forward swing, and the elbows drive far back on the back swing, opposite to the legs.
- **Secondary motion:** hair, the tunic hem, the cloak and the sash ends trail a frame behind the body, to show drag, and settle over 1 to 2 frames after stopping. A headwind from the wind system (section 14) makes the trail stronger.
- **Facings:** side views show all of this most clearly. Front and back views show it through the bob and torso drop, the foreshortened knee lift, the heel kick showing behind the legs, and the arms pumping.
- **Variants:** with a weapon drawn or a shield up, the pump is reduced on the occupied arm. Carrying a load or a downed ally uses its own heavy gait (the carry walk, section 01). The heavy build has deeper down frames and a shorter flight (section 16).
- **Starting and stopping:** a one-frame lean into the start, and a short skid and settle on stopping (two frames).
- **Checks:**
  - Art lint confirms that each run strip has a suspension frame per stride with both feet at least 1 px above the ground line, and a torso drop of 1 to 2 px on the down frames (section 14; Book 2 section 19).
  - Any stage that adds or changes people includes, in its report, GIFs at 1x and 4x of the walk and the run in every facing, for both steerer models and the heavy build, shown side by side.

## 18 / Missiles and pickups
*Every shot is seen: an arrow or a spear flies, casts its shadow, and stays where it struck. Things worth picking up catch the eye.*

### Missiles in flight
- **Drawn for every shot** (Book 1 section 09; Book 2 section 12, Missiles). An arrow and a thrown spear each have a flight sprite in **16 directions**, rotated along the line of flight; the arrow about 10 px long with a pale fletching and a dark head, the spear about 24 px with its iron head catching the light. They are drawn from the palette, with the ink outline, never as a line or a dot.
- **The arc and the shadow.** The missile is drawn raised above the ground by its height in the simulation, with a soft 3 x 1 px ground shadow under it (Book 10 section 21, `shadow`), so its arc reads by the gap between the two: wide at mid-flight, closing as it comes down. The sprite tips nose-down on the falling half of the arc (the nearer of the 16 directions with the drop).
- **Speed reads.** At the Book 10 speeds an arrow moves about a quarter of a tile a frame; it is drawn every frame, with a faint one-frame streak behind it (none with reduced motion), so the eye never loses it. A spear is slower and flies point first, never tumbling.
- **Stuck missiles** stay where they struck, at the angle they struck, with sprites for each surface: **in the ground** (the shaft standing out of sand, turf or earth, leaning back along its line, with a small kick of sand or turf), **in timber** (a hull, a wall, a door, a tree), **in a shield** (the shaft standing out of the board, moving with the shield and its bearer) and **in a body** (the shaft standing out of a person or animal, moving with them; drawn with the gore setting, section 12). A **broken** arrow lies as two pieces with a splinter; one that strikes stone glances and lies broken at its foot; one into water vanishes with a small splash ring. Whole arrows that can be picked up show the interactive highlight edge in reach (section 13).
- **Against the standard** (section 14): missiles and stuck shafts have shadows like every prop; stuck shafts in a breeze stay still (they are solid), but their fletching stirs in a strong gust; a hit raises the dust, splinters or spray of what it hit.

### The draw
- **Drawing plants the feet**, so the draw and loose (section 01) has **no walking variant**: the archer stands square, turns to the aim with the cursor, and the legs stay planted while the bow is drawn. Any facing turns the whole body, never the legs alone. Crew and enemy archers use the same frames: a stop, the draw, the loose, then movement again.
- The steerer's bow is a weapon layer like any other (section 07) and is drawn **only once the bow is owned**: until it is picked up on Wreck Strand there is no bow on the steerer's back or in hand, and no quiver. Once owned, it is carried on the back with the quiver at the hip, and in hand while selected. The seax likewise appears at the front of the belt only once found.

### Pickups and their glint
- A thing worth picking up that the player might miss (the seax in the wreck's debris, the bow in the stern, a cache, a dead archer's quiver) shows a **glint**: a small four-pointed sparkle from the highlight of its material, two or three frames every few seconds, brighter in low sun, kept under the strong luminous accents reserved for the supernatural (section 09). It is a light on the object, not an icon over it, and it stops once the thing is taken.
- **Item icons** for the hotbar and the inventory are drawn for every item (section 10): the seax, the bow, and **arrows** (a small bundle of three shafts with their fletching; bone heads pale, iron heads dark), with the count in the slot's corner. Arrows show their count on the bow's slot.
- **The pickup tooltip** (Book 2 section 21; Book 8 section 10) sits in a carved-wood panel beside the item's icon, above the hotbar, with each control drawn as its key, mouse button or pad button in a small frame, never as a colour alone.
