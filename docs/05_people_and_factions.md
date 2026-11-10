# Oar and Ember, Book 05: People and Factions

*Crew, leaders, rival captains, motives, relationships and possible alliances.*

Sixteen residents should feel like sixteen people. The coast should feel like a crowd of rivals with their own plans, not a list of quest-givers waiting for the player.

**How to use:** Use this book for named characters, faction goals, relationship ties and alliance terms. Stable IDs here are the keys for Book 2's content files. Values, ties and stances are design truth; dialogue is illustrative and may be rewritten.

_All characters are fictional. Ages are adult for every resident. There is no romance system; existing relationships are listed here. Hidden stances and secrets are listed here for implementation and must never be shown to the player before they are discovered._


## 01 / How people work
*Every person has values that judge the player, ties that bind them to others, memories of what they saw and a reason to stay or go.*

### Values
Each resident and leader has two or three of six values, weighted 1 (cares) to 3 (defining).
| Value | Approves of | Disapproves of |
|---|---|---|
| **Gain** | Rich hauls, good trades, hard bargains | Leaving wealth behind, paying compensation |
| **Mercy** | Sparing people, rescue, avoiding needless killing | Burning homes, killing the surrendered, cruelty by allies |
| **Glory** | Bold attacks, holding ground, famous deeds | Retreat, paying tribute, hiding the sail |
| **Kin** | Protecting the household, bringing everyone home | Risking residents for strangers or loot |
| **Faith** | Respect for what that person holds sacred | Desecration of it; mockery |
| **Word** | Keeping promises and oaths, honest dealing | Broken agreements, lies, betrayal of guests |

### How judgement shows
Witnessed deeds change a resident's regard for the player. Regard moves through visible states: **devoted, loyal, content, uneasy, resentful, estranged**. Each step down appears first as a remark, then a complaint at the fire, then refusal of a specific kind of order ("I will not burn a church"), then a request to leave. Each step up appears as praise, offers of help and, at the top, personal favours and loyalty in a crisis. No resident leaves without warning, and no hidden threshold fires silently.

### Living at home
Every resident follows a daily schedule shaped by job, season, weather and wounds, so the player always finds them doing something: mending nets, arguing over the forge, nursing a hand, teaching a song. Talking to them opens topics drawn from their memories: the last raid, a death, a wound, the weather, their worries and their ties. Some residents seek the player out when something matters to them. Book 8 holds how they speak.

