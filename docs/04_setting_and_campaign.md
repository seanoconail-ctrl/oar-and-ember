# Oar and Ember, Book 04: Setting and Campaign Bible

*Geography, beliefs, history, supernatural rules and chapter structure for the Narrow Sea, around AD 900.*

The Narrow Sea is a few days' sailing wide and crowded with people who need each other and fear each other: Gaelic farmers and kings, monks with long memories, Norse-Gaelic traders, hungry raiders, and the old powers of sea, mist and hill that both peoples half believe in.

**How to use:** Use this book for world facts, stable IDs, Skarvholm and the mainland on foot, seasons, supernatural rules, the wilderness, dungeons, the living world, twists and chapter beats. It must not contradict Book 1. Book 5 holds people, Book 6 scenarios, Book 7 appearance, Book 8 voices, Book 9 tile plans and Book 10 every number. Every place, zone, area, power and chapter here has a stable ID for Book 2's content files.

_All places, people, saints and events are fictional. Mythological figures are adapted from Norse and Gaelic sources for play; they are not reconstructions of historical belief. Historical touchstones are inspiration and should be checked before any claim of accuracy is made in marketing or in-game text._


## 01 / The Narrow Sea
*A fictionalised North Channel between the southern Hebrides and north-east Ireland. Close enough that a good crew can cross in a day; dangerous enough that many do not.*

> Figure: schematic map of the Narrow Sea (drawn in the PDF version of this book).

### Shape of the region
The Irish coast runs along the south-west of the map: farmland, ringforts, a monastery on a headland and Saltvik's harbour at its eastern end. Behind that shore lies the mainland, one region of twenty areas with woods, a great bog, a mountain and a moor (section 03). The Scottish coast closes the north-east: a long peninsula, a sea loch reaching into the hills and small islands. Skarvholm sits in the middle, exposed to every wind, a day's row from almost anywhere. To the north-west, past Blue Men's Sound, lie the northern isles where Orm Sveinsson rules from Kaldness. The deep water around Skarvholm is Rán's Reach, where the drowned go down.

### Places and stable IDs
| ID | Display name | Type | Who lives there | Offers the player |
|---|---|---|---|---|
| `ISLE_SKARV` | Skarvholm | Home island | The household | Shelter, steading, boatshed |
| `SITE_CARRICK` | Carrick Landing | Raid site | Ardcarn's storekeeper and guards | Grain, iron, a boat; first raid |
| `TOWN_ARDCARN` | Ardcarn | Gaelic farm settlement | About 60 people under Muiredach | Food, cattle, a holy well, grievances |
| `ABBEY_KILBRECC` | Kilbrecc | Monastery | Abbot Colmán's community and tenants | Stores, records, sanctuary, the Bell of Brecc |
| `FORT_DUNFIACH` | Dún Fiach | Ringfort and petty kingdom | King Fiachra's household and clients | Land rights, warriors, a marriage tie |
| `TOWN_SALTVIK` | Saltvik | Norse-Gaelic trading harbour | Merchants, shipwrights, about 400 people | Trade, refits, hired oarsmen, news |
| `GLEN_ARRA` | Glen Arra | Norse-Gaelic farmsteads | Gilla Muire's kin and herders | Cattle, archers, a sheltered loch |
| `ISLE_INISRON` | Inis Rón | Sacred island | The Keepers and the seal-kin | Lore, Manannán's favour, Nessa's past |
| `CAMP_CROWWICK` | Crowwick | Raiders' camp | Ulf Hrafnsson's crew | Rival, ally or conquest target |
| `ISLE_KALDNESS` | Kaldness | Sea king's seat | Orm Sveinsson, Heid the Grey | The external threat (late campaign) |

### Sea features
| ID | Name | What it does |
|---|---|---|
| `HAZ_CAULDRON` | The Cailleach's Cauldron | A whirlpool tide-gate between Skarvholm and Loch Arra. Passable only near slack water; saves a day when timed well. Inspired by Corryvreckan. |
| `HAZ_BLUEMEN` | Blue Men's Sound | The shortest route north. The Blue Men rise in bad weather and challenge captains in verse (section 06). |
| `HAZ_MIST` | Manannán's Mist | A fog bank that moves by its own rules. It hides ships from pursuit and from charts. Lost crews sometimes come out somewhere else. |
| `HAZ_RANSREACH` | Rán's Reach | Deep water around Skarvholm. Storms here are fiercer; the drowned are not recovered without help. |

## 02 / Skarvholm
*A small island with a lot in it. The household lives, works and explores here for the first year and a half, and it should reward walking every day.*

### Size and shape
Skarvholm is 384 x 256 tiles: about a minute's run straight across, several minutes by its paths, with caves, tidal ground and interiors adding more. Thin soil, one sheltered stretch of machair, sheep gone half-wild, cliffs crowded with cormorants and a long shingle beach. Its last Gaelic family left two generations ago after a raid and a bad winter. Full tile plans are in Book 9.

### Places
| ID | Place | Role in play |
|---|---|---|
| `SK_WRECK_STRAND` | Wreck Strand | Opening beach. The broken ship sits on the skerry offshore; salvage and driftwood come in with storms. |
| `SK_BROCH` | The old broch | A roofless drystone tower. First shelter, later storehouse and last refuge. |
| `SK_KELDA` | Kelda Spring | The only reliable fresh water. Turns brackish at spring tides from Chapter 4: the island's clock. |
| `SK_NAUST` | Naust Cove | Sheltered landing; site of the boatshed. Slumps and silts in Chapter 5. |
| `SK_MACHAIR` | The machair | Sandy grassland: the barley plots, sheep, later a byre. |
| `SK_HAGSEAT` | The Hag's Seat | A tall stone where the Cailleach is said to rest. Runa is found here in Chapter 1. |
| `SK_CAIRN` | The Hollow Cairn | A grassed mound older than anyone's story, with passages inside, a sealed inner door and, behind it, Manannán's Cup. The aos sí keep it. Skarvholm's dungeon. |
| `SK_TIDECAVE` | Seal Cave | A tide cave on the north-east cliffs where the wreck-scavengers hide their skiff. Its deep passage, open only at spring low tides, runs under the bog to the cairn: a small dungeon in its own right. |
| `SK_ROOKHILL` | Rook Hill | Highest point. Lookout, then the watch cairn that warns of sails. |
| `SK_GREYMEN` | The Grey Men | A ring of nine stones between the hill and the bog. |
| `SK_BOG` | The peat bog | Fuel for every winter; something old lies in it. |
| `SK_GEO` | Gull Geo | A narrow hidden cove on the north-west, out of sight of Rook Hill. |
| `SK_CELL` | The hermit's cell | A ruined beehive cell above Gull Geo, burned a century ago. |
| `SK_SKERRY` | Skerry of the Drowned | A rock reached by a causeway only at spring low tides, where the drowned are seen. |
| `SK_EAGLE` | Eagle stack | A sea stack off the west cliffs with an eyrie. |

