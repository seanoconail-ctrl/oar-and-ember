# Oar and Ember, Book 11: Audio and Music Brief

*Direction for music, sound and voice: instruments, themes, the adaptive music system, seasons and festivals, diegetic song, sound design, mix, accessibility and technical delivery.*

Music is a priority. It should make the household's growth audible, make the sea feel enormous, and make the strange things in the mist feel old. Sound must also carry gameplay: in a game without a pause, the ears warn first.

**How to use:** The game generates all of its own audio (section 12). Claude composes the music as note data and writes every sound, ambience and voice blip as code, using sections 01 to 09; sections 03 and 08 to 12 are implemented against Book 2 section 18. Every cue and sound has a stable ID (`MUS_`, `SFX_`, `AMB_`, `VO_`).

_Every tune, sound and ambience is original, written for this project and played by the game. No recordings, no commissioned composer, no voice acting, no licensed or sampled music; no existing song, recording or melody is reproduced or imitated. Instrument choices are period-inspired, not claims of historical accuracy._


## 01 / Direction
*SNES-era and Stardew-like, darker and more wind-blown: a few small instruments against wind, sea and silence.*

- **Style.** The sound of a 16-bit console played on a cold night: small sampled-sounding instruments, about eight voices, one shared echo, melodies you can hum. Stardew's warmth and seasons, but darker and more wind-blown. Modal and Celtic-Norse in feel: mostly Dorian and Aeolian, drones underneath, ornamented melodies (cuts and rolls on whistle and harp).
- **Home is small and warm.** Few instruments, close and dry, as if played in the longhouse.
- **The sea is vast and indifferent.** Low drones, a long echo, the sound of distance; dread rather than adventure.
- **Violence is percussive and sudden**, not orchestral bombast. Drums, breath, impacts.
- **The supernatural is old and slightly wrong**: detuned unisons, lowered seconds, voices without words, sounds that move against the wind.
- **Silence is a tool.** Long stretches of ambience only; music arrives when it means something. At least a third of time at home is ambience only.
- **Growth is audible.** The household theme gains an instrument or part as the household grows, and a new verse each year.

### References (match their qualities, never their melodies)
| Reference | Quality to match | Used for |
|---|---|---|
| Chrono Trigger | Celtic-flavoured 16-bit melody, singable themes | The main themes |
| Terranigma; Kingdom: Two Crowns | Sparse, melancholy, ambience-led | The island |
| Stardew Valley | Seasonal variations; plenty of near-silence at home | Home and seasons |
| Dredge; Hyper Light Drifter | Dread and the uncanny | The sea and the supernatural |
| Final Fantasy VI | Dark drama | Orm, Heid and the finale |
| Wardruna | Norse drones and frame drums | Instrument and mood guidance |

Two tests of the result: **the hearth theme should feel like Chrono Trigger played on a cold night; the sea should feel like Dredge.**

## 02 / Instruments and palette
*Small instruments synthesised in code or built from short generated samples, played SNES-style: one short sample per instrument, pitched for every note, with a loop over the sustain.*

### Core instruments (generated)
| Instrument | How it is made | Use |
|---|---|---|
| Plucked lyre | A plucked string (Karplus-Strong) | Norse household; the hearth theme |
| Bright harp | A brighter, longer-ringing pluck | Gaelic coast, Kilbrecc's patrons, Órlaith; counter-melodies |
| Breathy flute (bone or wooden) | Soft harmonics, breath noise and a chiff | Skarvholm, wind, birds; Hild's tune |
| Tin whistle | Purer, brighter harmonics with less breath | Ornamented Gaelic melodies |
| Frame drum and hand percussion | A falling membrane thump with a skin slap; struck noise through a resonator | Rowing, combat, feasts, the raid |
| Low drone | A reedy fifth, slowly beating | Under everything; the sea |
| Soft choir-like pad | An "ah" from formant-weighted harmonics, three detuned voices | The hummed voice, the Keepers, Rán's choir, Yule |
| Bells | Inharmonic struck partials | Kilbrecc, the Bell of Brecc, winter |
| Horn | Brassy harmonics, slow opening | Calls, signals, the alarm, Orm |
| Seabirds | A generated gull call | In the gaps of the island theme |

Instruments still to build as later stages need them, to the same rules: bowed lyre (sorrow, the drowned, Heid), reed pipe, keening voice, struck stone (the Cailleach).

### Limits that keep it of a piece
- **About eight voices** for music at once; a ninth note steals the voice nearest its end (as the SNES did). Effects, ambience and blips have their own budget.
- **Small instruments:** one short sample each (32 kHz), pitched for every note.
- **One shared echo** (a delay with feedback through a low-pass), set per piece: close and dry at the hearth, long at sea and for the supernatural.
- A gentle low-pass (about 7 kHz) on the music gives the soft top of interpolated samples.
- No guitars, modern drum kits, synth leads in the foreground, bagpipes or fiddles.

### Scales and intervals
Modal, mostly Dorian and Aeolian with drones. The Gaelic coast leans pentatonic and ornamented; the Norse household leans on fourths and fifths. The supernatural uses detuned unisons, a lowered second, and slow glissandi. A season can change a piece's mode (Skarvholm is Dorian in summer and Aeolian in winter).

## 03 / The music system
*Adaptive music driven by place, time, season, threat and story. Changes land on bar lines.*

