# Oar and Ember, Book 11: Audio and Music Brief

*Direction for music, sound and voice: instruments, themes, the adaptive music system, seasons and festivals, diegetic song, sound design, mix, accessibility and technical delivery.*

Music is a priority. It should make the household's growth audible, make the sea feel enormous, and make the strange things in the mist feel old. Sound must also carry gameplay: in a game without a pause, the ears warn first.

**How to use:** Composers and sound designers use sections 01 to 07; the coding LLM implements sections 03 and 08 to 10 against Book 2 section 18. Every cue and sound has a stable ID (`MUS_`, `SFX_`, `AMB_`, `VO_`).

_Direction, not delivered audio. All music and lyrics must be original or properly licensed; no existing songs, recordings or melodies are reproduced. Instrument choices are period-inspired, not claims of historical accuracy._


## 01 / Direction
*Intimate and huge at once: a few human voices and instruments against wind, sea and silence.*

- **Home is small and warm.** Few instruments, close and dry, as if played in the longhouse.
- **The sea is vast and indifferent.** Low drones, wide reverb, the sound of distance.
- **Violence is percussive and sudden**, not orchestral bombast. Drums, breath, impacts.
- **The supernatural is old and slightly wrong**: detuned intervals, voices without words, sounds that move against the wind.
- **Silence is a tool.** Long stretches of ambience only; music arrives when it means something.
- **Growth is audible.** The household theme gains instruments and voices as the household grows and prospers.

## 02 / Instruments and palette
### Core instruments (period-inspired)
| Instrument | Use |
|---|---|
| Lyre (plucked, six strings) | Norse household; the hearth theme |
| Early Gaelic harp | Gaelic coast, Kilbrecc's patrons, Órlaith |
| Bowed lyre | Sorrow, the drowned, Heid |
| Bone and wooden flutes | Skarvholm, wind, birds |
| Reed pipes and horn | Shepherds, signals, the ship |
| Frame drums and hand percussion | Rowing, combat, feasts |
| Bells (hand-bell, small iron bells) | Kilbrecc, the Bell of Brecc |
| Voices: solo unaccompanied song, men's and women's choirs, chant | Everything; the most important instrument |
| Herding calls and keening | Mountain shielings; mourning |

### Supporting textures
Low sustained strings and modern drones used sparingly to give scale at sea and in the finale. Field recordings of wind, surf, seabirds and fire processed into pads. No guitars, no modern drum kits, no synth leads in the foreground. No bagpipes or fiddles, which feel later and Scottish or Irish-cliché.

### Scales and intervals
Modal, mostly Dorian and Aeolian with drones. The Gaelic coast leans pentatonic and ornamented; the Norse household leans on fourths and fifths. The supernatural uses detuned unisons, a lowered second, and slow glissandi.

## 03 / The music system
*Adaptive music driven by place, time, season, threat and story. Changes land on bar lines.*

### States
| State | Triggers | Character |
|---|---|---|
| `MUS_HOME_DAWN/DAY/DUSK/NIGHT` | At home by time of day | Hearth theme variations; sparse at night |
| `MUS_ISLAND_EXPLORE` | Island zones away from the steading | Flutes and wind; zone motifs |
| `MUS_REGION_<id>` | Mainland hinterlands | Regional palettes |
| `MUS_SEA_CALM/WIND/STORM` | Sea map by weather | Rowing pulse in calm and wind; drones and drums in storm |
| `MUS_RAID_APPROACH` | Landing, unalarmed | Low pulse, held breath |
| `MUS_RAID_ALARM` | Alarm raised | Drums enter on the next bar |
| `MUS_COMBAT_1/2/3` | Combat by intensity | Layers add with enemy count and danger |
| `MUS_EXTRACTION` | Carrying to the boat | Driving rhythm, rising |
| `MUS_SEABATTLE` | Sea battle | Rowing drums and horn calls |
| `MUS_SUPERNATURAL_<power>` | Signs and encounters | Each power's motif |
| `MUS_COUNCIL` | Kilbrecc council | Restrained, ceremonial |
| `MUS_RETURN_SKARVHOLM` | The late-game expedition | The island theme broken and salted (section 04) |
| `MUS_FINALE_*` | Chapter 8 | All themes converging |

### Layers and intensity
Most states have three to five stems (bed, rhythm, melody, voice, danger). An `intensity` value from 0 to 1, driven by threat awareness, enemy count and the steerer's vitality, mixes the stems. Intensity rises within one bar and falls over four, so music never flickers.

### Stingers
Short cues on key events: discovery, a resident's death, a bargain accepted, the horn, the charge level-2 tell (also a sound effect), a level up, a building finished, a chapter end. Stingers duck the music under them.

