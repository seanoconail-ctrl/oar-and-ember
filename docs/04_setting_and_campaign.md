# Oar and Ember, Book 04: Setting and Campaign Bible

*Geography, beliefs, history, supernatural rules and chapter structure for the Narrow Sea, around AD 900.*

The Narrow Sea is a few days' sailing wide and crowded with people who need each other and fear each other: Gaelic farmers and kings, monks with long memories, Norse-Gaelic traders, hungry raiders, and the old powers of sea, mist and hill that both peoples half believe in.

**How to use:** Use this book for world facts, stable IDs, regions on foot, seasons, supernatural rules and chapter beats. It must not contradict Book 1. Book 5 holds people, Book 6 scenarios, Book 7 appearance, Book 8 voices, Book 9 tile plans and Book 10 every number. Every place, zone, power and chapter here has a stable ID for Book 2's content files.

_All places, people, saints and events are fictional. Mythological figures are adapted from Norse and Gaelic sources for play; they are not reconstructions of historical belief. Historical touchstones are inspiration and should be checked before any claim of accuracy is made in marketing or in-game text._


## 01 / The Narrow Sea
*A fictionalised North Channel between the southern Hebrides and north-east Ireland. Close enough that a good crew can cross in a day; dangerous enough that many do not.*

> Figure: schematic map of the Narrow Sea (drawn in the PDF version of this book).

### Shape of the region
The Irish coast runs along the south-west of the map: farmland, ringforts, a monastery on a headland and Saltvik's harbour at its eastern end. The Scottish coast closes the north-east: a long peninsula, a sea loch reaching into the hills and small islands. Skarvholm sits in the middle, exposed to every wind, a day's row from almost anywhere. To the north-west, past Blue Men's Sound, lie the northern isles where Orm Sveinsson rules from Kaldness. The deep water around Skarvholm is Rán's Reach, where the drowned go down.

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
| `SK_CAIRN` | The Hollow Cairn | A grassed mound older than anyone's story, with passages inside, a sealed inner door and, behind it, Manannán's Cup. The aos sí keep it. |
| `SK_TIDECAVE` | Seal Cave | A tide cave on the north-east cliffs where the wreck-scavengers hide their skiff. |
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
Spring brings lambs, eggs on the cliffs and the first peat cutting. Summer brings long light, birds and the best fishing. Autumn brings seal pups and storms that throw wreckage onto the strand. Winter freezes the bog pools, darkens the afternoons and brings the dead closer at Samhain and Yule.

## 03 / The mainland on foot
*Once the household moves ashore, the new home sits in a hinterland joined by routes on foot. Some places are known; many must be found.*

### Candidate home sites (Chapter 6)
| Site | Strengths | Weaknesses | Ways to secure it |
|---|---|---|---|
| `SITE_CARRICK_STRAND` Carrick Strand, beside Ardcarn | Good farmland, near Kilbrecc and Dún Fiach | It is the shore you first raided | Grant from Fiachra (service, hostage or a marriage tie between other households) plus compensation to Ardcarn; or seizure |
| `SITE_SALTNESS` Saltness headland, outside Saltvik | Trade, shipyard, strong position | Poor soil; Orm's likely first target | Purchase in silver, or a season escorting Saltvik's fleet; council vote |
| `SITE_ARRAFOOT` Arra Foot, mouth of Loch Arra | Sheltered water, cattle land, near Inis Rón | Remote; Crowwick next door | Protection pact with Glen Arra (deal with Ulf), or take Crowwick |

### How the hinterlands work
Each candidate site has a region of about nine to twelve connected scenes. Walking from the home to its farthest known place takes three to five real minutes. Known roads between waymarks can be travelled quickly when safe. Places belong to factions or to the wilderness; a hostile faction's guards attack on sight in its territory.

### Carrick hinterland (`REG_CARRAIG`, Irish coast)
| Place | Known at start | What it holds |
|---|---|---|
| Carrick Strand (home site) | Yes | Farmland by the shore you first raided |
| Carrick Landing and Ardcarn | Yes | Muiredach's people, their stores and their memories |
| Loch Carn and Brigid's well | Yes | The each-uisce, bound or loose |
| Coastal path to Kilbrecc | Yes | The monastery and its tenants |
| Ridge road to Dún Fiach | Yes | Fiachra's riders patrol it |
| Fiodh Dubh, the Black Wood | No | Wolves, outlaws and an old ringfort of the hill-folk with a souterrain beneath |
| Móin Mhór, the great bog | No | A plank road, a drowned trackway and something kept in the peat |
| Sliabh Carn | No | A summit cairn where Bealtaine fires are lit |

### Saltness hinterland (`REG_SALTNESS`, Irish coast by Saltvik)
| Place | Known at start | What it holds |
|---|---|---|
| Saltness headland (home site) | Yes | A strong position with poor soil |
| Saltvik | Yes | Market, yards, guards |
| The salt pans and Ottar's farms | Yes | Work, trade and Ottar's stewards |
| The Mound Field | No | Norse burial mounds; one haugbúi guards its goods |
| The moor | No | Wolves in winter; peat; an old hill-fort |
| The river ford | Yes | The border with Dún Fiach's land |
| Smugglers' cave and the sea-wife's hut | No | Contraband, wind-knots and secrets |