### Zones, resources and secrets
| Zone | Terrain | Seasonal resources | Threats and secrets |
|---|---|---|---|
| `ZONE_SK_STRAND` | Shingle, tidal flats, skerries | Driftwood after storms; shellfish and seaweed at low tide; wreck salvage | Scavengers; Thorkel's draugr at low tide if unburied |
| `ZONE_SK_MACHAIR` | Grass, plots, the steading | Barley, kale, grazing; lambs in spring | Raiders landing on the strand |
| `ZONE_SK_KELDA` | Spring and stream | Water; watercress in spring and summer | The spring's slow failure |
| `ZONE_SK_ROOK` | Heather, high ground | Heather for thatch and bedding; hares | The lookout's blind spots |
| `ZONE_SK_BOG` | Peat bog | Peat cut in spring and summer; bog cotton | Soft ground in rain; an old offering in the peat |
| `ZONE_SK_GREYMEN` | Stone ring | None | A sunrise alignment on festival mornings |
| `ZONE_SK_CAIRN` | Mound and sheepfold | Sheep | The cairn's passages and its keepers |
| `ZONE_SK_CLIFFS` | Cliffs and eagle stack | Seabird eggs (days 10 to 40), birds in summer | Falls; the eagle |
| `ZONE_SK_GEO` | Hidden cove and cell | Kelp | A landing raiders can use unseen; the hermit's hidden niche |
| `ZONE_SK_SEALCAVE` | North-east horn and cave | Seals (pups days 65 to 85) | The tide puzzle; killing seals angers the seal-kin |
| `ZONE_SK_HAGSEAT` | West headland | Kelp, wind | The Cailleach's stone |
| `ZONE_SK_NAUST` | Cove, causeway, skerry | Fish from the rocks | The drowned on the skerry at spring low tides |

### Through the year
Spring brings lambs, eggs on the cliffs and the first peat cutting. Summer brings long light, birds and the best fishing. Autumn brings seal pups and storms that throw wreckage onto the strand. Winter freezes the bog pools, darkens the afternoons and brings the dead closer at Samhain and Yule. Every zone changes with season and tide, so the island repays walking it again.

## 03 / The mainland
*One shared region of twenty areas on the Irish coast, the same for every player. It opens up over time, and the household knows it long before it chooses a home there.*

### One region that opens over time
The mainland (`REG_MAINLAND`) is one connected region of twenty areas on the Irish coast, and every player gets the same mainland. From Chapter 3 its coastal areas can be reached by ship; inland areas open on foot as they are discovered and as blocks are cleared. The mainland is fully explorable long before Chapter 6, so the household chooses its home knowing the land. Places belong to factions or to the wilderness: a hostile faction's guards attack on sight in its territory, and areas held by factions the household has wronged stay open but dangerous. Every area changes with season and tide. Book 9 section 10 holds the layout overview; Book 10 section 14 holds the travel times, quick-travel cost and the costs of clearing blocks.

### Home sites (Chapter 6)
There are two home sites, both on this map. Arra Foot is no longer a home site.

| Site | Area | Strengths | Weaknesses | Ways to secure it |
|---|---|---|---|---|
| `SITE_CARRICK_STRAND` Carrick Strand, beside Ardcarn | `MAIN_CARRICK_STRAND` | Good farmland, near Kilbrecc and Dún Fiach | It is the shore you first raided | Grant from Fiachra (service, hostage or a marriage tie between other households) plus compensation to Ardcarn; or seizure |
| `SITE_SALTNESS` Saltness headland, outside Saltvik | `MAIN_SALTNESS` | Trade, shipyard, strong position; sea caves below the headland | Poor soil; Orm's likely first target | Purchase in silver, or a season escorting Saltvik's fleet; council vote |

### The twenty areas
| # | ID | Area | Type | Known at start | Leader / faction | Notes |
|---|---|---|---|---|---|---|
| 1 | `MAIN_CARRICK_STRAND` | Carrick Strand | Coast, home site A | Yes (by sea) | Ardcarn's land | Farmland by the shore first raided |
| 2 | `MAIN_CARRICK_LANDING` | Carrick Landing | Coast | Yes | Muiredach | First raid site |
| 3 | `MAIN_ARDCARN` | Ardcarn | Village | Yes | Muiredach | Fields, guesthouse, Eithne's old home |
| 4 | `MAIN_LOCH_CARN` | Loch Carn and Brigid's Well | Lake | No | (the each-uisce) | Water-horse; holy well |
| 5 | `MAIN_KILBRECC` | Kilbrecc | Monastery, coast | Yes | Abbot Colmán | Round tower, the Bell |
| 6 | `MAIN_KILBRECC_FARMS` | The tenant farms | Farmland | No | Colmán's reeve | Tithe barns, pilgrims' road |
| 7 | `MAIN_BLACKWOOD_EDGE` | Fiodh Dubh: the edge | Oakwood | No | Wilderness | Boar, charcoal burners, outlaw scouts |
| 8 | `MAIN_BLACKWOOD_HEART` | Fiodh Dubh: the heart | Old forest, dungeon | No | The aos sí | Hill-folk ringfort and souterrain |
| 9 | `MAIN_MOIN_MHOR` | Móin Mhór, the Great Bog | Bog | No | Peat-cutters (Lasair) | Plank road; floods in winter |
| 10 | `MAIN_TRACKWAY` | The Drowned Trackway | Bog, dungeon | No | (the Bog King) | Sunken trackway and shrine |
| 11 | `MAIN_SLIABH_CARN` | Sliabh Carn | Mountain | No | Herders (Dubhthach) | Shielings in summer; summit cairn |
| 12 | `MAIN_CAILLEACH_CAVE` | The Cailleach's Cave | Mountain cave, dungeon | No | (the Cailleach) | Ice, wind, old stone |
| 13 | `MAIN_HIGH_PASS` | The High Pass | Pass | No | Wilderness | Blocked by a landslide at first |
| 14 | `MAIN_DUN_FIACH` | Dún Fiach | Royal fort | Yes (by sea) | King Fiachra, Órlaith | Rath on a crag |
| 15 | `MAIN_RIDGE_ROAD` | The Ridge Road | Road | Yes | Fiachra's riders | Patrolled; tolls |
| 16 | `MAIN_FORD` | The River Ford | River crossing | Yes | The ford-keeper (Cuán) | Floods in spate; border |
| 17 | `MAIN_SALT_PANS` | Ottar's farms and salt pans | Farmland, coast | Yes | Hrefna, Ottar's steward | Work, trade, smugglers' rumours |
| 18 | `MAIN_SALTVIK` | Saltvik | Town, coast | Yes | Ottar Silkbeard, Gunnhild | Market, yards, guards |
| 19 | `MAIN_SALTNESS` | Saltness headland | Coast, home site B | Yes | Saltvik council | Sea caves below the headland |
| 20 | `MAIN_MOUND_FIELD` | The Mound Field and the moor | Burial ground, moor, dungeon | No | (Hrolf the Barrow-King); outlaws (Faolán) | Norse mounds; the outlaws' hill-fort beyond |

