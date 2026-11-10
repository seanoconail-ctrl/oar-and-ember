# Oar and Ember, Book 01: Game Bible

*The design authority: what the game is, what the player does, and what must stay consistent across every build.*

A pixel-art Viking settlement RPG set on a fictional island in the Narrow Sea, around AD 900. Shipwrecked on poor ground with too many mouths to feed, you explore and work your island home, raid and trade along Gaelic and Norse coasts, grow your ship into a second home, and finally move ashore to unite the people you once raided against a sea king who has bargained with the drowned.

**How to use:** Planning only. No implementation is authorised by this delivery. Book 1 owns design intent. Books 4 to 11 own setting, people, scenarios, art, dialogue, level layouts, numbers and audio within Book 1's limits. Book 2 owns data and runtime contracts. Book 3 owns build order and records the Stage 0 decisions. Implement one stage at a time and pass its gate before starting the next.

_Revision 2.1 renames the game Oar and Ember and adds the playable homestead, on-foot exploration, seasons with consequences, real-time combat without pause, the steerer's death, mature violence the Stage 0 decisions and the Return to Skarvholm. Specification only: nothing here claims that systems exist or tests pass. Names, characters and supernatural rules are fictional design choices drawing on Norse and Gaelic myth._


## 01 / Design authority
*Oar and Ember is a game about an island household that survives by working its land and raiding its neighbours, grows rich and feared, and must then live among the people it raided.*

### The title
**Oar and Ember** names the game's two loops: the oar is the ship, the voyages and the raids; the ember is the hearth, the home and the household that must be kept alight through every winter. "The Borrowed Shore" remains the name of Chapter 6.

### What the game is, in one breath
A life-and-work game in the spirit of a farming RPG, with real combat, exploration, puzzles and threats, joined to a raiding-and-sailing game with lasting consequences. The player lives at home on foot, helps with every task and talks to their people; sails a growing ship across a regional sea map; and lands to raid, trade or bargain in real-time scenes.

### Setting in one paragraph
A fictional island, **Skarvholm**, lies in the **Narrow Sea**, a fictionalised North Channel between the southern Hebrides and north-east Ireland, around AD 900. Within a few days' sailing are Gaelic farms and ringforts, a monastery, a Norse-Gaelic trading harbour, Scottish sea lochs, rival raiding camps and stretches of water that sailors avoid after dark. Communities are mixed: Gaelic people are largely Christian while keeping older customs; Norse people hold differing beliefs. "Celtic" and "pagan" are never opposing teams. The Keepers of Inis Rón, who still serve the old powers openly, are a deliberate fantasy element.

### Locked requirements
- Detailed, readable pixel sprites in a top-down three-quarter view. The game is built from scratch: all code and art are new, and the art is authored by Claude to the Book 7 rules.
- Single-player, desktop browser first, TypeScript with WebGL.
- **Real time, no tactical pause.** The world does not stop to give orders. Menus can be opened only when no enemy is aware of the player.
- **The home is playable.** Skarvholm, and later the mainland home, is explored and worked on foot. The player can help with any homestead task, designate buildings, watch residents at work, and talk with them about events, wounds and plans. Combat controls stay enabled at home.
- **On-foot exploration is diverse and extensive.** Skarvholm has its own caves, cliffs, tidal ground, ruins and puzzles. On the mainland, routes on foot lead to places that may or may not be known yet, including wilderness.
- **A 120-day year of four 30-day seasons**, with real consequences: sowing and harvest, fishing and fuel, livestock, weather, cold and sickness. Winter must be prepared for.
- Sailing happens on a regional **sea map** of routes. Local scenes open for landings, raids, harbours and interruptions such as sea battles, wrecks, storms and sea creatures.
- **Raiding is the main repeatable voyage activity.** Every raid allows theft, intimidation, tribute, bargaining, rescue and withdrawal as well as fighting.
- Loot comes from somewhere. Taking it changes the place it came from, and the people there remember.
- The ship grows through refits and new hulls but keeps its name, chosen fittings and history.
- Sixteen permanent residents maximum, excluding the player. Hired oarsmen, allied warriors and temporary refugees sit outside that roster.
- A friendly newcomer joins, earns trust and later reveals ties to an old power. Betrayal is one branch, never the compulsory payoff.
- The campaign turns on moving ashore, and ends with an alliance against an external threat.
- **The Return to Skarvholm.** Late in the campaign, long after the household has left, it must mount a hostile, difficult expedition back to Skarvholm, now held by Orm's garrison, to recover Manannán's Cup from the Hollow Cairn.
- **The steerer can die.** Death is game over, with a reload from the last save or checkpoint. Losing the mainland home in the finale also ends the campaign.