### States
| State | Triggers | Character |
|---|---|---|
| `MUS_HOME_DAWN/DAY/DUSK/NIGHT` | At home by time of day | Hearth theme variations; sparse at night |
| `MUS_ISLAND_EXPLORE` | Island zones away from the steading | Flutes and wind; zone motifs |
| `MUS_REGION_<id>` | Mainland areas | Regional palettes |
| `MUS_SEA_CALM/WIND/STORM` | Sea map by weather, while the boat is under way (Stage 13, decisions S13-60 to S13-65): the calm below Book 10's `windFrom` (section 25, Sea sound), the wind from it, the storm from section 02's stormFrom; silent in fog unless a storm, and when held, at anchor or handed off to a scene | Rowing pulse in calm and wind; drones and drums in storm. Their own pieces (content/music/sea.json): D Aeolian at 64 beats a minute in 4/4, a minute a pass, a long echo, over a low drone re-struck every four bars so the loop has no seam; the frame drum strokes every two beats as the crew pull and the oars creak on the recovery. **The calm**: the drone, the stroke, a held pad and a sparse harp far off, avoiding the sixth. **The wind**: the stroke and the pad under a breathy flute's long tune with cuts, darkening to the lowered sixth at its middle. **The storm**: no tune; the drone, a deeper drone grinding between the lowered sixth and the fifth, frame drums in quavers, a great drum like a sea breaking every second bar, and a low choir pad. Each begins with the drone alone |
| `MUS_RAID_APPROACH` | Landing, unalarmed | Low pulse, held breath |
| `MUS_RAID_ALARM` | Alarm raised | Drums enter on the next bar |
| `MUS_COMBAT_1/2/3` | Combat by intensity | Layers add with enemy count and danger |
| `MUS_EXTRACTION` | Carrying to the boat | Driving rhythm, rising |
| `MUS_SEABATTLE` | Sea battle | Rowing drums and horn calls |
| `MUS_SUPERNATURAL_<power>` | Signs and encounters | Each power's motif |
| `MUS_COUNCIL` | Kilbrecc council | Restrained, ceremonial |
| `MUS_LAUNCH` | The launch (Chapter 1's gate), to the sea map | The Ship theme: frame drum on the stroke, oar creak, men's chorus (decision S12-17) |
| `MUS_RITES_STONES`, `MUS_RITES_SEA` | Thorkel's rites, from the choice to the rite's end, at the rite's place and the camp (the user's fourth playtest, decision DH-23) | Their own piece (content/music/rites.json): D Aeolian, slow, over a drone; the lyre carries the lament's falling line and the choir pad answers a bar behind, falling; a whistle fragment turns upward at the half and settles on the home note. The stones: a slow frame-drum walk and a stone set down in the gaps. The sea: the drum swells once a bar and the choir sits lower. Thorkel's lament is sung over it, the piece ducking as under a stinger |
| `MUS_RETURN_SKARVHOLM` | The late-game expedition | The island theme broken and salted (section 04) |
| `MUS_FINALE_*` | Chapter 8 | All themes converging |

### Layers and intensity
Most states have three to five stems (bed, rhythm, melody, voice, danger). An `intensity` value from 0 to 1, driven by threat awareness, enemy count and the steerer's vitality, mixes the stems. Intensity rises within one bar and falls over four, so music never flickers.

### Fades
Music arrives gently and leaves gently (design addendum 2.4; decision DE-29; the times are Book 10 section 25, "Music fades"):
- **Gradual onset.** A piece fades in from silence over about 6 to 10 seconds and starts with a single layer, a drone or one instrument. Its other layers join one at a time, each on a bar line, over the first 20 to 30 seconds.
- **Fade out.** Whenever music stops it fades out over about 4 to 8 seconds. A change between pieces cross-fades, and the new piece still begins with one layer. Combat music obeys the same fades: its intensity can rise within a bar once it has begun, but it never cuts in or out.
- **Only stingers** start and stop sharply.
- **Silence is welcome.** Stretches of ambience alone between pieces, in the Stardew manner, are part of the design, not a gap to fill.

### Stingers
Short cues on key events: discovery, a resident's death, a bargain accepted, the horn, the charge level-2 tell (also a sound effect), a level up, a building finished, a chapter end. Stingers duck the music under them.

### Rules
- Combat music never starts before the player can see or hear the threat.
- No music during the first seconds of the opening: the cold open is storm, wind, timber and shouts; the waking is wind, surf and Hild's voice. The music arrives gently with the first fire (design addendum 2.4).
- At least 30 percent of home time is ambience only.
- A resident's death silences the music for a bar before the lament.
- **The pause menu** (the user's third playtest, decision DG-15): while it holds time, music and ambience fall by Book 10's `pauseDuck` over a quarter of a second and keep playing quietly, and effects and voice blips pause; on resume they come back over the same quarter second. In the overlay, with time running, nothing ducks.
- **Thorkel's sea burial** (decision DG-14): Thorkel's lament plays through the rite and holds a single keening note as the bier is borne down; it thins to the drone as the waves come in, and its last note ends with the sink, under the foam and the gulls. No stinger.
- **The sea's music follows the weather** (Stage 13, decisions S13-60 to S13-65): a change of weather asks for the new piece, which lands on the next bar line and cross-fades like any change (the three share a key and a tempo, so the bar grid runs on through it); the new piece starts from the drone. **Fog is the dead quiet of fog**: the music falls away and only the bed is heard, unless it is a storm. While the boat is held at a tide gate, sheltering or lying at anchor, and while a scene has the sound (the wreck), there is no sea music. The wreck's own scene is ambience only: surf, gulls and the survivors' cries.
- **Thorkel's rites have their own music** (the user's fourth playtest, decision DH-23): `MUS_RITES_STONES` or `MUS_RITES_SEA` takes over from the place's music once the rite is chosen, wherever the household gathers for it (the rite's place, or the camp), and fades out at its end like any piece; the lament and the sea ending play over it as stingers do.

