# Oar and Ember, Book 04: Setting and Campaign Bible

*Geography, beliefs, history, supernatural rules and chapter structure for the Narrow Sea, around AD 900.*

The Narrow Sea is a few days' sailing wide and crowded with people who need each other and fear each other: Gaelic farmers and kings, monks with long memories, Norse-Gaelic traders, hungry raiders, and the old powers of sea, mist and hill that both peoples half believe in.

**How to use:** Use this book for world facts, stable IDs, Skarvholm and the mainland on foot, journeys, seasons, beliefs and their cruelties, supernatural rules, the wilderness, dungeons, the living world, twists, chapter beats and story gates, quests and companions, deaths, and attacks and defences. It must not contradict Book 1. Book 5 holds people, Book 6 scenarios, Book 7 appearance, Book 8 voices, Book 9 tile plans and Book 10 every number. Every place, zone, site, route, power and chapter here has a stable ID for Book 2's content files.

_All places, people, saints and events are fictional. Mythological figures are adapted from Norse and Gaelic sources for play; they are not reconstructions of historical belief. Historical touchstones are inspiration and should be checked before any claim of accuracy is made in marketing or in-game text._


## 01 / The Narrow Sea
*A fictionalised North Channel between the southern Hebrides and north-east Ireland. Close enough that a good crew can cross in a day; dangerous enough that many do not.*

> Figure: schematic map of the Narrow Sea (drawn in the PDF version of this book).

### Shape of the region
The Irish coast runs along the south-west of the map: farmland, ringforts, a monastery on a headland and Saltvik's harbour at its eastern end. Behind that shore lies the mainland: sixteen sites, from villages to dungeons, joined by road legs and by six wilderness routes through an oakwood, a great bog, a mountain pass, a ridge, a river and a moor (section 03). The Scottish coast closes the north-east: a long peninsula, a sea loch reaching into the hills and small islands. Skarvholm sits in the middle, exposed to every wind, a day's row from almost anywhere. To the north-west, past Blue Men's Sound, lie the northern isles where Orm Sveinsson rules from Kaldness. The deep water around Skarvholm is Rán's Reach, where the drowned go down.

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
*Sixteen sites explored on foot, joined by off-screen road legs and six wilderness routes that are crossed on foot; the ship is the fast way along the coast. The same for every player, it opens up over time, and the household knows it long before it chooses a home there.*

### One region that opens over time
The mainland (`REG_MAINLAND`) is one connected region on the Irish coast, and every player gets the same mainland. It has two kinds of playable place, joined by road legs:
- **Sites** are destinations explored in full on foot: villages, forts, the monastery, farms, dungeons, the turf village and the mountain.
- **Wilderness routes** are long playable places *between* sites. **Whenever a journey passes through a route, the player crosses it on foot, in game.**
- **Road legs** join sites and route ends. They happen off screen and cost game time.

From Chapter 3 the coastal sites can be reached by ship, and the inland sites open on foot through the routes as they are discovered and as blocks are cleared. The mainland is fully explorable long before Chapter 6, so the household chooses its home knowing the land. Places belong to factions or to the wilderness: a hostile faction's guards attack on sight in its territory, and sites and routes held by factions the household has wronged stay open but dangerous. Every site and route changes with season and tide. Book 9 sections 10 and 14 hold the layouts; Book 10 section 14 ("Sites and routes", "Network", "Journey modifiers", "Shortest journeys", "Route encounters") holds every travel number and the costs of clearing blocks.

### Home sites (Chapter 6)
There are two home sites, both on this map. Arra Foot is no longer a home site.

| Site | Place | Strengths | Weaknesses | Ways to secure it |
|---|---|---|---|---|
| `SITE_CARRICK_STRAND` Carrick Strand, beside Ardcarn | `MAIN_CARRICK_STRAND` | Good farmland, near Kilbrecc and Dún Fiach | It is the shore you first raided | Grant from Fiachra (service, hostage or a marriage tie between other households) plus compensation to Ardcarn; or seizure |
| `SITE_SALTNESS` Saltness headland, outside Saltvik | `MAIN_SALTNESS` | Trade, shipyard, strong position; sea caves below the headland | Poor soil; Orm's likely first target | Purchase in silver, or a season escorting Saltvik's fleet; council vote |

### Sites and routes
| ID | Place | Kind | Known at start | Leader / faction | Notes |
|---|---|---|---|---|---|
| `MAIN_CARRICK_STRAND` | Carrick Strand | Site, coast, home site A | Yes (by sea) | Ardcarn's land | Farmland by the shore first raided |
| `MAIN_CARRICK_LANDING` | Carrick Landing | Site, coast | Yes | Muiredach | First raid site |
| `MAIN_ARDCARN` | Ardcarn | Site, village | Yes | Muiredach | Fields, guesthouse, Eithne's old home |
| `MAIN_LOCH_CARN` | Loch Carn and Brigid's Well | Site, lake | No | (the each-uisce) | Water-horse; holy well |
| `MAIN_KILBRECC_FARMS` | The tenant farms | Site, farmland | No | Colmán's reeve | Tithe barns, the pilgrims' road, the bondmen who work the land |
| `MAIN_KILBRECC` | Kilbrecc | Site, monastery, coast | Yes | Abbot Colmán | Round tower, the Bell |
| `MAIN_BLACKWOOD_EDGE` | The Black Wood path (Fiodh Dubh) | **Route**, oakwood | No | Wilderness | Boar, charcoal burners, outlaw scouts. The ID keeps its first name, the edge |
| `MAIN_BLACKWOOD_HEART` | Fiodh Dubh: the heart | Site, old forest, dungeon | No | The aos sí | Entered from the Black Wood path through the hill-folk's gate |
| `MAIN_MOIN_MHOR` | Móin Mhór: the turf village and bog edge | Site, bog | No | Peat-cutters (Lasair) | The turf village on the Great Bog's edge; the plank road and the moor road end here |
| `MAIN_PLANK_ROAD` | The plank road across the Great Bog | **Route**, bog | No | Wilderness; the peat-cutters keep the planks | Móin Mhór to Sliabh Carn; floods in winter |
| `MAIN_TRACKWAY` | The Drowned Trackway | Site, bog, dungeon | No | (the Bog King) | Branches off the plank road; summer and autumn, or a winter freeze |
| `MAIN_SLIABH_CARN` | Sliabh Carn | Site, mountain | No | Herders (Dubhthach) | Shielings in summer; summit cairn |
| `MAIN_CAILLEACH_CAVE` | The Cailleach's Cave | Site, mountain cave, dungeon | No | (the Cailleach) | Ice, wind, old stone; closed by snow in winter |
| `MAIN_HIGH_PASS` | The High Pass | **Route**, pass | No | Wilderness | Landslide until cleared |
| `MAIN_DUN_FIACH` | Dún Fiach | Site, royal fort, coast | Yes (by sea) | King Fiachra, Órlaith | Rath on a crag |
| `MAIN_RIDGE_ROAD` | The Ridge Road | **Route**, ridge | Yes | Fiachra's riders | Patrolled; tolls |
| `MAIN_FORD` | The river path and the Ford | **Route**, river | Yes | The ford-keeper (Cuán) | Closed in spate unless bridged; the border |
| `MAIN_SALT_PANS` | Ottar's farms and salt pans | Site, farmland, coast | Yes | Hrefna, Ottar's steward | Work, trade, smugglers' rumours |
| `MAIN_SALTVIK` | Saltvik | Site, town, coast | Yes | Ottar Silkbeard, Gunnhild | Market, yards, guards |
| `MAIN_SALTNESS` | Saltness headland | Site, coast, home site B | Yes | Saltvik council | Sea caves below the headland |
| `MAIN_MOOR_ROAD` | The moor road | **Route**, moor | No | Wilderness | Salt pans to Móin Mhór; wolves in winter |
| `MAIN_MOUND_FIELD` | The Mound Field | Site, burial ground, dungeon | No | (Hrolf the Barrow-King); outlaws (Faolán) | Entered from the moor road; Faolán's outlaws' hill-fort beyond the mounds |