### Violence and its limits
- The game is for adults: bloody, graphic combat with gore, dismemberment and bodies that stay where they fall.
- The player can kill anyone they can fight, including civilians and people who have surrendered. Consequences follow from witnesses, evidence and the crew's own values, so they are likely but not certain: a massacre with no surviving witness may never reach the coast, but the crew always knows.
- Hard limits that do not change: children never appear as actors in any scene; no sexual violence of any kind; no player-performed torture; captives are named people, never a currency, and there is no slave-market loop.
- Religions are presented through their believers. The game never proves Christianity or the old beliefs right or wrong; the supernatural is real in the fiction but ambiguous in its meaning.

### Scope boundaries
No ageing, pregnancy, playable children, multiplayer, procedural continent or full naval simulation. No romance system; residents may arrive with existing relationships. Any adult can learn any job; origin and belief grant no stat bonuses. The player directly commands one flagship; a second vessel is managed only on the sea map.

### Authority across the eleven books
| Book | Owns |
|---|---|
| 01 Game Bible | Design intent and locked requirements |
| 02 Coding Contracts | Data shapes, runtime behaviour, saves, tests |
| 03 30-Stage Plan | Build order, gates and the Stage 0 decisions |
| 04 Setting and Campaign | World facts, seasons, regions, supernatural rules, chapters |
| 05 People and Factions | Characters, values, relationships, alliances |
| 06 Voyages and Raids | Complete loop-proving scenarios |
| 07 Ship and Visual | Ship statistics and art rules |
| 08 Dialogue and Voice | How everyone speaks |
| 09 Level Layouts | Tile plans, routes, sightlines and landing points |
| 10 Balance Sheet | Every tuning number, progression targets and the threat schedule |
| 11 Audio and Music | Music, sound and voice direction |

The user's latest explicit instruction overrides everything. Book 1 overrides Books 4 to 11 on intent; Book 10 is the single source for numbers; Book 2 governs how they are implemented. Record every departure in the decision log. Never silently drop a locked feature to make a test pass.

## 02 / Pillars and player fantasy
*The player should feel like the steerer of a desperate household that becomes powerful, and then has to decide what that power was for.*

### Six pillars
1. **A home you live in.** Skarvholm is a place to walk, work, explore and defend, with people whose days you can watch and share.
2. **Every raid is a dilemma, not a dungeon.** Incomplete information, a plan, a change of circumstances, a choice under pressure and a way out.
3. **The coast remembers.** Settlements change their watches, hire protection, attack on sight and form alliances because of what you did.
4. **The ship is a second home.** It is where the crew lives, argues, carries the wounded and shows the world who you are.
5. **People, not production slots.** Sixteen residents with names, values, ties and memories, whose opinions shift through experience.
6. **The sea offers bargains.** Supernatural powers drawn from Norse and Gaelic myth tempt the player with real benefits and honest terms.

### The player fantasy across the campaign
| Phase | The player feels | Typical session |
|---|---|---|
| Survive on the island | Responsible for people who could die | Rescue, shelter, explore, repair the boat |
| Learn the coast | Curious and opportunistic | Work the steading, short voyages, first raids and trades |
| Become wealthy | Capable, envied, slightly reckless | Bigger raids, refits, rivals, preparing for winter |
| Face the cost | Accountable | Defending the island, answering demands, hard conversations |
| Move ashore | Exposed and determined | Securing land, exploring a new hinterland, moving people |
| Unite the coast | A leader others might follow | Councils, compensation, final preparations, battle |