## 04 / Themes and motifs
| Theme | Instruments | Notes |
|---|---|---|
| The Household (hearth) | Lyre, solo voice | The game's heart. Starts as a hummed fragment by Hild at the first fire; gains instruments as residents join (one layer per four residents), voices at Yule, full ensemble in the United Coast ending |
| The Ship | Frame drum, men's chorus, oar-creak rhythm | Tempo matches the rowing stroke; the ship's name can be sung in it once chosen |
| Skarvholm | Bone flute, wind pad, seabirds | Bright in summer, thin in winter; in the late game its melody returns with salt-cracked intervals |
| The Gaelic coast | Harp, reed pipe | Ornamented, proud; Dún Fiach's variant has a slow march |
| Saltvik | Mixed: lyre and harp together, hand percussion | Busy, cheerful, a little shifty |
| Kilbrecc | Chant, hand-bell | Original chant-like writing on Latin texts in the public domain |
| The Keepers and the seal-kin | Wordless women's voices, low drone | Seal-song glissandi; Nessa's theme grows from it |
| Rán | Low choir, bowed lyre, descending line | Always falling; sea-light shimmer on top |
| Manannán | Shimmering high strings, distant horn | Mist that seems to move; never resolves |
| The Cailleach | Harsh wind, drone, struck stone | No melody; weather made music |
| The Blue Men | Call-and-response voices | Matches the rhyme duel rhythm |
| Orm | Cold drums, horn, unison men's voices | A march that never changes key: order without mercy |
| Heid | Solo voice in a seiðr-style chant, bowed lyre | Incantatory; breaks into grief |
| Thorkel's lament | Keening voice, lyre | Used at his rites and, altered, if he walks |
| Nessa | Seal-song motif | Three endings matching her branch |

## 05 / Seasons and festivals
### Seasonal palettes
| Season | Palette |
|---|---|
| Spring | Flutes, birdsong, lighter percussion; the hearth theme in a major mode for the first time after the hungry gap |
| Summer | Fullest instrumentation, long phrases, rowing songs |
| Autumn | Harp and lyre in minor, harvest songs, storms in the ambience |
| Winter | Sparse; solo voice and lyre, long silences, wind and fire |

### Festivals
| Festival | Music |
|---|---|
| Bealtaine (day 31) | Fire music: drums, pipes, dancing at the steading |
| Lúnasa (day 61) | The Saltvik fair: competing musicians, a contest the player can watch |
| Samhain (day 91) | Hushed; voices outside the walls; the aos sí motif |
| Yule (day 105) | The feast: the household sings together; the size of the choir is the size of the household |
| Imbolc (day 1 of a new year) | A single new verse added to the household theme each year |

## 06 / Diegetic music and song
*Residents make music. Songs are performed at the fire, at the oars and at work.*

- **Rowing songs** set the stroke; the ship rows slightly better in calm water when a song is going (a morale effect, not a puzzle).
- **Work songs** at the forge, the fields and the nets.
- **Feast songs** at Yule and after victories; some mock rivals, one mocks the steerer kindly.
- **Laments**: keening for the Gaelic dead, a sung list of deeds for the Norse dead.
- **A skáld's verse** about the household's deeds, composed from the ledger after major events: praise for bold acts, sharp verses for shameful ones. The verse text is generated from a template set written to Book 8's rules.
- **Residents who sing:** Hild, Kolla, Tófi, Nessa and Áine sing; Bran hums; Senán chants.
- All lyrics are original to this project. No traditional lyric is quoted unless verified as public domain and approved.

## 07 / Sound design
### Ambience
Layered by zone, season, weather and time: surf on shingle versus sand, wind through heather, cormorants and gulls, seals, sheep, the hearth, rain on thatch, wind in rigging, the dead quiet of fog. Every zone has a day and a night bed and seasonal variants. Secret entrances on the routes (Book 4 section 03) have a sound hint as well as their signs: a thin draught breathing at the crack, heard within a few tiles, with the information caption *A cold draught, close by*.

