# Oar and Ember: Design Addendum 2.2

Date: 11 November 2026. Approved by the user. This addendum changes the design. Integrate it into
the books (each section says which), then treat the books as the source of truth again. Where it
conflicts with the books, this addendum wins. Items marked PROPOSAL are suggestions the user can
veto at the next review; build them unless vetoed.

---

## 1. Character art and animation (Books 1, 7, 10; Stage 0 decision 4)

- **Canvas:** people are drawn on a **32 x 48** canvas (was 32 x 40), foot anchor bottom centre,
  about 18 x 38 occupied pixels. Tiles stay 24 x 24; the viewport stays 640 x 360. Redo the
  steerer's two body models and Hild now, before more sprites exist.
- **Walk:** 6 frames (right contact, right down, passing, left contact, left down, passing). The
  torso and head drop exactly 1 px on the down frames. Arm swing reaches further forward and back
  to show weight. **Run:** 8 frames. Idle: breathing and occasional weight shifts and glances.
- **Secondary motion:** hair, cloaks, sashes and bags lag a frame behind the body.
- **Shadows:** every person, animal and prop has a soft semi-transparent oval ground shadow.
- **Equipment layers (paper doll):** body, clothing, cloak, helmet, armour, shield and weapon are
  separate layered sheets that share the body's frames, so worn equipment is visible. Iron helmets
  are rare: leaders and veterans wear them, most people do not. The steerer starts with none.
- **Readability:** the steerer carries a madder-red accent (sash, cloak lining or pin) from the
  Book 7 palette so they stand out against sand and grass. Residents each have one signature
  colour and silhouette detail (Hild's braid, Bran's ladle, Runa's adze, Áine's bow).
- **Cultural detail where it fits:** braids, beards, fur mantles in winter, distinct weapon
  carriage. No horned helmets, no costume-Viking excess.
- **Particles:** dust kicked up when running on sand and dry earth, footprints in sand and snow,
  splashes in shallows and streams, wood chips when chopping, sparks at the forge, chaff at the
  harvest, peat crumbs when cutting.
- **Task animations:** every homestead task has a readable work loop for the player and residents
  alike (section 8).

## 2. Water and wading (Books 7, 9)

- Water has depth bands: **wet** (no change), **ankle** (feet hidden, 3 px), **knee** (12 px of the
  sprite masked below a waterline), **waist** (22 px masked; carrying and fighting are harder),
  **deep** (swimming only where allowed).
- People in water show a waterline with a highlight, expanding **ripple rings** at the feet (on
  every step, and slowly while standing), **splashes** on entering and running, slower movement,
  and **darkened, dripping** sprites for a few seconds after leaving the water.
- **Hild in the opening** stands knee to waist deep in the shallows, partly submerged, calling,
  with ripples and spray around her.
- Streams flow visibly; foam gathers at rocks and narrows; waterfalls have falling sheets, spray
  and a churned pool.

## 3. The mainland: one shared world of twenty areas (Books 1, 4, 9, 10; replaces the three separate hinterlands)

- The mainland is **one connected region of 20 areas** on the Irish coast. Every player gets the
  same mainland; it opens up over time.
- **Home sites: two**, both on this map: **Carrick Strand** (by Ardcarn) and **Saltness** (by
  Saltvik). Arra Foot is no longer a home site. Glen Arra, Inis Rón and Crowwick remain
  destinations across the sea with their own small on-foot areas.
- From Chapter 3 the coastal areas can be reached by ship; inland areas open on foot as they are
  discovered and as blocks are cleared. The mainland is fully explorable long before Chapter 6, so
  the household chooses its home knowing the land.