### Tone
Grounded, warm and brutal. Meals, jokes and ordinary arguments sit alongside violence that is ugly and costly. Myth intrudes as one wrong detail before it becomes a monster. The people being raided are farmers, monks, merchants and fighters with their own plans, not loot containers.

## 03 / The core loops
*Two loops feed each other. The home loop makes the household able to sail; the voyage loop brings home what the household cannot make.*

### The home loop (a day on foot)
Wake at dawn. The steward's short morning report gives the food runway, work in hand, crew moods, wounds, weather and known threats. Then the day is the player's: work beside residents, explore the island, gather, train, solve something strange at the cairn, prepare the ship, or talk at the fire. Residents carry on their delegated work in real time and can be watched and joined. Evening brings a meal, conversation and sometimes trouble. Sleep ends the day. A full day lasts about seventeen real minutes.

### The voyage loop
Hear about an opportunity, prepare the crew and ship, take a risk, bring something home, and see what it changes.

> Figure: the core voyage loop (drawn in the PDF version of this book).

### How they connect
| From home to voyage | From voyage to home |
|---|---|
| Food, rested crew, repaired hull and fittings | Iron, grain, livestock, timber, silver |
| Weapons and tools forged at home | New residents, rescued people, hostages |
| Scouting from Rook Hill; rumours at the fire | Leads, charts, contacts and enemies |
| Winter preparation frees the household to sail in summer | Retaliation and threats that come back to the island |

### Rewards at several distances
| Timescale | Reward | Example |
|---|---|---|
| Every few minutes | Find something, discover a route, secure supplies | A seal colony marks a safe landing; eggs on the cliff |
| Every day | Finish a task, solve a puzzle, improve the camp | The smoke-house means fish keeps through winter |
| Every voyage | Acquire something that opens new possibilities | Iron lets Kolbeinn forge axe-heads; a pilot reveals a channel |
| Every season | Survive and change the household's position | Harvest in, winter stores full, the karvi launched |
| Across chapters | Transform the ship, community and standing on the coast | A seat at the Kilbrecc council |

Rewards must change what the player can do. A good day produces progress; a good voyage produces a new capability, a new relationship state and two leads.

### Pacing promises
- First departure from Skarvholm within 45 to 60 minutes of a new game, with a combat test inside the first 25 minutes.
- No starvation timer while the player is learning controls.
- A prosperous home can run for several voyages under sensible delegated orders.
- Never require a daily sequence of identical clicks to keep a stable home alive; the player's own work is a bonus and a pleasure, not a chore tax.
- Book 10 holds the ideal progression for a good player and the schedule of threats to the homestead.

### Fun tests (playtest questions, not automated checks)
- After the first raid, does the player want another voyage because they have a plan?
- Does the player choose to spend a day at home because there is something they want to do there?
- Can the player name a resident they care about, a fitting they want and a place they want to explore tomorrow?
- Did a mercy ever pay off, and did a brutal choice ever come back to bite?

## 04 / Campaign shape
*Six phases across eight chapters and about 270 in-game days: two full 120-day years and the spring of a third.*

| Chapter | Phase | Core goal | Ends when |
|---|---|---|---|
| 1 The Wreck | Survive on the island | Shelter, rescue four crew, repair the boat | The boat is launched and named |
| 2 The First Raid | Learn the coast | Provisions and iron from Carrick Landing | The haul is home and two leads are offered |
| 3 The Open Coast | Learn the coast | Trade, explore, recruit, sow, first refit | The Followers arrive and the island needs more |
| 4 A Name on the Water | Become wealthy | Bigger voyages, harvest, karvi, survive the first winter | Orm's tribute demand comes due |
| 5 The Long Memory | Face the cost | Answer retaliation; the island begins to fail | The household commits to moving ashore |
| 6 The Borrowed Shore | Move ashore | Secure a mainland site, explore its hinterland, move | The mainland home is defensible |
| 7 The Gathering | Unite the coast | Win allies, pay what they demand | The council at Kilbrecc ends |
| 8 The Sea King | Unite the coast | Return to Skarvholm for Manannán's Cup; defeat or outlast Orm and break his bargain | An ending is reached |