Five sea-map places are areas of the mainland: Carrick Landing (`SITE_CARRICK`), Ardcarn (`TOWN_ARDCARN`, reached from the sea through Carrick Landing), Kilbrecc (`ABBEY_KILBRECC`), Dún Fiach (`FORT_DUNFIACH`) and Saltvik (`TOWN_SALTVIK`), and the two home sites are areas too. A name in brackets under Leader / faction is a power or one of the dead (section 07), not a living leader. Book 5 holds the leaders. Bealtaine fires are lit at the summit cairn on Sliabh Carn; the sea-wife keeps her hut at Saltvik; rumour says smugglers use the sea caves under Saltness.

### Connections and travel times
Times are real time on foot, walking (Book 10 section 14).

| From | To | Walk | Condition |
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

Quick travel along known roads between waymarks is allowed when safe; it costs game time equal to the walk, at about one game hour per real minute walked (Book 10 section 14). By sea, from Chapter 3, the coastal areas (Carrick Strand, Carrick Landing, Kilbrecc, Dún Fiach below its crag, the salt pans, Saltvik and Saltness) are landings on the sea map.

### How the map opens up
- **The landslide on the High Pass:** cleared by a work party with axes and levers, by Fiachra's men after an alliance, or by the Cailleach's maul (section 10). Book 10 section 14 gives the worker-days.
- **The River Ford in spate:** wait for the water to fall, or build a timber bridge (a homestead build at the ford), which also helps everyone who travels it. Book 10 section 14 gives the timber and worker-days.
- **The Black Wood heart:** the hill-folk let the household in after an offering, a kept promise or the right words found in the hermit's psalter on Skarvholm.
- **The Drowned Trackway:** reachable in summer and autumn, or when a winter cold snap freezes the bog.
- **Hostile ground:** areas held by factions the household has wronged stay open but dangerous.

### Seasons on the mainland
| Season | Changes |
|---|---|
| Spring | Rivers in spate; the ford closes; lambing in the farms; the bog wet but passable |
| Summer | Herders at the shielings on Sliabh Carn; the Trackway reachable; fairs and pilgrims; most traffic |
| Autumn | Harvest work; storms; the ford may close; nuts, berries and mushrooms in the Black Wood |
| Winter | Snow closes the Cailleach's Cave and slows the pass; the bog floods (or freezes in cold snaps); wolves range widely; fewer travellers; nights are long and cold |

### Destinations across the sea
Glen Arra, Inis Rón and Crowwick are not part of the mainland. They remain destinations across the sea, each with its own small area on foot.

| Place | On foot |
|---|---|
| `GLEN_ARRA` Glen Arra | Gilla Muire's steadings, the summer grazing at the loch head and the narrow shore path that looks across the water to Crowwick |
| `ISLE_INISRON` Inis Rón | The Keepers' landing and the seal-kin's shore, where Manannán's compact is renewed |
| `CAMP_CROWWICK` Crowwick | Ulf's camp and its beach; taken only by assault |

## 04 / Seasons, weather and the calendar
*A 120-day year of four 30-day seasons. Each season changes what can be done and what must be done. The calendar opens windows; it never forces an outcome on its own.*

> Figure: chapter timeline across the calendar (drawn in the PDF version of this book).

### The year
| Days in year | Season | Sailing | Festival on the first day |
|---|---|---|---|
| 1 to 30 | Spring | Open crossings in fair weather; gales possible | Imbolc (from Year 2) |
| 31 to 60 | Summer | Best sailing; long light; raids and trade | Bealtaine: fires, cattle to summer grazing |
| 61 to 90 | Autumn | Harvest; storms rising; crossings riskier | Lúnasa: harvest fair at Saltvik |
| 91 to 120 | Winter | Open crossings closed except in calm windows; coastal hops only | Samhain and the Norse Winter Nights |

Section 03 gives what each season changes on the mainland. Yule falls on day 105 of each year. Festivals are social events at home and abroad, and the nights when bargains and boundaries matter most. Samhain is when the dead and the hill-folk walk closest; Bealtaine is when bargains are easiest to strike.

### What each season demands
| Season | Fields | Livestock | Sea and shore | Fuel | People |
|---|---|---|---|---|---|
| Spring | Sow barley and oats by day 25 (later sowing yields less) | Lambing and calving; milk returns | Eggs on the cliffs, shellfish; crossings open | Cut peat early so it dries for 20 days | The hungry gap: stores lowest before new food; gales |
| Summer | Weed; cut and dry hay | Cattle to the shielings on the mainland; shearing | Best fishing; raids and fairs | Stack dry peat | Long light until 23:00; building weather |
| Autumn | Harvest days 61 to 75; rots after day 80 | Slaughter and salt what cannot be wintered | Seal pups; storms throw wreckage ashore; fishing falls | Fill the stacks | Sickness rises; storms close in |
| Winter | Nothing grows | Cattle in the byre on hay; sheep on the machair | Open sea closed except calm windows; fishing on calm days only | Every heated house burns peat daily | Cold, hunger, long nights (dark 16:00 to 08:30), the dead at Samhain and Yule |

### Consequences that bite
Unsown plots yield nothing. Unharvested barley rots. Fresh fish spoils in two days unless dried, smoked or salted. Cattle without hay or a byre lose condition and die. A house without fuel in winter makes its residents cold, slower to heal and prone to sickness. A household that prepared well has a warm winter of crafting, stories, feasts and repairs; one that did not spends it rationing and burying. Book 10 gives the numbers and the targets for a well-prepared household at day 90.

### Weather and sea
- **Wind** is a daily state with a direction and strength, forecast a day ahead by weather-wise crew. Fair wind speeds sailing; foul wind means rowing, which drains stamina and stores.
- **Tide** runs on a simple two-state-per-watch cycle (flood and ebb, with slack at the turn). Tide gates, landings and the Cauldron depend on it. Spring tides peak twice a season.
- **Visibility** is clear, haze, fog or night. Fog hides both you and others; Manannán's Mist is a special moving fog.
- **The Cailleach's washing**: one storm between days 86 and 94 of each year marks winter's arrival. After it, the sea map shows open crossings as closed except during forecast calm windows of one to three days.

## 05 / Beliefs
*Belief is personal, mixed and practical. Nobody in the Narrow Sea belongs to a faction called "pagan" or "Celtic". People pray to what has helped them.*

### The Norse households
The old gods are honoured with oaths, feasts and offerings: Thor for weather and strength, Odin by those who seek wisdom or victory, Freyr for harvest, Njörd for fair sailing. Rán is feared rather than worshipped; sailors carry a little gold so that if they drown they come to her hall with a gift. Some Norse at Saltvik are baptised, often for trade, and many keep both a cross and a hammer. Oaths, reputation and a good death matter. Burial varies: mounds, stone ship-settings, boats burned or buried.