### The twenty areas
| # | ID | Area | Type | Known at start | Leader / faction | Notes |
|---|---|---|---|---|---|---|
| 1 | MAIN_CARRICK_STRAND | Carrick Strand | Coast, home site A | Yes (by sea) | Ardcarn's land | Farmland by the shore first raided |
| 2 | MAIN_CARRICK_LANDING | Carrick Landing | Coast | Yes | Muiredach | First raid site |
| 3 | MAIN_ARDCARN | Ardcarn | Village | Yes | Muiredach | Fields, guesthouse, Eithne's old home |
| 4 | MAIN_LOCH_CARN | Loch Carn and Brigid's Well | Lake | No | (the each-uisce) | Water-horse; holy well |
| 5 | MAIN_KILBRECC | Kilbrecc | Monastery, coast | Yes | Abbot Colmán | Round tower, the Bell |
| 6 | MAIN_KILBRECC_FARMS | The tenant farms | Farmland | No | Colmán's reeve | Tithe barns, pilgrims' road |
| 7 | MAIN_BLACKWOOD_EDGE | Fiodh Dubh: the edge | Oakwood | No | Wilderness | Boar, charcoal burners, outlaw scouts |
| 8 | MAIN_BLACKWOOD_HEART | Fiodh Dubh: the heart | Old forest, dungeon | No | The aos sí | Hill-folk ringfort and souterrain |
| 9 | MAIN_MOIN_MHOR | Móin Mhór, the Great Bog | Bog | No | Peat-cutters (Lasair) | Plank road; floods in winter |
| 10 | MAIN_TRACKWAY | The Drowned Trackway | Bog, dungeon | No | (the Bog King) | Sunken trackway and shrine |
| 11 | MAIN_SLIABH_CARN | Sliabh Carn | Mountain | No | Herders (Dubhthach) | Shielings in summer; summit cairn |
| 12 | MAIN_CAILLEACH_CAVE | The Cailleach's Cave | Mountain cave, dungeon | No | (the Cailleach) | Ice, wind, old stone |
| 13 | MAIN_HIGH_PASS | The High Pass | Pass | No | Wilderness | Blocked by a landslide at first |
| 14 | MAIN_DUN_FIACH | Dún Fiach | Royal fort | Yes (by sea) | King Fiachra, Órlaith | Rath on a crag |
| 15 | MAIN_RIDGE_ROAD | The Ridge Road | Road | Yes | Fiachra's riders | Patrolled; tolls |
| 16 | MAIN_FORD | The River Ford | River crossing | Yes | The ford-keeper (Cuán) | Floods in spate; border |
| 17 | MAIN_SALT_PANS | Ottar's farms and salt pans | Farmland, coast | Yes | Hrefna, Ottar's steward | Work, trade, smugglers' rumours |
| 18 | MAIN_SALTVIK | Saltvik | Town, coast | Yes | Ottar Silkbeard, Gunnhild | Market, yards, guards |
| 19 | MAIN_SALTNESS | Saltness headland | Coast, home site B | Yes | Saltvik council | Sea caves below the headland |
| 20 | MAIN_MOUND_FIELD | The Mound Field and the moor | Burial ground, moor, dungeon | No | (Hrolf the Barrow-King); outlaws (Faolán) | Norse mounds; the outlaws' hill-fort beyond |

### Connections and travel times (real time on foot, walking)
| From | To | Time | Condition |
|---|---|---|---|
| Carrick Strand | Carrick Landing | 1 min | |
| Carrick Landing | Ardcarn | 1.5 min | |
| Ardcarn | Loch Carn | 2 min | |
| Ardcarn | Kilbrecc farms | 2 min | |
| Kilbrecc farms | Kilbrecc | 1 min | |
| Ardcarn | Black Wood edge | 2.5 min | |
| Black Wood edge | Black Wood heart | 3 min | Opens with the hill-folk's leave (an offering or the right words) |
| Black Wood edge | Móin Mhór | 2.5 min | |
| Móin Mhór | Drowned Trackway | 2 min | Summer and autumn only; or frozen in a winter cold snap |
| Móin Mhór | Sliabh Carn | 3 min | |
| Sliabh Carn | Cailleach's Cave | 2 min | Closed by snow in winter |
| Sliabh Carn | High Pass | 2 min | |
| High Pass | Dún Fiach | 2.5 min | Landslide until cleared |
| Kilbrecc | Ridge Road | 2 min | |
| Ridge Road | Dún Fiach | 2 min | Guards attack if Dún Fiach is hostile |
| Ridge Road | River Ford | 2.5 min | |
| River Ford | Salt pans | 2 min | Impassable in spate (spring days 1 to 20; autumn storms) unless bridged |
| Salt pans | Saltvik | 1 min | |
| Saltvik | Saltness | 1 min | |
| Salt pans | Mound Field and moor | 2.5 min | |
| Mound Field and moor | Móin Mhór | 3 min | Wolves in winter |