### Brutality and the crew
A few residents relish brutality (Kári, and Ulf's sort of raider); most are shaken by the killing of civilians or of people who surrendered, and say so. The steerer can order or commit such killings; the crew's reactions follow Book 10's deltas and never stay hidden.

### Change through experience
Values can shift by one point after strong shared events. A Glory-minded warrior saved by a merciful bargain may gain Mercy. A Mercy-minded healer who watches the merciful choice get a friend killed may lose it. Shifts are rare (no more than two per resident per campaign) and always shown with a scene.

### Ties and memory
A **tie** links two people: kin, spouse, friend, rival, debt, grievance, oath or mentor. Spouses and partners exist only where this book says so; there is no romance system and none are created in play. Ties carry a strength and a history. Each person keeps a short **memory list** of significant events they witnessed or were told, with the source. Memories drive dialogue and reactions; they are not deleted when they become inconvenient.

### Roster rules
- Sixteen permanent residents maximum, excluding the player.
- Hostages are held as guests outside the roster but cost food and a guard.
- Hired oarsmen and allied warriors are temporary and do not count.
- Refugees can shelter temporarily with a visible food cost and a resolution plan.
- Any adult can learn any job. Origin and belief grant no stat bonuses.

## 02 / The household
*Thorkel Ketilsson's people, fled from Hvitness after Orm burned it. They wreck on Skarvholm with their chief drowned and the player suddenly in charge.*

### The player: the steerer
Thorkel's sister's child, raised in his household and trusted with his steering oar. The player names the steerer and chooses one of two body models. The game never states the steerer's gender, and no line uses a gendered word for them; people say the name, "Steerer" or "you" (Book 8). The steerer has no fixed values; the crew judges them by deeds. Stable ID: `P_STEERER`.

### Starting crew (Chapter 1)
#### Hild Thorkelsdóttir (`C_HILD`)
Fisher and sailor, Thorkel's daughter and the player's cousin. The first person rescued, calling from beyond the rocks. **Values:** Kin 3, Glory 2. **Skills:** sailing, fishing, spear. **Behaviour:** first to help, makes jokes when things are worst, will not stop looking for her father's body. **Arc:** her grief can harden into a demand for vengeance on Orm, or turn into fierce protection of the household. If Thorkel walks as a draugr, she is the one who can speak to him. **Wants from the player:** her father's rites; a place in the bow on the first raid.

#### Oddi Gunnarsson (`C_ODDI`)
A wiry young deckhand, son of a poor freedman. Found injured near the wreck. **Values:** Gain 3, Kin 1. **Skills:** climbing, stealth, rope work. **Behaviour:** has already stolen food from the shared supplies; it is found in his bedding on the second night. **Arc:** treated fairly (shared shame, then responsibility) he becomes the household's best scout and scrounger. Shamed or beaten, he leaves at Saltvik and later sells what he knows to Ulf. **Secret:** he owes Ulf's men a debt from a dice game before the voyage.

#### Bran Gilla Brigte (`C_BRAN`)
Norse-Gaelic former raider in his forties, ten years in Thorkel's household. Found in a sheepfold by the Hollow Cairn, guarding Thorkel's body from wreck-scavengers; he refuses to leave his chief. **Values:** Mercy 3, Word 2. **Skills:** axe and shield, Irish speech, cooking. **Behaviour:** hates needless killing, says grace in two languages, fights well and takes no pleasure in it. **Arc:** fifteen years ago he raided Kilbrecc; Sister Muirenn recorded his face. At Kilbrecc he can be recognised. Confession and penance make him a mediator with the Gaelic coast; concealment, if discovered, damages trust on both sides.

#### Runa Ásdísardóttir (`C_RUNA`)
Boatwright in her thirties, found injured at the Hag's Seat after following a strange light. Insists on carrying her tool chest before anything else. **Values:** Word 2, Faith 2 (the old gods and the Cailleach), Kin 1. **Skills:** carpentry, ship repair, pilotage. **Behaviour:** blunt, practical, superstitious about the sea and proud of it. **Arc:** becomes the household's shipwright. Her sister Asa and Asa's husband Kolbeinn, a smith, are in debt to Ottar Silkbeard in Saltvik; Runa wants them out. She has a professional rivalry with Gunnhild Sea-Mare.

### Later residents
#### Eithne ingen Domnaill (`C_EITHNE`)
A Gaelic widow from Ardcarn, about thirty. At Carrick Landing she asks to leave with the raiders: her late husband's kin plan to marry her off to settle a debt. **Values:** Word 3, Mercy 2, Kin 1. **Skills:** stewardship, accounts, herding. **Arc:** becomes the steward. Ardcarn may call her abducted or a runaway, depending on what witnesses saw. She can carry messages to Ardcarn or be demanded back as part of a settlement. Christian; will want a cross at the steading.

#### Nessa of Inis Rón (`C_NESSA`)
Healer and net-maker, late twenties, seal-kin of Inis Rón. Arrives through the fog-light event in Chapter 3. See section 03.

#### Old Gudrun and the Followers (Chapter 3)
Six of Thorkel's household who escaped Hvitness in a second boat and find Skarvholm by the smoke. They double the mouths to feed.
| Resident | Role | Notes |
|---|---|---|
| Gudrun (`C_GUDRUN`) | Matriarch, story-keeper | Thorkel's aunt. Kin 3, Word 2. Opposes reckless raiding; insists on rites; remembers the old compacts in fragments. |
| Arnbjörn (`C_ARNBJORN`) | Herder | Gudrun's son. Cautious, kind, a poor fighter. Kin 2, Mercy 1. Candidate for a marriage tie with Glen Arra. |
| Kári (`C_KARI`) | Rower, fighter | Twin of Kolla. Glory 3. Wants fame, will follow Ulf if the household seems timid. |
| Kolla (`C_KOLLA`) | Rower, fisher | Twin of Kári. Kin 2, Gain 2. Holds her brother back, mostly. |
| Tófi One-Eye (`C_TOFI`) | Old warrior, trainer | Ylva's husband of forty years. Glory 2, Word 2. Teaches combat; tells the truth about past raids nobody wants to hear. |
| Ylva (`C_YLVA`) | Dependant | Gudrun's elderly sister and Tófi's wife. Cannot work; needs care and warmth. Sees fetches. |

#### Kolbeinn the Smith (`C_KOLBEINN`)
A Saltvik smith, married to Runa's sister Asa; both are in debt to Ottar Silkbeard. Joins if the player pays the debt, wins it at dice, or frees him from Ulf's men who are collecting it. Asa (`C_ASA`), a weaver who keeps accounts, comes with him if her own debt is settled too. **Values:** Gain 2, Glory 2 (pride in craft). Turns iron into tools, axe-heads and ship fittings. Grumbles about the forge until it is built properly.

#### Thrand Halfhand (`C_THRAND`)
A veteran who deserted Orm after Heid ordered a captured crew thrown to Rán. Arrives in Chapter 4 as a castaway clinging to a spar. **Values:** Word 3, Mercy 1, Glory 2. Knows Orm's tactics, ships and signals. Orm demands him back as a hostage. Keeping him is an act of defiance; giving him up is remembered by everyone.

#### Áine of Glen Arra (`C_AINE`)
A herder and archer. Joins if the player protects Glen Arra from Ulf or returns its stolen cattle. **Values:** Kin 2, Glory 2. Gaelic-speaking, Norse-named father. The best shot on the coast and the first to say so.

#### Brother Senán (`C_SENAN`)
A monk of Kilbrecc of Norse-Gaelic birth who speaks both languages. Joins only if Kilbrecc is spared and the abbot agrees, as scribe, healer and mediator. **Values:** Faith 3 (Christ and the saints), Mercy 2, Word 2. Can also remain at Kilbrecc as a contact.

### Hostages and guests
**Donnchad mac Muiredaig** (`H_DONNCHAD`), Muiredach's adult son, can be taken as a hostage at Carrick or arrive later as an envoy. He is Órlaith's foster-brother. Held well, he can become a friend; returned freely, he is a major peace lever with Ardcarn and Dún Fiach.

### Generated residents
Refugees and recruits outside the named cast use the same model. Generate varied adults across origin, appearance, skills and values; never let the opening depend on a rare roll. Each generated resident gets one memorable trait shown through behaviour (sings while rowing; hoards pretty stones; will not eat fish).

## 03 / Nessa
*The friendly newcomer. Useful, trusted, and tied to an older power she has not mentioned. Her stance is fixed at campaign start and never chosen afterwards to punish trust.*

### Arrival
In Chapter 3 the fog-light event (Book 6) brings the boat to a seal skerry where Nessa is stranded, or brings Nessa to Skarvholm in a coracle. She is a skilled healer and net-maker and works by ordinary rules: she uses real supplies, needs food and rest, and does not create resources from nothing. She may improve wound care, find a better fishing ground or warn of a storm a day early.

### Clues before the reveal
She swims in water that would kill anyone else. Seals gather where she works. She never eats seal meat and leaves the fire if it is cooked. She speaks to Ylva about fetches as if they were ordinary. She knows the old name of the Hag's Seat. None of these are labelled with an enemy icon.

### Hidden stances
| Stance | Truth | How it shows after the reveal |
|---|---|---|
| **Watcher** (`NESSA_WATCHER`) | Sent by Brónach to judge whether the household deserves the Keepers' help against Orm. | Reports to Inis Rón. Her judgement opens or closes the Keepers' alliance. She defends the household if it has been decent. |
| **Bound** (`NESSA_BOUND`) | Her brother Ruairí drowned; Heid has promised to release him from Rán's hall in exchange for information about the household. | Has been sending word by seal. Can confess and become a double agent, flee, or betray the household's plans if left without a way out. |
| **Runaway** (`NESSA_RUNAWAY`) | Fled Inis Rón and an arranged binding; her seal-skin is hidden on Skarvholm. The Keepers want her back. | Asks for protection. Whoever finds the skin holds power over her; how the player uses it defines her branch. |

### Reveal triggers
The reveal fires once, after at least twenty days of residence and two shared significant events, through one of: her own disclosure if her regard is loyal or higher; a visitor from Inis Rón or Kaldness; or the player finding evidence (letters by seal, the hidden skin, a sea-light message). The trigger is saved so loading never repeats it.

### Branches
Nessa can **stay** as a trusted resident, **leave** for Inis Rón, **mediate** between the household and the Keepers, **defect** to Heid, or **turn hostile**. The branch follows her stance, her regard, her ties (especially with Ylva, Bran and Hild) and the player's choice at the reveal. Betrayal is possible only for the Bound stance and only if the player gives her no way out. Every stance contains at least one path in which she becomes the household's strongest friend.

## 04 / Leaders of the coast
*People with power, obligations and their own problems. Each wants something the player can provide and fears something the player can cause.*

| Leader | Place | Wants | Fears |
|---|---|---|---|
| **King Fiachra mac Áeda** (`L_FIACHRA`) | Dún Fiach | Tribute, public submission, a sea-guard he does not have to pay for | Looking weak before his clients; Saltvik's wealth |
| **Órlaith ingen Fhiachrach** (`L_ORLAITH`) | Dún Fiach | Her father's kingdom to survive him; fewer feuds | Fergal's temper; a marriage that serves only her father |
| **Abbot Colmán** (`L_COLMAN`) | Kilbrecc | The Bell kept safe, sanctuary respected, peace on church lands | Another burning; losing the patrons who feed the community |
| **Sister Muirenn** (`L_MUIRENN`) | Kilbrecc | An accurate record; justice for the dead of past raids | Records being burned or ignored |
| **Muiredach the hospitaller** (`L_MUIREDACH`) | Ardcarn | To feed his people through winter; his son home | Shame before Fiachra; the lough |
| **Ottar Silkbeard** (`L_OTTAR`) | Saltvik | Trade at any price; a seat for Saltvik at any table | Orm's fleet in his harbour; war that stops trade |
| **Gunnhild Sea-Mare** (`L_GUNNHILD`) | Saltvik | The best ships on the coast; salvage rights | Cheats; Runa's sister's debt swallowing a good boatwright |
| **Gilla Muire** (`L_GILLAMUIRE`) | Glen Arra | His cattle and his loch kept safe from Ulf | Being forced to choose between Orm and Dún Fiach |
| **Brónach** (`L_BRONACH`) | Inis Rón | The old compact renewed; Nessa's fate decided by the seal-kin | Heid; outsiders treating the Keepers as a curiosity |

### Notes for play
- **Fiachra** can be flattered, paid or shamed, but never ignored. He will grant land for service or a marriage tie, and demand hostages for either. His line has a bean sí; when she keens, someone of his blood is close to death.
- **Órlaith** is the real negotiator. A marriage tie between households is a political alliance between willing adults of the two households (Arnbjörn is the obvious candidate), never the steerer; there is no romance system. She will not agree to one that is only her father's idea.
- **Colmán** will mediate the final council if Kilbrecc is spared or compensated. **Muirenn's** annals are the human face of the deed ledger: at the council she reads out what the household did, accurately.
- **Muiredach** is a plain farmer with a guesthouse. His storehouse at Carrick is the first raid. He can forgive almost anything except his people starving, and will trade almost anything for his son.
- **Ottar** will sell to anyone and is privately considering submitting to Orm. **Gunnhild** respects skill and contracts above blood or belief.
- **Gilla Muire** wants someone to deal with Ulf. **Brónach** is gruff, old and Nessa's mother's sister.

## 05 / Rival captains
*Other people with ships and ambitions. They raid the same coast, want the same cargo and judge the household by sea-going standards.*

#### Ulf Hrafnsson, "the Crow" (`R_ULF`)
Captain at Crowwick with about twenty-five hungry raiders and a black sail marked with a raven. Can arrive at Carrick as the rival-crew complication. **Motives:** plunder, fame, contempt for "farmers". **Behaviour:** kills when it is quicker than talking; keeps a bargain while it pays. **Possible paths:** an ally who leads the van in the finale if given plunder rights and respect; an enemy who sells the household's plans to Orm; or a defeated rival whose camp becomes the Arra Foot site. He sees the move ashore as betrayal of the raiding life.

#### Gunnhild Sea-Mare (`L_GUNNHILD`, listed once as a leader)
Saltvik's best shipwright and a trader-raider in her own right. Competes for salvage and cargo; honours contracts exactly. Ally path: ships and repairs for the finale. Rival path: undercuts the household's trade and buys its enemies' debts.

#### Asgrim Cold-Hand (`R_ASGRIM`)
Orm's tribute-collector with three ships. Disciplined, cold, never cruel for sport. Arrives in Chapter 4 with Orm's demand. **Secret:** his brother was one of the crew Heid gave to Rán. Evidence of the bargain's true price can turn him: a defected Asgrim brings ships and Orm's signals to the alliance.

#### Fergal mac Cathail (`R_FERGAL`)
Dún Fiach's ship-captain, who lost a brother to a Norse raid. Leads retaliation in Chapter 5 if the household has shamed Fiachra. Honourable: accepts surrender, keeps truces, respects a fair fight. Compensation and a shared victory can make him an ally. Seeks Órlaith's hand as a political match.

#### Gilla Ciaráin (`R_GILLACIARAIN`)
A Norse-Gaelic sellsword with one fast ship and no loyalties. Can be hired by Ardcarn or Kilbrecc to strike back, or by the player. Breaks contracts only when the other side breaks first.

## 06 / The enemy
*Orm is the external threat, but his offer is real. That is what makes him dangerous.*

#### Orm Sveinsson, Sea King of Kaldness (`E_ORM`)
About forty-five. Survived a wreck no one else survived and came out of it certain he was meant to rule the sea. He believes he is building order: one king, one tribute, safe water for everyone who pays. His fleet of six to ten ships never seems to meet a storm. **What he offers:** protection for tribute, a tenth of plunder and a hostage. **How he escalates:** demands grow until he asks for something the household cannot give, a drowning for Rán. **Ways to end him:** killed in battle, captured and held, exiled after his bargain breaks, or bargained with if he is beaten and Heid has broken her staff.

#### Heid the Grey (`E_HEID`)
Orm's seeress, a völva who works seiðr with staff and song. Her twin sons drowned; in the sea-light she can see them in Rán's hall, and serving the bargain lets her keep watching. Her grief explains her choices without excusing them. **She can be turned:** freeing Breccán's crew with the Bell shows her that the drowned can be released; renewing Manannán's compact offers her sons a way out. Persuaded, she breaks her staff herself. Long ago she came to Inis Rón to learn, and Brónach turned her away.

#### Kolgrím the Burner (`E_KOLGRIM`)
Orm's harbour-taker and the commander of the garrison on Skarvholm in the late game. Coarse, proud, fond of fire and of an audience. He will accept a public challenge to a hólmganga because refusing would shame him in front of his men. Killed in fair combat, his garrison loses heart; killed by stealth, they fight to the end.

#### Gróa (`E_GROA`)
Heid's apprentice, young, devout and frightened, sent to dig the Cup out of the Hollow Cairn. She has already lost diggers to the cairn and the sea. She believes the Door can be forced with enough blood. She can be fought, captured, or persuaded to stop, and if spared she knows things about Heid that matter in the finale.

#### Kaldness
Orm's hall on a northern isle. His crews are exiles, adventurers, conscripted hostages and men who saw what happens to those who refuse. Not all are loyal; defections are possible when the weather turns against him.

## 07 / Factions
| Faction | Goal | Strength | Start attitude | Moves towards the household |
|---|---|---|---|---|
| Ardcarn | Survive winter, get Donnchad back | Food, cattle, Fiachra's protection | Neutral | Kept bargains, returned goods, help with the each-uisce |
| Dún Fiach | Prestige and control of the coast | Warriors, land rights | Wary | Service, gifts, public respect, a marriage tie |
| Kilbrecc | Sanctuary, the Bell, peace | Stores, records, mediation, patrons | Wary | Sparing it, compensation, Senán's word |
| Saltvik | Trade without war | Ships, yards, silver, news | Neutral | Profitable trade, protection of its fleet |
| Glen Arra | Cattle and safety from Ulf | Archers, cattle, a sheltered loch | Neutral | Dealing with Ulf, returning cattle |
| Keepers | Renew the compact, judge Nessa's case | Lore, Manannán's favour | Unknown | Respect for seal-kin, Nessa's report, honouring the old powers |
| Crowwick | Plunder and fame | Hard fighters, a fast ship | Rival | Shared plunder, bold deeds, respect |
| Kaldness | Rule the Narrow Sea | Fleet, weather, fear | Demanding | Tribute and obedience only |

### Faction state
Each faction tracks **regard** for the household (from hostile to sworn), **fear**, **debts and promises** in both directions, **known deeds** (only those its carriers have reported) and its own **resources**, which raids actually reduce. Regard and fear are separate: a faction can fear you and hate you, or respect you and not fear you.

## 08 / Relationship web
| Tie | Nature | What can change it |
|---|---|---|
| Fiachra and Ottar | Old rivals; peace sealed by a marriage of cousins | Orm's pressure on Saltvik; a trade war |
| Muiredach and Fiachra | Client and lord: tribute for protection | A raid on Carrick shames Fiachra, who must answer |
| Kilbrecc and Ardcarn | Landlord and tenants; part of Carrick's grain is owed as tithe | Taking the tithe grain angers both |
| Órlaith and Donnchad | Foster-siblings | Donnchad's treatment as a hostage |
| Órlaith and Fergal | He seeks a political match with her; she has not decided | A marriage tie with the household; Fergal's conduct in retaliation |
| Bran and Kilbrecc | He raided it fifteen years ago; Muirenn recorded him | Confession, penance or exposure |
| Eithne and Muiredach | He arranged her marriage; her husband was his cousin | How she left; what she says at the council |
| Runa and Gunnhild | Rival shipwrights; respect under the insults | Asa's debt; a shared refit |
| Kolbeinn and Asa | Married; in debt together | Whether both debts are settled |
| Tófi and Ylva | Married forty years | Ylva's health through winter |
| Ulf and Gilla Muire | Raider and victim of cattle theft | The household's choice of side |
| Ulf and Oddi | Creditor and debtor | Oddi's treatment by the household |
| Thrand and Asgrim | Former shipmates who parted badly | Proof of Heid's sacrifices |
| Asgrim and Heid | He blames her for his brother's drowning | Evidence of the bargain |
| Heid and Brónach | Refused student and teacher | Nessa's stance; the compact's renewal |
| Heid and Gróa | Teacher and frightened apprentice | What happens at the cairn |
| Kolgrím and Asgrim | Rival captains under Orm | Asgrim's defection |
| Nessa and Brónach | Niece and aunt | Nessa's stance and branch |
| Hild and Thorkel | Daughter and drowned father | His rites, or his walking |
| Gudrun and the steerer | Matriarch and new leader | Rites honoured, kin protected, raids restrained |

## 09 / Possible alliances
*Allies are won by deeds and kept by terms. Each has a contribution, a demand and a condition that breaks the deal.*

| Ally | Contributes in the finale | Typical demand | Breaks if |
|---|---|---|---|
| Kilbrecc | Stores, sanctuary for non-fighters, mediation | Return of the Bell; no raids on church lands; Bran's penance if known | Church land is raided after the council |
| Dún Fiach | Warriors under Fergal; land rights confirmed | Hostage or marriage tie; public submission at the council | Fiachra is publicly shamed again |
| Ardcarn | Food, local guides, militia | Compensation for Carrick; Donnchad returned; Eithne's account heard | Its people go hungry because of the household |
| Saltvik | Two ships, repairs, hired oarsmen | Trade rights; protection of its fleet; Asa's debt settled fairly | Ottar submits to Orm (preventable) |
| Glen Arra | Archers, cattle, a sheltered anchorage | Ulf dealt with; cattle returned | The household allies with Ulf without Glen Arra's consent |
| Keepers | The compact rite; Manannán's mist over the fleet | Respect for the seal-kin; Nessa's fate settled fairly | Seal-kin are harmed or the skin is used as a leash |
| Crowwick | Hard fighters and a fast ship | Plunder rights; the van in battle; old scores | Glen Arra or Kilbrecc sit at the same table without terms |
| Asgrim | Three ships, Orm's signals | Proof of Heid's sacrifices; a place afterwards | Thrand is harmed |

### Conflicts between allies
- Kilbrecc will not sit with Ulf unless Ulf swears off church lands before witnesses.
- Glen Arra will not fight beside Ulf unless its cattle are returned first.
- Dún Fiach and Saltvik each demand precedence at the council; the seating order is a decision with consequences.
- Fergal will not accept a marriage tie between Órlaith and the household without being heard.

### Alliance strength
The finale reads each ally's state: committed, conditional, absent or hostile. Strength depends on what each ally actually contributes, not on a single score. A thin alliance can still win with good planning; a broad one can still fail if its members are kept apart. Book 2 holds the data contract.