### The Gaelic communities
Ardcarn, Dún Fiach and the tenants of Kilbrecc are Christian. They keep saints' days, pray at holy wells and fear the judgement of the Church. They also keep older customs without contradiction in their own eyes: fires at Bealtaine, care at Samhain, respect for the good people of the mounds, and the cross of rushes on Brigid's day. Kings take hostages, keep poets and make alliances by fosterage and marriage.

### The Norse-Gaelic world
Saltvik and Glen Arra are mixed: Norse names with Gaelic mothers, Gaelic names with Norse ships. In Glen Arra the smith casts crosses and hammers in the same mould and sees nothing strange in it. These people translate between the others, and profit from it.

### The Keepers of Inis Rón (fantasy element)
A small community on a seal island who still serve the old powers openly: Manannán, the Cailleach and the seal-kin. They are a deliberate fantasy element, not a claim that such communities existed. They remember the compact that once kept Rán out of these waters. Some are seal-kin themselves, able to put on a seal's skin.

### How belief appears in play
- Each resident has a **Faith** value pointing at something specific: the old gods, Christ and the saints, the land-spirits, or nothing.
- The steading's shrine is chosen by the residents, not the player alone. A hammer-post, a cross, a stone for offerings or more than one can stand together.
- Sacred places raise the stakes of raids. Taking a relic, a well's offerings or a mound's grave goods triggers both human and supernatural consequences.
- The game shows sincere believers in every tradition, including sceptics and hypocrites. It never declares one tradition correct.

### Historical touchstones (inspiration only)
Norse raids on Irish and Hebridean monasteries are recorded from the 790s. A Norse base at Dublin is recorded from 841, and its Norse rulers were expelled in 902 before returning in 917. Irish annals name the Gall-Gaedil, the mixed Norse-Gaelic people, from the 850s. The Corryvreckan whirlpool and its Cailleach lore inspire the Cauldron. Treat these as atmosphere; Saltvik, Kilbrecc and every named person are invented.

## 06 / History
*Every faction tells this history differently. The table records what actually happened in the game world; Book 5 records who believes what.*

| When | Event (world truth) | Who tells it differently |
|---|---|---|
| Time out of mind | The cairn-builders raise the Hollow Cairn. The aos sí withdraw into the hills. Manannán's mist guards the Narrow Sea under a compact with the people of the coast. | The Keepers tell it as sacred history; monks call the hill-folk fallen angels or the old dead. |
| About 300 years ago | The prince Breccán drowns in the Cauldron with fifty men. His brother, later Saint Brecc, founds Kilbrecc and makes the Bell. Rung over the Cauldron each Lúnasa, it keeps Breccán's drowned crew asleep. | Monks: the saint's prayer stilled the water. Keepers: the saint struck a bargain with Rán in a saint's name. |
| About 100 years ago | The first Norse ships. Kilbrecc is raided twice; its tower is built. Skarvholm's hermit cell is burned. | Kilbrecc's annals record the raids precisely and remember the sails. |
| About 60 years ago | A Norse winter camp becomes Saltvik. Trade begins to outweigh raiding. | Saltvik says it was founded by agreement; Dún Fiach says by theft. |
| About 30 years ago | Norse-Gaelic families settle Glen Arra. Dún Fiach and Saltvik fight, then make peace through a marriage. | Both sides claim to have won. |
| About 12 years ago | Orm Sveinsson survives a wreck no one else survived. The seeress Heid the Grey becomes his adviser. | Orm says Rán spared him for greatness. Heid knows the price. |
| 1 to 5 years ago | Orm takes independent harbours in the northern isles, demanding tribute and hostages. His fleet never seems to meet a storm. | Northern exiles talk of fog that comes when Orm wants it. |
| This spring | Orm's ships burn Hvitness. Chief Thorkel Ketilsson flees south with his household in an old ship. A mist hides them from pursuit and then wrecks them on Skarvholm. Thorkel drowns. | Was the mist Heid's or Manannán's? The answer matters in Chapter 7. |

### Orm's bargain (world truth, revealed in Chapters 5 to 7)
Orm promised Rán the drowned of the Narrow Sea in return for command of tides and fog through Heid. Every ship he sinks feeds the bargain. The rising tides at Skarvholm are Rán's reach growing as her share grows. Breaking the bargain requires three things, in any order, discovered through play: renewing Manannán's compact at Inis Rón (which needs Manannán's Cup from the Hollow Cairn on Skarvholm), ringing the Bell of Brecc over the Cauldron at slack water to release Breccán's crew, and taking Heid's staff from her or persuading her to break it. Partial success weakens Orm's weather in the finale; full success removes it.

## 07 / Supernatural rules
*The supernatural is real in the fiction, rare in practice and fair in its rules. It draws on Norse and Gaelic myth and it keeps its bargains.*

### The world-truth model
Every supernatural actor has a **true state** in the save: what it is, what it wants, what it has agreed and what binds it. Testimony, rumour and belief can differ from that truth. The player learns the truth through signs, objects, witnesses and experiment. The code never rewrites the truth to suit a scene.

### Fairness contract
Every dangerous supernatural mechanic has four parts:
1. **A visible sign** before danger: sound, tracks, animal behaviour, weather, an object out of place.
2. **A learnable rule** that a careful player can work out or be told.
3. **A player response** that changes the outcome: avoid, bargain, perform a specific act, fight for time, or withdraw.
4. **A saved consequence** that persists and is reported.

No instant death from an invisible knowledge check. Ordinary weapons can buy time against some threats; not every encounter is a combat check. Rituals are specific acts with discovered information, witnesses or objects, never a universal spell bar. Powers keep the stated terms of accepted bargains; disputes arise over scope, interpretation or who had authority to promise.

### Rán and her daughters (Norse)
Rán gathers the drowned in her net. Her nine daughters are the waves, and the worst storms carry their names: **Kólga** the cold wave, **Hrönn** the grasping wave, **Blóðughadda** whose foam is red. Through Orm's bargain her reach is growing.
- **Signs:** tides higher than the moon allows, gulls flying low and silent, sea-light (pale green under the water at night), the drowned seen standing in the shallows.
- **Rules:** she claims those who drown; gold carried aboard buys a drowned crew member a gentle welcome. She cannot take what is above the tide line on land she has not been given.
- **In play:** named storms on the sea map; the Kelda spring turning brackish; a drowned crewmate's body unrecoverable from Rán's Reach without a bargain.
- **The drowned at the feast:** if a crew member drowns and their rites are honoured, they may appear dripping at the funeral feast and leave in peace: a sign Rán received them well. This is an omen, not a horror.

### Manannán mac Lir and the mist (Gaelic)
The lord of the sea between Ireland and Britain, who hides what he favours in his cloak of mist. He rarely appears directly. When he does it is as **the Ferryman**: a grey-cloaked stranger in a small boat who offers to guide a ship through fog for a price.
- **Signs:** fog that moves against the wind; the sound of hooves on water; a figure who is never quite closer.
- **Rules:** he asks for a true story, a gift given freely, or a promise of hospitality to strangers. He never asks for blood. He keeps his word exactly and expects the same.
- **Offering:** a bundle of green rushes at midsummer, laid on the water at Inis Rón.
- **Manannán's Cup:** in Irish tales, a cup that breaks at three lies and mends at three truths. The cairn-builders laid it in the Hollow Cairn when the compact was sworn. It leaves its stone only after three true things the speaker would rather not say are spoken at the Door of Three Truths; each lie wakes a warden, and three lies seal the Door until the next spring tide. Lifting it draws Rán's tide over the island.
- **In play:** the moving `HAZ_MIST`; shortcuts and escapes; renewing his compact in Chapter 7 can cover the alliance fleet in the finale.

### The Cailleach (Gaelic)
The old woman of winter and storms, who washes her plaid in the Cauldron before winter comes.
- **Signs:** a hag-shaped cloud over the Cauldron; hail out of season; the Hag's Seat stone wet when nothing else is.
- **Rules:** she respects endurance and plain speaking. She will sell a calm window in winter for something that cost you effort: a season's first catch, a hard-won tool, an honest confession.
- **In play:** the Cailleach's washing (winter's arrival); weather bargains; her stone on Skarvholm helps Runa in Chapter 1 if the player leaves an offering.