### Loch Arra hinterland (`REG_ARRA`, Scottish coast)
| Place | Known at start | What it holds |
|---|---|---|
| Arra Foot (home site) | Yes | Sheltered water and cattle land |
| Glen Arra's steadings | Yes | Gilla Muire's kin |
| Coire Ard shielings | No | Summer pasture, herders and the high corrie |
| The pinewood | No | Boar, deer, outlaws |
| Beinn na Caillich | No | The Cailleach's mountain, a cave and a spring |
| Shore path to Crowwick | Yes | Ulf's camp across the water |
| Crossing to Inis Rón | No | A tidal crossing open only at spring low tides |
| Selkie cove and the old broch | No | Seal-kin, and a lookout Ulf uses |

### Wilderness rules
- Wolves hunt in packs at night and in winter; boar charge when cornered; deer and birds flush and give warning.
- Outlaws ambush roads; they can be fought, paid, avoided or recruited.
- Winter nights away from fire make the party cold; fog can turn a party round.
- Hill-folk rings and mounds have rules: leave them alone, or learn them.

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

Yule falls on day 105 of each year. Festivals are social events at home and abroad, and the nights when bargains and boundaries matter most. Samhain is when the dead and the hill-folk walk closest; Bealtaine is when bargains are easiest to strike.

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
- **In play:** the Hollow Cairn on Skarvholm (whose occupant can be a neighbour, a nuisance or a protector), shrines that protect villages, and boundaries that matter when choosing a mainland site.

### The unquiet dead (Norse)
Death is normally final. A **draugr** rises only from a specific unresolved condition: a body left unburied, an oath broken over a corpse, a death under protection betrayed, or a deliberate raising. A **haugbúi** guards its mound and its goods.
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
- **The each-uisce:** a water-horse in Loch Carn above Ardcarn, bound by Brigid's well. It offers a fine horse to ride and drags riders under. Raiding the well's offerings releases it. Binding it again is a redemption path with Ardcarn.
- **Selkies:** seal-kin who take off their skins to walk ashore. A stolen skin binds a selkie to whoever holds it. Nessa's story turns on one.
- **The lyngbakr:** a heather-backed beast so large it is mistaken for an island. Sign: an uncharted island with no birds and a sweet smell. Rule: do not land. Response: steer off, or throw food to draw it under. Consequence of landing: an escape scene as the island sinks.
- **The Long Swimmer:** a serpent shape that follows ships for days. It wants something aboard. Learning what (a stolen object, a drowned body, a debt) resolves it without a fight.

### Human practitioners
- **Heid the Grey:** Orm's seeress, a völva who works seiðr with staff and song. She speaks for Rán and can call fog and turn tides within Orm's bargain. She is a person with history and doubts, and can be argued with (Book 5).
- **Sea-wives and wind-knots:** a sea-wife at Saltvik sells cords tied in three knots. One knot loosed is a fair wind, two a strong one, three a gale nobody controls. Each knot also adds a little to Rán's share.
- **The Keepers:** they know the old compacts and the right words, and can teach specific rites. They are not wizards.

### Blood on sacred ground
Killing at a holy well, a church, a mound or a stone ring is noticed by more than people. The place's power responds according to its rules: Brigid's well clouds and the each-uisce stirs; the Hollow Cairn's keepers withdraw their goodwill; a church becomes a place where the household's dead do not rest easily. These are consequences with signs and remedies, not curses without escape.

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
1. Wake on Wreck Strand. Control in seconds. Hild is calling beyond the rocks; carry her above the tide line.
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
**Gate:** residents at least 9 and a longhouse built, or day 60.

### Chapter 4: A Name on the Water
**Window:** days 61 to 120. **Goal:** become wealthy and survive winter.
- Bigger targets: the Bell of Brecc, Glen Arra's cattle, Asgrim's tribute ship. Rival crews notice.
- The karvi hull: bought at Saltvik, captured, or built in the boatshed over winter.
- **Asgrim Cold-Hand** arrives from Orm: a tenth of all plunder and one hostage, or Orm's displeasure.
- At home: harvest between days 61 and 75, cut and dry hay, slaughter and salt, fill the peat stacks and lay the ship up in the boatshed. The Year 1 threat schedule (Book 10) tests the watch.
- The Cailleach's washing closes the sea. Winter at home: cold, fuel and sickness; Samhain and the Yule feast; stories, crafting and repairs; the Nessa reveal window opens.
- The Kelda spring turns brackish at spring tides.
**Gate:** Asgrim returns at the end of winter for an answer.

### Chapter 5: The Long Memory
**Window:** days 121 to 180. **Goal:** face the cost of earlier raids and decide the household's future.
- Retaliation falls due according to the deed ledger: Fergal's ships from Dún Fiach, an interdict from Kilbrecc, Ulf's ambition, Ardcarn's hired swords. None is scripted; each is earned.
- Orm's fleet takes an independent harbour. Refugees arrive.
- A storm-tide slumps Naust Cove. The spring fails at every spring tide.
- **The household council:** stay and dwindle, or move ashore. Residents argue from their values.
**Gate:** the household commits to a mainland site. Choosing to stay leads to the Lonely Isle path.

### Chapter 6: The Borrowed Shore
**Window:** days 181 to 210 (earlier if the council commits earlier). **Goal:** secure a mainland home and move the household.
- Secure the chosen site by purchase, service, marriage tie, protection pact or conquest.
- Move people, livestock, stores and workshops over several voyages. The consort ship helps.
- Explore the hinterland on foot: known places, places still to be found, the wilderness and hostile ground.
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