Book 4 holds the full chapter structure and calendar. The year has a rhythm: spring sowing and the hungry gap, summer voyages and peat, autumn harvest and storms, winter at home living on what was prepared.

### Strategic arc
Every raid writes deeds into the coast's memory. Every promise kept or broken changes who will stand with you. The external threat is **Orm Sveinsson of Kaldness**, a sea king swallowing independent harbours, who has made a bargain with **Rán**, the Norse sea power who gathers the drowned, through his seeress **Heid the Grey**. That bargain is also why strange tides are souring Skarvholm's spring and eating its landing. After the household moves ashore, Orm's men take the empty island, and Heid's apprentice begins digging into the Hollow Cairn for the Cup that could undo him.

### Endings
| Ending | Requires | Feels like |
|---|---|---|
| The United Coast | A broad alliance, Rán's bargain broken, the shore secured | Belonging, earned |
| The Uneasy Peace | Orm defeated with a thin alliance; grudges remain | Victory with a bill |
| The New Sea King | Orm's place taken, by his bargain or his tribute | Power, and what it costs |
| The Lonely Isle | The shore abandoned; the household survives on the outpost | Survival without home |
| Game over | The steerer dies, or the mainland home falls in the finale | Reload or checkpoint restart |

## 05 / Raiding
*Each raid begins with incomplete information, offers several ways in and out, and changes when it meets reality. Taking something without losing anyone can be a complete success.*

### Before the raid
A lead names a place and a rumour with a source and a confidence. Scouting, trade contacts, captives' testimony and charts improve it; some rumours are wrong. Plans are made in safe moments (at home, in harbour or at anchor) and set: **landing point**, **timing** and tide, **crew**, **equipment**, **aim** (grain, livestock, iron, silver, tools, timber, a boat, a hostage, a specific person, information) and **one preparation advantage** (scouting, trade goods or extra weapons).

### Ways to take what you came for
| Approach | Works when | Typical cost |
|---|---|---|
| Steal | Night, poor watch, good information | Discovery turns it into a chase |
| Intimidate | Visible strength, a weak or divided target | They remember the shame and send word |
| Demand tribute | The target can pay and wants to keep its homes | Sets an expectation; others hear you can be bought off |
| Bargain or trade | You have goods or a service they want | Less gain now; a contact later |
| Rescue | Someone wants out, or a rival holds captives | Berths and cargo space; enmity from captors |
| Fight | You outmatch the defenders, or must | Wounds, deaths, lasting grievance |
| Slaughter | The player chooses to kill everyone they find | Crew horror or delight, and a hunted name if anyone escapes |
| Withdraw | The plan has failed | Little gain, but people come home |

### When plans change
Every site carries one or two complications drawn from its true state: the storehouse holds winter seed; a rival crew arrives and starts killing; the defenders offer payment; an injured companion cannot walk and the boat is full; a local offers information for protection; the place belongs to someone you promised safe passage. Never more than two on an early raid.

### Getting home
Carrying loot or wounded people slows movement and occupies hands. The boat cannot hold everything. Withdrawal is always reachable: a damaged ship carrying half the intended supplies is still a result worth continuing.

### Ethical design rules
- Mercy must not always cost money, and brutality must not always pay.
- Every approach, including the brutal ones, has at least one situation where it is effective, and every approach has a cost somewhere.
- Moral weight comes from concrete people and consequences, not a morality meter.

## 06 / Consequences
*Consequences are material and personal. Loot leaves a hole; witnesses carry the story; the crew judges what it saw.*

### Material
Settlements have real stores, boats, livestock and people. Taking grain weakens a settlement through the next winter. Killing its farmers empties its fields. Burning its boat removes future trade. Sparing a craft worker may create a contact.