### The Blue Men (Scottish)
Blue-skinned storm kelpies who rise in Blue Men's Sound and challenge a ship's captain with two lines of verse. If the captain completes the verse well, they let the ship pass. If the captain hesitates or answers badly, they try to swamp it.
- **Signs:** blue shapes in the troughs; the sea suddenly too loud; a voice speaking verse from the water.
- **Rules:** they reward wit and boldness. Silence counts as failure; a bold, fitting answer counts as success even if it is not clever.
- **In play:** a short dialogue duel with three to four choices per line. Crew with the right skills suggest answers. Failure means a storm scene with damage, not instant sinking.

### Land-spirits and the hill-folk (Norse and Gaelic)
Norse settlers speak of **landvættir**, the spirits of a land; Gaels speak of the **aos sí**, the good people of the mounds. In the game they are the same kind of power seen through two traditions: local, territorial and touchy about respect.
- **Rule of the stem:** a carved beast-head on the prow frightens the land-spirits of a shore. Unship it before landing where you want to be welcome. Leave it up to intimidate.
- **Rules:** they keep boundaries, demand hospitality and remember insult. Their gifts can be safe. Their beauty does not mean kindness and their strangeness does not mean malice.
- **In play:** the Hollow Cairn on Skarvholm (whose occupant can be a neighbour, a nuisance or a protector), the heart of the Black Wood on the mainland (below), shrines that protect villages, and boundaries that matter when choosing a mainland site.

### The unquiet dead (Norse)
Death is normally final. A **draugr** rises only from a specific unresolved condition: a body left unburied, an oath broken over a corpse, a death under protection betrayed, or a deliberate raising. A **haugbúi** guards its mound and its goods; Hrolf the Barrow-King is one (below).
- Each has an identity, an anchor, a behaviour and at least one discoverable resolution.
- Violence can drive one off for a night; only resolving the anchor ends it.
- A named dead resident never returns as an ordinary enemy.
- **Thorkel's anchor:** if Bran's protection of the body fails and the player does not give Thorkel rites, he walks Wreck Strand at low tide from Chapter 3, wanting what he died owing: vengeance on Orm, or a promise that his household will be safe.
- **Breccán's crew:** fifty drowned men under the Cauldron, kept asleep by the Bell. Take the Bell and they follow it.

### Omens (Norse and Gaelic)
- **The fetch and the fylgja:** a resident's double, or an animal that follows them, is seen by another resident. It means that person is close to death. Rest, care or keeping them off the next voyage can change it. The game never kills someone because their fetch appeared; it is a warning.
- **The washer at the ford:** before the final battle, a woman is seen washing bloody shirts in a stream. Asked, she will name whose shirts they are. The player can change orders, and so change fate.
- **The bean sí:** the keening woman of Dún Fiach's royal line. When she is heard, someone of Fiachra's blood will die unless something is done.

### Creatures of the sea and water
- **The each-uisce:** a water-horse in Loch Carn above Ardcarn, bound by Brigid's Well. It offers a fine horse to ride and drags riders under. Its full rules are under Powers of the mainland, below.
- **Selkies:** seal-kin who take off their skins to walk ashore. A stolen skin binds a selkie to whoever holds it. Nessa's story turns on one.
- **The lyngbakr:** a heather-backed beast so large it is mistaken for an island. Sign: an uncharted island with no birds and a sweet smell. Rule: do not land. Response: steer off, or throw food to draw it under. Consequence of landing: an escape scene as the island sinks.
- **The Long Swimmer:** a serpent shape that follows ships for days. It wants something aboard. Learning what (a stolen object, a drowned body, a debt) resolves it without a fight.

### Powers of the mainland
Each follows the fairness contract: a sign, a rule, a response and a saved consequence.

**The each-uisce and Brigid's Well.** A water-horse in Loch Carn above Ardcarn, bound by Brigid's Well beside the loch.
- **Signs:** a fine horse standing in the shallows with its mane wet; weed in the mane; the well clouding when the binding weakens.
- **Rules:** while the well's offerings lie undisturbed it cannot leave the loch. It offers a fine horse to ride and drags its rider into deep water. Raiding the well's offerings releases it; blood spilled at the well clouds the water and stirs it.
- **Response:** refuse the ride; restore the offerings and bind it again with Ardcarn's help (a redemption path with Ardcarn); or win the kelpie bridle (section 10), which lets the steerer summon it to cross lochs, bogs and rivers.
- **Saved consequence:** the each-uisce is bound, loose or bridled. A bridle kept near water at night drowns its rider, and the bridle's holder knows that term from the moment it is won.

**The hill-folk of the Black Wood.** The aos sí keep a ringfort and its souterrain in the heart of Fiodh Dubh.
- **Signs:** flowers out of season; shadows falling the wrong way; a path that is not there the second time.
- **Rules:** nobody passes into the heart without their leave, given for an offering, a kept promise or the right words from the hermit's psalter. Inside, their doors answer riddles, and their champion keeps the last room.
- **Response:** ask leave properly, keep the promise, find the words; or stay at the edge.
- **Saved consequence:** their leave, and any promise made for it, is recorded; breaking one of their rules brings ill luck. Whoever keeps Ceo, the mist-spear, is called on by the hill-folk for a service each Samhain, and Christian residents are uneasy about it.

**The Bog King.** A drowned offering-priest who still keeps the shrine at the end of the Drowned Trackway.
- **Signs:** the trackway's planks wet in dry weather; bubbles rising in a line; old offerings glinting just under the water.
- **Rules:** what was given to the bog belongs to him. His dead walk the flooded bog and see the living by their warmth.
- **Response:** come in summer or autumn, or over a frozen bog in a cold snap; give the bog something in place of what is taken; or fight for time and leave with it.
- **Saved consequence:** taking the bog torc is recorded. Its wearer is unseen by the dead except at arm's length and walks the flooded bog, but fires warm them less and they risk cold sickness.