Sixteen places are sites and six are routes. Five sea-map places are sites of the mainland: Carrick Landing (`SITE_CARRICK`), Ardcarn (`TOWN_ARDCARN`, reached from the sea through Carrick Landing), Kilbrecc (`ABBEY_KILBRECC`), Dún Fiach (`FORT_DUNFIACH`) and Saltvik (`TOWN_SALTVIK`), and the two home sites are sites too. A name in brackets under Leader / faction is a power or one of the dead (section 07), not a living leader. Book 5 holds the leaders. Bealtaine fires are lit at the summit cairn on Sliabh Carn; the sea-wife keeps her hut at Saltvik; rumour says smugglers use the sea caves under Saltness.

### The network
A road leg is off screen and costs game time; a route is crossed on foot, and its time is for its direct path at walking pace. These are starting values; Book 10 section 14 ("Network") holds the numbers and computes the shortest journey between every pair of sites from them ("Shortest journeys"), and a test checks them.

| From | To | Kind | Time | Condition |
|---|---|---|---|---|
| Carrick Strand | Carrick Landing | Road | 0.5 h | |
| Carrick Landing | Ardcarn | Road | 0.5 h | |
| Ardcarn | Loch Carn | Road | 1 h | |
| Ardcarn | Kilbrecc farms | Road | 1 h | |
| Kilbrecc farms | Kilbrecc | Road | 0.5 h | |
| Ardcarn | Black Wood path (south end) | Road | 2 h | |
| Black Wood path | (crossing) | **Route** | About 2.5 h direct | The hill-folk's gate to the heart lies off it, and opens with their leave |
| Black Wood path (north end) | Móin Mhór | Road | 1 h | |
| Móin Mhór | Plank road (west end) | Road | 0.5 h | |
| Plank road | (crossing) | **Route** | About 2 h direct | The Trackway branches off it in summer and autumn, or in a winter cold snap |
| Plank road (east end) | Sliabh Carn | Road | 0.5 h | |
| Sliabh Carn | Cailleach's Cave | Road | 1 h | Closed by snow in winter |
| Sliabh Carn | High Pass (north end) | Road | 1 h | |
| High Pass | (crossing) | **Route** | About 2.5 h direct | Closed by the landslide until it is cleared |
| High Pass (south end) | Dún Fiach | Road | 1 h | |
| Kilbrecc | Ridge Road (west end) | Road | 1 h | |
| Ridge Road | (crossing) | **Route** | About 2 h direct | Branches east to Dún Fiach and south to the river; Fiachra's riders attack if Dún Fiach is hostile |
| Ridge Road (east end) | Dún Fiach | Road | 0.5 h | Guards attack if Dún Fiach is hostile |
| Ridge Road (south branch) | River path (north end) | Road | 1 h | |
| River path and Ford | (crossing) | **Route** | About 2 h direct | The Ford is closed in spate unless bridged |
| River path (south end) | Salt pans | Road | 1 h | |
| Salt pans | Saltvik | Road | 0.5 h | |
| Saltvik | Saltness | Road | 0.5 h | |
| Salt pans | Moor road (south end) | Road | 1 h | |
| Moor road | (crossing) | **Route** | About 2.5 h direct | The Mound Field lies off it |
| Moor road (north end) | Móin Mhór | Road | 1.5 h | |