Quick travel along known roads between waymarks is allowed when safe; it costs game time
equal to the walk at about one game hour per real minute walked.

### How the map opens up
- **Landslide on the High Pass:** cleared by a work party (axes, levers, 6 worker-days), by
  Fiachra's men after an alliance, or by the Cailleach's hammer (section 5).
- **The River Ford in spate:** wait for the water to fall, or build a timber bridge (a homestead
  build at the ford, 8 timber, 6 worker-days), which also helps everyone who travels it.
- **The Black Wood heart:** the hill-folk let you in after an offering, a kept promise or the
  right words found in the hermit's psalter on Skarvholm.
- **The Drowned Trackway:** reachable in summer and autumn, or when a winter cold snap freezes
  the bog.
- **Hostile ground:** areas held by factions you have wronged stay open but dangerous.

### Seasons on the mainland
| Season | Changes |
|---|---|
| Spring | Rivers in spate; the ford closes; lambing in the farms; the bog wet but passable |
| Summer | Herders at the shielings on Sliabh Carn; the Trackway reachable; fairs and pilgrims; most traffic |
| Autumn | Harvest work; storms; the ford may close; nuts, berries and mushrooms in the Black Wood |
| Winter | Snow closes the Cailleach's Cave and slows the pass; the bog floods (or freezes in cold snaps); wolves range widely; fewer travellers; nights are long and cold |

## 4. Wilderness, hazards and camping (Books 1, 4, 10)

- The wilderness is **big and worth exploring**: every wilderness area has at least one secret,
  one resource worth the trip, one story (a traveller, a ruin, a grave) and one danger.
- **Hazards:** bog holes (slow, then sink unless pulled out), spate rivers (swept downstream),
  cliffs and scree (falls), cold at night, fog (getting turned round), wolves (packs at night and
  in winter), boar, outlaws (ambushes, roadblocks), landslides after rain, lightning on high
  ground, and the hill-folk's rules.
- **Camping:** the steerer can sleep anywhere not hostile, with a bedroll and a fire. A camp ends
  the day, heals, and saves if safe. Risks scale with area and season (wolves, outlaws, cold); a
  good fire, a companion on watch and a sheltered spot reduce them.
- **Companions on foot:** up to two residents can travel with the steerer on the mainland and
  comment, help and fight.

## 5. Dungeon sites and game-changing equipment (Books 1, 4, 6, 9, 10)

Each dungeon has a lead, puzzles from the world, fair traps with signs, enemies, a guardian, lore
and a reward that changes how you play, with a cost.

| Site | Guardian | Reward | What it changes | Cost |
|---|---|---|---|---|
| Black Wood souterrain (area 8) | The hill-folk's champion; riddling doors | **Ceo, the mist-spear** | In fog and at night, thrusts pass through shields | The hill-folk call on you at Samhain; Christian residents are uneasy |
| The Barrow-King's mound (area 20) | Hrolf the haugbúi and his draugar | **Barrow mail** | Best armour; immune to stagger | The dead are drawn to you at night; Ottar's family claim it (see twists) |
| The Drowned Trackway (area 10) | The Bog King, a drowned offering-priest | **The bog torc** | The dead cannot see you; you walk flooded bog | Fires warm you less; cold sickness risk |
| Outlaws' hill-fort (area 20, moor) | Faolán Wolf-Hand and his band | **A Frankish sword** | The finest sword on the coast | It was stolen from Dún Fiach; wearing it there is an accusation |
| The Cailleach's Cave (area 12) | Wind and ice, then the Cailleach herself | **The Cailleach's maul** | Shatters shields; freezes water it strikes (ice bridges, frozen bog) | Only works in autumn and winter; using it in summer angers her |
| Loch Carn (area 4), quest | The each-uisce | **The kelpie bridle** | Summon the water-horse to cross lochs, bogs and rivers fast | Never keep it near water at night, or it drowns its rider |