**The Cailleach's Cave.** Her own place, high on Sliabh Carn. Her rules on Skarvholm and at the Cauldron hold here too.
- **Signs:** frost on one stone only; wind out of the cave mouth when the air is still; hail out of season on the mountain.
- **Rules:** she respects endurance and plain speaking. Snow closes the cave in winter. Her wind and ice test whoever climbs in before she shows herself.
- **Response:** endure the climb and speak plainly; or turn back.
- **Saved consequence:** the Cailleach's maul is hers to lend or lose. It shatters shields and freezes the water it strikes, but only in autumn and winter, and using it in summer angers her: her anger is recorded, and a storm follows.

**Hrolf the haugbúi.** Hrolf the Barrow-King keeps court among his goods in the largest mound of the Mound Field, with his draugar about him.
- **Signs:** grave-light on the mound at night; frost on the turf above the chamber; wet footprints leading in.
- **Rules:** a haugbúi guards his mound and his goods (the unquiet dead, above). He can be spoken to at his court. His anchor is what he died owing; with the barrow's silver seed (section 12), it is the church silver taken from Kilbrecc.
- **Response:** leave his goods; bargain at his court; fight for time and leave with what you came for; or resolve his anchor.
- **Saved consequence:** taking the barrow mail is recorded. The dead are drawn to its wearer at night, and Ottar's family claim it (section 12).

### Human practitioners
- **Heid the Grey:** Orm's seeress, a völva who works seiðr with staff and song. She speaks for Rán and can call fog and turn tides within Orm's bargain. She is a person with history and doubts, and can be argued with (Book 5).
- **Sea-wives and wind-knots:** a sea-wife at Saltvik sells cords tied in three knots. One knot loosed is a fair wind, two a strong one, three a gale nobody controls. Each knot also adds a little to Rán's share.
- **The Keepers:** they know the old compacts and the right words, and can teach specific rites. They are not wizards.

### Blood on sacred ground
Killing at a holy well, a church, a mound or a stone ring is noticed by more than people. The place's power responds according to its rules: Brigid's Well clouds and the each-uisce stirs; the Hollow Cairn's keepers withdraw their goodwill; a church becomes a place where the household's dead do not rest easily. These are consequences with signs and remedies, not curses without escape.

### Christian relics
The **Bell of Brecc** stills water around it and keeps Breccán's crew asleep. Whether this is the saint's holiness or an old bargain dressed in a saint's name is never settled; both readings fit the evidence. Relics have real, bounded effects in the fiction and are treated with the weight their keepers give them.

### Prohibited patterns
- No universal mana, spell bar or resurrection.
- No supernatural damage through unseen terrain or without a tell.
- No monster in every voyage. Target: a supernatural event every third or fourth voyage on average, with signs more often than encounters.
- No power that changes the terms of an accepted bargain after the fact.

## 08 / Chapter structure
*Eight chapters across six phases. Each chapter has a window, a goal, key beats, unlocks and a gate. Beats are ordered by default but most can be taken in a different order.*

