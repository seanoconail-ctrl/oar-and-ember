# Oar and Ember, Book 06: Voyages, Raids and Consequences

*A small set of complete scenarios that prove the central loop: lead, preparation, risk, return and consequence.*

If these nine scenarios are fun, fair and different from each other, the game works. Each one is specified completely enough to build, test and balance before the map grows. Every raid can be a stealth raid or an all-out assault (section 12). The mainland's dungeons (section 13) and the revenge quests (section 14) run on the same machinery of deeds, carriers and delayed consequences. The scenarios that move the story are story gates the player chooses to start (section 15); the downed are carried home, not bled out (section 16); and a few deaths are written in (section 17).

**How to use:** Build Chapter 1's encounters (section 18) with Build 1 and its rework, Scenario 1 for Build 2, Scenarios 2 and 3 for Build 3, and the rest during the campaign stages; assaults, dungeons and revenge quests follow the stage plan (Book 3). Each scenario lists its hidden true state, what the player can know, approaches, complications, extraction, outcome bands, consequences and the tests that prove it. Quantities are starting values for balancing, not final numbers.

_Specification, not implemented content. All places and people are fictional. Violence is graphic and the player can kill civilians and the surrendered; consequences depend on witnesses and evidence. No children appear as actors in any scene; families are implied by homes, belongings and adults. Numbers here are illustrative; Book 10 is authoritative._


## 01 / How a scenario is built
*Every voyage or raid uses the same template, so content can be authored as data and tested the same way.*

| Part | Contents |
|---|---|
| **Lead** | How the player hears of it, from whom, and with what confidence |
| **True state** | What is really there: stores, people, defences, sacred objects, local disputes, supernatural facts. Hidden in the save. |
| **Known intel** | What the player can learn before landing, each item with source and confidence (rumour, likely, certain) |
| **Mode** | Stealth raid, all-out assault, or both; some targets allow only an assault (section 12) |
| **Preparation** | Landing, timing, crew, equipment, aim, and one preparation advantage |
| **Approaches** | At least three viable ways to reach the aim, plus withdrawal |
| **Complications** | One or two changes drawn from the true state, never stacked beyond two on early raids |
| **Extraction** | Getting people and cargo to the boat and away; berths and cargo slots |
| **Outcome bands** | Named results, each a meaningful result rather than pass or fail |
| **Evidence** | Bodies, dropped gear, tracks and burned buildings left behind, and when they will be found |
| **Consequences** | Immediate, at home, regional, among the crew, and delayed |
| **Gate** | Whether the scenario is a story gate (section 15), and what its readiness screen shows |
| **Proof tests** | What a scripted or human test must show for the scenario to pass its gate |

### Stealth raid or assault
Every raid can be played as a **stealth raid** (a small landing party, often by night, aiming not to be seen) or an **all-out assault**, a strandhögg in force (the full crew lands by day and fights for the place). Fortified places, Crowwick and Orm's outposts can only be taken by assault. A scenario lists what each mode finds: an assault meets the same true state, but defenders muster, horns call reinforcements and many more people see the sail. Section 12 holds the assault rules.

### Cargo and berths
Every lot of cargo takes one slot: grain, iron, silver, timber, salt, cloth. Livestock take two slots per pen. People use berths; a passenger beyond the berths takes two cargo slots. The starting coastal boat has **8 berths** and **4 cargo slots** (5 with the cargo fitting from Chapter 1). One grain lot is fifty ration-days: ten days for a household of five.

### Deed tags
Outcomes write **deeds** to the coast's memory. A deed records what happened, where, who witnessed it, and the sail and marks that identified the doer. The core vocabulary:
| Deed tag | Meaning |
|---|---|
| `THEFT` | Goods taken without violence or threat |
| `THREAT` | Goods yielded under threat of violence |
| `TRIBUTE_TAKEN` | Payment accepted to spare a place |
| `FAIR_TRADE` | Goods exchanged at a fair rate |
| `KILLING` | Defenders killed in a fight (count and names recorded) |
| `CIVILIAN_KILLED` | Non-combatants killed: farmers, monks, traders, keepers, servants |
| `SURRENDERED_KILLED` | People killed after surrendering or while downed |
| `SACRILEGE` | Blood spilled or goods taken at a sacred place |
| `SPARED` | Defenders or people spared when they could have been killed |
| `BURNING` | Buildings, boats or stores burned |
| `SEED_TAKEN` / `SEED_LEFT` | Winter or seed stores taken or knowingly left |
| `SACRED_TAKEN` | A relic, offering or grave good removed |
| `RESCUE` | People freed or taken away at their own request |
| `HOSTAGE_TAKEN` | A named person held as a guarantee or for ransom |
| `PROMISE_MADE` / `PROMISE_KEPT` / `PROMISE_BROKEN` | Agreements and their fate |
| `SAIL_SEEN` | The household's sail and marks recognised |
| `KILLING_HIDDEN` | A killing concealed rather than declared. Written with the killing when the doer neither owns it openly nor lets it be found: a body hidden or sunk, a death denied when asked, a quiet killing never declared by the next day |
| `HOSPITALITY_BROKEN` | Harm to a host or guest, or done under truce. Written by turning on people whose food or fire the household has shared (Colla after an open bargain, Kilbrecc after a night in its guesthouse, Muiredach at Ardcarn), by harming a guest or hostage held at home, or by breaking a truce or parley |
| `BLOOD_PRICE_PAID` / `BLOOD_PRICE_TAKEN` | A blood-price (éraic) paid by the household for a killing, or accepted by it in place of vengeance. Written when a feud is settled with silver (section 14), when an answer is settled by compensation for the dead (section 09), and in Bran's reckoning (section 17) |
| `RITES_DENIED` | The dead left unburied or without rites. Written when the household's own dead are left without rites, when the field is held after a fight and the dead are refused to their kin, or when Thorkel's rites are never given |
| `CHALLENGE_REFUSED` | A formal challenge turned down. Written when the steerer or the household's champion refuses a hólmganga, a duel or a public challenge such as Fergal's "meet me on the strand" |