### Knowledge, evidence and recognition
Survivors recognise your sail, shields, faces and voices. Word travels with real carriers. Bodies are found; dropped gear and tracks are evidence. A deed with no surviving witness and no evidence may never be linked to the household. Changing the sail can hide identity for a while.

### How the coast responds
Communities change their watches, move valuables inland, hire protection, send envoys, pay rivals to strike back, raid Skarvholm, and **post guards who attack the household on sight** in their territory until the matter is settled. A reputation for killing those who surrender means enemies who recognise you stop surrendering.

### The crew's judgement
Each resident holds two or three of six values: **Gain**, **Mercy**, **Glory**, **Kin**, **Faith** and **Word**. Strong disapproval shows as a remark, a complaint, refusal of a specific kind of order, then a request to leave, never as a hidden stat that suddenly fires. Some residents relish brutality; most do not.

### Fairness
Show the likely direction of a consequence when the steerer would know it. Report what changed in plain language. No consequence the player could not have anticipated from information in the world.

## 07 / The ship
*The ship is the second home: transport, base, status and a record of everything the household has done.*

The game begins with a surviving small coastal boat repaired on the beach, not a longship built from debris. Through refits and new hulls it becomes a karvi and then, by a choice, a fast war hull or a deep cargo hull. Name, sail mark, carvings, trophies and selected fittings transfer to each new hull. Book 7 holds dimensions and art; Book 10 holds the numbers.

### Customisation as trade-offs
| Upgrade | Benefit | Cost or drawback |
|---|---|---|
| Larger cargo capacity | More supplies and room for rescued people | Heavier, slower under oar, needs more crew |
| Shallow draft | More landing sites and river access | Less capacity and seaworthiness |
| Stronger hull | Survives damage and storms | Weight and repair materials |
| Better sail and rigging | Faster passage and better escapes | Needs skilled maintenance |
| Fighting fittings | Better boarding and defence | Less room for cargo |
| Shelter and stores | Longer expeditions | Space otherwise used for loot |

Sail designs, shields, carvings, trophies and repaired damage are visible on the sea map and in scenes. A feared sail makes intimidation easy and trade hard. A stolen sacred object aboard may draw its former guardian.

## 08 / Sailing and the sea map
*Most sailing stays on a regional sea map of charted routes. Wind, tides, supplies, visibility, season and known threats decide the route.*

Travel resolves watch by watch. Stores drain with crew size; tidal gates open and close; fog hides both you and others. Charts, pilots and experience reveal routes. Winter closes open crossings except in calm windows. Most journeys are quiet or offer a short choice; some open a playable scene: boarding or escaping another vessel, a storm landing, a wreck with survivors, a sea creature following the ship, a light in the fog. Monsters are rare enough to feel like events.

Sea battles emphasise manoeuvring into an approach, an exchange of missiles and boarding; they are not a naval simulator. Helm orders and volleys are given in real time. Withdrawal is possible until the ships are lashed together.

## 09 / Combat
*Real-time, skill-based melee in the readable top-down view, with no tactical pause. Spacing, facing, timing and stamina decide fights.*

### Controls
- **Light attack**, chaining up to three strikes depending on the weapon.
- **Charged heavy attack**: hold to charge through two levels with clear visual and audio tells. A full charge breaks guards; it can still be parried or dodged.
- **Parry**: a timed press that staggers the attacker and opens a riposte.
- **Block**: hold to raise the shield over a frontal arc; costs stamina, and an empty stamina bar breaks the guard.
- **Dodge**: a short committed move with brief invulnerability.
- **Shove**: breaks a block and makes space.
- **Stamina** gates everything except walking. **Facing** matters: shields cover the front, backs are exposed, and attacks commit to a direction.

### Feel
Committed attacks have readable tells and recovery windows. Spears control distance; axes threaten shields; swords are flexible and rare; seaxes are fast; Dane axes are slow and devastating. Bows and thrown spears matter most at sea and at landings. Skill should overcome modest differences in equipment.