**The island's ambience** (Stage 14, decisions S14-100 to S14-109) is layered by rule for every scene and area, season and hour (`content/audio.json` `island`; a scene with no rule of its own is heard from its own tiles): the surf by the distance to the sea over the whole island, panned to the sea's side; the wind, strongest on the headlands and the high ground (**the wind over the high ground**, `AMB_WIND_HIGH`, on Rook Hill, the cliffs and Gull Geo; the Hag's Seat keeps its gale); the birds by season: **the cliff colony** (`AMB_BIRD_COLONY`: kittiwakes crying over the growl of guillemots, echoing off the rock, in spring and summer), **the skylark over the moor** (`AMB_SKYLARK`: its long, high song by day in spring and summer) and **the curlew on the bog** (`AMB_CURLEW`: its rising call and bubbling trill from spring to autumn, at night too); **the stream over its stones** (`AMB_STREAM`) and **the waterfall** (`AMB_WATERFALL`: a broad roar with the hiss of its spray), each by its distance and panned to it, the upper stream silent where it has shrunk to pools in summer and the falls muffled under the winter ice; **the cave's drip and echo** (`AMB_CAVE_DRIP`) in the deep passage and the cairn's inside; **the deep passage's roar** (`AMB_PASSAGE_ROAR`: the sea surging in under the rock on the swash's period), rising from the turn of a spring tide to the window's close, the warning before the passage floods; **the drowned's tell** (`SFX_TELL_DROWNED`: slow drips from no rain and a low wordless hum, a lowered second against its root, swelling and sinking) on the Skerry at the spring lows; and **the bog's quiet** (`AMB_BOG_QUIET`: the wind fallen low, and now and then a soft plop in a pool), deepest at the Grey Men. An unseen stream or waterfall has its information caption with its direction (*Running water from the east*, *Water falling from the north*; sound class, at most once a minute); the passage's roar is captioned by the passage itself (*The passage grows loud*, Book 8 section 07); the drowned's tell has its tell caption (*Slow dripping*, with its direction). The birds, the surf, the wind, the drips and the quiet carry no gameplay information and are not captioned.

**The island's finds, puzzles and gathering** (Stage 14, work package C, decision S14-86), generated in code like the Chapter 1 finds: a single shell lifted, a damp scrape and one hollow click with its ring (`SFX_FIND_SHELL`); a psalter page, oiled leather drawn back and dry vellum's soft crackle (`SFX_FIND_PAGE`); the drowned spoken with, slow drips on dry rock over the sea breathing low (`SFX_FIND_DROWNED`); lore, a palm on cold stone and a low hum of two close tones beating (`SFX_FIND_LORE`); the bog's cauldron, peat sucking free and a dull bronze note (`SFX_FIND_CAULDRON`); the cairn's east door turning on its pivot, a long grinding rumble that settles (`SFX_CAIRN_DOOR`); the deep passage's warning as the tide turns is the passage's roar above (`AMB_PASSAGE_ROAR`); and the resource nodes gathered: cress pulled from running water (`SFX_GATHER_CRESS`), heather cut in three strokes (`SFX_GATHER_HEATHER`), a hare lifted from its form (`SFX_GATHER_HARE`), bog cotton plucked (`SFX_GATHER_COTTON`), kelp hauled off the rocks (`SFX_GATHER_KELP`), eggs lifted while the seabirds cry (`SFX_GATHER_EGGS`), a peat spade biting and lifting (`SFX_GATHER_PEAT`), a fish flapping on the rock (`SFX_GATHER_FISH`) and seals groaning at the haul-out (`SFX_GATHER_SEAL`). Each has its information caption (`caption.sfx.*`); what was found or gathered is told by its own caption (`caption.find.*`), which the audit keeps as a story line.

### Foley
Footsteps by surface (shingle, sand, machair, heather, peat, mud, stone, timber deck, plank road, snow; and splashing through shallow water). Footsteps are **soft and natural**: low and dull, with no sharp click (every step rises over at least 2 ms), a heel and a softer roll onto the toe, and drawn afresh each step so no two sound the same (decision AU-10). Each surface has its own character: a soft thud on grass, a crunch of shifting stones on shingle, a hush on sand, a duller squelch on wet sand, a splash and drops in water, a dull knock on rock. Running is a little louder and quicker, carrying heavier, sneaking much quieter. Footsteps sit at least 10 dB below the effects that matter. Work sounds for every homestead task (adze, hammer, forge, sickle, net, spade, quern, loom). **Residents at the boat are heard at it** (the user's fourth playtest, DH-63): each worker in earshot sounds the repair's adze and mallet every Book 10 boatWorkSound, panned to them, so a crew spread round the hull is heard as several hands; like all work sounds, not captioned (Book 8 section 10).

**The opening's tactile sounds** (design addendum 2.4): the cold open's storm (wind, rain, timber groaning, the crack of the strike); waking coughing in the surf; the net's cords parting under the seax, strand by strand, with Hild's gasp as a voice blip; Thorkel's chest scraping and bumping up the shingle, and set down with a thud; the flint's strike and sparks, the tinder's crackle and the flame taking; the sail hauled up, ropes creaking taut, the cloth flapping then filling with a soft boom and settling; the key in the chest's lock and the lid's creak; the lashing parting under an arrow and the bundle's splash; the arm-ring's small clink from the pool. **Doors:** a driftwood door's creak and knock, a hide or cloth flap's soft slap, a bar dropped into its brackets. **Rain on the sail cloth** inside the shelter is a soft patter with drips from the edge, heard only under it. Each has an information caption (Book 8 section 10). **The shelter's stages** (the user's third playtest, decision DG-12): the frame, oars knocked together and the lashing drawn tight with a creak, pegs driven into the turf with a stone; the sail and lashings, the sail hauled up (as before) and the lashings creaking taut along the ridge, stones set on the foot; the finishing on the second day, turf cut and slapped down, a mallet on pegs, the driftwood door's first creak. **Thorkel taken by the sea** (decision DG-14; Book 10 section 08): the surf's wash rising wave by wave, each a deeper boom and a longer hiss of foam; the bier's planks knocking on the shingle as the third wave lifts it, then quiet; a slap of water on the cloak as it drifts; as it sinks, a deep swallowing gulp and a fizz of bubbles, then only the surf and the gulls. Seen, so not captioned (the audit). **Chapter 1's small finds** (the user's fourth playtest, request 24; decision DH-119): cowrie shells lifted out of the wrack, a damp rustle and a few small clinks (`SFX_FIND_SHELLS`); the nest's gull crying twice overhead and straw rustling under a hand (`SFX_FIND_EGGS`); a palm brushing lichen off old stone and a fingertip in a groove, for the carved stone and the kerbstone (`SFX_FIND_STONE`); a stone picked up and set on the waymark cairn, knock and settle (`SFX_FIND_CAIRN`); the faint, dull ring of an old bronze pin stirred in its cleft over the wind's hush (`SFX_FIND_OFFERING`); a skull's dry knock on its ledge and the shells round it shifting (`SFX_FIND_BONE`); and iron grating free of a crack with a small ring as the knife comes (`SFX_FIND_KNIFE`). Each has its information caption (`caption.sfx.find_*`); what was found is told by the find's own story caption (`caption.find.*`), which the audit keeps as a story line.

**The movement verbs** (Stage 14, work package B, decision S14-61), generated in code (`src/audio/synth/traverse.ts`): fingers biting into a crack, grit trickling and a shoe finding the next hold, at each hand-hold taken on a climb (`SFX_CLIMB_HOLD`); every fourth hold, a hard breath pushed out through the teeth with the leather creaking under the pull, the steerer's breath and never a voice (`SFX_CLIMB_STRAIN`); the grip going, hands and shoes scrabbling down the face in a long rattle of grit as a spent climber slides (`SFX_CLIMB_SLIDE`); an arm reaching over and pulling through the water, a soft slap and its swirl, at each swim stroke (`SFX_SWIM_STROKE`); a thrash at the surface, the water closing over with a choked gulp and bubbles rising as a spent swimmer starts to sink, and again as the drowning begins (`SFX_SINK`); head up out of it at the shallows, a ragged in-breath and a cough of water (`SFX_SINK_GASP`); a palm and a knee on damp rock with cloth dragging, at each shuffle of a crawl (`SFX_CRAWL`); a heavy stone ground along stone for the length of each step it is pushed or pulled (`SFX_STONE_SCRAPE`); and both feet coming down together with a thud and a scuff at a jump's landing and a slide's end (`SFX_JUMP_LAND`). Each has its information caption (`caption.sfx.*`); all are seen in the steerer's own frames, so the audit keeps them off the screen, and going under has a safety line instead, saying what to do (`caption.traverse.sinking`, `caption.traverse.drowning`; Book 8 section 10).

### Combat
| Event | Sound |
|---|---|
| Light attack | Short whoosh by weapon; hit by material (flesh, mail, shield) |
| Charge level 1 | A tightening creak and breath |
| Charge level 2 | A distinct ring and exhale: the audible guard-break warning |
| Parry | A bright clang with a short tail, unmistakable from a block |
| Block | A heavy wooden thud |
| Guard break | Splintering crack and a stagger grunt |
| Dodge | Cloth and footwork |
| Gore | Wet impacts, bone crack on heavy blows, dismemberment with a short, sickening detail; scaled by the gore setting |
| Downed | A fall, breath, and a heartbeat for crew |
| Bow string | The creak of the draw growing with it, then the snap of the string on the loose; a thrown spear's grunt and the rush of the throw |
| Arrow in flight | A short, thin whistle that passes with the arrow, panned and fading with its distance from the listener; a spear's lower rush |
| Missile strikes | A thunk into timber (a hull, a wall, a tree); a duller thud into earth and turf; a hard knock into a shield, with the board's ring; a crack and a skitter where it breaks on stone; a small splash into water; into a body, the gore set's wet impact |
| Hits (combat v2) | Every hit is layered: the impact by what it meets (flesh, mail or shield wood) and a grunt or cry from the one hit, pitched to their voice. The steerer's own hurt is a sharp breath, never a voiced cry, so it never hints at a gender (decision DE-7) |
| Parry and riposte (combat v2) | The parry's sharp, bright ring rides on its long hitstop; the riposte has a heavy, distinct whoosh and impact of its own |
| Lunge and backstab (combat v2) | The lunge's tell is a scuff of feet and a drawn breath; the backstab is a short struggle, muffled, carrying only a few tiles |
| Arrow dodge and awareness (combat v2) | A quick scuff for a sidestep; a suspicious enemy's "Who's there?" is a bark with its blip; turning alert, a sharp intake of breath and the weapon drawn |
| Warnings | Spoken barks with blips, rising as the steerer comes on; a weapon drawn near them rings out of its sheath |
| Telegraphs (design addendum 2.5) | Every enemy attack has a distinct sound at its tell's flash, 28 ticks before the blow lands (Book 10 section 06, "Telegraphs"), panned to the attacker and louder with the blow's weight: a sharp breath for a light attack; steel scraping for a bladed heavy or charged attack; a grunt and a creak of wood for an axe, club or Dane axe heavy; the charge's creak and ring; a scuff and a drawn breath for a lunge; the bow's creak as it is drawn; a low growl for a wolf, snorting and pawing for a boar, a wet rattle for the draugr's grip, a gurgle for the each-uisce. Each weight is told apart by ear, so a player can parry by sound alone. The steerer's own attacks have a breath only |
| Finishers (the user's third playtest, decision DG-3) | One heavy, distinct blow for each weapon and variant, on its active tick: a short wet thrust for the seax and the spear, a heavy chop for the axes, a dull crushing blow for the club, the foe's own weapon's sound when unarmed; the impact rides the long hitstop, then the body's fall. The steerer's effort is a breath. The foe's last sound is a short, wordless breath out, never a scream drawn out. Scaled by the gore setting |
| The spare (decision DG-4) | The steerer's sharp breath with the shout (no blip), the dropped weapon's clatter on the ground's material, the spared foe's reply in their blips and their running feet going away |
| The steerer's death (the user's fourth playtest, decision DH-71) | The killing blow and the fall's thud as any fall; then every sound drops away to silence (Book 10 "The steerer's death", soundFade): effects, voice blips and the tells within half a second, the world and the music over 1.6 s, the thud left to ring out under it; a still beat in silence; then the `GAME_OVER` sting as the death screen comes, and the mix back over half a second when a save is loaded. No caption |
| The strongbox snatched (the user's fourth playtest, decision DH-17) | `SFX_SNATCH`: feet skidding to a stop in the shingle, the box's iron handles clanking twice as it is hauled up, the coins shifting inside, panned to the thief; seen, so not captioned in play |
| Svart's guard (decision DG-9) | A dry clack of the shaft turning a blow, with a scrape of iron along the wood (on the shield, a hollow knock with a short ring): unlike a block's thud, so the ear learns that nothing landed |
| The red blow (decisions DG-9 and DG-10) | **Steel scraping**: the axe's beard drawn along the shield's iron rim from the wind-up's first tick, rising to the flash; at the flash, a bright metallic hiss with the red glint. Unlike every other tell, so a player can dodge it by ear. Its miss is the axe biting turf with a heavy thud and Ketill's grunt |
| First sight and the fold (decisions DG-8 and DG-26) | First-sight lines are spoken barks with blips (section 08). The fold's talk is blips at speaking level within the overhearing range, and a low murmur of blips with no words beyond it, out to its edge |
| Commitment and stamina (design addendum 2.5) | A parry's wind-up is a short rasp of the guard coming up, distinct from the parry's ring; a block raised, a soft leather creak; a dodge, cloth, a push-off and a heavy landing; a missed attack, the whoosh carrying on into an overbalanced scuff; a guard broken by an empty bar, a splintering crack and a stagger grunt, longer than any other break; the exhausted, hard, ragged breathing until stamina is back to the threshold (the steerer's as breath, like every steerer sound). None has a caption in a fight (section 09) |

### Ships and sea
Oar creak and splash in time with the stroke; sail flap, fill and strain; hull groan in storms; the scrape of beaching; grapnel and boarding-plank impacts; arrows into wood and shields.

**At sea** (Stage 13, decisions S13-66 to S13-69). The sea map has a bed of its own under the music, by the weather now: the open swell, low and slow, the sound of distance; the water running along the strakes while she moves; small waves slapping the hull, heavier with the sea and booming in a storm, panned to the side they strike; and **wind in the rigging** (`AMB_WIND_RIGGING`), rising with the wind's strength as a share of a storm's, its stays whistling and its gusts lifting it. While the crew row, the oars' splash at the catch and their creak on the recovery fall in time with the stroke of the sea's music (a stroke every two beats). Under sail the sheets creak now and then and, in light airs, the cloth luffs. In a storm the hull groans with every heavy sea. **The dead quiet of fog** (`AMB_FOG_QUIET`): the wind and the far sea fall away; a dulled swell, water lapping close along the planks, a drip from the rigging and the mast's small creak, nothing far off, and no music. The sail's moments are one-shots: **the sail reefed** (`SFX_SAIL_REEF`: the halyard run out, the loose cloth flogging as it is gathered, the reef points tied off in quick rubs of rope, the sheets creaking taut again), when the steerer presses on into rising weather; **the sail luffing** (`SFX_SAIL_LUFF`: the cloth shivering along its edge in a rapid rattle that swells and dies), as a leg begins close-hauled; **the sheets straining** (`SFX_SAIL_STRAIN`: the cloth booming full, the sheets and stays creaking long under the load, the taut rope humming), as a leg begins under sail in a fresh wind; the sail filling as before in lighter winds; and **the hull groaning** (`SFX_HULL_GROAN`: the strakes groaning long against their rivets, a treenail's sharp creak at the end), with storm damage, and a sea on the hull in each watch of a storm. There is no watch bell: the watches pass on the sea map's clock. The sea map shows the wind, the fog, the rowing or the sail and the storm, so only the hull's groan has a caption in play (*Timber groaning*, sound class).

**The wreck with survivors** (Stage 13, decisions S13-70 to S13-73). On its skerry the wreck has a bed of its own, **surf on the rocks and gulls over the wreck** (`AMB_SEA_WRECK`): the swell heaving up and breaking heavily on the rock, its wash draining back through the weed, gulls crying more often than on the strand, water slopping in the broken hull and a plank's creak, panned to where the wreck lies. Over it, **timber breaking** (`SFX_WRECK_BREAK`: a strake splintering in a crackle that closes into one hard split, and the piece falling into the sea), **the hull grinding on the rock** (`SFX_WRECK_GRIND`: a long rough scrape with grit in it as the swell lifts it, the planks groaning, the water slopping in) and **cries from the wreck** (`SFX_WRECK_CRIES`: the survivors calling across the water in their own voices, wordless and far, softened by the distance and carried on the echo). The cries have their caption with their direction (*Cries for help from the east*, direction class); the timber's caption shows only while the wreck is out of view (*Timber breaking on rock*, *A hull grinding on rock*, sound class).

**The storm of the cold open** (design addendum 2.5 section 3; Book 10 section 25, "The storm"): **thunder** after every lightning flash, its delay and loudness by the strike's distance (a near strike a sharp crack splitting into a long roll, a far one only a low rumble, 2.5 to 4 seconds), never on the flash itself; the **wind** howling in the rigging, rising with each gust; **rain** hissing on the sea and drumming on the deck and the sail; **waves** breaking against the hull, a deep boom and a hiss of spray falling back across the deck, panned to the side they strike; **timber** groaning and the mast creaking in time with the pitch and roll, so the sound rocks with the picture; the torn sail flogging; Thorkel's shouts as voice blips. No music: the cold open is the storm alone (section 03). Under the new caption rules only Thorkel's speech has a line: the storm is seen.

Every missile sound (section 07, Combat) has an information caption with its direction where it helps: *Bowstring, to the north*; *Arrow overhead*; *Arrow into timber*; *Arrow into the ground*; *Arrow on a shield*; *Arrow breaks on stone*; *Arrow into the water*. The whistle is captioned only when an arrow passes near the steerer, so a volley does not flood the captions.

### Supernatural tells
Each sign has a unique, learnable audio tell, so a careful player can hear danger before seeing it: Rán's sea-light hum under the water, hooves on water for Manannán, hail on stone for the Cailleach (and at the Hag's Stone, its hush: the wind dropping to nothing and the birds falling silent, a low drone and a whisper rising out of the silence, then a sudden gust and the world's sounds back at once; Book 10 section 25 times it; captioned *The wind drops*, *A whisper by the stone*, *A sudden gust*), verse from the troughs for the Blue Men, a dripping that follows for the draugr, keening for the bean sí, and the washer's rhythmic slap of cloth on stone. Each tell has a caption.

## 08 / Voice
*No voice acting. Dialogue and barks are text; each speaker has a short voice blip.*

- **Voice blips:** as a line appears, its speaker "speaks" it in short blips, one per syllable, in their own pitch, timbre and rhythm. The text's vowels colour each blip; punctuation shapes the line (a question rises, an exclamation lifts, a comma pauses). Each speaker's voice follows who they are (Book 5): Hild warm and lively, Bran low and measured, Runa clipped and firm, Oddi quick and jittery.
- **Talk among the household, nudges and advice** (the user's fourth playtest, DH-48 to DH-58) are speech lines in their speakers' own blips, like barks; no new voice and no new sound.
- **The steerer** has no voice blip, keeping the steerer's gender unstated. In a fight the steerer's hurt and effort are breath, never a voiced grunt or cry. The steerer's spare shout (the user's third playtest) is the one speech line under the steerer's name in play: it is shown as text with a sharp breath and no blip. The steerer's word over a body (the user's fourth playtest, decision DH-26) is the other: shown as text under the steerer's name with `SFX_STEERER_SIGH`, a slow, soft breath out through the nose, and no blip.
- **Fighters' grunts and cries** (combat v2) are short, wordless sounds in each fighter's own voice, made like the blips; enemies who warn, or turn suspicious, bark in words with their blips (Book 8 sections 07 and 08).
- **The wreck's survivors** (Stage 13, decision S13-70; Book 5 section 02): the three adults on the skerry each have a voice blip of their own, from who they are: Fínán (`C_FINAN`), about fifty, formal even half-drowned, low and measured, falling at the ends; Derbáil (`C_DERBAIL`), about forty-five, keen-eyed and precise, a clear middle voice, even and firm; Ívar (`C_IVAR`), about twenty-five, quick to laugh at his own bad luck, light, quick and rising. Their pitches are apart from every resident's and the scavengers'. The cries from the wreck are theirs too, wordless: Derbáil first, Fínán's long low call, Ívar's quick one from the shingle.
- **Song** is music: the residents who sing (section 06) are heard as melody lines on the hummed-voice pad or a whistle, with their lyrics as text.
- Every line has its subtitle; blips are never the only source of required information.

## 09 / Mix and accessibility
- **Priority order:** threat tells, combat feedback, voice blips, music, ambience, footsteps. Threat tells are never masked; the steerer's own footsteps are the quietest thing in the mix, at least 10 dB below a light hit (tested by `tests/browser/sound.spec.ts`).
- **Ducking:** music ducks under blips and stingers; ambience ducks under combat. At the steerer's death everything falls to silence (section 07, "The steerer's death"), which no slider or pause duck undoes until a save is loaded.
- **Loudness:** integrated about -16 LUFS for the master on the web; true peak below -1 dBTP. Music sits about -21 to -24 dBFS RMS, ambience about -22, so effects and tells stand out.
- **Sliders:** master, music, ambience, effects, voice blips, and a separate slider for supernatural tells, in the pause menu's audio settings (decision DG-18). The pause menu's items make a soft wooden click, and opening it a muted thump; these are interface sounds, not captioned.
- **Captions** for gameplay-relevant sounds the picture does not already show, with direction where it helps ("Horn, north"), one line at a time (Book 2 section 18). In a fight, combat sounds are read by ear and by their drawn twin (the telegraph's draw-back and flash, sparks, the parry's spark) and are not captioned; an accessibility option, off by default, captions them (design addendum 2.5; decision DF-14). Sound captions that only restate the picture (work, doors, the opening's actions, music) are cut (Book 8 section 10, the audit).
- **Mono** option and a reduced dynamic range option for small speakers.
- **Gore audio** follows the gore setting.

## 10 / Technical specification
| Item | Specification |
|---|---|
| Engine | Web Audio API, one `AudioContext`, unlocked on first input; the same code renders offline (`OfflineAudioContext`) for tests |
| Music | Note data in `content/music/<piece>.json` (tempo, metre, mode, echo, layers, seasonal variants), played by an in-game sequencer and synthesiser (`src/audio/synth/`); notes scheduled ahead of the audio clock; loops seamless; every change lands on a bar line |
| Instruments | Short samples generated in code at load (32 kHz), deterministic; 8 music voices with stealing |
| Effects and tells | Generated per event from oscillators, noise and filters; at most 48 voices |
| Ambience | Generated layers driven by the game's state: the wind from the game's own wind field, the tide, the zone, season, weather and time |
| Latency | Combat sounds scheduled within one frame of the hit event |
| Spatial | Stereo panning and distance attenuation by tile distance; no HRTF required |
| Memory | Under 20 MB of generated samples and buffers |
| Events | Sim events map to `SFX_`, `AMB_`, `MUS_` and `VO_` IDs through a content table; audio never reads hidden truth and never affects the simulation, saves or determinism |
| Naming | IDs `amb_<zone>_<season>_<time>`, `sfx_<event>_<variant>`, `mus_<state>_<stem>` and `vo_<stringKey>` (the voice blip of a line), written in capitals in content (`AMB_`, `SFX_`, `MUS_`, `VO_`); offline renders take the same names with `.wav` |
| Listening back | `npm run audio:render` renders every piece and sound to WAV with its levels (`artifacts/audio/`); the sound test page (`sound.html`) plays them all |

## 11 / Production plan
*All audio is generated by the game, composed and designed by Claude (section 12). Nothing is recorded or licensed.*

| Phase | Audio deliverable |
|---|---|
| Stage 5 | Audio engine, music state machine, captions |
| Art and audio passes | The synthesiser and sequencer; the hearth, Skarvholm and raid music; the Wreck Strand ambience; combat set; three tells; voice blips; the sound test page |
| Build 1 (Stage 12) | Audio wired into play for everything built; home music by time of day with the silence rule; the wreck opening ambience; first combat layers; Chapter 1 effects |
| Build 2 (Stage 20) | Sea states (built at Stage 13 with the sea map and the wreck), raid approach, alarm and extraction, Carrick ambience, home seasons |
| Build 3 (Stage 24) | Saltvik, sea battle, first supernatural motifs, blips for the starting crew |
| The living coast (Stages 25 to 27) | Travellers, carts, herds and bandits; wandering characters' blips; festivals; winter, Samhain and Yule |
| Build 4 (Stage 33) | The mainland sites' and the six wilderness routes' ambiences and music by season; wilderness hazard warnings (wolves, thunder, the bog); the six dungeons and their guardians; the four small dungeons behind the secret entrances, and the draught that hints at them; the mainland leaders' blips |
| Campaign (Stages 34 to 37) | Moving ashore, all motifs, laments, the Return to Skarvholm, the finale |
| Stage 38 | Final mix, loudness pass, captions complete |

Each stage that adds a place, character or system adds its sounds and music to the section 12 standard.

## 12 / Audio standard
*Permanent, like Book 7's terrain art standard: every stage that adds a place, character or system meets it, and is not done until it does.*

### The decision
The game generates all of its own audio. No recordings, no commissioned composer, no voice acting, no licensed or sampled music. Every tune, sound and ambience is original, written by Claude and played by the game.

### Music
- **Style:** SNES-era and Stardew-like, darker and more wind-blown than Stardew. Modal and Celtic-Norse: mostly Dorian and Aeolian, drones underneath, ornamented melodies.
- **How it works:** each piece is composed as note data (patterns, instruments, tempo, layers) and played by the in-game synthesiser and sequencer, within SNES-like limits: about 8 voices, small instruments, one shared echo.
- **Instruments:** plucked lyre, bright harp, breathy flute and tin whistle, frame drum and hand percussion, low drone, soft choir-like pad, bells, a horn call (section 02).
- **Kept from this book:** the themes and motifs (section 04), the music states, layers driven by an intensity value, stingers, changes on bar lines (section 03), seasonal variations and festivals (section 05).
- **The household theme grows:** it gains an instrument or part as the household grows, and a new verse each year.
- **Silence matters:** at least a third of time at home is ambience only.
- **References** (section 01): match their qualities, never their melodies. The hearth theme should feel like Chrono Trigger played on a cold night; the sea should feel like Dredge.

### Sound effects and ambience (also generated)
- Ambience in layers by zone, season, weather and time of day: surf on shingle and sand, wind tied to the game's own wind direction and strength, rain, the hearth fire, seabirds, sheep.
- Footsteps by surface; work sounds for every homestead task; ship sounds (oars, sail, hull).
- Combat: distinct sounds for light hits, both charge levels of the heavy, parry (bright and unmistakable), block, guard break, dodge and gore, all scaled by the gore setting; every hit layered as its impact on flesh, mail or shield wood with a grunt or cry (the steerer's a breath); the riposte, the lunge's tell and the backstab; and for every missile, the bow string, the arrow's whistle in flight, and its strike into timber, earth, a shield, stone or water, each with an information caption.
- Doors and flaps opening and closing; the opening's tactile actions (section 07).
- Music fades in gently from a single layer and fades out whenever it stops; only stingers start and stop sharply (section 03, "Fades").
- Every supernatural sign has its own learnable sound tell (section 07).
- Every gameplay-relevant sound that the picture does not show has its caption; combat sounds have a drawn twin instead and are never captioned, in any mode (decision DF-80).
- Every enemy attack has its telegraph sound, told apart by weight; the exhausted breathe hard; the cold open's storm has thunder after the lightning, wind, rain, breaking waves and timber rocking with the ship (sections 07 and "Ships and sea").

### Voice
No voiced barks. Dialogue and barks stay as text, with a short voice blip for each speaker (their own pitch, timbre and rhythm). The steerer has no voice blip.

### Engineering
- Audio is presentation only: it reacts to simulation events and never affects gameplay, saves or determinism, and never reveals hidden truth.
- Web Audio API, one AudioContext unlocked on the first input. Loops are seamless, and music changes always land on a bar line.
- Separate volume sliders for master, music, ambience, effects and voice blips, plus one for supernatural tells. Mono option. Within the Book 2 and section 10 budgets.

### How it is checked
- `tests/unit/synth.test.ts`: every bar fits its metre; every pitched note is in its piece's mode in every season; no piece needs more than 8 voices; samples are deterministic, never clip and loop without a click; every gameplay-relevant sound has a caption or, in a fight, a drawn twin, and every enemy attack weight has its telegraph sound; every speaker has a voice of their own and the steerer none.
- `tests/unit/seaAudio.test.ts` (Stage 13): the sea's three pieces in their mode and metre, each within 8 voices counting every release and the seam, each starting from the drone and looping without a gap; the music and the bed routed purely from the weather and the voyage; every sea and wreck sound with its caption and its audit verdict; the survivors' own voices.
- `tests/unit/islandAmbience.test.ts` (Stage 14): which layers play in every scene and area by season and hour, the surf by the sea's distance, the stream, the falls, the roar by the tide and the drowned's tell at the spring lows; every island cue with its generated sound, the unseen water's and the tell's captions and their audit verdicts.
- `tests/browser/sound.spec.ts`: the sound test page offers every item; rendered offline, every item sounds and none clips, the hearth theme loops without a gap, and a raised alarm lands on the next bar line.
- Listening back: `npm run audio:render` writes every item to `artifacts/audio/` with its levels, for spectrograms and a listen against this section before anything is shown to the user.