### Chapter 1: The Wreck
**Window:** days 1 to 6. **Session target:** 45 to 60 minutes. **Goal:** shelter, rescue four crew, make the boat seaworthy.
1. Wake on Wreck Strand. Control in seconds. Hild is calling beyond the rocks, hurt and standing knee to waist deep in the shallows; wade out to her and carry her above the tide line.
2. Hild leads to the old broch. Gather driftwood, light a fire, treat her injury. Warmth, food, a conversation.
3. Three searches, any order: **Oddi** injured near the wreck (recover a chest now, or take Oddi home first); **Bran** in a sheepfold by the Hollow Cairn, guarding Thorkel's body from three wreck-scavengers (fight, sneak, or bargain with the chest); **Runa** at the Hag's Seat, injured, following a strange light (leave an offering for the Cailleach's help, or take the slower cliff path).
4. Three repairs: patch the hull with salvaged boards; recover rigging from the wreck section on the skerry at low tide; recover the steering oar from the scavengers' skiff in Seal Cave (fight, steal, trade, or have Runa carve a new one over two days).
5. One reversible customisation: more cargo space, or a raised fighting position at the bow.
6. Thorkel's rites (optional, recommended by Hild): a stone ship-setting on the machair, or a sea burial with gold for Rán.
7. Days and nights pass in real time: the first night by the fire, the first dawn report, the first fish from the shore.
8. Launch. Name the boat and choose a sail mark. The sea map reveals the coast and smoke rising at Carrick Landing.
**Unlocks:** sea map, steading basics. **Gate:** the boat is launched.

### Chapter 2: The First Raid
**Window:** days 7 to 15. **Goal:** provisions and iron. Full scenario in Book 6.
Lead from a chart fragment and the smoke. One preparation advantage. Carrick Landing supports theft, bargaining, threatening the keeper or fighting the guards, with one complication. The boat cannot hold everything. Return to Skarvholm: the haul becomes tangible (a forge, food runway, a newcomer at the fire). Two leads are offered: Saltvik (trade and Runa's sister) and Glen Arra (cattle and a rumour of Ulf).
Back home, the first days of real work: the forge, the drying racks, the first peat cutting and the first plots dug.
**Unlocks:** raiding, home consequences, homestead tasks and building designation, the steward role if Eithne joined. **Gate:** two leads offered.

### Chapter 3: The Open Coast
**Window:** days 16 to 60. **Goal:** learn the coast, build a capable crew, make the island a home.
- Saltvik: trade, the first ship fittings, Kolbeinn the smith, wind-knots, news of Orm.
- Glen Arra and Crowwick: Ulf appears as a rival who wants a share of everything.
- Kilbrecc can be visited, traded with or raided. Brother Senán can become a contact.
- The fog-light event brings Nessa (Book 6).
- About day 40 to 50, the **Followers' boat** arrives: Old Gudrun and five more of Thorkel's household who escaped separately. Too many mouths; the island needs more.
- At home: sow the plots before day 25, cut peat, build the longhouse, and explore the whole island: Seal Cave, the Grey Men, the cairn, the cell and the Skerry of the Drowned.
- First sign of the tides: a spring tide reaches the broch's foot.
- The mainland opens: from this chapter its coastal areas (Carrick Strand and Carrick Landing, Kilbrecc, Dún Fiach, the salt pans, Saltvik and Saltness) can be reached by ship, and inland areas open on foot as they are found and their blocks are cleared (section 03). Up to two residents can go ashore with the steerer, and camps let a trip inland last several days (section 09).
**Gate:** residents at least 9 and a longhouse built, or day 60.

### Chapter 4: A Name on the Water
**Window:** days 61 to 120. **Goal:** become wealthy and survive winter.
- Bigger targets: the Bell of Brecc, Glen Arra's cattle, Asgrim's tribute ship. Rival crews notice.
- The karvi hull: bought at Saltvik, captured, or built in the boatshed over winter.
- **Asgrim Cold-Hand** arrives from Orm: a tenth of all plunder and one hostage, or Orm's displeasure.
- At home: harvest between days 61 and 75, cut and dry hay, slaughter and salt, fill the peat stacks and lay the ship up in the boatshed. The Year 1 threat schedule (Book 10) tests the watch.
- The Cailleach's washing closes the sea. Winter at home: cold, fuel and sickness; Samhain and the Yule feast; stories, crafting and repairs; the Nessa reveal window opens.
- The Kelda spring turns brackish at spring tides.
- Between voyages, expeditions inland: the Black Wood, Móin Mhór, Sliabh Carn and the Mound Field hold the dungeons and their equipment (section 10). Autumn is the last chance at the Cailleach's Cave before snow closes it; a winter cold snap can freeze the bog to the Drowned Trackway.
**Gate:** Asgrim returns at the end of winter for an answer.

### Chapter 5: The Long Memory
**Window:** days 121 to 180. **Goal:** face the cost of earlier raids and decide the household's future.
- Retaliation falls due according to the deed ledger: Fergal's ships from Dún Fiach, an interdict from Kilbrecc, Ulf's ambition, Ardcarn's hired swords. None is scripted; each is earned.
- Orm's fleet takes an independent harbour. Refugees arrive.
- A storm-tide slumps Naust Cove. The spring fails at every spring tide.
- **The household council:** stay and dwindle, or move ashore to Carrick Strand or Saltness, on a mainland the household already knows. Residents argue from their values and from what they have seen there.
**Gate:** the household commits to a mainland site. Choosing to stay leads to the Lonely Isle path.

### Chapter 6: The Borrowed Shore
**Window:** days 181 to 210 (earlier if the council commits earlier). **Goal:** secure a mainland home and move the household.
- Secure the chosen site, Carrick Strand or Saltness, by the ways in section 03: a grant from Fiachra won by service, a hostage or a marriage tie, with compensation to Ardcarn; purchase or service to Saltvik and a council vote; or seizure.
- Move people, livestock, stores and workshops over several voyages. The consort ship helps.
- Live on ground the household already knows. The mainland has been open since Chapter 3, so this chapter finishes opening what is still blocked and settles who the neighbours are; hostile ground stays open but dangerous. A Gaelic pedlar starts calling at the new home (section 11).
- Raise a hall and a palisade. Meet the neighbours who remember you.
- Decide what remains on Skarvholm: an outpost with a few residents, a lookout only, or nothing. Whatever is left there is taken when Orm seizes the island in Chapter 7.
**Gate:** hall and defences built and most of the household moved.

### Chapter 7: The Gathering
**Window:** days 211 to 240. **Goal:** unite former rivals against Orm.
- A council under sanctuary at Kilbrecc. Each faction states its contribution and its demand.
- Compensation, returned captives, returned relics, public concessions and marriage ties are negotiated.
- Rival raiders call it betrayal. Some leave; some can be won.
- Orm's ships take Skarvholm (about day 228); outpost residents become captives in the broch.
- The Keepers reveal how Orm's bargain can be broken, and that the compact needs Manannán's Cup from the Hollow Cairn, where Gróa is now digging. Nessa's fate is settled.
**Gate:** the council ends and Orm's fleet sails at the start of Year 3.

### Chapter 8: The Sea King
**Window:** days 241 to 270. **Goal:** defeat or outlast Orm and break his bargain.
- **The Return to Skarvholm (days 241 to 252):** a required expedition to the occupied island for the Cup (Book 6 scenario 9). Checkpoint before landing; one retry before day 255 if it fails.
- A last preparation window: renew the compact at Inis Rón if the Cup is in hand; assign allies, ships and defenders. Checkpoint before the battle.
- The washer at the ford names who will die. Orders can change it.
- Battle in two linked parts: a sea engagement at the approaches (Rán's daughters against Manannán's mist, if renewed) and the defence of the mainland home.
- Breaking the bargain during the battle turns the weather. Orm can be killed, captured, exiled or bargained with.
**Endings:** the United Coast, the Uneasy Peace, the New Sea King, the Lonely Isle; defeat returns to the pre-battle checkpoint.

### Chapter state contract
Each chapter has states: **locked**, **open**, **active**, **resolved**. A chapter opens when its window starts or its prerequisites are met, whichever is later. Resolution is recorded with the facts that caused it. Loading a save never replays a resolved beat.

## 09 / Wilderness, hazards and camping
*The wilderness is big and worth exploring. Its dangers are fair: each one shows itself before it bites.*

### What every wilderness area holds
Every wilderness area has at least one secret, one resource worth the trip, one story (a traveller, a ruin, a grave) and one danger. Wolves hunt in packs at night and in winter; boar charge when cornered; deer and birds flush and give warning. Outlaws can be fought, paid, avoided or recruited.

### Hazards
| Hazard | Where and when | Sign | What happens and the response |
|---|---|---|---|
| Bog holes | Móin Mhór, the Drowned Trackway, the moor | Bright green moss, standing water, bubbles | Slow, then sink unless pulled out by a companion, a pole or a rope; the peat-cutters know the safe steps |
| Spate rivers | The River Ford and streams in spring and after autumn storms | Brown water, a roar, foam over the stepping stones | A person who enters is swept downstream; wait for the water to fall, or bridge it |
| Cliffs and scree | Sliabh Carn, the High Pass, the coast | Loose stone underfoot, a marked climb or none | Falls cost vitality; scree slides under a running party |
| Cold at night | Everywhere in winter; high ground in any season | Breath shows, frost forms, the stamina bar shrinks with the reason "Cold" | Make a fire, find shelter, or press on and grow weaker |
| Fog | The bog, the moor, the Black Wood | Sounds go flat; the far edge of the scene greys out | Getting turned round: the way out may not be the way in; a guide or a known landmark helps |
| Wolves | Packs at night and in winter; the moor road in winter | Howling, tracks, sheep scattered | Fire keeps them off; stand together or get to shelter |
| Boar | The Black Wood | Rooted ground, a snort in the undergrowth | Charges when cornered; give it room |
| Outlaws | Roads and woods, when camps are unchecked | Cut trees across a road, a whistle, too-quiet birds | Ambushes and roadblocks: fight, pay, avoid or recruit |
| Landslides | The High Pass and steep ground after rain | Trickling stones, cracked turf | Ground gives way; wait for it to settle, or take another route |
| Lightning | High ground in storms | Hair lifts, a hum in iron, the storm overhead | Get off the summit and away from iron |
| The hill-folk's rules | Rings, mounds and the Black Wood heart | Flowers out of season, shadows falling the wrong way | Leave them alone, or learn the rule (section 07) |

Traversal draws on the steerer's stamina: climbing, swimming and waist-deep wading drain it, and running out mid-climb or mid-swim is a hazard of its own (Book 1 section 18). Cold, hunger, wounds, lack of sleep and a hard day lower the bar's size, so a long day in the wilderness makes every crossing harder. Book 10 sections 06 and 15 give the numbers.

### Camping
The steerer can sleep anywhere not hostile, with a bedroll and a fire. A camp ends the day, heals, and saves if it is safe. Its risks scale with the area and the season: wolves, outlaws and cold. A good fire, a companion on watch and a sheltered spot each reduce them, and a warm fire with a hot meal restores the stamina that the cold and the day took. Book 10 section 15 gives the numbers.

### Companions on foot
Up to two residents can travel with the steerer on the mainland. They comment on what they see from their own values and memories, help with hazards (a hand out of a bog hole, a watch at camp), and fight. They are away from the home while they travel, and the home runs without them (Book 10 section 19).

## 10 / Dungeons and game-changing equipment
*Six dungeon sites on the mainland, each with a reward that changes how the game is played, and a price for it.*

### What a dungeon has
Each dungeon has a lead, puzzles from the world, fair traps with signs, enemies, a guardian, lore and a reward that changes how the household plays, with a cost. Book 9 section 11 holds the layouts at outline level; Book 10 section 16 holds the numbers.

| Site | Guardian | Reward | What it changes | Cost |
|---|---|---|---|---|
| Black Wood souterrain (area 8) | The hill-folk's champion; riddling doors | **Ceo, the mist-spear** | In fog and at night, thrusts pass through shields | The hill-folk call on you at Samhain; Christian residents are uneasy |
| The Barrow-King's mound (area 20) | Hrolf the haugbúi and his draugar | **Barrow mail** | Best armour; immune to stagger | The dead are drawn to you at night; Ottar's family claim it (section 12) |
| The Drowned Trackway (area 10) | The Bog King, a drowned offering-priest | **The bog torc** | The dead cannot see you; you walk flooded bog | Fires warm you less; cold sickness risk |
| Outlaws' hill-fort (area 20, moor) | Faolán Wolf-Hand and his band | **A Frankish sword** | The finest sword on the coast | It was stolen from Dún Fiach; wearing it there is an accusation |
| The Cailleach's Cave (area 12) | Wind and ice, then the Cailleach herself | **The Cailleach's maul** | Shatters shields; freezes water it strikes (ice bridges, frozen bog) | Only works in autumn and winter; using it in summer angers her |
| Loch Carn (area 4), quest | The each-uisce | **The kelpie bridle** | Summon the water-horse to cross lochs, bogs and rivers fast | Never keep it near water at night, or it drowns its rider |

The costs are terms, not curses: each has a sign and is saved, like any supernatural consequence (section 07). The Cailleach's maul can also clear the landslide on the High Pass (section 03).

### Skarvholm's dungeons
Skarvholm keeps the Hollow Cairn, and the Seal Cave's deep passage is a small dungeon in its own right: the tidal back passage that runs under the bog to the cairn, open only at spring low tides (Book 9 sections 03 and 09).

## 11 / The living world
*The coast goes on without the household. People travel for their own reasons, and news arrives with them.*

### Travellers
Travellers move between areas on schedules, each with an origin, a destination and a reason: pilgrims to Kilbrecc, monks, herders driving cattle, Fiachra's riders, a travelling poet, traders' carts, tinkers, fugitives, and refugees from Orm's raids. They can be talked to, traded with, helped, recruited or robbed, and deeds apply to whatever is done to them, with witnesses like any other deed.

### Wandering characters
Wandering characters with small stories recur across the game: a poet who writes satires about the steerer, a pedlar who always knows a rumour, a hermit, and a disgraced warrior. Each can be met on a road, at a fair or at the household's own fire, and remembers the last meeting.

### Bandits
Outlaw camps form and break up. Outlaws ambush roads, and they raid farms when nobody checks them. A camp that is broken scatters its people; one that is left alone grows.

### Off-screen life and news
Places and travellers are simulated at low detail when off screen. Things happen while the household is away: a farm is raided, a fair is held, a leader falls ill, Orm takes a harbour. News reaches the household through travellers and traders, late and sometimes wrong, never by an all-seeing report.

### Traders at the homestead
Traders visit the household's home and bring goods, prices and leads: a Saltvik knarr in the sailing season, a Gaelic pedlar once the household is on the mainland, a wandering smith once a season, the sea-wife now and then, and Ulf's men as fences for stolen goods. Book 10 section 17 gives how often each comes.

### How busy the world is
On a road or in a settlement, a traveller or living event comes roughly every minute; in the wilderness, a creature, sign or event every 30 to 60 seconds (Book 10 section 17).

## 12 / Twists and the unexpected
*Every major quest has a reveal that changes what the right choice looks like.*

### Principles
- Every major quest has at least one reveal that changes what the "right" choice looks like.
- No clean good option: the obvious answer has a cost; the cruel answer sometimes helps.
- Consequences can arrive 10 to 40 days later, from people the player forgot.
- Characters have secrets and motives that surface through play, not exposition.
- Companions disagree, argue with each other and sometimes act on their own.
- Side quests intersect the main story.

### Twist seeds (proposal)
These are proposals for the user's review; build them unless vetoed. Book 5 holds the people's secrets and their personal quests.
1. **Thorkel's debt.** The household's drowned chief made his own bargain with Rán before the wreck: safe passage south for his people, at a price. The wreck was part of the price, and part of it is still owed. Revealed through Thorkel's ghost, Gudrun's memories and the Skerry of the Drowned.
2. **The outlaw prince.** Faolán Wolf-Hand is Fiachra's eldest son, outlawed for refusing to burn Kilbrecc in an old feud. Restoring him can split Dún Fiach between him and Órlaith, and the Frankish sword in his fort is the proof of who he is.
3. **The barrow's silver.** Hrolf the Barrow-King was Ottar's grandfather, buried with church silver stolen from Kilbrecc. Opening his mound exposes how Saltvik was founded.
4. **The abbot's calm water.** Brother Senán finds that the Bell's peace was bought with an old bargain, and the abbot knows. Whether it was a saint's prayer or a bargain stays ambiguous.
5. **The friendly pedlar.** The pedlar who always knows a rumour sells news to everyone, including Orm. He is not evil; he is poor.
6. **Ylva's last fetch.** Ylva's fetch-sightings come true. Then she sees the steerer's.
7. **The hostage who will not go home.** Donnchad, held as a hostage, does not want to return, because of what waits for him at Ardcarn.
8. **The grateful survivor.** Someone you spared in an early raid returns at the worst moment, to help or to repay a different debt.

A seed that is kept is part of the world truth from the start of every campaign, never decided at the moment of the reveal (section 07): Thorkel's debt is a bargain recorded like any other, the barrow's silver is part of how Saltvik was founded (section 06), and the Bell's meaning stays ambiguous. Thorkel's ghost can speak as his draugr, as the drowned at his funeral feast or on the Skerry of the Drowned, whichever the household meets.

### The event deck
An event deck of about forty rare events brings the unexpected. Each fires at most once per campaign, and only when its conditions fit the moment: a whale stranding, a poet's satire spreading, a sickness a resident hides, a lost child's shoe found (no child appears), a stolen boat, a feud at a feast, a sacred stone found in a field. About one comes every 5 to 10 days, never during a tutorial and never two at once (Book 10 section 17).