### Rules
- Combat music never starts before the player can see or hear the threat.
- No music during the first seconds of the opening: wind, surf and Hild's voice only.
- At least 30 percent of home time is ambience only.
- A resident's death silences the music for a bar before the lament.

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
Layered by zone, season, weather and time: surf on shingle versus sand, wind through heather, cormorants and gulls, seals, sheep, the hearth, rain on thatch, wind in rigging, the dead quiet of fog. Every zone has a day and a night bed and seasonal variants.

### Foley
Footsteps by surface (shingle, sand, machair, heather, peat, mud, stone, timber deck, plank road, snow). Carrying adds breath and strain. Sneaking is audibly quieter. Work sounds for every homestead task (adze, hammer, forge, sickle, net, spade, quern, loom).

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

### Ships and sea
Oar creak and splash in time with the stroke; sail flap, fill and strain; hull groan in storms; the scrape of beaching; grapnel and boarding-plank impacts; arrows into wood and shields.

### Supernatural tells
Each sign has a unique, learnable audio tell, so a careful player can hear danger before seeing it: Rán's sea-light hum under the water, hooves on water for Manannán, hail on stone for the Cailleach, verse from the troughs for the Blue Men, a dripping that follows for the draugr, keening for the bean sí, and the washer's rhythmic slap of cloth on stone. Each tell has a caption.

## 08 / Voice
*Voiced barks only. Music and song carry the emotion; text carries the conversation.*

- **Scope:** about 40 to 80 barks per major resident and 15 to 30 per minor speaker, covering Book 8 categories; plus sung performances for the five singers.
- **Accents:** natural Irish, Scottish and Scandinavian-accented English for the respective peoples; no stage-Irish or comedy-Viking delivery. Glossary words pronounced correctly.
- **Old Norse and Old Irish:** short phrases only (oaths, blessings, toasts), checked by a speaker of the modern language and a specialist where possible.
- **The steerer** has no voiced lines, keeping the steerer's gender unstated.
- **Recording:** 48 kHz, 24-bit, dry, consistent mic distance; delivered as mono files named by string key.
- Every voiced line has its subtitle; barks are never the only source of required information.

## 09 / Mix and accessibility
- **Priority order:** threat tells, combat feedback, barks, music, ambience. Threat tells are never masked.
- **Ducking:** music ducks under barks and stingers; ambience ducks under combat.
- **Loudness:** integrated about -16 LUFS for the master on the web; true peak below -1 dBTP.
- **Sliders:** master, music, ambience, effects, voice, and a separate slider for supernatural tells.
- **Captions** for every gameplay-relevant sound, with direction where it helps ("Horn, north").
- **Mono** option and a reduced dynamic range option for small speakers.
- **Gore audio** follows the gore setting.

## 10 / Technical specification
| Item | Specification |
|---|---|
| Engine | Web Audio API, one `AudioContext`, unlocked on first input |
| Music | Streamed stems, Opus in Ogg with AAC fallback for Safari; loop points in metadata; bar and beat grid per cue |
| Effects | Decoded buffers; pooled voices; maximum 48 simultaneous voices |
| Latency | Combat sounds scheduled within one frame of the hit event |
| Spatial | Stereo panning and distance attenuation by tile distance; no HRTF required |
| Memory | Under 120 MB decoded audio at once |
| Events | Sim events map to `SFX_`, `AMB_`, `MUS_` and `VO_` IDs through a content table; audio never reads hidden truth |
| Naming | `mus_<state>_<stem>.ogg`, `sfx_<event>_<variant>.ogg`, `amb_<zone>_<season>_<time>.ogg`, `vo_<stringKey>.ogg` |

## 11 / Production plan
*Music matters, so it needs an owner. Claude can design the system and sketch music; final recordings need a composer or licensed sources.*

| Phase | Audio deliverable |
|---|---|
| Stage 5 | Audio engine, music state machine, captions; temporary cues clearly flagged |
| Build 1 (Stage 12) | Hearth theme, Skarvholm theme, wreck opening ambience, first combat layers, Chapter 1 SFX |
| Build 2 (Stage 20) | Sea states, raid approach, alarm and extraction, Carrick ambience, home seasons |
| Build 3 (Stage 24) | Saltvik, sea battle, first supernatural motifs, barks for the starting crew |
| Campaign (Stages 25 to 29) | Regional palettes, festivals, all motifs, laments, the Return to Skarvholm, the finale |
| Stage 30 | Final mix, loudness pass, captions complete, no temporary audio |

### Decisions still to make
- Who composes the final score: a commissioned composer (recommended), or licensed libraries with original arrangement.
- Whether Claude produces music sketches as MIDI or notation for the composer, and procedural ambience generators in code.
- Budget and schedule for recording singers and voiced barks.