Skarvholm keeps the Hollow Cairn, and the Seal Cave's deep passage is a small dungeon in its own right.

## 6. A living world (Books 1, 2, 4, 5, 10)

- **Travellers** move between areas on schedules with an origin, a destination and a reason:
  pilgrims to Kilbrecc, monks, herders driving cattle, Fiachra's riders, a travelling poet,
  traders' carts, tinkers, fugitives, refugees from Orm's raids. They can be talked to, traded
  with, helped, recruited or robbed (deeds apply).
- **Wandering characters** with small stories recur across the game (a poet who writes satires
  about you, a pedlar who always knows a rumour, a hermit, a disgraced warrior).
- **Bandits:** outlaw camps form and break up; ambushes on roads; they raid farms when unchecked.
- **Off-screen simulation:** places and travellers are simulated at low detail when off screen.
  Things happen while you are away and **news** reaches you through travellers and traders.
- **Traders visit the homestead:** a Saltvik knarr about every 10 days in the sailing season; a
  Gaelic pedlar every 6 days once you are on the mainland; a wandering smith once a season; the
  sea-wife now and then; and Ulf's men as fences for stolen goods. Traders bring goods, prices
  and leads.
- **Density target:** on a road or in a settlement, a traveller or living event roughly every
  minute; in the wilderness, a creature, sign or event roughly every 30 to 60 seconds.

## 7. Raids: stealth or all-out assault (Books 1, 2, 6, 10)