### Blood and death
Hits draw blood; heavy kills can sever limbs and heads; bodies stay. A gore setting reduces this for players who want less. The steerer's death ends the game; named residents can die permanently unless the *Rán's mercy* option is chosen.

### Enemies and crew
Enemies see, hear, remember and communicate by shouts, horns and runners. Groups hold narrow ground, flank and break when cohesion fails; most surrender when beaten, unless your reputation tells them not to bother. Crew commands (follow, hold, attack my target, protect, carry, withdraw to the ship) are issued with quick keys in real time and acknowledged aloud. Getting back to the boat with loot or wounded people is part of the fight.

## 10 / The playable homestead
*Skarvholm begins as a ruin and a beach. The player lives there on foot, works there, defends it and makes it a home.*

### Working beside the household
The player can do or help with any homestead task: sowing, weeding and harvesting barley; fishing from the shore or boat; gathering shellfish, seaweed and eggs; cutting peat and hay; building; carpentry; smithing; cooking; tending wounds; herding; repairing the ship; training. Each task has a short hands-on action whose quality improves with skill, and the player's work counts like a resident's. Residents do the same work by themselves under the steward's plan, so the player's help speeds and improves things rather than being required.

### Designating buildings
The player places buildings from a build menu onto valid ground: blueprint, materials, workers and build days are shown before confirming. Placement has rules (above the tide line, on firm ground, away from the forge's fire risk) and small adjacency benefits (racks near the shore, the byre near the fields). Residents build designated plots in priority order; the player can join. Buildings can be moved or taken down for part of their materials.

### Watching and talking
Residents are always visibly doing something: working, eating, arguing, mending, singing, nursing a wound, sulking. The player can talk to anyone to discuss recent events, deeds, wounds, worries and plans, and residents raise topics of their own. Not every interaction is a request: include jokes, ordinary meals and moments that ask nothing of the player.

### Facilities
Longhouse, second house, boatshed, forge, drying racks, smoke-house, storehouse, byre, watch cairn, workshop and a shrine chosen by the residents. Each removes a chore or enables something new. Book 10 lists costs and effects.

### Residents and delegation
Up to sixteen permanent residents, excluding the player. Assign outcomes, not individual actions: a **steward** runs work within ration, reserve and spending limits; a **shipwright** maintains the ship; a **watch leader** fills posts; a **mate** commands landing parties. Shortages and refusals are explained in plain words.

### Threats at home
Combat controls stay enabled at home. Scavengers, raiders, retaliating neighbours, storms, cold, sickness and the unquiet dead all reach the homestead on a rough schedule shaped by the player's deeds (Book 10). The watch cairn on Rook Hill buys warning; walls, the broch and preparation buy survival.

## 11 / Exploration on foot
*Exploration is a reason to play every day, not only a route between objectives.*

### Skarvholm
A small island with a lot in it, and everything found there matters again in the late-game return: cliffs to climb for eggs, tide caves that open only at low water, a causeway to the Skerry of the Drowned at spring low tides, a hermit's ruined cell, a stone ring, a peat bog, an eagle stack, the Hollow Cairn and the Hag's Seat. Seasons change what can be found. Book 9 holds the plans.

### The mainland
Once the household moves ashore, routes on foot lead from the new home to villages, a monastery, a royal fort, a trading town, sacred sites and wilderness: oakwoods, bog roads, moors, corries and lake shores. Some places are known from the start; many must be discovered. The wilderness holds wolves, boar, outlaws, the hill-folk and stranger things.

### Puzzles
Puzzles come from the world: reading tides to reach a cave; aligning a stone ring at sunrise; finding the way through a cairn whose passages obey the hill-folk's rules; answering the Blue Men in verse; following a drowned man's directions to a channel. No sliding-block abstractions.

### Hostile ground
Factions the household has wronged post guards who **attack on sight** in their territory. Travel through hostile land is possible by stealth, by night, by another route, or after making peace. Leaders and witnesses recognise faces; changing cloak and shield helps only with strangers.

## 12 / Seasons and the year
*A 120-day year of four 30-day seasons. Each season changes what can be done and what must be done.*

| Season | Days | At home | At sea | Danger |
|---|---|---|---|---|
| Spring | 1 to 30 | Sowing, lambing, eggs on the cliffs, peat cutting begins; the hungry gap before new food | Crossings open in fair weather | Short stores, spring gales |
| Summer | 31 to 60 | Hay, peat drying, best fishing, shearing, building weather | Best sailing; raids and fairs | Rivals at their boldest |
| Autumn | 61 to 90 | Harvest, slaughter and salting, seal season, stores filled | Storms rising; crossings riskier | Sickness, the Cailleach's washing |
| Winter | 91 to 120 | Living on stores, fuel every day, crafting, feasting, long nights | Open sea closed except in calm windows | Cold, hunger, the dead at Samhain and Yule |

### Consequences
Unsown fields yield nothing; unharvested barley rots; fresh fish spoils in two days unless dried, smoked or salted; livestock without hay or a byre must be slaughtered or die; a house without fuel in winter makes its residents cold and sick. Preparation is visible and rewarded: a household that enters winter with full stores, dry peat and a sound roof has a warm, sociable winter of crafting and stories. Book 10 gives the numbers.

## 13 / The supernatural
*The sea and coast offer bargains as well as threats. The powers come from Norse and Gaelic myth, adapted for this game, and they keep the terms they agree.*

| Power | Roots | In play |
|---|---|---|
| Rán and her daughters | Norse sea goddess who nets the drowned; her daughters are the waves | Orm's patron; rising tides; storms with names |
| Manannán mac Lir | Gaelic lord of the sea between Ireland and Britain; cloak of mist | The moving mist; the Ferryman |
| The Cailleach | Gaelic hag of winter and storms; the Corryvreckan whirlpool | Winter's arrival; the Cauldron; weather bargains |
| The Blue Men | Scottish storm kelpies who challenge captains in verse | A rhyme duel at Blue Men's Sound |
| Aos sí and landvættir | Gaelic hill-folk and Norse land-spirits | Cairns, shrines and boundaries |
| Draugr and haugbúi | Norse restless dead and mound-dwellers | The unquiet dead, with anchors |
| Fetch, fylgja, washer at the ford | Norse and Gaelic death omens | Warnings that let a careful player change fate |
| Selkies and the each-uisce | Seal-folk and water-horses | The Keepers' kinship; a lake terror bound by a well |

Every dangerous mechanic has a visible sign, a learnable rule, a player response and a saved consequence. Meaning stays ambiguous: was it a saint's power or an old bargain? The game shows evidence for both.

### Manannán's Cup
In Irish tales Manannán gives a cup that breaks when three lies are spoken over it and mends with three truths. Here the cairn-builders laid such a cup in the Hollow Cairn when the old compact was sworn. It leaves its stone only when three true things the household would rather not say are spoken at the Door of Three Truths, so the household's own record decides what it must confess.

### The newcomer: Nessa
Nessa arrives in Chapter 3 as a healer and net-maker and belongs to the seal-kin of Inis Rón. Her hidden stance is seeded at random per campaign: a **Watcher**, a **Bound** woman trading information to Heid for her drowned brother, or a **Runaway** who hid her seal-skin on Skarvholm. Book 5 holds her branches.

## 14 / Moving ashore and the alliance
*The campaign's major turn: the island becomes untenable, and the household must earn a place on someone else's coast.*

Tides rise, the Kelda spring turns brackish, the landing slumps and Orm's ships take independent harbours. The player can delay and prepare but eventually needs a mainland home: Carrick Strand by Ardcarn, the Saltness headland by Saltvik, or Arra Foot by Glen Arra, secured by purchase, service, a marriage tie between other households, a protection pact or conquest. The household moves people, livestock, stores and workshops over several voyages, then explores and holds a new hinterland on foot.

| Ally | Contributes | May demand |
|---|---|---|
| Kilbrecc | Stores, sanctuary, mediation, records | The Bell returned; no raids on church lands |
| Dún Fiach | Land rights and warriors | Hostages, a marriage tie, public submission |
| Ardcarn | Food, guides, militia | Compensation; Donnchad returned |
| Saltvik | Ships, repairs, hired oarsmen | Trade rights, silver, protection |
| Glen Arra | Cattle, archers, a sheltered loch | Help against Ulf; returned cattle |
| Keepers of Inis Rón | Knowledge of Rán's bargain; Manannán's mist | Respect for the seal-kin; Nessa's fate decided fairly |
| Ulf Hrafnsson | Hard fighters and a ship | Plunder rights, or a settling of scores |

People you raided may still cooperate, but demand compensation, returned captives or public concessions. A household known for slaughter finds most doors closed and must buy, force or earn its way back.

### The Return to Skarvholm
Before the final battle the household must go home one last time. The island is drowned at its edges, its spring is salt, its watch cairn is manned by Orm's men and its broch is a fort. Everything learned while living there (the hidden cove, the cave passage, the stone ring's secret, the patrol's blind spots) becomes the way back in. The expedition is hostile and difficult by design, with a checkpoint before landing and one retry if it fails (Book 6 scenario 9).

## 15 / Onboarding: the Wreck and the First Raid
*The shipwreck gives the opening clear goals, immediate stakes and a reason to care about the crew.*

Wake on the shore with control in seconds. Someone is calling beyond the rocks: carry Hild above the tide line. Shelter in the old broch, light a fire, treat the injured. Three searches teach carrying, combat and exploration with a supernatural clue. Three repairs make the boat seaworthy; one customisation is offered. The chapter ends with a launch, a name and the coast on the sea map. Chapter 2 is the Carrick raid (Book 6).

### Accessibility without a pause
- One clear current objective, with optional discoveries alongside.
- Generous interaction range and clear prompts. No pixel hunting.
- Simple inputs with depth from timing, position and facing.
- Planning screens open in safe moments; crew orders use quick keys and a hold-to-open command ring that does not stop time.
- Difficulty options: combat speed, parry window, enemy damage, *Second wind* (a brief rescue window when the steerer falls), *Rán's mercy* (no crew permadeath), gore level, day length.
- Checkpoints before major danger; failure teaches without twenty minutes of repetition.
- Remappable controls, colour-independent readability, subtitles and sound captions, adjustable text size.

## 16 / First builds and proof
*The first prototype is one island, one ship and one coastal target, followed by a return voyage and consequences at home.*

| Build | Scope | Proof required |
|---|---|---|
| 1: The Wreck | Skarvholm's southern half playable on foot, four crew, shelter, day and night, one encounter, boat repairs, launch and sea-map reveal | A new player finishes the chapter and wants to launch |
| 2: The First Voyage | Whole island explorable, homestead v1 with tasks and designations, sea travel, Carrick with every approach, consequences | Different choices produce different useful outcomes; players choose to spend days at home |
| 3: Reasons to Return | Saltvik on foot, ship upgrades, sea battle, a returning character, the first bargain | Players form their own next goal |

The user playtests each build gate personally at first. The most important test of Build 2: after the first raid, does the player want another voyage because they have a plan, and a day at home because there is something to do?

## 17 / Pixel-art contract summary
*Book 7 is the full art reference; these rules are locked here.*

- Logical viewport 640 x 360; world tiles 24 x 24; adult sprite canvas 32 x 40 with a grounded foot anchor and about 18 x 30 occupied pixels.
- WebGL rendering with nearest-neighbour sampling, pixel-aligned drawing and integer scaling; letterbox rather than stretch.
- Four authored facings for people; armed sprites are never mirrored. Two body models for the steerer, chosen by the player and never labelled with a gender.
- Final art is authored by Claude as palette-indexed pixel sources compiled to atlases, checked visually before any stage is marked done.
- Blood, wounds and dismemberment are drawn in pixel form at the same scale, with a gore setting.
- The supernatural begins as one wrong detail; strong luminous accents are reserved for important phenomena.
- No horned helmets, no fantasy plate, no modern props. Never permanent circles, boxes or emoji in place of art.
