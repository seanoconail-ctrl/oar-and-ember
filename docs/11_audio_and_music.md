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
Footsteps by surface (shingle, sand, machair, heather, peat, mud, stone, timber deck, plank road, snow; and splashing through shallow water). Footsteps are **soft and natural**: low and dull, with no sharp click (every step rises over at least 2 ms), a heel and a softer roll onto the toe, and drawn afresh each step so no two sound the same (decision AU-10). Each surface has its own character: a soft thud on grass, a crunch of shifting stones on shingle, a hush on sand, a duller squelch on wet sand, a splash and drops in water, a dull knock on rock. Running is a little louder and quicker, carrying heavier, sneaking much quieter. Footsteps sit at least 10 dB below the effects that matter. Work sounds for every homestead task (adze, hammer, forge, sickle, net, spade, quern, loom).

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
*No voice acting. Dialogue and barks are text; each speaker has a short voice blip.*

- **Voice blips:** as a line appears, its speaker "speaks" it in short blips, one per syllable, in their own pitch, timbre and rhythm. The text's vowels colour each blip; punctuation shapes the line (a question rises, an exclamation lifts, a comma pauses). Each speaker's voice follows who they are (Book 5): Hild warm and lively, Bran low and measured, Runa clipped and firm, Oddi quick and jittery.
- **The steerer** has no voice blip, keeping the steerer's gender unstated.
- **Song** is music: the residents who sing (section 06) are heard as melody lines on the hummed-voice pad or a whistle, with their lyrics as text.
- Every line has its subtitle; blips are never the only source of required information.

## 09 / Mix and accessibility
- **Priority order:** threat tells, combat feedback, voice blips, music, ambience, footsteps. Threat tells are never masked; the steerer's own footsteps are the quietest thing in the mix, at least 10 dB below a light hit (tested by `tests/browser/sound.spec.ts`).
- **Ducking:** music ducks under blips and stingers; ambience ducks under combat.
- **Loudness:** integrated about -16 LUFS for the master on the web; true peak below -1 dBTP. Music sits about -21 to -24 dBFS RMS, ambience about -22, so effects and tells stand out.
- **Sliders:** master, music, ambience, effects, voice blips, and a separate slider for supernatural tells.
- **Captions** for every gameplay-relevant sound, with direction where it helps ("Horn, north").
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
| Build 2 (Stage 20) | Sea states, raid approach, alarm and extraction, Carrick ambience, home seasons |
| Build 3 (Stage 24) | Saltvik, sea battle, first supernatural motifs, blips for the starting crew |
| The living coast (Stages 25 to 27) | Travellers, carts, herds and bandits; wandering characters' blips; festivals; winter, Samhain and Yule |
| Build 4 (Stage 33) | The mainland sites' and the six wilderness routes' ambiences and music by season; wilderness hazard warnings (wolves, thunder, the bog); the six dungeons and their guardians; the mainland leaders' blips |
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
- Combat: distinct sounds for light hits, both charge levels of the heavy, parry (bright and unmistakable), block, guard break, dodge and gore, all scaled by the gore setting.
- Every supernatural sign has its own learnable sound tell (section 07).
- Every gameplay-relevant sound keeps its caption.

### Voice
No voiced barks. Dialogue and barks stay as text, with a short voice blip for each speaker (their own pitch, timbre and rhythm). The steerer has no voice blip.

### Engineering
- Audio is presentation only: it reacts to simulation events and never affects gameplay, saves or determinism, and never reveals hidden truth.
- Web Audio API, one AudioContext unlocked on the first input. Loops are seamless, and music changes always land on a bar line.
- Separate volume sliders for master, music, ambience, effects and voice blips, plus one for supernatural tells. Mono option. Within the Book 2 and section 10 budgets.

### How it is checked
- `tests/unit/synth.test.ts`: every bar fits its metre; every pitched note is in its piece's mode in every season; no piece needs more than 8 voices; samples are deterministic, never clip and loop without a click; every combat sound and tell has a caption; every speaker has a voice of their own and the steerer none.
- `tests/browser/sound.spec.ts`: the sound test page offers every item; rendered offline, every item sounds and none clips, the hearth theme loops without a gap, and a raised alarm lands on the next bar line.
- Listening back: `npm run audio:render` writes every item to `artifacts/audio/` with its levels, for spectrograms and a listen against this section before anything is shown to the user.