### How each culture reads a deed
Everyone judges by the ethics of their own culture around AD 900, the household included (Book 5 section 16). A witness's culture weighs a deed first, then their values (Book 5 section 01), traits (Book 5 section 17) and stance (Book 5 section 16). Book 10 section 08 ("Deed reactions by culture") holds the weights.
| Deed | Norse (the household, Orm, Ulf) | Gaels (Dún Fiach, Ardcarn, Glen Arra) | Church (Kilbrecc) | Keepers (Inis Rón) |
|---|---|---|---|---|
| A killing in open fight (`KILLING`) | Honourable if bold | An act of war; vengeance or éraic owed | A sin, though kings do it | The sea's business, unless on their shore |
| Theft by stealth (`THEFT`) | "Thieves' work" to the Glory-minded; fine to the Gain-minded. Secret theft from one's own is the deepest shame | Less grave than burning and killing, but still owed | A sin | Taking without giving |
| Farmers and other people who bore no weapon killed (`CIVILIAN_KILLED`) | No glory in it; bad luck; invites vengeance. Some shrug | Outrage; éraic owed by the dead person's rank | A grave sin; monks killed become martyrs | Blood on the shore angers the old powers |
| The surrendered killed (`SURRENDERED_KILLED`) | Shameful once quarter is given; a níð-worthy deed | Dishonour | Murder | Oath-breaking |
| A killing hidden (`KILLING_HIDDEN`) | Murder: far worse than an open killing, which can be declared and paid for | Worse than an open killing | Sin compounded by a lie | No matter |
| Hospitality broken (`HOSPITALITY_BROKEN`) | Shameful, even to Orm's men | Shameful; the briugu's curse | Shameful | Shameful |
| Sacrilege at a church (`SACRILEGE`) | Nothing to most; bad luck to the superstitious | Outrage (though Gaelic kings burn rivals' churches too) | The worst of crimes | Indifferent |
| Sacrilege at an old shrine or mound (`SACRILEGE`) | A dangerous offence to the gods and land-spirits | Bad luck; the aos sí remember | A good work | Outrage |
| A blood-price paid or taken (`BLOOD_PRICE_PAID`, `BLOOD_PRICE_TAKEN`) | The lawful end of a feud; the Glory-minded call it carrying your kin in your purse | Proper and expected | Better than vengeance | No matter |
| A hostage or captive taken (`HOSTAGE_TAKEN`) | Ordinary dealing; harming a hostage is shameful | Ordinary dealing; harming a hostage is shameful | Acceptable | Acceptable |
| A promise broken (`PROMISE_BROKEN`) | Shameful (cynics shrug if it was to an enemy) | Shameful; sureties are ruined | A sin | The worst of crimes |
| Rites denied (`RITES_DENIED`) | Invites draugar; shame on the kin | Shame | The soul denied | Angers the sea |
| A challenge refused (`CHALLENGE_REFUSED`) | Cowardice; níð | Shame, unless a king forbids it | Righteous | No matter |

- **Saltvik** judges mainly by the bargain: a fair weight and a paid debt are honoured, cheating at the scale is the great shame, and killing is bad for trade more than it is wrong.
- **People of mixed birth** (Bran, Senán, Áine and much of Saltvik) carry both codes, and judge and are judged by either.
- **Captives and the household's own stores.** Taking captives in a fight is ordinary to most Norse: the Mercy-minded object to cruelty towards captives, not to their capture. Theft from the household's own stores is judged more harshly than open plunder abroad. Captives are never currency, and there is no slave market (Book 5 section 01).
- **Re-voiced, not reversed.** Every reaction in this book keeps its direction; the reasons people give are period reasons (honour and shame, luck, kin and vengeance, sin, the honour-price), never modern ones (Book 8 section 16). The player can act against the household's code; the household reacts by that code.

## 02 / Scenario 1: The Carrick Storehouse
*Chapter 2. The first raid. Small, readable, and full of choices. A storehouse and landing on the Irish coast that serves Ardcarn, open to a stealth raid by night or an assault by day.*

### Lead
After the launch, the sea map shows smoke on the Irish coast. Thorkel's chart fragment, from his locked chest (opened in Chapter 1 with the key from his body, section 18), marks a landing called Carrick with the note "grain, iron, few spears". The island needs provisions and iron for nails and tools. **Confidence:** likely.

### The place
A shingle beach with a timber jetty, a stone-footed storehouse, the keeper's house, a byre, a drying rack for fish and a watch post on the headland. A cart track leads inland to Ardcarn. A runner who gets off the map brings Fiachra's riders, quartered at Ardcarn, back in about two minutes (Book 9 section 07). Low tide doubles the carry from the storehouse to a boat on the beach; high tide lets the boat lie at the jetty.

### True state
| Element | Truth |
|---|---|
| Grain | Six lots. Two are winter seed for Ardcarn's spring sowing, marked with Brigid's cross. One lot is Kilbrecc's tithe. |
| Iron | Two lots of bar iron bought from Saltvik. |
| Silver | One lot hidden under the keeper's hearth: Muiredach's tribute to King Fiachra. |
| Boat | The keeper's small currach at the jetty. Can be towed (two extra slots, slower, may be lost in rough water). |
| Defenders | Colla the keeper (old, will not fight unless his house is entered), three guards with spears, one young herdsman who runs for Ardcarn if alarmed. |
| Guest | Eithne, delivering the season's tally. She wants to leave with whoever is going. |
| Watch | Two guards by day, one at night; the night guard sleeps at the turn of the tide. Dogs only after a first raid. |

### Known intel and how to improve it
Without scouting: grain and iron, few spears. **Scout the shore** (Oddi or Hild, half a day): guard count, the night guard's habit, the marked seed sacks, the runner. **Ask a trader** (if Saltvik visited first, not possible in Build 2): the iron was owed to Kilbrecc's smith. Captured or friendly locals can tell the rest.

### Preparation
Choose the **mode**: a stealth raid, with up to five landing-party members and the others staying with the boat, or an assault, with the full crew ashore and the boat drawn up on the beach, so the landing itself must be held. Then choose timing (dawn, day, dusk, night; tide high or low) and **one preparation advantage**: scout the shore, bring trade goods (salvage from the wreck: an amber necklace, a silver arm-ring, good rope) or bring extra fighting equipment (spare shields and spears for everyone ashore).

### Approaches
| Approach | Mode | How it plays | Best conditions |
|---|---|---|---|
| **Steal** | Stealth | Land at the far end of the beach, slip past the night guard, carry lots to the boat. Discovery turns it into a chase to the boat. | Night, high tide, scouting done |
| **Bargain** | Open landing | Walk up openly with trade goods. Colla will trade surplus grain and one iron lot, but not seed or tithe without Muiredach's word. | Trade goods brought; Bran or Eithne speaks |
| **Threaten** | Open landing | Arrive armed and in force by day. Colla yields stores to protect his house. The runner leaves regardless. | Extra weapons; full landing party; the feared sail |
| **Fight** | Stealth, gone loud | Attack the guards with the landing party, or fight when a stealth raid is discovered. Colla surrenders when two guards fall or flee. Turning on Colla in the middle of an open bargain is `HOSPITALITY_BROKEN`. | Extra weapons; dawn |
| **Assault** | Assault | The full crew lands on the main beach by day and fights for Carrick while Ardcarn musters (below). | Full crew; extra weapons; high tide for a short carry |
| **Slaughter** | Either | Kill everyone found, including Colla and the herdsman. Killing the runner before he leaves the map stops the patrol. | Full landing party; night or dawn |
| **Withdraw** | Either | Always available from the plan or at the boat. In an assault it is the "fall back to the ships" command. | Any time the plan has failed |

### Stealth by night, assault by day
- **An open landing** (to bargain or threaten) uses the party of the chosen mode. If it comes to blows, a small party fights as a stealth raid gone loud, and a full crew fights as an assault.
- **The stealth raid by night** uses the hidden route from the north cove to the storehouse's back hatch (Book 9 section 07). The watch post is empty, the night guard sleeps at the turn of the tide, and Carrick may not know whose sail it was until morning.
- **The assault by day** follows section 12. The watch post sees the boat land and the herdsman runs for Ardcarn whatever the household does, unless he is caught. Ardcarn's horn calls its men in over time, farmers with spears and tools, with a few bows on the headland, and Fiachra's riders come behind them as reinforcements (timings in Book 9 section 07 and Book 10 section 18). The objectives are to **seize the store**, **fire the thatch** of the keeper's house and byre, **take or kill Colla**, and **hold the landing** while the boat is loaded. In Chapter 2 the household's side is only as large as its crew, so Book 10 section 18 sizes Carrick's muster to match; Carrick can be assaulted again later with a larger crew, against the stronger watch it keeps after a first raid.

### Complications (one drawn per seed)
- **The Crows arrive.** Ulf's black sail beaches beside yours. He demands half and his men start killing the guards. The player can join, stand aside, or stop them. Stopping them earns `SPARED` and Ulf's enmity; standing aside writes Ulf's killings into the ledger with your sail present.
- **The defenders offer payment.** Colla offers the hidden silver if you leave the grain and the houses alone. Accepting is `TRIBUTE_TAKEN`: Carrick will pay again next year, and Fiachra loses his own tribute.
- **The patrol.** If the runner reaches Ardcarn and the party stays past a visible horn signal, four of Fiachra's riders arrive. A time-pressure extraction, not an ambush. In an assault this is not a complication: the muster and the riders always come.

Two features are always present and are not complications: the **seed sacks** (a discovered choice) and **Eithne** (an offered person).

### Extraction
The coastal boat has three free berths and four or five cargo slots. Available: six grain, two iron, one silver, the towed currach. Eithne takes a berth. A downed crew member carried to the boat takes the carrier out of the fight; there is no bleed-out timer, and anyone carried aboard survives. Anyone still lying on the beach when the boat pulls away is taken to Ardcarn as a captive, to be ransomed or rescued later (section 16). Rowing clear while defenders gather on the beach is part of the scene.

### Outcome bands
| Band | Typical haul | Deeds and immediate effects |
|---|---|---|
| Clean theft | 3 to 4 grain, 1 iron | `THEFT`. Carrick does not know whose sail until morning. Food runway roughly 30 days longer. |
| Fair bargain | 2 grain, 1 iron | `FAIR_TRADE`. Colla becomes a contact; Ardcarn regard rises; next visit offers trade first. |
| Taken by threat | 4 grain, 2 iron | `THREAT`, `SAIL_SEEN`. Fiachra is shamed: his client was not protected. |
| Hard fight | Up to full slots | `KILLING` with named dead. Ardcarn hostile, and éraic is owed for its dead; Muirenn records it; Bran calls it needless unless the guards struck first. |
| Paid to leave | 1 silver, 1 to 2 grain | `TRIBUTE_TAKEN`. Expectation of a yearly payment; Fiachra's tribute lost. |
| Taken by assault | Up to full slots | `KILLING`, `SAIL_SEEN`, and `BURNING` if the thatch was fired. Many witnesses: Fiachra is publicly shamed and Ardcarn hostile; the answer comes sooner than after a stealth raid (section 12). Glory-minded crew approve; Bran does not. |
| Massacre | Up to full slots | `CIVILIAN_KILLED`, `KILLING`. If anyone escapes or the bodies are linked to the household, Ardcarn and Dún Fiach turn hostile on sight. Most of the crew are shaken, in their own terms: there was no glory in it, it will bring bad luck, Ardcarn's kin will come. Kári is not shaken, but he wins no name from it either: there is no glory in killing farmers. |
| Withdrawal | 0 to 1 lots | Possibly `SAIL_SEEN`. Everyone comes home. A lead to try another way. |

### Consequences
**At home.** Iron becomes nails and tools: the boat's hull patch is made permanent and a simple forge can be built. Grain becomes breathing room shown in the steward's report. Eithne at the fire, if she came. Stolen silver attracts an offer or accusation at the next harbour.
**Regional.** Ardcarn's winter stores fall by what was taken. A taken currach means Ardcarn's fishing suffers. After any raid Carrick posts two more guards and keeps dogs. The runner's news reaches Fiachra in three days and Kilbrecc in five. Saltvik's traders hear within ten days, which shifts prices and gossip.
**Crew.** Bran approves bargains and mercy, Hild approves bold success and everyone coming home, Oddi approves the haul, Runa approves the iron. Every approach pleases someone and troubles someone.
**Evidence.** Bodies at Carrick are found by Ardcarn the next morning. They link the deed to the household if gear was dropped, if a body bears a recognisable wound pattern from a known weapon, or if a fisherman offshore saw the sail (a chance in Book 10). With no escaping witness and no link, Ardcarn knows only that someone did it, and blames the nearest raiders: Ulf. If the household hid the bodies or denies the killing, the ledger also holds `KILLING_HIDDEN`: the crew know, and to Norse eyes an undeclared killing is murder. An assault by day is always linked: everyone who fled saw the sail.
**Delayed.** `SEED_TAKEN`: Ardcarn's spring sowing fails in Year 2, bringing hungry refugees, a desperate Muiredach and hired swords. `SEED_LEFT` (if anyone at Ardcarn learns of it): Muiredach remembers the mercy at the council. Taking the tithe grain makes Kilbrecc an aggrieved party. Taking the silver makes Fiachra one. A known massacre empties half of Ardcarn's fields the next spring, makes Muiredach an implacable enemy and closes the Carrick Strand site to anything but conquest.

### Leads offered on return
Saltvik (sell or trade, Runa's sister, ship fittings) and Glen Arra (cattle, and a rumour that the Crows are planning something there).

### Proof tests
1. Each approach can finish with at least one food lot or a lasting non-material gain such as a contact.
2. Withdrawal is reachable from every state of the scene.
3. Leaving the seed produces a positive delayed consequence by Chapter 5 if witnessed; taking it produces a negative one.
4. Threat and fight bands schedule a retaliation that a player can see coming.
5. Two leads are offered on return in every band, including withdrawal.
6. A new player completes the raid in 12 to 20 minutes.
7. Both modes can be completed: a stealth raid by night can reach the storehouse unseen, and an assault by day can seize the store and hold the landing until the boat is loaded.
8. The same haul taken by assault records more witnesses and schedules its answer sooner than when taken by stealth.

## 03 / Scenario 2: The Light in the Fog
*Chapter 3 voyage interruption. A light in Manannán's mist, a price that sounds cheap, and the arrival of Nessa.*

### Lead and trigger
On any crossing in Chapter 3 after the Saltvik visit, the moving mist closes over the route. A steady light appears ahead that does not flicker like a flame.

### True state
The light is the Ferryman's lamp. Manannán is curious about the household that his mist both hid and wrecked. Following it leads to a seal skerry where Nessa is stranded (if her secret is the Watcher or the Bound) or to a quick passage home with Nessa found later in a coracle on Wreck Strand (if it is the Runaway).

### Choices
| Choice | Result |
|---|---|
| Follow the light | The Ferryman's boat comes alongside. He offers to guide them out for a price. |
| Sail on by reckoning | A rock-strewn passage scene: steering and lookout choices; hull damage likely; Nessa found anyway, later. |
| Anchor and wait | One day lost, stores consumed; the mist lifts; Nessa found later. |

### The Ferryman's price (choose one)
- **A true story.** The player tells something true about an earlier voyage. The crew hears it. Truth about a shameful deed troubles Glory-minded crew and earns Word-minded respect.
- **A gift freely given.** One cargo lot dropped over the side. No haggling: haggling withdraws the offer.
- **A promise of hospitality.** The household will take in the next stranger who comes to them from the sea. This is saved as a bargain with Manannán. The next stranger is Thrand Halfhand in Chapter 4. Turning him away breaks the promise: the mist will never help the household again.

### Consequences
Nessa joins or is met. A bargain or gift recorded with Manannán. The mist on the sea map can later be entered deliberately for escape or shortcut, once per season, if the household has kept faith. **Proof tests:** each choice reaches home within one day; the promise branch demonstrably binds Thrand's arrival; no choice leads to death.

## 04 / Scenario 3: Saltvik Market Day
*Chapter 3. A trade voyage with no raid at all: proof that the loop works without violence and that the coast remembers.*

### Lead
Offered on return from Carrick. Runa wants to find her sister; the household needs fittings, salt and news.

### What is there
| Stall or person | Offers | Wants |
|---|---|---|
| Gunnhild's yard | Ship fittings (cargo, rigging, shallow draft) and repairs | Silver, iron, a share of salvage rights |
| Ottar Silkbeard | Bulk salt, cloth, arrows by the dozen, buyers for anything | Profit; tells you Orm's ships were seen in the north |
| The sea-wife | A wind-knot cord (three knots) | Silver, or a lock of the steerer's hair |
| Kolbeinn the smith | Himself, if his debt is cleared | His debt paid, won at dice, or his creditors driven off |
| Asa, Runa's sister | Gratitude, a contact in Ottar's counting-house | Her own debt settled |
| Hiring bench | Oarsmen for one voyage | Silver and a share; they leave if the voyage goes badly |

### Recognition
Saltvik judges by the bargain (section 01): it forgives a raid sooner than a short weight. Goods from Carrick can be recognised. Grain sacks with Brigid's cross, bar iron with Kilbrecc's smith's mark, Muiredach's silver. A Kilbrecc lay brother at the market notices. Selling those goods openly records a `SAIL_SEEN` with Kilbrecc and lowers the price; if Saltvik is hostile, its guards attack on sight at the jetty and the market is closed; selling quietly through Ottar costs a cut. Ulf's men may be here collecting Kolbeinn's debt or Oddi's, depending on earlier choices.

### Outcome and proof
The player leaves with at least one fitting, one new resident or one contact, and a clear next lead (Glen Arra, Kilbrecc, or a cargo run for Ottar). **Proof tests:** a player who never fights can still finish the market with a fitting and a resident; stolen goods are recognised by their marks; the wind-knot works exactly as specified in Book 4.

## 05 / Scenario 4: The Glen Arra Cattle
*Chapter 3 or 4. Ulf plans to lift Glen Arra's cattle. The household can join him, warn the glen, beat him to it, or broker a deal.*

### True state
Glen Arra has twelve cattle on the summer grazing at the loch head, guarded by Áine and two herders. Ulf plans to land at dawn in two days with fifteen men. Gilla Muire's main household is an hour away.

### Approaches
| Approach | Play | Result |
|---|---|---|
| Join Ulf | A shared raid. Ulf takes the lead and the larger share. | Livestock (two slots per pen); `THREAT` or `KILLING` shared; Ulf's friendship and Crowwick's regard up; Glen Arra hostile |
| Warn and defend | Sail in first; hold the narrow shore path with Áine | A defensive fight; `SPARED` if Ulf's men are allowed to retreat; Áine may join; Ulf becomes an enemy |
| Raid first | Use a shallow draft fitting to reach the loch head before Ulf | Most cattle if fast; Ulf and Glen Arra both angered |
| Broker | Persuade Ulf to take a payment from Gilla Muire instead | Requires Ulf's respect or a shared enemy; earns a fee from both; fragile |

### Extraction
Cattle must be driven to the shore and loaded; a coastal boat carries at most two pens. Swimming cattle out to a karvi is slow and loud. Leftover cattle are a choice: leave them, kill them (`BURNING`-class waste), or give them back.

### Consequences
Áine joins only through warning or brokering. Ulf's path splits here. **Proof tests:** each approach leaves the region in a different state; brokering is reachable only with prerequisites the player can see; cattle extraction respects slots.

## 06 / Scenario 5: The Bell of Brecc
*Chapter 4. A monastery, a relic, a man who was here before, and the biggest consequences in the early game.*

### True state
Kilbrecc has a round tower where the community takes refuge, a church, a guesthouse, workshops, a farm and stores. The Bell of Brecc hangs in the church in a shrine-case of silver. Abbot Colmán will hide the Bell in the tower if warned. Sister Muirenn keeps the annals in the tower. About thirty monks and lay brothers; few fighters. Sanctuary is claimed by anyone who reaches the church.

### Known intel
Rumour says the monastery is rich. Bran knows the layout from fifteen years ago and does not want to go. Senán, if a contact, can tell the truth about how little silver there is and how much the Bell matters.

### Approaches
| Approach | Play | Notes |
|---|---|---|
| Take the Bell | Reach the church before it is hidden, or besiege the tower | `SACRED_TAKEN`. The largest consequences in Chapters 1 to 4. Besieging the tower is an assault (section 12). |
| Raid the farm, spare the church | Take stores and livestock from the farm buildings | `THEFT` or `THREAT`; the church records restraint |
| Demand tribute | Arrive in force; Colmán pays in stores and some silver | `TRIBUTE_TAKEN`; Kilbrecc keeps the Bell |
| Borrow the Bell | Offer protection for a season in exchange for carrying the Bell aboard on one named voyage | A `PROMISE_MADE` with the Church; returning it on time earns deep trust |
| Leave | Trade at the guesthouse, or simply go | Bran's relief; Senán's respect. Raiding Kilbrecc after a night in its guesthouse is `HOSPITALITY_BROKEN` |

### Bran at Kilbrecc
If Bran comes ashore, Muirenn recognises him. He can confess, which changes Kilbrecc's view of the household and Bran's own arc, or deny it, which works until someone checks the annals.

### The Bell aboard
While aboard, the Bell calms water: storms on the sea map are one step weaker, and the boat is faster in rough seas. But **Breccán's drowned crew follow it**. Signs: fog every night, wet footprints on the deck, figures standing in the shallows wherever the ship anchors. They grow bolder each night until the Bell is returned or rung over the Cauldron at slack water, which releases them and is one of the three keys to breaking Orm's bargain. Ringing it there without the Church's leave still counts, but Kilbrecc must hear why.

### Consequences
`SACRED_TAKEN` makes Kilbrecc an aggrieved party with a demand at the council, may bring an interdict that closes Christian markets, and may bring **the abbot's curse**: the community fasts against the household, after the Gaelic custom, and calls down a malediction on it (Book 5 section 15). It raises the Glory and Gain crew, while Christian residents call it the worst of crimes and the Mercy-minded say no good luck comes of robbing a saint. Borrowing it creates the game's clearest test of a promise. **Proof tests:** the drowned escalate predictably and stop when the Bell is returned or rung; every approach is completable; Bran's recognition fires only when he lands.

## 07 / Scenario 6: The Tribute Ship
*Chapter 4. A sea battle against Asgrim's tribute ship carrying silver and hostages from a harbour Orm has taken.*

### Lead
Thrand (if aboard), Ottar or a fisherman reports a heavy ship sailing south under a grey sail. Two escorts were scattered by weather.

### True state
One ship, eighteen crew, Asgrim aboard. Cargo: three silver lots and four hostages from the taken harbour, held below the half-deck: people whose families have not paid, whom Orm drowns when payment fails (Book 5 section 15). A sealed message in Heid's hand tells Asgrim to give "two for the Reach" if the weather turns. Asgrim does not know what the message says.

### The battle
1. **Approach.** On the sea map, choose to close with the wind, cut across from the weather gauge, or wait in the mist. Wind and tide decide who reaches the approach first.
2. **Missiles.** In the battle scene, both ships exchange arrows, thrown spears and stones while closing; each archer stands to draw and loose, and every missile flies where it can be seen, sticks in hull and shields, and can miss (Book 1 section 09). Shields up reduces losses; good archers suppress the enemy steerer.
3. **Grapple or break off.** Once alongside, grapple to board, or break off while you still can.
4. **Boarding.** Ordinary melee across two decks. The hostages below can be freed during the fight. Asgrim surrenders when half his crew falls or when the hostages are freed and his ship is lost.

### Outcomes
Silver (three lots), hostages freed (refugees asking for shelter: roster pressure), Asgrim captured, killed or let go with his ship. Reading Heid's message to Asgrim, or letting him find it, plants his defection. **Consequences:** Orm's demand escalates to a direct threat; the freed hostages carry the household's name to the north; Asgrim's path splits. **Proof tests:** the player can break off before grappling; boarding resolves within ten minutes; the message is discoverable on every path that ends with the ship searched.

## 08 / Scenario 7: The Island With No Birds
*Any open crossing, any chapter after the first raid, at most once per campaign. A short supernatural event proving the fairness contract.*

| Part | Content |
|---|---|
| **Sign** | An island where the chart shows none. No birds, no surf breaking on it, and a sweet smell on the wind. |
| **Rule** | It is the lyngbakr, the heather-backed beast. It surfaces where fish gather and sinks when disturbed. |
| **Response** | Steer off (safe); throw a food lot overboard to draw it under (safe, costs food); land (a short escape scene as the island tilts and sinks). Runa or Nessa can identify it if aboard. |
| **Consequence** | A story the crew tells for the rest of the game; landing and escaping is a famous deed (`Glory` approval); losing someone ashore is possible only if the player ignores two clear warnings. |

## 09 / Scenario 8: The Answer
*Chapter 5. The coast responds. The scenario is assembled from the deed ledger, so each player meets the answer they earned.*

### Which answer comes
| Ledger contains | Answer |
|---|---|
| Fiachra shamed (`THREAT` or `TRIBUTE_TAKEN` at Carrick, Donnchad held) | Fergal's two ships raid Skarvholm at dawn |
| `SEED_TAKEN` and Ardcarn hungry | Ardcarn hires Gilla Ciaráin to burn the boatshed |
| `SACRED_TAKEN` | Kilbrecc's interdict: Christian markets refuse trade; envoy demands the Bell |
| `KILLING` with Glen Arra | Gilla Muire's archers ambush the next landing in Loch Arra |
| Ulf betrayed or humiliated | Ulf sells the household's watch pattern to Orm |
| `CIVILIAN_KILLED` known to a faction | That faction declares the household outlaws: its guards attack on sight, it pays Gilla Ciaráin to hunt the ship, and its allies close their markets |
| `SURRENDERED_KILLED` known twice or more | That faction's fighters stop surrendering to the household |
| Mostly fair dealing | An envoy, not a raid: a demand for compensation, with a chance to settle |

### Defence of Skarvholm
If an attack comes, it is a defence scene and a story gate (section 15), and **the one gate that does not wait for the player**: the attack comes on a fixed night, typically day 135 (Book 4 section 08; Book 10 section 22), and cannot be put off or avoided. **Warning** comes at least seven days before it: omens (Book 4 section 07; Ylva's fetches, if she is with the household), scouts (a sail sighted from Rook Hill, a runner from a friendly harbour, a rumour at Saltvik) and Thrand, if he is with the household, who knows how a raid is readied and says when it will come. **Once warned, the household is held at home for that night:** no journey or voyage may start that would keep the steerer away, and the travel map and the sea map refuse it, saying why. A steerer already away when the warning comes gets word by a runner or a passing boat and is brought home by dusk on the day, the journey or voyage cut short. The days of warning are the time to prepare; at dusk on the night the readiness screen of watch, walls, weapons and warning opens, and the attack comes at nightfall. Preparation follows section 12's defences: the watch cairn on Rook Hill gives warning in proportion to how it is staffed; stakes, traps and archers on platforms can be set; the broch is the last refuge; the boatshed and the ship are what the attackers want to burn. Attackers have aims and withdraw when they have achieved them or lost cohesion. They can be talked to under a truce, and breaking that truce is `HOSPITALITY_BROKEN`. Settling with them before the night (below) does not move it: they still come that night, to take the settlement at the landing under truce, and the scene is a parley instead of a battle unless someone breaks the truce. An attack in force runs on the assault rules of section 12 from the other side: the household musters, and its crew can use the formation commands. Whoever leads the watch that night may die holding the landing, depending on preparation (section 17).

### Settling instead of fighting
Every answer includes a way to settle: compensation in goods, returning what was taken, freeing a hostage, public apology at a named place, or service. Settling writes `PROMISE_MADE` (and `BLOOD_PRICE_PAID` when the compensation is for the dead) and changes the council in Chapter 7. **Proof tests:** the answer chosen matches the ledger; a player with no grievances gets an envoy; every attack can be settled before or during the fight.

## 10 / Scenario 9: The Return to Skarvholm
*Chapter 8, required. Long after the household left, Orm's garrison holds the island, the beaches have drowned, and Heid's apprentice is digging into the Hollow Cairn for the one thing that can renew Manannán's compact. The household must go back.*

### Lead
Skarvholm is one of Orm's outposts, and taking the island from its garrison would need an assault (section 12). This scenario does not take the island: its aim is the Cup in the cairn, which is why it can be done by stealth. Afterwards the island belongs to Rán.

At the Gathering, Brónach tells the council that the old compact was sworn over **Manannán's Cup**, which the cairn-builders laid in the Hollow Cairn. Without it the compact cannot be renewed and Manannán's mist will not cover the alliance. The same week, word comes that Orm's ships took Skarvholm (typically about day 228, once the move ashore is done; the event waits at its gate, Book 10 section 13) and that Gróa is digging at the cairn. The Return is a story gate (section 15): the household sets out when the player chooses, from a readiness screen of crew, equipment, keys and the checkpoint. **Confidence:** certain about the Cup's place; likely about the garrison.

### True state
| Element | Truth |
|---|---|
| Garrison | About 40 fighters under Kolgrím the Burner, placed as in Book 9 section 08; three dogs; a horn on Rook Hill |
| Ships | Two of Orm's ships at Naust Cove; a reinforcement ship at Kaldness, called by the horn |
| The dig | Gróa, four guards and six conscripted diggers (farmers and fishers from a taken harbour, who bore no weapon) at the cairn; her shaft has broken into the central chamber |
| The cairn | The cairn's keepers are awake and angry; two diggers drowned in the broken chamber and walk as draugr |
| Captives | Any residents left as an outpost are held in the broch fort, with any of the household left downed in an earlier fight with Orm's men |
| The Cup | On its stone in the inner chamber. It leaves the stone only after three truths are spoken at the Door. Lifting it makes Rán's tide surge across the island |

### Known intel and how to improve it
- **Brónach:** the Cup and the Door's rule: "Say three true things you would rather not say."
- **Thrand, or Asgrim if he has defected:** garrison strength, the horn, the reinforcement time.
- **What the household learned in Year 1:** that Gull Geo is hidden from Rook Hill; the Seal Cave passage, if that puzzle was solved; the Grey Men alignment that opens the east door, if learned.
- **Scouting from a fishing boat:** the cell sentry at night, the patrol loop.
- **Nessa:** as Watcher or Runaway, her seals report the patrols. As Bound, she may already have told Heid about Gull Geo, which is why the cell sentry exists.

### Preparation
Choose the approach, the party (sized by approach), the timing and one advantage: **Thrand's signals** (a false horn call holds the garrison for a minute), **an allied diversion** (needs two committed allies), **Nessa's seals** (patrol warnings), or **fire arrows** (to burn the ships at Naust). A labelled checkpoint is made before landing.

### Approaches
| Approach | How it plays | Needs |
|---|---|---|
| A Gull Geo by night | Land unseen, silence or slip past the cell sentry, cross the bog in the peat banks' cover, reach the cairn from the north | Night; up to 6 |
| B The Seal Cave passage | Enter the cave at spring low water and follow the tidal passage into the cairn's spring room, below Gróa's dig | The Year 1 passage; spring low tide; up to 4 |
| C The Skerry causeway | Cross at spring low tide beside Orm's ships; burn them, then strike the cairn from the south-east | Spring low tide; up to 8 |
| D Diversion | Allied ships attack Naust Cove; a small party goes in by A or C while the garrison is drawn off | Two committed allies |
| E Challenge Kolgrím | Call him out to a hólmganga on the Skerry at low tide. A champion (the steerer or a resident) fights him; the losing side yields the night | Kolgrím's pride; nerve |

### Inside the cairn
The broken chamber holds Gróa, the drowned diggers and the cairn's wardens. The **Door of Three Truths** offers a choice of statements drawn from the ledger and the household's secrets: some true, some plausible lies. The Door accepts only true things the household would rather not say: a massacre, an abandonment, a broken promise, a fear, Bran's old raid. A household with a clean record can speak of losses and failures. Each lie wakes a warden; three lies seal the Door until the next spring tide. Everyone present hears the truths, and their memories, friendship and fear change accordingly. Gróa can be fought, captured or persuaded to stop; her diggers can be freed or killed.

### Complications (one drawn per seed)
- **Early reinforcement:** Orm's reinforcement ship is already offshore.
- **Fog:** a thick fog halves sight for everyone; whose fog it is depends on the bargains.
- **Heid comes for the Cup** in sea-light, if she has not been turned. She can be fought or talked down with Asgrim's evidence or the release of Breccán's crew.
- **The captives are moved:** the garrison begins loading the captives onto the ships; there is a short window to free them.

Two features are always present: the drowned diggers, and the surge when the Cup is lifted.

### Extraction
Once the Cup is lifted, Rán's surge rises on the Book 10 timers: tidal ground first, then the Seal Cave passage, then the causeway, then the strand. **The cairn door:** as the tide rises, someone must hold the cairn door behind the party. Whoever stays dies, unless the party found the spring-room passage first, which lets the last one out behind them (section 17). Exits from the inner chamber: back through the spring room to Seal Cave, out through the east door towards Gull Geo or Naust Cove, or up Gróa's shaft into the middle of the garrison. Freeing captives costs time against the surge.

### Outcome bands
| Band | Result |
|---|---|
| The Cup, unseen | Recovered with no alarm; the garrison finds out at dawn |
| The Cup by force | Recovered after the horn; losses; the ships burned or not |
| The Cup and the captives | Recovered and the household's people brought home |
| The Cup lost | Gróa forces the Door with blood after the household withdraws; Heid gains the Cup. Orm's weather is at its strongest; the United Coast is no longer reachable |
| Withdrawal | No Cup. One retry before you set out for the final battle, against a garrison half again as strong, with dogs at the cell |

### Consequences
- **The Cup recovered:** the compact can be renewed at Inis Rón; Manannán's mist can cover the alliance in the finale.
- **Ships burned:** Orm's fleet sails two ships short.
- **Beacon lit:** if the watch on Rook Hill lights its beacon, Orm is warned. It brings his attack, the final battle against his fleet and the defence of the mainland home, 5 days earlier (its typical day moves 5 days earlier) and raises the pressure faster, while the final battle remains a gate the player starts (section 15; Book 10 section 22). From then on his ships are on the coast, and there is less quiet time to renew the compact and gather allies.
- **Captives freed:** they return as residents with high friendship. **Diggers freed** is `RESCUE`; **diggers killed** is `CIVILIAN_KILLED`, known to Orm's conscripts and fatal to their chances of defecting.
- **Truths spoken:** the crew's memories and friendship change; secrets one resident held become shared.
- **Kolgrím:** killed in the hólmganga, his garrison's cohesion collapses for the night; killed later, his men fight to the end.
- **Skarvholm afterwards** belongs to Rán and cannot be resettled, but the household's dead can be given rites, and Thorkel can be laid to rest.
- **The downed** are carried to the boat or left behind (section 16); anyone left on the island is a captive of the garrison.
- The steerer's death anywhere on the expedition is game over, returning to the pre-landing checkpoint.

### Proof tests
1. Each approach recovers the Cup on at least one seed; B only at spring low tide.
2. The Door accepts exactly the ledger-true statements; three lies seal it until the next spring tide.
3. Surge timers match Book 10, and at least two exits from the inner chamber are reachable before they close.
4. Failure leaves the campaign winnable, without the United Coast, and offers exactly one retry, open until the household sets out for the final battle.
5. The expedition is hard: the autoplay "good player" policy recovers the Cup on its first attempt in no more than 60% of seeds.

## 11 / Consequence chains
*The game's memory is easiest to test as chains: one choice, carried by real people, arriving later as a different scene.*

### Example chains
| Choice | Carried by | Arrives as | Visible to the player |
|---|---|---|---|
| Seed left at Carrick | Colla tells Muiredach | Muiredach speaks for the household at the council | Steward's report: "Ardcarn will sow this spring" |
| Seed taken | Ardcarn's failed sowing | Hungry refugees in Year 2; Gilla Ciaráin hired | Rumours at Saltvik; refugees name the sail |
| Ferryman's promise | Manannán's bargain | Thrand arrives; keeping him keeps the mist | The promise listed in the bargains panel |
| Bell borrowed and returned | Colmán and Muirenn | Kilbrecc offers sanctuary and mediation | Muirenn's annal entry read at the council |
| Bell stolen | Breccán's crew and Kilbrecc | Nightly drowned; interdict; council demand | Fog and footprints; refused trade |
| Ulf stopped at Carrick | Ulf's grudge, Colla's gratitude | Ulf's enmity; Ardcarn's respect | Ulf's remark at Saltvik |
| Heid's message found | Asgrim | Asgrim's defection in Chapter 7 | The message in the evidence panel |
| Massacre at Carrick, unwitnessed | Nobody, unless evidence links it | Ulf is blamed; the household's crew remember | Residents' remarks; Ulf's fury when accused |
| Massacre at Carrick, witnessed | The escaping runner | Outlawry from Dún Fiach; guards attack on sight on the Irish coast | Hostile territory on the region map |
| Seal Cave passage found in Year 1 | The household's own knowledge | A hidden way into the Hollow Cairn in the Return | The passage on the island map |
| Bound Nessa told Heid of Gull Geo | Nessa's seals | A sentry at the hermit's cell in the Return | The sentry's light at night |
| An outpost kept on Skarvholm | Orm's capture of the island | Captives in the broch fort in the Return | Their names in the morning report |
| Carrick taken by assault | Every defender who fled, Ardcarn's muster, Fiachra's riders | Fiachra's answer sooner and harder than after a stealth raid | The Glory-minded's praise; guards on the Ridge Road |
| Barrow mail worn | Hrolf's draugar; Saltvik's gossip | The dead come to the camp and the steading at night; Ottar's family claim the mail (section 13) | Wet footprints at the door; Ottar's envoy |
| The Frankish sword worn at Dún Fiach | Fiachra's household | An accusation of theft, or the proof of who Faolán is (section 13) | Fiachra's face when he sees the hilt |
| A revenge killing in a town | The town's guards and the dead person's kin | A feud and a blood-price demand (section 14) | Guards on sight in that town; the kin's envoy |
| Someone spared in an early raid | The survivor | They return at the worst moment, to help or to repay a different debt | Their name in the deed record; a face the player may remember |
| A promise made to a traveller | The traveller, and the road | Help, or a grievance, from someone the player forgot | The promise in the bargains panel |
| A challenge refused | The challenger's men, and the poet | Níð spoken of the household; a satire sung where it hurts; the Glory-minded ashamed at the fire | Kári's anger; the satire at Saltvik |
| A killing hidden, then found out | A body found, or one of the household's own who will not keep the secret | The killing judged as murder, worse than if it had been declared, with éraic or vengeance owed | The accusation; who told |
| A resident left behind | The enemy who took them | A ransom demand, a rescue, or word of their death | Their empty place at the fire; the enemy's envoy |
| The scavengers fought at the first dusk (Chapter 1) | Conn, running to Ketill | One fewer at the sheepfold and at Seal Cave; the band warned (section 18) | Svart's body on the strand, or Svart kneeling; fewer men at the fold's gate |
| The scavengers paid off with food at the first dusk | Svart and Conn, fed | All three at the fold, and a parley there that starts warmer | Less salt fish in the morning report |
| Runa lied to about her tool chest | Runa, when she goes to look | Her friendship falls by her Word; she checks the steerer's word again later | Her line at the empty place; her cooler greeting |

### Propagation rules
- News travels only with carriers: survivors, traders, monks, rival crews, seals for the Keepers, and on the mainland the travellers on its roads, the ford-keeper at the River Ford and the pedlar. Each carrier has a route and a delay. Places and travellers are simulated at low detail while off screen, so things happen while the household is away and the news reaches it the same way, by people (Book 10 section 17).
- **Late arrivals.** Consequences can arrive 10 to 40 days after the choice, from people the player has forgotten (Book 10 holds each delay). A late consequence still has a carrier the player could have known about, and the report names what it answers when it arrives.
- A deed's identification depends on what witnesses saw: sail, shields, stem carving, faces, voices.
- Repainting the sail or unshipping the stem reduces identification on later deeds, not earlier ones.

### Balance check across approaches
Over Chapters 2 to 5, simulated with Book 2's autoplay harness, each approach family (theft, threat, tribute, trade, rescue, fight) must produce a different but competitive mix of goods, contacts, crew approval and future risk. Fail the gate if any single approach dominates on every measure, if mercy is always the poorer choice materially by the end of Chapter 5, or if the brutal policy is not both effective in the short term and costly by Chapter 5.

## 12 / Raids by assault
*A strandhögg in force, an attack overland, or the defence of home: the full crew fights for a place. Louder, bloodier and far more public than a stealth raid.*

### When an assault is the only way
Any raid can be an assault. Fortified places (a fort or hill-fort behind a bank and gate, such as Dún Fiach), Crowwick and Orm's outposts can only be taken by assault. Planning shows which targets are assault-only.

### How an assault runs
| Part | Rule |
|---|---|
| **Landing** | The full crew lands by day. Nobody stays with the boat unless ordered, so the landing is itself something to hold. |
| **Muster** | Defenders gather over time. Horns call them in: each call brings the next group from the place's houses and farms. |
| **Reinforcements** | Neighbours answer the horn or a runner: riders, a lord's warriors, an allied crew. Each comes on a timer the household can learn. |
| **Archers** | Defenders' archers take the high ground, banks and roofs. A loose line under their arrows bleeds. |
| **Size** | Battles run 10 to 30 a side (Book 10 section 18). |
| **Withdrawal** | "Fall back to the ships" is always available. Downed allies carried aboard survive; anyone left ashore is recorded as left behind (Book 2) and is captured or killed according to the enemy (section 16). The steerer's death is game over. |

### Objectives
An assault names one or more objectives at planning, and the outcome bands read which were met.
| Objective | What it means |
|---|---|
| **Break the gate** | Force the gate of a fort or the door of a hall so the crew can get in |
| **Fire the thatch** | Set roofs burning: defenders turn to save their homes. `BURNING`; anyone still inside is the household's deed |
| **Seize the store** | Take the storehouse and hold it while lots are carried to the ships |
| **Take or kill the leader** | Capture the place's leader (`HOSTAGE_TAKEN`) or kill them; their side's cohesion falls (Book 10 section 07) |
| **Hold the landing** | Keep the beach and the ships until the crew and the haul are aboard |

### Formations and commands
The crew takes real-time commands, with no tactical pause. Book 10 section 18 holds the numbers.
| Command | Effect |
|---|---|
| **Shield wall** | A locked line with a wide front arc; slow; strong against missiles |
| **Charge** | A shock to the cohesion of the line it hits |
| **Hold** | Stand and keep the ground |
| **Archers' volley** | The crew's archers loose together at a marked spot |
| **Fall back to the ships** | The crew withdraws in a body to the boat |

### Consequences
An assault's consequences are heavier and more public than a stealth raid's:
- **More witnesses.** By day every defender and onlooker who escapes is a carrier, and the sail is always seen (`SAIL_SEEN`).
- **More deaths** on both sides, written as `KILLING` with names; non-combatants caught in it are `CIVILIAN_KILLED`.
- **Faster retaliation.** The answer is scheduled sooner than for the same deed done by stealth (Book 10 section 18).
- **More glory with the Glory-minded.** Glory-minded residents and allies who took part gain friendship (Book 10 section 08); the Mercy-minded are troubled as ever.

### Attacks by land
Once the household is on the mainland it can march overland, with its residents and its allies, and assault a camp, a farm or a fort: the outlaws' hill-fort (section 13), a hostile farm, Dún Fiach itself. The march follows the journey rules of Book 4 section 03 (road legs off screen, wilderness routes crossed on foot), and cargo and captives slow it. The fight uses the same formations, commands and objectives as an assault from the sea, with one change: there is no boat, so **Hold the landing** becomes holding the way out, "Fall back to the ships" becomes "Fall back" to the rally point the plan names, and the downed are safe once carried to a safe camp or waystation (section 16).

### Sea-borne attacks
The household can land in force from its ships on any coastal settlement, including the mainland's coastal places: Carrick, Kilbrecc, Saltvik's outer harbour, Crowwick and Orm's outposts. These run exactly as the assaults above.

### Defences
The homestead on Skarvholm (section 09) and the mainland home (the final battle, Book 4 section 08) are defended in four steps: **watch** (who is posted and where), **warning** (the watch cairn, a runner, a rumour, a sail), **preparation** (walls, traps, stakes, archers on platforms, the old and the sick moved to the last refuge), and then **the battle**, on the assault rules from the other side. Attackers have aims and withdraw when they have met them or lost cohesion.

### Gate or optional
Each raid, land attack, sea-borne attack or defence is a story gate when it is a story event (section 15), with a readiness screen and a warning that it is a point of no return, and optional otherwise.

### Proof tests
1. Every raid on a settlement can be planned as an assault, and assault-only targets offer no stealth plan.
2. Defenders muster in groups after each horn, and reinforcements arrive on their timers.
3. Each objective can be met, and the outcome bands read it.
4. "Fall back to the ships" is reachable from every state of an assault.
5. Formations matter: a shield wall loses fewer to archers than a loose line.
6. An assault's deeds carry more witnesses than the same deeds by stealth, and its answer comes sooner.
7. Once on the mainland, a camp, farm or fort can be attacked by land with the same objectives, and "Fall back" is reachable from every state.
8. A defence offers watch, warning and preparation before the battle, and better preparation measurably lowers the household's losses.

## 13 / Dungeons and what their rewards cost
*Six mainland dungeons, each with a reward that changes how the game is played and a cost that comes back through people and powers.*

Each dungeon is built like a scenario: a lead, a true state, puzzles from the world, fair traps with signs, enemies, a guardian, lore and a reward. Book 4 holds the sites and their terms, Book 9 their layouts and Book 10 section 16 their numbers. This section holds the consequence chain of each reward: what it costs, who carries the cost, and how the player can answer it. Skarvholm keeps the Hollow Cairn (section 10), and the Seal Cave's deep passage is a small dungeon in its own right.

| Site and guardian | Reward and what it changes | Cost | How the cost arrives | Ways to answer |
|---|---|---|---|---|
| **The Black Wood souterrain**: the hill-folk's champion; riddling doors | **Ceo, the mist-spear**: in fog and at night, thrusts pass through shields | The hill-folk call on you at Samhain; Christian residents are uneasy | At Samhain the aos sí come for what is owed, held to the exact words of the bargain. Eithne and Senán remark on it, then complain, while it hangs in the house | Answer the Samhain call; refusing is `PROMISE_BROKEN` with the hill-folk. Keep it out of the Christians' sight |
| **The Barrow-King's mound**: Hrolf the haugbúi and his draugar | **Barrow mail**: the best armour; immune to stagger | The dead are drawn to you at night; Ottar's family claim it | Taking it is `SACRED_TAKEN` (a grave good). Hrolf's draugar follow it to camps and the steading after dark. Once Saltvik hears, from a trader or from someone who sees it worn, Ottar's family demand it. Hrolf was Ottar's grandfather and the mound holds church silver stolen from Kilbrecc; opening it exposes how Saltvik was founded | Give the mail to Ottar's family; keep it and carry Saltvik's grievance; take the church silver back to Kilbrecc, which honours Kilbrecc and shames Ottar |
| **The Drowned Trackway**: the Bog King, a drowned offering-priest | **The bog torc**: the dead cannot see you; you walk flooded bog | Fires warm you less; risk of cold sickness | Taking it is `SACRED_TAKEN` (an offering). While it is worn, a warm fire restores less of the stamina bar (Book 10 section 06, "Stamina capacity") and cold sickness comes more easily (Book 10 section 03) | Take it off for winter nights; give it back to the bog |
| **The outlaws' hill-fort**: Faolán Wolf-Hand and his band | **A Frankish sword**: the finest sword on the coast | It was stolen from Dún Fiach; wearing it there is an accusation | Anyone at Dún Fiach who sees it says so, and Fiachra accuses the household of the theft. The sword is the proof that Faolán is Fiachra's eldest son; bringing both to Dún Fiach can restore him and split the kingdom between him and Órlaith (Book 5 section 04) | Return it to Fiachra; keep it away from Dún Fiach; use it as proof. Taking the hill-fort by force is an assault (section 12) |
| **The Cailleach's Cave**: wind and ice, then the Cailleach herself | **The Cailleach's maul**: shatters shields; freezes water it strikes (ice bridges, frozen bog) | Works only in autumn and winter; using it in summer angers her | Swung in summer it does nothing and angers her, and her anger follows her rules in Book 4. Runa, who keeps faith with the Cailleach, says what she thinks of it | Use it only in her seasons; make amends at her stone |
| **Loch Carn**, a quest: the each-uisce | **The kelpie bridle**: summon the water-horse to cross lochs, bogs and rivers fast | Never keep it near water at night, or it drowns its rider | The water-horse comes for whoever holds the bridle by water after dark, with clear signs first (Book 4's fairness rules). If it takes the steerer, the game is over. Ardcarn, which fears the lough, judges how the each-uisce was dealt with (Book 5 section 07) | Keep it from water at night; bind the each-uisce again at Brigid's well (Book 4) |

### Small dungeons behind the routes' secret entrances
Four wilderness routes hide a secret entrance to a small dungeon (Book 4 section 03; Book 9 section 14 places them; Book 10 section 20 holds the numbers). Each is built like a small scenario: a lead (its hint signs and its rumours), a threshold seen before the party commits, one obstacle or trap from the world with its sign, a few creatures or none, lore that explains the reward before it is taken, and the reward with its cost. None has a guardian of the six dungeons' weight, and none of the rewards is game-changing; each is worth the detour.

| Entrance and route | Inside | Lore | Equipment and what it changes | Cost, and how it arrives | Ways to answer |
|---|---|---|---|---|---|
| **The fallen-oak souterrain**, the Black Wood path. A second, small souterrain, not a back way into the one in the heart | A creep under the oak's roots into three low stone chambers. A boar sow dens in the first in winter and spring (rooted earth at the creep and a snort inside first). The last chamber holds the farm's store, and the bones of the family who never came out | The family's names and tally cut on the lintel; a carving of the hill-folk's door that gives the answer to one of the riddling doors in the heart (the souterrain in the heart, above), so one fewer answer must come from the hermit's psalter | **A boar-spear**: a lugged hunting spear. A boar, wolf or charging person that runs onto its point is held at its length and takes a harder thrust | It is heavy: a slower thrust, and no second thrust in a combo. The bones ask for rites; nobody demands them, but the Kin- and Faith-minded remember whether they were given | Carry another spear for the shield wall. Give the bones rites in the souterrain or at home |
| **The cave behind the falls**, the High Pass | A wade across the edge of the gorge pool, then a wet ledge behind the falling water (a sheen on the stone and the roar; the drain of waist water, Book 1 section 18) into a dry outer cave with the watchmen's hearth, and an inner chamber with their store. In winter the falls freeze into a curtain of ice that must be broken first: with an axe it takes time and its noise carries along the pass; the Cailleach's maul breaks it at a blow | The watchmen's tally sticks, and the account they cut of the night Faolán's band took the tower: the band's leader wore the royal brooch of Dún Fiach, a clue to the outlaw prince (Book 4 section 12) | **A wolfskin cloak**: the cold of a night outdoors lowers the stamina bar by half as much | Dogs smell wolf on it: they bark at the wearer from further off, and herds shy away, so a stealth raid on a farm with dogs is harder. Fiachra's riders take a wolfskin for an outlaw's mark and challenge a wearer they do not know | Take it off before a stealth raid or the Ridge Road; wear it on cold nights |
| **The heather barrow**, the moor road | A crawl through the gap at the barrow's end into a short passage with a sill stone, and one chamber. The cairn-builders' grave is far older than the Mound Field; three lifetimes ago a Norse warrior was laid in it as well, with his helmet. At night the barrow-dead stir here (Book 4 section 09: their signs first) | Spirals like the Hollow Cairn's, and a carving of three figures speaking over a cup: what the Door of Three Truths asks (section 10), learned before the Return | **An iron helmet**, rare on this coast (Book 7 section 07): a helmet's protection (Book 10 section 06) | It is a grave good. Taken with nothing of worth left in its place, it is `SACRED_TAKEN`, and the barrow's dead follow the household's camps on the moor road at night until it is returned | Leave a weapon or silver of worth in its place, which both the Norse and the Gaels hold to be a fair exchange with the dead; or return it |
| **The otter-cave behind the weir**, the river path and the Ford | Along the top of the eel weir at low water, knee deep (closed in spate), behind its fall and through a crawl into the otters' holt (they slip away into the river), then a dry inner chamber above the flood line | Runes cut in the wall by a raiding crew of long ago: the river rose in spate behind them and took their ship at the Ford. The runes name the signs that come before a spate, so the household reads the Ford's closing a day early | **A rune-cut yew bow** with a quiver of iron-headed arrows: a longer reach and harder hits than the hunting bow, with a heavier draw | The runes name its owner, and his kin at Saltvik know the bow. The first time it is seen there, a kinsman asks for it back | Return it, which Saltvik remembers well; or keep it and carry Saltvik's grudge |

**Rumours.** Each entrance has three rumours in the line pools of travellers and minor characters (Book 8 section 17), and about one in three is wrong (Book 10 section 20). A wrong rumour sends the party to the wrong place or the wrong season, never into a trap:

| Entrance | True rumours | The wrong one |
|---|---|---|
| The fallen-oak souterrain | A charcoal burner: a farm stood here before the wood, and its people hid under the ground when raiders came. The pedlar: under a fallen oak, in the ring of old oaks | A traveller: in the holly-dark hollow, where the fog lies (only fog and holly) |
| The cave behind the falls | A herder on Sliabh Carn: the watchmen kept their store where the water falls. The hermit: the dippers know a door in the gorge | An outlaw: the watchmen's store is under the tower's floor (an empty pit) |
| The heather barrow | A salt-pan worker: there is an old one under the heather, older than the Barrow-King. The poet's verse: the stone with the spirals is a door | A herder: the old grave is the ring cairn on the low ridge (it is empty) |
| The otter-cave behind the weir | Cuán: the otters have a house behind the weir bigger than any otter needs. A fisher: there is a cave behind the weir, in at low water | A smuggler: the raiders' bow lies under the stepping stones at the Ford (only the river) |

### Optional quests for the ship and gear
Optional quests can be mounted at any time, outside the story gates: for ship enhancements (a better sail, a carved prow, a sea-charm, a famous mast timber), for character equipment (the dungeon rewards above, and smaller finds), and for residents' requests (Book 5 section 11). They are built like a small scenario, with a lead, a true state and consequences. Some need a particular companion, and say so before they start: Runa to judge a mast timber, Senán to read a carved stone (Book 5 section 12).

### Proof tests
1. Each reward's cost arrives on at least one path, carried by a person or a power, and is never a silent penalty.
2. Each cost has at least one answer the player can see before choosing.
3. A player can finish the campaign without taking any dungeon reward.
4. Each secret entrance can be found by exploring and entered under its conditions; each of its hint signs and both true rumours point at it, and the wrong rumour points elsewhere and leads into no trap.
5. Each small dungeon's lore can be read before its reward is taken, and each reward's cost arrives and can be answered as the table says.

## 14 / Revenge quests
*A death asked for by a friend, done in someone else's town. The deed is real, and so is every other way out.*

### The chain
| Step | What happens |
|---|---|
| **The request** | A resident or a leader asks for a death, naming the target and the wrong (Book 5 section 11) |
| **The lead** | Where the target lives, who guards them and what the town knows; intel with a source and a confidence, as for a raid (section 01) |
| **The truth** | A true state with at least one reveal that changes the demand: who really ordered it, or what the dead did first |
| **The killing** | A deed in that town: `KILLING`, or `CIVILIAN_KILLED` if the target is no fighter, with witnesses and evidence as in a raid |
| **The guards** | The town's guards attack the household on sight there until the matter is settled (Book 10 section 07, "Hostility and evidence") |
| **The feud** | The dead person's kin take up the feud and look for the household's people on the roads and in that town |
| **The blood-price** | The kin demand éraic of the household. Paying it writes `BLOOD_PRICE_PAID`, ends the feud and is remembered; refusing keeps the feud alive |

### Other ways out
Every revenge quest also allows:
- **A blood-price paid** to the one who asked, by the killer or the killer's kin, in public and by the law of that people. Accepting it writes `BLOOD_PRICE_TAKEN`: proper and expected to a Gael, "carrying your kin in your purse" to a Glory-minded Norse (section 01).
- **A duel**, a formal fight before witnesses. A death in a duel fought by its rules writes `KILLING` but brings no guards and no feud. A duel offered and refused writes `CHALLENGE_REFUSED` against whoever refused it.
- **Exile**: the target leaves the coast and does not come back.
- **The truth**: the reveal is shown to the one who asked, and the demand changes or falls away.

The one who asked judges the ending by their values (Book 5 section 11), and Book 10 section 08 ("Requests and quests") holds what each ending moves.

### Áine's father
The man who killed Áine's father lives in Saltvik. He is now a gentle father of three; as everywhere in this book, his family is implied by his house and never appears as actors. **The truth:** the killing was ordered by Gilla Muire himself. Killing him in Saltvik brings Saltvik's guards, his kin's feud and a blood-price, and costs goodwill at the market. A duel or exile ends it more quietly. The truth turns Áine's anger on Glen Arra's own chief and strains the Glen Arra alliance (Book 5 section 09).

### Hild and Kolgrím
Kolgrím the Burner burned Hvitness and later commands Orm's garrison on Skarvholm. The hólmganga in the Return (section 10, approach E) is the lawful way for Hild to have her vengeance; killed by stealth, Kolgrím's men fight to the end.

### Proof tests
1. Every revenge quest can end by the killing and by each of the four other ways out.
2. A killing in a town brings guards on sight there, a feud and a blood-price demand.
3. The reveal can be found before the killing on at least one path.

## 15 / Story gates
*The story moves forward only through major events the player chooses to start. The calendar keeps running, and every dated story event waits at its gate, save the defence of Skarvholm, which comes on its fixed night.*

### How a gate works
- **The player starts it.** A gate is a raid, an expedition, a defence or a council that moves the story on. Nothing starts one but the player's choice, with one exception: the defence of Skarvholm comes on its fixed night (below).
- **The calendar keeps running.** Seasons turn, crops grow and winter must be prepared for, but no chapter deadline passes without the player: a dated story event waits at its gate. Chapter windows in Book 4 section 08 are typical dates, not limits, and Book 10's target progression is a guide for a well-paced player, not a deadline (Book 10 sections 10 and 22).
- **Pressure builds gently.** While the player delays past a gate's typical day, demands grow and rumours spread (Book 10 section 22), but pressure never starts a gate.
- **The one fixed night.** The defence of Skarvholm, when the answer is an attack, comes on a fixed night with at least seven days' warning, and cannot be put off or avoided; once warned, no journey or voyage that would keep the steerer away that night may start, and a steerer already away is brought home by dusk on the day (section 09; Book 10 section 22). It has no pressure, because it does not wait.
- **A readiness screen** opens every gate. It shows the crew, the ship, the stores, the allies and the equipment the gate calls for, with what the household knows of the danger, and a clear warning that the gate is a point of no return.

### The gates
| Gate | Where it plays | Its readiness screen shows | What waits for it |
|---|---|---|---|
| The launch | The end of Chapter 1 (Book 4 section 08) | The boat's repairs, crew and stores | The sea map and the smoke at Carrick |
| The Carrick raid | Scenario 1 (section 02) | Crew, ship, mode, timing, equipment and the one preparation advantage | Chapter 2's haul and its consequences |
| The reply to Asgrim | Chapter 4's end (Book 4 section 08), when Asgrim returns for an answer | Silver, allies and the household's answer | Orm's escalation; Thrand's proof, if Thrand is ready to make it (section 17) |
| The defence of Skarvholm | Scenario 8, the answer (section 09), on its fixed night: the one gate that does not wait | Watch, walls, weapons and warning | The attack the ledger earned |
| The household council | Chapter 5 (Book 4 section 08) | Stores, the island's state and the two mainland sites | The move ashore, or the Lonely Isle path |
| The move ashore | Chapter 6 (Book 4 section 08) | Ships, cargo, and the chosen site secured | Orm's taking of Skarvholm |
| The Gathering | Chapter 7 (Book 4 section 08) | Allies, their demands and the household's offers | Brónach's word of the Cup |
| The Return to Skarvholm | Scenario 9 (section 10) | Crew, equipment, keys and the checkpoint | The Cup; one retry before the household sets out for the final battle |
| The final battle | Chapter 8 (Book 4 section 08); 5 days earlier, with the pressure rising faster, if the beacon was lit in the Return (section 10) | Allies, ships and the Cup | The endings |

Other raids, land attacks, sea-borne attacks and defences are gates when they are story events, and optional otherwise (section 12).

### Proof tests
1. No gate but the defence of Skarvholm starts without the player's choice, and every gate opens with its readiness screen and a plain point-of-no-return warning.
2. A dated story event (Orm's taking of Skarvholm) waits for its gate while the calendar runs on.
3. Delay raises the pressure on its Book 10 schedule and never starts a gate.
4. The defence of Skarvholm comes on its fixed night whatever the player does, after at least seven days' warning; from the warning, every journey and voyage that would keep the steerer away that night is refused with its reason, and a steerer away when the warning comes is home by dusk on the day.
5. With the beacon lit, the final battle's typical day is 5 days earlier and its pressure rises at the Book 10 beacon rate, and it still starts only on the player's choice.

## 16 / Downed, carried and left behind
*A downed ally is not dead. Carried home they live; left behind they are the enemy's.*

### Rules
- **No bleed-out timer.** A friendly character at zero vitality is downed, and stays downed until the scene ends. The steerer is the exception: the steerer's death is game over (Book 2 section 12).
- **Carry them out.** A downed ally carried to the boat, or the village, before the scene ends survives with a serious wound. On a journey or a land attack, a safe camp or a waystation counts (Book 10 section 06, "Downed and carried"). Carrying is slow, and the carrier cannot fight; heavy residents carry faster (Book 10 section 24).
- **Left behind.** A downed ally still on the field when the scene ends is captured or killed, according to the enemy. Captives can be rescued or ransomed later; a captive is a person to be brought home, never a sum.

| Enemy | What happens to the household's downed left behind |
|---|---|
| Norse raiders (Ulf's Crows, Orm's men) | Taken captive, to Crowwick or Kaldness; Orm may demand them as hostages |
| Gaelic lords (Dún Fiach, Ardcarn, Glen Arra) | Taken captive, held for ransom or for a settlement |
| The Church's hired swords | Taken captive and handed to whoever paid them |
| Outlaws in a hurry, wolves, the dead | Killed |

- **Enemies do not finish off the downed**, except berserkers and a few named cruel enemies (Ulf the Crow and Kolgrím the Burner; Book 5 section 19). They always give a visible warning first, a raised weapon and a shout (Book 10 section 06), so the player has a moment to answer.
- **The household's own finisher** on a downed enemy writes `SURRENDERED_KILLED`; taking a downed enemy captive is `HOSTAGE_TAKEN`, ordinary dealing to most of the coast (section 01).
- *Rán's mercy* still turns unscripted crew deaths into grave wounds; scripted deaths (section 17) still happen.

### Proof tests
1. No downed ally dies on a timer; one carried to a safe place before the scene ends survives.
2. One left behind is captured or killed by the enemy's rule above, and a captive can be rescued or ransomed.
3. Every finishing blow by an enemy on a downed ally is preceded by its visible warning.

## 17 / Scripted deaths
*A few deaths are written into the story or offered as a choice. Each one changes the household.*

Every one is announced by the scene before it can happen, and every death that follows is consequential (Book 5 section 19): grief, lost skills, changed ties, a grave, songs, and story branches that close.

| Death | Where | How it plays | How it can be avoided |
|---|---|---|---|
| **The cairn door** | The Return (section 10) | Once the Cup is lifted, someone must hold the cairn door as the tide rises. The player chooses who stays | Finding the spring-room passage first, from the Seal Cave (approach B or the Year 1 puzzle), lets the last one out |
| **The watch leader** | The defence of Skarvholm (section 09) | Whoever leads the watch on the night of the attack holds the landing, and may die there | Preparation: a staffed cairn, stakes and archers, and an early warning |
| **Thrand's proof** | The reply to Asgrim, or wherever Thrand next meets Asgrim (section 15) | Thrand challenges Asgrim to prove Heid's crimes, in a duel before both crews | The evidence: Heid's sealed message (section 07) or another proof of the bargain's price. Without it, Thrand dies in the duel |
| **Bran's reckoning** | Kilbrecc, after Bran is known (section 06) | A monk's family demands Bran's life as blood-price | Bran can go to his death, be exiled, or be defended at the cost of the alliance with Kilbrecc |
| **Rán's debt** | At sea or at the Skerry of the Drowned, when Thorkel's debt comes due (Book 4 section 12) | Someone must go into the sea. Gudrun offers herself | The steerer can accept, choose otherwise, or refuse and pay another way: the ship, the household's luck or a later life |
| **A berserk death** | Any fight | A Berserk resident (Kári, most likely) charges alone and can die through the trait | Keeping them out of the van; a friend at their side |
| **The washer at the ford** | Before the final battle (Book 4 section 07) | She names who will die | Changing orders can save them, at a cost elsewhere |

### Proof tests
1. Each scripted death can be avoided on at least one path the player can see before it happens.
2. Each death that happens leaves a grave, grief at home and at least one closed or changed story branch.


## 18 / Chapter 1: The Wreck's encounters
*Chapter 1 is the tutorial, but its few choices are scenarios in small, built on the same template and carried by the same people (design addendum 2.4; Book 4 section 08; decisions DE-14 to DE-22). Book 10 sections 07, 08 and 25 hold the numbers; Book 9 section 03 holds the places.*

### The scavengers at dusk
| Part | Contents |
|---|---|
| **Lead** | At the first dusk, iron on wood from the east end of the strand; Hild hears it at the camp ("Someone's down at the stern."), and the aim is to see who it is |
| **True state** | Three wreck-scavengers, outlaws who take no captives: Ketill (the heavy build, axe and shield, their leader) watches the sheepfold, where Bran holds Thorkel's body; Svart (spear, his shield on his back while he works) and Conn (young, bow and seax, cowardly) strip the wreck's stern. They want loot, not a death |
| **Mode** | A small fight, or none |
| **Approaches** | **Fight:** they warn first ("Keep out of this." "This wreck is ours. Walk on." "One more step and you'll bleed."); Svart's heavy thrust has a slow, obvious wind-up, so the first parry lands and earns a big riposte with its hitstop. **Walk away:** they finish at dark and go to the fold. **Bargain:** offer salt fish from the camp's stores; they take it and go. **Sneak:** through the dune grass on the bank behind them for a backstab on Conn or Svart |
| **Complication** | When one falls (dead, downed or surrendered), the other runs: self-preservation shown at once. Conn runs if he is hit at all |
| **Outcome bands** | Both gone with food; both gone at dark; one dead and one fled; one spared and one fled; both dead (rare: Conn runs) |
| **Evidence** | A body on the strand, which the household see and remark on; the stern stripped or not |
| **Consequences** | Whoever of the band is neither dead nor held goes to Ketill at the fold (the fold has one, two or three to face), and after the fold, to their skiff in Seal Cave (decision S11-10). A killing is a `KILLING` deed with the household's witnesses; a surrender let go is `SPARED`; the food is gone from the stores |
| **Gate** | Not a gate. A checkpoint autosave before it |
| **Proof tests** | Every approach ends the encounter; a scripted new player who parries Svart's first heavy wins with a riposte; Conn flees when Svart falls; walking away never starts the fight; the fold's band matches what happened at dusk |

### Thorkel's chest, his key and the bow
| Part | Contents |
|---|---|
| **The chest** | Thorkel's own sea chest, locked, found in the wash by Hild on the first morning and carried, or dragged, up to its outline in the camp. Hild: "Father's chest. Get it up to the camp. He wore the key round his neck." |
| **The key** | On Thorkel's body, which Bran holds at the sheepfold. However Bran's search ends (fight, sneak, bargain, or lost), the key comes to the steerer: from Bran when he lays Thorkel on his bier, or taken from the body wherever it lies |
| **Inside** | His hunting bow and a quiver of six arrows (the reward of the Bran search, about twenty to thirty minutes in), his chart fragment (Carrick, section 02), three linen bindings, a bone comb and a whetstone. Hild may keep the comb |
| **The ship's silver** | Not in this chest: the ship's hack-silver is in its iron-bound strongbox by Oddi, which is what Oddi's dilemma saves or loses, what buys Bran's way out at the fold, and what can trade for the steering oar |
| **The bow's first use** | The ship's stores (salt fish and the cauldron) hang lashed high on the broken mast, wedged in the western rocks, out of reach and in sight since the first morning; an arrow through the lashing drops them into the shallows to wade out for. It teaches aiming and loosing from a standing position, and pays in food |
| **Proof tests** | The chest cannot be opened without the key; the key reaches the steerer on every outcome of Bran's search; the bow is first owned only from the chest; the bundle falls only to a missile through its lashing, and can always be reached after |

### Runa's tool chest
| Part | Contents |
|---|---|
| **Choice** | Runa asks for her tool chest to be moved to safety. Once it is set down anywhere safe (the camp, the shelter, the boat), she asks "Where have you put it?" |
| **Approaches** | Tell the truth, or name another place |
| **Consequences** | The truth satisfies her (her friendship rises a little). A lie is found out when she goes to look, and counts against Word: her friendship falls by her Word (Book 10 section 08, `runaLie`), and it is remembered |
| **Proof tests** | Each answer is offered whatever the truth; a lie is always found out within a day; the truth never is |