- Every raid can be a **stealth raid** or an **all-out assault** (a strandhögg in force), and some
  targets (fortified places, Crowwick, Orm's outposts) can only be taken by assault.
- **Assaults:** the full crew lands by day. Defenders muster over time, with horns, reinforcements
  and archers. Battles run 10 to 30 a side. Objectives: break the gate, fire the thatch, seize
  the store, take or kill the leader, hold the landing.
- **Formations and commands:** shield wall (a locked line with a wide front arc; slow; strong
  against missiles), charge (a cohesion shock), hold, archers' volley, fall back to the ships.
- **Consequences** are heavier and more public than a stealth raid's: more witnesses, more
  deaths, faster retaliation, and more glory with the Glory-minded.
- Carrick supports both: a stealth raid by night or an assault by day.

## 8. The homestead: every task by hand, and a home that runs without you (Books 1, 2, 7, 10)

- The steerer can do **every task residents do**, with proper animations: felling and splitting
  timber, cutting peat, sowing seed, weeding, watering the kale garden in dry spells, harvesting,
  threshing, building (hammering, raising beams, thatching), smithing, carpentry, net-mending,
  fishing, herding, milking, shearing, cooking, tending wounds, repairing the ship.
- **The home runs without you:** while the steerer is away, work continues at **75% efficiency**
  (90% with a steward of skill 3 or more), threats are resolved by the watch, and events are
  queued for the report on your return. It never starves if food exists, but it does less, slips
  behind on repairs, and disputes can boil over.

## 9. People: happiness, friendship and fear; disputes; requests and quests (Books 2, 5, 8, 10)

### Three measures per resident (replacing the single regard)
- **Happiness** (0 to 100): mood now, from food, warmth, rest, safety, success, grief, festivals
  and how they were treated today.
- **Friendship** (-100 to 100): how they feel about the steerer over time, from kept promises,
  care, shared deeds that fit their values, and gifts and time spent with them.
- **Fear** (0 to 100): how much they fear the steerer, from brutality, punishments, displays of
  strength and threats.

### Effects (starting values for Book 10)
- **Work:** output x (0.8 + 0.4 x happiness / 100); below 25 happiness, disputes are twice as likely.
- **Loyalty:** friendship 40 or more: volunteers for danger, defends the steerer, stays in hard
  times. Friendship -40 or less with fear below 30: leaves.
- **Fear:** fear 60 or more with friendship below 0: obeys any order but with 15% worse quality,
  and may desert or betray when the steerer is away or wounded. Fear 60 or more with friendship 40
  or more: fierce devotion.
- The old warning flow (remark, complaint, refusal, request to leave) stays, driven by these.

### Disputes at home
- About every 5 to 8 days, with ten or more residents, a dispute arises: theft, insults, a fight,
  shirking, a share of plunder, belief (whose shrine), an old grudge, a debt, a broken promise.
- The steerer judges: take a side, find a compromise, punish, pay compensation, call a household
  thing to decide, or ignore it. Each choice moves happiness, friendship and fear for those
  involved and those watching.

### Requests and quests
- Residents and leaders make **requests**: small (build me a loom, find my mother's brooch),
  personal (lay my brother's ghost, take me to my sister), and dangerous (avenge my father).
- Some requests become **quests** across the map, including **revenge killings in other towns**.
  A killing in a town is a deed with all its consequences: guards, a feud, the blood-price.
  Every revenge quest also allows another way out: a blood-price paid, a duel, exile, or the
  truth.
- **PROPOSAL, personal quest seeds:**
  - **Hild:** vengeance on the captain who burned Hvitness. It is Kolgrím, who later commands
    the garrison on Skarvholm.
  - **Áine:** the man who killed her father lives in Saltvik. He is now a gentle father of three,
    and the killing was ordered by Gilla Muire himself.
  - **Bran:** penance at Kilbrecc, and a meeting with a monk who lost a brother in Bran's raid.
  - **Oddi:** clearing his debt to Ulf's men without becoming their spy.
  - **Eithne:** freeing her late husband's land at Ardcarn from a debt she suspects was forged.
  - **Thrand:** proving what Heid did, to Asgrim and to Orm's own crews.
  - **Runa:** getting her sister and Kolbeinn clear of Ottar's debt-books, which hide something.

## 10. Named leaders everywhere (Book 5)

Every settlement and camp has a named leader with a relationship to the household (friendship
and fear apply to leaders too). New leaders to add:

| Place | Leader | Sketch |
|---|---|---|
| Móin Mhór | **Lasair**, head of the peat-cutters | Old, sharp, knows every safe step in the bog |
| Sliabh Carn | **Dubhthach**, herder-chief of the shielings | Hospitable, proud, at feud with Fiachra over grazing |
| River Ford | **Cuán**, the ford-keeper | Takes tolls from everyone; hears all news |
| Salt pans | **Hrefna**, Ottar's steward | Hard and fair; keeps Ottar's secret books |
| Kilbrecc farms | **Ninnid**, Colmán's reeve | Worries about the tithe, the pilgrims and the poor |
| Outlaws' hill-fort | **Faolán Wolf-Hand** | Outlaw chief with a hidden past (see twists) |
| The Mound Field | **Hrolf the Barrow-King** (dead) | A haugbúi who still keeps court among his goods |

Existing leaders stay: Muiredach, Fiachra and Órlaith, Colmán and Muirenn, Ottar and Gunnhild,
Gilla Muire, Brónach, Ulf, Orm and Heid.

## 11. Twists and unexpected events (Books 1, 4, 5, 6)

### Principles (in the spirit of The Witcher 3 and Baldur's Gate 3)
- Every major quest has at least one reveal that changes what the "right" choice looks like.
- No clean good option: the obvious answer has a cost; the cruel answer sometimes helps.
- Consequences can arrive 10 to 40 days later, from people the player forgot.
- Characters have secrets and motives that surface through play, not exposition.
- Companions disagree, argue with each other and sometimes act on their own.
- Side quests intersect the main story.

### PROPOSAL, twist seeds
1. **Thorkel's debt.** The household's drowned chief made his own bargain with Rán before the
   wreck: safe passage south for his people, at a price. The wreck was part of the price, and
   part of it is still owed. Revealed through Thorkel's ghost, Gudrun's memories and the Skerry of
   the Drowned.
2. **The outlaw prince.** Faolán Wolf-Hand is Fiachra's eldest son, outlawed for refusing to
   burn Kilbrecc in an old feud. Restoring him can split Dún Fiach between him and Órlaith, and
   the Frankish sword in his fort is the proof of who he is.
3. **The barrow's silver.** Hrolf the Barrow-King was Ottar's grandfather, buried with church
   silver stolen from Kilbrecc. Opening his mound exposes how Saltvik was founded.
4. **The abbot's calm water.** Brother Senán finds that the Bell's peace was bought with an old
   bargain, and the abbot knows. Whether it was a saint's prayer or a bargain stays ambiguous.
5. **The friendly pedlar.** The pedlar who always knows a rumour sells news to everyone,
   including Orm. He is not evil; he is poor.
6. **Ylva's last fetch.** Ylva's fetch-sightings come true. Then she sees the steerer's.
7. **The hostage who will not go home.** Donnchad, held as a hostage, does not want to return,
   because of what waits for him at Ardcarn.
8. **The grateful survivor.** Someone you spared in an early raid returns at the worst moment,
   to help or to repay a different debt.

### Unexpected events
- An **event deck** of about 40 rare events, each firing at most once per campaign, with
  conditions so they fit the moment: a whale stranding, a poet's satire spreading, a sickness a
  resident hides, a lost child's shoe found (no child appears), a stolen boat, a feud at a feast,
  a sacred stone found in a field.
- About one every 5 to 10 days, never during a tutorial, never two at once.

## 12. Exploration density, movement and collectibles (Books 1, 9, 10)

- **Density:** something worth stopping for every 20 to 30 seconds of walking (an item, detail,
  creature, view or resource), and a real secret or small puzzle in every area.
- **Return value:** every area changes with season and tide.
- **Movement verbs:** walk, run, sneak, carry, climb (marked routes), wade, swim (where allowed),
  jump short gaps, crawl through gaps, push and pull heavy objects, and ride the kelpie bridle's
  water-horse where it allows.
- **Collectibles:** shells, carved stones, the hermit's psalter pages, the names of the dead,
  songs learned, and lore for each power.
- **Objectives:** the current goal is always shown; side discoveries are always close by.

## 13. Effects on the plan (Book 3)

The game is now substantially larger. Keep Stages 1 to 12 with these changes: Stage 6 redoes the
sprites at 32 x 48 with layers and adds wading (Hild partly submerged); Stage 7 adds task
animations; Stage 8 introduces happiness, friendship and fear. Re-plan Stage 13 onwards into as
many stages as needed (expected about 36 in total) and rename Book 3 "Stage Plan". Suggested
order after Stage 12:

13 Sea map and voyage events · 14 Whole island (density, verbs, collectibles) · 15 Raid
planning · 16 Carrick (stealth and assault) · 17 Complications, extraction, evidence, assault
battles and formations · 18 Ledger and hostility · 19 Homestead v1 (away simulation, visiting
traders) · **20 Build 2 gate** · 21 Saltvik · 22 Ship upgrades and sea battle · 23 People v2
(disputes, requests, quest framework) · **24 Supernatural and Build 3 gate** · 25 Living world
(travellers, traders, bandits, news, off-screen simulation) · 26 Chapters 3 and 4 and the first
winter · 27 Chapter 5 · 28 Mainland part 1 (areas 1 to 10, travel, blocks, seasons, camping) ·
29 Mainland part 2 (areas 11 to 20, wilderness hazards) · 30 Dungeons 1 to 3 · 31 Dungeons 4 to 6
and equipment · **32 Build 4 gate: the mainland** · 33 Chapter 6, moving ashore · 34 Personal
quests and twists · 35 Chapter 7 · 36 Chapter 8, the Return, the finale and endings ·
37 Release hardening.

## 14. Decision log entries
- Sprite canvas 32 x 48 with equipment layers (amends Stage 0 decision 4).
- One shared mainland of 20 areas; two home sites; the map opens over time and with the seasons.
- Raids can be stealth or all-out assault.
- Living world, visiting traders, camping, dungeons with game-changing equipment.
- Happiness, friendship and fear replace single regard; disputes; requests and quests.
- Twist and event design principles; proposals listed for user review.
- The plan grows beyond 30 stages.