### How a journey works
- **A journey is a chain** of road legs and routes. For example: Ardcarn, then two hours on the road (off screen), then **the Black Wood path** (played: about 2.5 game hours on its direct path, longer if the party explores), then one hour on the road (off screen), then Móin Mhór.
- **The travel map shows the chain before the player sets out**: each leg and route, its time, the time of arrival, and any block, season or hostile ground on the way. The player leaves a site by its road and chooses where to go; the off-screen legs pass, and the party arrives at the next route's end or at the destination.
- **A day fits one or two nearby sites.** At the Book 10 clock (section 02, "Clock": 50 real seconds a game hour, so 16.7 real minutes from 06:00 to 02:00), a far site needs a camp on the way, or the ship.
- **The ship is the fast way along the coast.** The coastal sites (Carrick Strand and Carrick Landing, Kilbrecc, Dún Fiach's landing below the crag, the salt pans, Saltvik and Saltness) can be reached by sea from Chapter 3, on the sea map with its own risks, skipping the inland routes. The inland sites can only be reached through the routes.
- **A route has no quick way through.** Whoever takes a journey through a route walks it; the party can turn back the way it came, camp on it, or leave by any of its ends.

### Road legs (off screen)
- **Modifiers** (Book 10 section 14, "Journey modifiers"): travel at night is slower and riskier; driving cattle or carrying cargo is slower; known roads are quicker; the kelpie bridle (section 10) halves water crossings; blocks (the landslide, spate, snow and flood) force a detour or close the way (below).
- **Journey events:** a road leg can be interrupted by a short playable scene: travellers, bandits, wolves, weather, a wounded stranger, or a discovery ("smoke in the hills" adds a new point of interest to the map). Most road legs are quiet. When the scene ends, the leg goes on.

### Wilderness routes (played)
- **Shape:** long rather than square, with a clear main path, side paths, pockets, one or two camp spots and at least one shortcut to find. The direct path takes about 1.5 to 2.5 real minutes of walking (2 to 3 game hours); exploring off it can double that. Time runs at its normal rate. Book 9 section 14 holds each route's layout in outline.
- **Contents:** one major point of interest, 4 to 8 minor ones, wildlife always, gathering spots (herbs, nuts, berries, timber, peat, fish in the streams), hazards (section 09) and camp spots.
- **Each crossing is different:** the time of day, the weather, the season, and the living world (section 11) draw what the party meets:
  - wandering people: travellers, pilgrims, pedlars, herders, charcoal burners, patrols, outlaws, a lost traveller, a fleeing thrall, a hunting party;
  - wildlife: deer, boar, hares, wolves, ravens, otters, eagles, by season;
  - the risk of attack: bandits, outlaws, wolves, a boar, or a patrol of a hostile faction.
- **Encounters:** wandering people on about half of all crossings; a hostile encounter on about one crossing in five by day and one in three at night; more or fewer with the season, the factions' state, the cargo carried and whether the household has cleared the route (Book 10 section 14, "Route encounters").
- **Ambushes are readable:** a fallen tree across the path, crows rising ahead, a stretch gone too quiet, fresh tracks. Keen-eyed companions spot them sooner (Book 5). Each ambush keeps the fairness of every danger: a sign first, then a choice to fight, pay, go round or turn back.
- **Cargo and cattle** slow the crossing and draw raiders. Companions cross with the steerer, and so does anyone being carried.

### The six routes
Each route has its own country and must meet the terrain art standard set at Stage 6 (wind, moving plants, light, water and wildlife); Book 7 draws it and Book 9 section 14 lays it out.

| Route | Country | Major point of interest | Typical dangers | Seasons |
|---|---|---|---|---|
| The Black Wood path | Old oakwood, holly, moss, shafts of light, streams | The charcoal burners' camp; the hill-folk's gate to the heart | Boar, outlaw scouts, wolves in winter, getting lost off the path | Nuts and mushrooms in autumn; bare and dark in winter |
| The plank road | Open bog, pools, cotton grass, the timber trackway | The turf-cutters' shelter; the branch to the Drowned Trackway | Sinking ground off the planks, mist, will-o'-the-wisps, the Bog King's drowned | Floods in winter; frozen in cold snaps |
| The High Pass | Scree, crags, a stream in a gorge, wind | The landslide (until cleared); a ruined watchtower | Rockfall, cold, wolves, Faolán's outlaws | Snow slows it in winter |
| The Ridge Road | Open ridge, heather, cairns, long views to the sea | Fiachra's toll post | Fiachra's riders if Dún Fiach is hostile; toll disputes | Busiest in summer, with fairs and pilgrims |
| The river path and the Ford | Alder and willow, a wide brown river, stepping stones | Cuán's ford-house and the crossing | Spate, the river itself, smugglers | Closed in spate unless bridged |
| The moor road | Heather moor, standing stones, a gallows tree | The standing stones; the turn to the Mound Field | Wolves in winter, outlaws, the barrow-dead at night | Long dark nights in winter |

### Making a route better
- **Find its shortcuts:** each route has at least one, off the main path, that shortens later crossings once found.
- **Drive out the outlaws** who use it: a broken camp scatters (section 11), and the route's hostile encounters fall.
- **Waymark it:** cairns or blazes along the main path keep a party on it in fog and at night.
- **Bridge the Ford:** a timber bridge, built like a homestead building, ends the spate closure for everyone (below).
- **Build a waystation:** a safe camp with a small store, at one camp spot per route. It counts as a safe camp for sleeping, saving and bringing the downed to safety (section 14). Book 10 section 15 ("Waystations") gives its cost and store.
- **Hostile ground stays open:** a route held by a hostile faction is never closed, but it is dangerous.

### Points of interest in every site and route
- **Major points of interest:** one or two in each site and one on each route: a village, dungeon, ruin, shrine or camp with people and quests.
- **Minor points of interest:** 4 to 8 in each site and route: a cairn, a wreck, a carved stone, a hermit's hut, a hidden cache, a viewpoint, an eagle's nest, a herb patch, a grave, a burned farm.
- **Off the beaten track:** the best minor rewards lie off the obvious paths, behind a climb, a wade, a hazard or a puzzle, and reward curiosity with food, materials, lore, collectibles or equipment. Hazards (section 09) guard many of the best finds. A cache, a dead archer's quiver or a hunter's camp often holds a few arrows (Book 10 section 21).
- **Camping:** if night falls away from home, the party camps at a site, at one of a route's camp spots or at a waystation (section 09).

Book 9 section 12 sets how densely they are placed.

### Secret entrances
Four of the six routes hide a secret entrance to a **small dungeon**: two to four chambers holding lore and a piece of equipment worth the detour, each with a cost (Book 6 section 13 holds what is inside; Book 9 section 14 places them; Book 10 section 20 holds the numbers). Nothing marks an entrance on the ground or on the travel map until it is found. The party finds it by exploring off the main path, helped by hints:
- **Rumours** from travellers and minor characters, at the fire, on the road and in the sites at either end. About one in three is wrong: it sends the party to the wrong place or the wrong season, never into a trap.
- **Carved marks** left by whoever used the place.
- **A cold draught** from a crack: leaf litter stirring, a breath of mist on a cold morning, a torch flame leaning.
- **Birds** flying into a cliff or a waterfall and not coming out.
- **A keen-eyed companion** who notices it when close, and says so (Book 5 section 17).

| Entrance | Route | Where | Hints | What it is |
|---|---|---|---|---|
| The fallen-oak souterrain | The Black Wood path | Under the root-plate of a fallen oak in the ring of old oaks, east of the main path | A cross cut in a holly where the side path leaves; a cold draught stirring the leaves at the roots; the charcoal burners' talk of a farm that stood there before the wood | An old farm's refuge, a souterrain of three low chambers where its people hid from raiders. It is a second, small souterrain, not a back way into the one in the heart: that still needs the hill-folk's leave |
| The cave behind the falls | The High Pass | Behind the waterfall over the gorge pool; in winter, behind a curtain of ice that must be broken | Dippers flying into the falls and not coming out; the watchmen's chevron cut on the watchtower's lintel and again on a stone by the pool; in winter, a dark hollow behind the ice | The watchtower garrison's hidden store, a dry cave of two chambers |
| The heather barrow | The moor road | A long, low hump in the heather beside the sheep trod, with one spiral-carved kerbstone showing | The spirals on the kerbstone; wheatears going in and out between the kerbstones; a cold draught from a gap at its end; the poet's verse about a grave older than the Barrow-King | A passage grave of the cairn-builders, far older than the Mound Field: a short passage and one chamber |
| The otter-cave behind the weir | The river path and the Ford | Behind the eel weir where it meets the rock of the bank, reached along the top of the weir at low water; closed in spate | Otters slipping behind the weir and not coming out; a ship cut into an alder by the path; Cuán's story of the otters' great house | A low cave and a dry inner chamber where a raiding crew of long ago hid what it could not carry |

The plank road and the Ridge Road keep secrets of other kinds (the peat-cutters' safe steps, the smugglers' way). A secret entrance is never on a route's main path and never gets round a block.

### How the map opens up
The blocks lie on the routes and road legs. A closed way shows its reason in words on the travel map, and a detour, or the ship, goes round it.
- **The landslide on the High Pass:** fallen rock and timber close the route's main path until cleared by a work party with axes and levers, by Fiachra's men after an alliance, or by the Cailleach's maul (section 10). Until then, Sliabh Carn and Dún Fiach are joined only the long way round, through the plank road, Móin Mhór, the Black Wood path, Ardcarn, Kilbrecc and the Ridge Road, or by sea. Book 10 section 14 gives the worker-days.
- **The Ford in spate:** the river path's crossing is closed in spate. Wait for the water to fall, go round by the moor road, take the ship to the salt pans, or build a timber bridge (a homestead build at the Ford), which also helps everyone who travels it. Book 10 section 14 gives the timber, the worker-days and when the river is in spate.
- **The hill-folk's gate:** the heart of the Black Wood lies off the Black Wood path. The hill-folk let the household in after an offering, a kept promise or the right words found in the hermit's psalter on Skarvholm.
- **The Drowned Trackway:** it branches off the plank road and is reachable in summer and autumn, or when a winter cold snap freezes the bog.
- **The bog in winter flood:** the plank road stays open on its planks, but its side paths and the Trackway branch go under water until a cold snap freezes them.
- **Snow on the climb:** the road leg from Sliabh Carn to the Cailleach's Cave is closed by snow in winter, and snow slows the High Pass.
- **Hostile ground:** sites and routes held by factions the household has wronged stay open but dangerous.

### Seasons on the mainland
| Season | Changes |
|---|---|
| Spring | Rivers in spate; the Ford closes; lambing in the farms; the bog wet but the planks passable |
| Summer | Herders at the shielings on Sliabh Carn; the Trackway reachable; fairs and pilgrims on the Ridge Road; most traffic on every route |
| Autumn | Harvest work; storms; the Ford may close; nuts, berries and mushrooms on the Black Wood path |
| Winter | Snow closes the Cailleach's Cave and slows the High Pass; the bog floods off the planks (or freezes in cold snaps); wolves range widely on the moor road and in the Black Wood; fewer travellers; nights are long and cold, so far journeys need a camp |

### Destinations across the sea
Glen Arra, Inis Rón and Crowwick are not part of the mainland. They remain destinations across the sea, each with its own small area on foot.

| Place | On foot |
|---|---|
| `GLEN_ARRA` Glen Arra | Gilla Muire's steadings, the summer grazing at the loch head and the narrow shore path that looks across the water to Crowwick |
| `ISLE_INISRON` Inis Rón | The Keepers' landing and the seal-kin's shore, where Manannán's compact is renewed |
| `CAMP_CROWWICK` Crowwick | Ulf's camp and its beach; taken only by assault |

## 04 / Seasons, weather and the calendar
*A 120-day year of four 30-day seasons. Each season changes what can be done and what must be done. The calendar keeps running, but it never forces a story gate (section 08).*

> Figure: chapter timeline across the calendar, at typical dates (drawn in the PDF version of this book).

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
- The game shows sincere believers in every tradition, including sceptics and hypocrites. It never declares one tradition correct, and it shows every tradition's cruelty as well as its comfort (below).
- Each people judges right and wrong by its own code: honour and shame, luck, oaths, kin and vengeance, hospitality, blood-price, sin and penance. Book 6 and Book 10 say how each culture reads a deed; Book 5 gives each major character's stance towards their own code.

### The cruelty of every tradition
Every religious tradition in the Narrow Sea is shown with its cruelty as well as its comfort, even-handedly, through what its believers do. No tradition is the good one. These are facts of the world, met in play:

| Tradition | Cruelty shown in play |
|---|---|
| Norse belief | Thralls killed to follow a chieftain into death; Heid giving captured crews to Rán; blood-oaths that bind sons to their fathers' feuds; Orm drowning hostages whose families failed to pay |
| The Church at Kilbrecc | Bondmen who work the tithe farms and cannot leave; public floggings for penance; the abbot's curse (a fast and a malediction against a household, the Gaelic custom of fasting against an enemy); hired swords when prayer fails; shrines of the older faith smashed |
| Gaelic custom | Satire that can ruin a person; the blood-price that lets the rich kill the poor; hostages starved when treaties break; geasa that doom people to impossible choices |
| The Keepers and the old powers | Seal-kin women bound by whoever holds their skin; the sick left on a skerry for the sea to judge; the Bog King's drowned offerings in the peat |

- **Shown, not glorified.** A cruelty is seen in what people do and what it costs those it falls on; the game never makes it a spectacle or a reward.
- **Always with kind, doubtful or ashamed believers too.** Every tradition has them: Tófi One-Eye tells the ugly truth about old raids; Thrand broke his oath to Orm after Heid gave a captured crew to Rán; Brother Senán is troubled by the abbey's bondmen and hired swords, and Sister Muirenn records the Church's own sins as faithfully as the heathens'; Faolán Wolf-Hand was outlawed for refusing to burn Kilbrecc; Bran keeps a Christian conscience inside a raider's past (Book 5).
- **The hard limits hold.** No children as actors, no sexual violence, no player torture. Period views of thralls, captives and marriage may be spoken; they never become a system, captives are never currency, and there is no slave market to sell into.

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
- **The washer at the ford:** before the final battle, a woman is seen washing bloody shirts in a stream. Asked, she will name whose shirts they are. The player can change orders, and so change fate, at a cost elsewhere (section 14).
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
- **Response:** ask leave properly, keep the promise, find the words; or keep to the Black Wood path.
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
- **Heid the Grey:** Orm's seeress, a völva who works seiðr with staff and song. She speaks for Rán and can call fog and turn tides within Orm's bargain. She is a person with a history; she believes every cruel rite she performs is owed, never doubts it, and can still be argued with (Book 5).
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
*Eight chapters across six phases. Each chapter has typical dates, a goal, key beats, unlocks and the story gates that move it on. Beats are ordered by default but most can be taken in a different order.*

### Story gates
- **The story moves forward only through major events the player chooses to start:** a raid, an expedition, a defence, a council. These are **gates**.
- **The calendar keeps running.** Seasons turn, crops grow and winter must be prepared for, but no chapter deadline passes without the player: a dated story event waits at its gate.
- **Pressure builds gently while the player delays** (demands grow, rumours spread), but it never forces a gate. Book 10 section 22 ("Story gates") gives how fast it builds.
- **Each gate has a readiness screen** showing the crew, the ship, the stores, the allies and the equipment, with a clear warning that it is a point of no return.
- **The chapter dates below are typical dates** for a well-paced player, not limits. Book 10 section 10's progression is a guide for such a player, not a deadline.
- **One exception: the defence of Skarvholm.** When the coast's answer in Chapter 5 is an attack, it comes on a fixed night, typically day 135 (Book 10 section 22), and cannot be put off or avoided. Omens, scouts and Thrand, if he is with the household, give warning at least seven days before. Once it is known, no journey or voyage may start that would keep the steerer away that night: the travel map and the sea map refuse it and say why. A steerer already away when the warning comes gets word, and is brought home by dusk on the day.

| Gate | Chapter | The player starts it by |
|---|---|---|
| The launch | 1 | Launching the boat at the end of Chapter 1 |
| The Carrick raid | 2 | Setting out for Carrick Landing |
| The reply to Asgrim | 4 | Giving Orm's tribute-collector the household's answer |
| The defence of Skarvholm | 5 | Standing to on the attack's fixed night, when the Answer is an attack (Book 6 scenario 8); the one gate that does not wait |
| The household council | 5 | Calling the council that decides the household's future |
| The move ashore | 6 | Sailing the household to its mainland site |
| The Gathering | 7 | Calling the council under sanctuary at Kilbrecc |
| The Return to Skarvholm | 8 | Setting out for the occupied island |
| The final battle | 8 | Setting out to meet Orm |

Optional raids, attacks and quests are never gates unless they are story events (sections 13 and 15).

### Chapter 1: The Wreck
**Typical dates:** days 1 to 6. **Session target:** 45 to 60 minutes. **Goal:** shelter, rescue four crew, make the boat seaworthy.
1. Wake on Wreck Strand with nothing in hand: no blade and no bow, so the steerer can only shove and dodge. Control in seconds. Hild is calling beyond the rocks, hurt and standing knee to waist deep in the shallows; wade out to her and carry her above the tide line. A glint in the wreck's debris a few steps from the waking place is a seax, found within the first five minutes. After the rescue Hild names Thorkel's hunting bow, stowed in the stern; the stern lies washed up at the east end of the strand, and the bow and a quiver of six arrows are found there within the first fifteen minutes. Each item's controls show once, as a tooltip, when it is first picked up.
2. Hild leads to the old broch. Gather driftwood, light a fire, treat her injury. Warmth, food, a conversation.
3. Three searches, any order: **Oddi** injured near the wreck (recover a chest now, or take Oddi home first); **Bran** in a sheepfold by the Hollow Cairn, guarding Thorkel's body from three wreck-scavengers (fight, sneak, or bargain with the chest); **Runa** at the Hag's Seat, injured, following a strange light (leave an offering for the Cailleach's help, or take the slower cliff path).
4. Three repairs: patch the hull with salvaged boards; recover rigging from the wreck section on the skerry at low tide; recover the steering oar from the scavengers' skiff in Seal Cave (fight, steal, trade, or have Runa carve a new one over two days).
5. One reversible customisation: more cargo space, or a raised fighting position at the bow.
6. Thorkel's rites (optional, recommended by Hild): a stone ship-setting on the machair, or a sea burial with gold for Rán.
7. Days and nights pass in real time: the first night by the fire, the first dawn report, the first fish from the shore.
8. Launch. Name the boat and choose a sail mark. The sea map reveals the coast and smoke rising at Carrick Landing.
**Unlocks:** sea map, steading basics. **Gate:** the launch: the boat is launched.

### Chapter 2: The First Raid
**Typical dates:** days 7 to 15. **Goal:** provisions and iron. Full scenario in Book 6.
Lead from a chart fragment and the smoke. Setting out for Carrick Landing is the Carrick raid gate. One preparation advantage. Carrick Landing supports theft, bargaining, threatening the keeper or fighting the guards, with one complication. The boat cannot hold everything. Return to Skarvholm: the haul becomes tangible (a forge, food runway, a newcomer at the fire). Two leads are offered: Saltvik (trade and Runa's sister) and Glen Arra (cattle and a rumour of Ulf).
Back home, the first days of real work: the forge, the drying racks, the first peat cutting and the first plots dug.
**Unlocks:** raiding, home consequences, homestead tasks and building designation, the steward role if Eithne joined. **Moves on:** when two leads are offered.

### Chapter 3: The Open Coast
**Typical dates:** days 16 to 60. **Goal:** learn the coast, build a capable crew, make the island a home.
- Saltvik: trade, the first ship fittings, Kolbeinn the smith, wind-knots, news of Orm.
- Glen Arra and Crowwick: Ulf appears as a rival who wants a share of everything.
- Kilbrecc can be visited, traded with or raided. Brother Senán can become a contact.
- The fog-light event brings Nessa (Book 6).
- About day 40 to 50, the **Followers' boat** arrives: Old Gudrun and five more of Thorkel's household who escaped separately. Too many mouths; the island needs more.
- At home: sow the plots before day 25, cut peat, build the longhouse, and explore the whole island: Seal Cave, the Grey Men, the cairn, the cell and the Skerry of the Drowned.
- First sign of the tides: a spring tide reaches the broch's foot.
- The mainland opens: from this chapter its coastal sites (Carrick Strand and Carrick Landing, Kilbrecc, Dún Fiach, the salt pans, Saltvik and Saltness) can be reached by ship, and the inland sites open on foot through the wilderness routes as they are found and their blocks are cleared (section 03). Up to two companions can go ashore with the steerer (section 13), and camps let a journey inland last several days (section 09).
**Moves on:** when residents number at least 9 and a longhouse is built (typically about day 60). No date ends the chapter.

### Chapter 4: A Name on the Water
**Typical dates:** days 61 to 120. **Goal:** become wealthy and survive winter.
- Bigger targets: the Bell of Brecc, Glen Arra's cattle, Asgrim's tribute ship. Rival crews notice.
- The karvi hull: bought at Saltvik, captured, or built in the boatshed over winter.
- **Asgrim Cold-Hand** arrives from Orm: a tenth of all plunder and one hostage, or Orm's displeasure.
- At home: harvest between days 61 and 75, cut and dry hay, slaughter and salt, fill the peat stacks and lay the ship up in the boatshed. The Year 1 threat schedule (Book 10) tests the watch.
- The Cailleach's washing closes the sea. Winter at home: cold, fuel and sickness; Samhain and the Yule feast; stories, crafting and repairs; the Nessa reveal window opens.
- The Kelda spring turns brackish at spring tides.
- Between voyages, expeditions inland: the Black Wood, Móin Mhór, Sliabh Carn and the Mound Field hold the dungeons and their equipment (section 10). Autumn is the last chance at the Cailleach's Cave before snow closes it; a winter cold snap can freeze the bog to the Drowned Trackway.
**Gate:** the reply to Asgrim. He returns for an answer, typically at the end of winter, and waits for it: the player chooses when to give it, while Orm's demands grow.

### Chapter 5: The Long Memory
**Typical dates:** days 121 to 180. **Goal:** face the cost of earlier raids and decide the household's future.
- Retaliation falls due according to the deed ledger: Fergal's ships from Dún Fiach, an interdict from Kilbrecc, Ulf's ambition, Ardcarn's hired swords. None is scripted; each is earned.
- Orm's fleet takes an independent harbour. Refugees arrive.
- A storm-tide slumps Naust Cove. The spring fails at every spring tide.
- **The household council:** stay and dwindle, or move ashore to Carrick Strand or Saltness, on a mainland the household already knows. Residents argue from their values and from what they have seen there.
**Gates:** the defence of Skarvholm, if the Answer is an attack (Book 6 scenario 8): the attack comes on its fixed night, typically day 135, after at least seven days' warning, and it does not wait for the player (Story gates, above; section 15); then the household council, where the household commits to a mainland site. Choosing to stay leads to the Lonely Isle path.

### Chapter 6: The Borrowed Shore
**Typical dates:** days 181 to 210 (earlier if the council commits earlier). **Goal:** secure a mainland home and move the household.
- Secure the chosen site, Carrick Strand or Saltness, by the ways in section 03: a grant from Fiachra won by service, a hostage or a marriage tie, with compensation to Ardcarn; purchase or service to Saltvik and a council vote; or seizure.
- Move people, livestock, stores and workshops over several voyages. The consort ship helps.
- Live on ground the household already knows. The mainland has been open since Chapter 3, so this chapter finishes opening what is still blocked and settles who the neighbours are; hostile ground stays open but dangerous. A Gaelic pedlar starts calling at the new home (section 11).
- Raise a hall and a palisade. Meet the neighbours who remember you.
- Decide what remains on Skarvholm: an outpost with a few residents, a lookout only, or nothing. Whatever is left there is taken when Orm seizes the island in Chapter 7.
**Gate:** the move ashore: the household sails for its mainland site. **Moves on:** when the hall and defences are built and most of the household has moved.

### Chapter 7: The Gathering
**Typical dates:** days 211 to 240. **Goal:** unite former rivals against Orm.
- A council under sanctuary at Kilbrecc. Each faction states its contribution and its demand.
- Compensation, returned captives, returned relics, public concessions and marriage ties are negotiated.
- Rival raiders call it betrayal. Some leave; some can be won.
- Orm's ships take Skarvholm in the week of the Gathering (typically about day 228); outpost residents become captives in the broch.
- The Keepers reveal how Orm's bargain can be broken, and that the compact needs Manannán's Cup from the Hollow Cairn, where Gróa is now digging. Nessa's fate is settled.
**Gate:** the Gathering: the player calls the council when ready. When it ends, Orm's fleet sails (typically at the start of Year 3).

### Chapter 8: The Sea King
**Typical dates:** days 241 to 270. **Goal:** defeat or outlast Orm and break his bargain.
- **The Return to Skarvholm (typically days 241 to 252):** a required expedition to the occupied island for the Cup (Book 6 scenario 9), and a gate. Checkpoint before landing; if it fails, one retry before you set out for the final battle. If the watch on Rook Hill lights its beacon, Orm is warned: it brings his attack, the final battle, 5 days earlier and raises the pressure faster, while the final battle remains a gate (Book 10 section 22).
- A last preparation window: renew the compact at Inis Rón if the Cup is in hand; assign allies, ships and defenders. Orm's fleet is at sea, and its raids on the coast grow while the household waits, but the battle begins only when the player sets out for it: the final battle gate. Checkpoint before the battle.
- The washer at the ford names who will die. Orders can change it.
- Battle in two linked parts: a sea engagement at the approaches (Rán's daughters against Manannán's mist, if renewed) and the defence of the mainland home.
- Breaking the bargain during the battle turns the weather. Orm can be killed, captured, exiled or bargained with.
**Endings:** the United Coast, the Uneasy Peace, the New Sea King, the Lonely Isle; defeat returns to the pre-battle checkpoint.

### Chapter state contract
Each chapter has states: **locked**, **open**, **active**, **resolved**. A chapter opens when the gate or the conditions that end the chapter before it are passed; a date never opens, ends or skips a chapter. A dated story event (Asgrim's return, Orm's seizure of Skarvholm) waits at its gate rather than passing without the player. Resolution is recorded with the facts that caused it. Loading a save never replays a resolved beat.

## 09 / Wilderness, hazards and camping
*The wilderness is big and worth exploring. Its dangers are fair: each one shows itself before it bites.*

### What every wilderness route and wild site holds
Every wilderness route (section 03) and every wild site (the heart of the Black Wood, Loch Carn, Sliabh Carn, the Mound Field and the dungeons) has at least one secret, one resource worth the trip, one story (a traveller, a ruin, a grave) and one danger, among the points of interest section 03 requires. Wolves hunt in packs at night and in winter; boar charge when cornered; deer and birds flush and give warning. Outlaws can be fought, paid, avoided or recruited.

### Hazards
| Hazard | Where and when | Sign | What happens and the response |
|---|---|---|---|
| Bog holes | Off the plank road's planks, Móin Mhór's bog edge, the Drowned Trackway, the moor road | Bright green moss, standing water, bubbles | Slow, then sink unless pulled out by a companion, a pole or a rope; the peat-cutters know the safe steps |
| Spate rivers | The Ford on the river path, and streams, in spring and after autumn storms | Brown water, a roar, foam over the stepping stones | A person who enters is swept downstream; wait for the water to fall, or bridge it |
| Cliffs and scree | Sliabh Carn, the High Pass, the coast; the climbs to off-path finds | Loose stone underfoot, a marked climb or none | Falls cost vitality; scree slides under a running party |
| Cold at night | Everywhere in winter; high ground in any season | Breath shows, frost forms, the stamina bar shrinks with the reason "Cold" | Make a fire, find shelter, or press on and grow weaker |
| Fog | The plank road, the moor road, the Black Wood path | Sounds go flat; the far edge of the scene greys out | Getting turned round off a route's main path: the way out may not be the way in; a guide, a known landmark or a waymarked path helps |
| Wolves | Packs at night and in winter; the moor road, the High Pass and the Black Wood path in winter | Howling, tracks, sheep scattered | Fire keeps them off; stand together or get to shelter |
| Boar | The Black Wood path | Rooted ground, a snort in the undergrowth | Charges when cornered; give it room |
| Outlaws | The routes, and now and then a road leg, when camps are unchecked | A fallen tree across the path, crows rising ahead, a whistle, a stretch gone too quiet, fresh tracks | Ambushes and roadblocks: fight, pay, go round or turn back, or recruit |
| Landslides | The High Pass and steep ground after rain | Trickling stones, cracked turf | Ground gives way; wait for it to settle, or take another way |
| Lightning | High ground in storms | Hair lifts, a hum in iron, the storm overhead | Get off the summit and away from iron |
| The hill-folk's rules | Rings, mounds and the Black Wood heart | Flowers out of season, shadows falling the wrong way | Leave them alone, or learn the rule (section 07) |

Traversal draws on the steerer's stamina: climbing, swimming and waist-deep wading drain it, and running out mid-climb or mid-swim is a hazard of its own (Book 1 section 18). Cold, hunger, wounds, lack of sleep and a hard day lower the bar's size, so a long day in the wilderness makes every crossing harder. Book 10 sections 06 and 15 give the numbers.

### Camping
If night falls away from home, the party camps at a site, at one of a route's camp spots or at a waystation (section 03), on ground that is not hostile, with a bedroll and a fire. A far journey needs a camp on the way, or the ship. A camp ends the day, heals, and saves if it is safe; a safe camp or a waystation is also somewhere to bring a downed ally (section 14). Its risks scale with the place and the season: wolves, outlaws and cold. A good fire, a companion on watch and a sheltered spot each reduce them, and a warm fire with a hot meal restores the stamina that the cold and the day took. Book 10 section 15 gives the numbers.

### Companions on foot
Up to two companions can travel with the steerer on any expedition on foot (section 13). They comment on what they see from their own values, traits and memories, help with hazards and puzzles (a hand out of a bog hole, a watch at camp), spot ambushes if they are keen-eyed, and fight. They are away from the home while they travel, and the home runs without them (Book 10 section 19).

## 10 / Dungeons and game-changing equipment
*Six dungeon sites on the mainland, each with a reward that changes how the game is played, and a price for it.*

### What a dungeon has
Each dungeon has a lead, puzzles from the world, fair traps with signs, enemies, a guardian, lore and a reward that changes how the household plays, with a cost. Book 9 section 11 holds the layouts at outline level; Book 10 section 16 holds the numbers.

| Site | Guardian | Reward | What it changes | Cost |
|---|---|---|---|---|
| Black Wood souterrain (the heart) | The hill-folk's champion; riddling doors | **Ceo, the mist-spear** | In fog and at night, thrusts pass through shields | The hill-folk call on you at Samhain; Christian residents are uneasy |
| The Barrow-King's mound (the Mound Field) | Hrolf the haugbúi and his draugar | **Barrow mail** | Best armour; immune to stagger | The dead are drawn to you at night; Ottar's family claim it (section 12) |
| The Drowned Trackway (off the plank road) | The Bog King, a drowned offering-priest | **The bog torc** | The dead cannot see you; you walk flooded bog | Fires warm you less; cold sickness risk |
| Outlaws' hill-fort (beyond the Mound Field) | Faolán Wolf-Hand and his band | **A Frankish sword** | The finest sword on the coast | It was stolen from Dún Fiach; wearing it there is an accusation |
| The Cailleach's Cave (above Sliabh Carn) | Wind and ice, then the Cailleach herself | **The Cailleach's maul** | Shatters shields; freezes water it strikes (ice bridges, frozen bog) | Only works in autumn and winter; using it in summer angers her |
| Loch Carn, quest | The each-uisce | **The kelpie bridle** | Summon the water-horse to cross lochs, bogs and rivers fast | Never keep it near water at night, or it drowns its rider |

The costs are terms, not curses: each has a sign and is saved, like any supernatural consequence (section 07). The Cailleach's maul can also clear the landslide on the High Pass (section 03).

### Small dungeons behind secret entrances
Four wilderness routes hide a secret entrance to a small dungeon (section 03): the fallen-oak souterrain, the cave behind the falls, the heather barrow and the otter-cave. They are smaller than the six dungeons above, with no guardian of the same weight, and their equipment is useful rather than game-changing; each still has its lore and its cost (Book 6 section 13).

### Skarvholm's dungeons
Skarvholm keeps the Hollow Cairn, and the Seal Cave's deep passage is a small dungeon in its own right: the tidal back passage that runs under the bog to the cairn, open only at spring low tides (Book 9 sections 03 and 09).

## 11 / The living world
*The coast goes on without the household. People travel for their own reasons, and news arrives with them.*

### Travellers
Travellers move between sites on schedules, along the road legs and through the routes, each with an origin, a destination and a reason: pilgrims to Kilbrecc, monks, herders driving cattle, Fiachra's riders, a travelling poet, traders' carts, tinkers, fugitives, and refugees from Orm's raids. They can be talked to, traded with, helped, recruited or robbed, and deeds apply to whatever is done to them, with witnesses like any other deed.

### Wandering characters
Wandering characters with small stories recur across the game: a poet who writes satires about the steerer, a pedlar who always knows a rumour, a hermit, and a disgraced warrior. Each can be met on a route or a road leg, at a fair or at the household's own fire, and remembers the last meeting.

### Bandits
Outlaw camps form and break up, most of them off the routes. Outlaws ambush the routes and now and then a road leg, and they raid farms when nobody checks them. A camp that is broken scatters its people; one that is left alone grows.

### Off-screen life and news
Places and travellers are simulated at low detail when off screen. Things happen while the household is away: a farm is raided, a fair is held, a leader falls ill, Orm takes a harbour. News reaches the household through travellers and traders, late and sometimes wrong, never by an all-seeing report.

### Traders at the homestead
Traders visit the household's home and bring goods, prices and leads (arrows by the dozen from the knarr, and iron arrowheads from the smith): a Saltvik knarr in the sailing season, a Gaelic pedlar once the household is on the mainland, a wandering smith once a season, the sea-wife now and then, and Ulf's men as fences for stolen goods. Book 10 section 17 gives how often each comes.

### How busy the world is
In a settlement, a traveller or living event comes roughly every minute; on a wilderness route or in a wild site, a creature, sign or event every 30 to 60 seconds (Book 10 section 17). Each route crossing also draws its wandering people and its risk of attack (section 03); most road legs are quiet.

## 12 / Twists and the unexpected
*Every major quest has a reveal that changes what the right choice looks like.*

### Principles
- Every major quest has at least one reveal that changes what the "right" choice looks like.
- No clean good option: the obvious answer has a cost; the cruel answer sometimes helps.
- Consequences can arrive 10 to 40 days later, from people the player forgot.
- Characters have secrets and motives that surface through play, not exposition.
- Companions disagree, argue with each other and sometimes act on their own.
- Side quests intersect the main story.

### Twist seeds
The user approved them (decision DD-1). Book 5 holds the people's secrets and their personal quests.
1. **Thorkel's debt.** The household's drowned chief made his own bargain with Rán before the wreck: safe passage south for his people, at a price. The wreck was part of the price, and part of it is still owed. Revealed through Thorkel's ghost, Gudrun's memories and the Skerry of the Drowned. What is still owed comes due as Rán's debt (section 14).
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

## 13 / Optional quests and companions
*Quests the player can mount at any time for the ship, for equipment and for the residents; and up to two companions on any expedition on foot.*

### Optional quests
Optional quests can be mounted at any time, between the story gates, and never move the story on by themselves:

| For | Examples |
|---|---|
| Ship enhancements | A better sail, a carved prow, a sea-charm, a famous mast timber |
| Character equipment | The dungeon rewards (section 10), and smaller finds off the beaten track (section 03) |
| Residents' requests | What residents ask of the steerer, some of which grow into quests across the map (Book 5 section 11) |

### Companions
- **Up to two:** the steerer can take up to two friendly characters, residents or allies who agree to come, on any expedition on foot: a journey, a site, a dungeon or a raid ashore.
- **What they do:** they fight, help with puzzles and hazards, comment, react through their traits, values and stance (Book 5), and can be wounded or downed like anyone (section 14). While they are away the home runs without them (Book 10 section 19).
- **Some quests need a particular companion:** Runa to judge a mast timber, or Senán to read a carved stone. The quest says so before the party sets out.

## 14 / Downed, left behind, and scripted deaths
*Downed friends generally live if they are brought to safety. Crew die mainly by being left behind, by berserkers and cruel enemies, and in scripted deaths and death-choices, and every death changes the household.*

### Downed, not dead
- **Downed friendly characters generally survive** if the steerer brings them back to the boat or the village before the scene ends; on a journey, a safe camp or a waystation counts (section 03). They do not bleed out on a timer.
- **Carrying is slow** and leaves the carrier unable to fight (Book 10 section 06, "Downed and carried").
- **Enemies do not finish off the downed**, except berserkers and a few named cruel enemies, and those do so with a visible warning first.
- **Left behind** at the end of a scene, a downed ally is captured or killed, according to the enemy. Captives can be rescued or ransomed back later.
- **Where deaths come from:** crew permadeath now comes mainly from being left behind, from berserkers and cruel enemies, and from scripted deaths. The *Rán's mercy* option still prevents unscripted deaths; scripted deaths still happen.

### Scripted deaths and death-choices
| Death | When | What happens |
|---|---|---|
| Rán's debt | Thorkel's bargain comes due (section 12, twist 1) | Someone must go into the sea. Gudrun offers herself. The steerer can accept, choose otherwise, or refuse and pay another way: the ship, the household's luck or a later life |
| The Return's cairn door | The Return to Skarvholm (Chapter 8) | Someone must hold the cairn door as the tide rises. Whoever stays dies, unless the party found the spring-room passage first (Book 9 section 09) |
| Bran's reckoning | Once Bran is known at Kilbrecc (Book 5) | A monk's family demands Bran's life as blood-price. Bran can go to his death, be exiled, or be defended at the cost of the alliance |
| Thrand's proof | Thrand challenges Asgrim to prove Heid's crimes | Without the evidence, Thrand dies in the duel |
| The defence of Skarvholm | The night of the attack (Chapter 5) | Whoever leads the watch may die holding the landing, depending on the preparation |
| Berserk deaths | Any fight | A berserker such as Kári can die charging alone, through the trait (Book 5) |
| The washer at the ford | Before the final battle (section 07) | She names who will die; changing orders can save them, at a cost elsewhere |

### Every death counts
Every death is consequential: grief (happiness falls across the household), lost skills and jobs, changed relationships, a grave to tend, songs at the fire, ghosts or fetches where the dead had unfinished business (section 07), story branches that close, and enemies who mock or allies who honour the dead. Rites matter: dead left without them invite draugar and shame the kin.

## 15 / Raids, attacks and defences
*The household fights by sea and by land, attacking and defending. Each fight is a story gate when it is a story event, and optional otherwise.*

| Kind | What it is | Where |
|---|---|---|
| Raids by sea | Stealth or an all-out assault (Book 6 section 12) | Any shore the ship can reach |
| Attacks by land | Once the household is on the mainland, it marches overland with its people and allies, by the network of section 03, and assaults a camp, a farm or a fort, with the same formation and objective rules as an assault from the sea | Mainland camps, farms and forts, outlaw camps among them |
| Sea-borne attacks | The household lands in force from its ships on a coastal settlement | Mainland coastal places (Carrick, Kilbrecc, Saltvik's outer harbour) as well as Crowwick and Orm's outposts |
| Defences | Watch, warning and preparation (walls, traps, stakes, archers on platforms), then the battle | The homestead on Skarvholm, and the mainland home |

Each is a gate when it is a story event (section 08: the Carrick raid, the defence of Skarvholm, the final battle), with a readiness screen and a warning that it is a point of no return, and optional otherwise. A story defence waits at its gate: its signs show, the attackers gather, and the battle comes when the player stands to for it. The one exception is the defence of Skarvholm, which comes on its fixed night (section 08).
