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

### Happiness, friendship and fear
Every resident holds three separate measures of how they stand.
| Measure | Range | What it is | What moves it |
|---|---|---|---|
| **Happiness** | 0 to 100 | Their mood now | Food, warmth, rest, safety, success, grief, festivals and how they were treated today |
| **Friendship** | -100 to 100 | How they feel about the steerer over time | Kept promises, care, shared deeds that fit their values, gifts and time spent with them |
| **Fear** | 0 to 100 | How much they fear the steerer | Brutality, punishments, displays of strength and threats |

Leaders hold friendship and fear towards the steerer too (section 04); happiness is kept only for residents. Book 10 section 08 holds every number: "Friendship deltas by deed", "Friendship bands", "Happiness, friendship and fear" and "Fear deltas".

### What the measures do
The marks below are starting values; Book 10 section 08 ("Happiness, friendship and fear") is their source.
- **Work.** Happiness scales what a resident produces, from 0.8 times at 0 happiness to 1.2 times at 100. Below 25 happiness, disputes (section 10) are twice as likely.
- **Loyalty.** A friend (friendship 40 or more) volunteers for danger, defends the steerer and stays in hard times. A resident with friendship -40 or less who does not fear the steerer (fear below 30) leaves.
- **Fear without friendship.** A resident with fear 60 or more and friendship below 0 obeys any order, but with work 15% worse, and may desert or betray while the steerer is away or wounded.
- **Fear with friendship.** Fear 60 or more with friendship 40 or more is fierce devotion: the resident follows the steerer anywhere.
- Fear and friendship are separate, as a faction's regard and fear are (section 07). A resident can like and fear the steerer, or dislike them and stay because they are afraid.

### How judgement shows
Witnessed deeds move a resident's friendship and fear; daily life moves their happiness. Friendship moves through visible bands: **devoted, loyal, content, uneasy, resentful, estranged** (Book 10 section 08, "Friendship bands"). Each step down in friendship, or happiness that stays low, appears first as a remark, then a complaint at the fire, then refusal of a specific kind of order ("I will not burn a church"), then a request to leave. Fear shows in its own way: people go quiet when the steerer comes near, work without care, and flinch at a raised voice. A resident who is afraid and not a friend shows that they may desert or betray before they do it: whispered talk a friend reports, provisions put by, a look towards the boat. Each step up appears as praise, offers of help and, at the top, personal favours and loyalty in a crisis. No resident leaves, deserts or betrays without warning, and no hidden threshold fires silently. Book 8 section 11 holds how each step is spoken.

### Living at home
Every resident follows a daily schedule shaped by job, season, weather and wounds, so the player always finds them doing something: mending nets, arguing over the forge, nursing a hand, teaching a song. Talking to them opens topics drawn from their memories: the last raid, a death, a wound, the weather, their worries and their ties. Some residents seek the player out when something matters to them, with a request (section 11) or a grievance against someone else (section 10). Every resident has one **signature colour** from the Book 7 palette and one **silhouette detail** that picks them out at a glance; those chosen so far (Hild, Bran, Runa and Áine) are in their entries, and the rest are still to be chosen. Book 8 holds how they speak.

### Brutality and the crew
A few residents relish brutality (Kári, and Ulf's sort of raider); most are shaken by the killing of civilians or of people who surrendered, and say so. The steerer can order or commit such killings. Brutality raises the fear of everyone who sees it, and moves their friendship by their values: the crew's reactions follow Book 10 section 08 ("Friendship deltas by deed" and "Fear deltas") and never stay hidden.

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
Thorkel's sister's child, raised in his household and trusted with his steering oar. The player names the steerer and chooses one of two body models. The game never states the steerer's gender, and no line uses a gendered word for them; people say the name, "Steerer" or "you" (Book 8). The steerer has no fixed values; the crew judges them by deeds. A madder-red accent (a sash, a cloak lining or a pin) picks the steerer out against sand and grass. On the mainland up to two residents can walk with the steerer (section 12). Stable ID: `P_STEERER`.

### Starting crew (Chapter 1)
#### Hild Thorkelsdóttir (`C_HILD`)
Fisher and sailor, Thorkel's daughter and the player's cousin. The first person rescued, calling from beyond the rocks. **Values:** Kin 3, Glory 2. **Skills:** sailing, fishing, spear. **Behaviour:** first to help, makes jokes when things are worst, will not stop looking for her father's body. **Arc:** her grief can harden into a demand for vengeance on Orm, or turn into fierce protection of the household. If Thorkel walks as a draugr, she is the one who can speak to him. **Wants from the player:** her father's rites; a place in the bow on the first raid. **Looks:** signature colour woad blue; silhouette detail her long braid. **Personal quest (proposal):** vengeance on the captain who burned Hvitness. It is Kolgrím the Burner, who later commands Orm's garrison on Skarvholm; her chance may come at the hólmganga in the Return (Book 6 section 10, approach E), or she may be talked into letting it go.

#### Oddi Gunnarsson (`C_ODDI`)
A wiry young deckhand, son of a poor freedman. Found injured near the wreck. **Values:** Gain 3, Kin 1. **Skills:** climbing, stealth, rope work. **Behaviour:** has already stolen food from the shared supplies; it is found in his bedding on the second night. **Arc:** treated fairly (shared shame, then responsibility) he becomes the household's best scout and scrounger. Shamed or beaten, he leaves at Saltvik and later sells what he knows to Ulf. **Secret:** he owes Ulf's men a debt from a dice game before the voyage. **Personal quest (proposal):** clearing his debt to Ulf's men without becoming their spy.

#### Bran Gilla Brigte (`C_BRAN`)
Norse-Gaelic former raider in his forties, ten years in Thorkel's household. Found in a sheepfold by the Hollow Cairn, guarding Thorkel's body from wreck-scavengers; he refuses to leave his chief. **Values:** Mercy 3, Word 2. **Skills:** axe and shield, Irish speech, cooking. **Behaviour:** hates needless killing, says grace in two languages, fights well and takes no pleasure in it. **Arc:** fifteen years ago he raided Kilbrecc; Sister Muirenn recorded his face. At Kilbrecc he can be recognised. Confession and penance make him a mediator with the Gaelic coast; concealment, if discovered, damages trust on both sides. **Looks:** signature colour bleached linen (proposal); silhouette detail the ladle at his belt. **Personal quest (proposal):** penance at Kilbrecc, and a meeting with a monk who lost a brother in Bran's raid.

#### Runa Ásdísardóttir (`C_RUNA`)
Boatwright in her thirties, found injured at the Hag's Seat after following a strange light. Insists on carrying her tool chest before anything else. **Values:** Word 2, Faith 2 (the old gods and the Cailleach), Kin 1. **Skills:** carpentry, ship repair, pilotage. **Behaviour:** blunt, practical, superstitious about the sea and proud of it. **Arc:** becomes the household's shipwright. Her sister Asa and Asa's husband Kolbeinn, a smith, are in debt to Ottar Silkbeard in Saltvik; Runa wants them out. She has a professional rivalry with Gunnhild Sea-Mare. **Looks:** signature colour ochre (proposal); silhouette detail the adze over her shoulder. **Personal quest (proposal):** getting Asa and Kolbeinn clear of Ottar's debt-books, which hide something; Hrefna, Ottar's steward, keeps those books (section 04).

### Later residents
#### Eithne ingen Domnaill (`C_EITHNE`)
A Gaelic widow from Ardcarn, about thirty. At Carrick Landing she asks to leave with the raiders: her late husband's kin plan to marry her off to settle a debt. **Values:** Word 3, Mercy 2, Kin 1. **Skills:** stewardship, accounts, herding. **Arc:** becomes the steward. Ardcarn may call her abducted or a runaway, depending on what witnesses saw. She can carry messages to Ardcarn or be demanded back as part of a settlement. Christian; will want a cross at the steading. **Personal quest (proposal):** freeing her late husband's land at Ardcarn from a debt she suspects was forged.

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
| Ylva (`C_YLVA`) | Dependant | Gudrun's elderly sister and Tófi's wife. Cannot work; needs care and warmth. Sees fetches. **Secret (proposal), her last fetch:** her sightings prove true whenever the warning is ignored. Then she sees the steerer's. |

#### Kolbeinn the Smith (`C_KOLBEINN`)
A Saltvik smith, married to Runa's sister Asa; both are in debt to Ottar Silkbeard. Joins if the player pays the debt, wins it at dice, or frees him from Ulf's men who are collecting it. Asa (`C_ASA`), a weaver who keeps accounts, comes with him if her own debt is settled too. **Values:** Gain 2, Glory 2 (pride in craft). Turns iron into tools, axe-heads and ship fittings. Grumbles about the forge until it is built properly.

#### Thrand Halfhand (`C_THRAND`)
A veteran who deserted Orm after Heid ordered a captured crew thrown to Rán. Arrives in Chapter 4 as a castaway clinging to a spar. **Values:** Word 3, Mercy 1, Glory 2. Knows Orm's tactics, ships and signals. Orm demands him back as a hostage. Keeping him is an act of defiance; giving him up is remembered by everyone. **Personal quest (proposal):** proving what Heid did, to Asgrim and to Orm's own crews.

#### Áine of Glen Arra (`C_AINE`)
A herder and archer. Joins if the player protects Glen Arra from Ulf or returns its stolen cattle. **Values:** Kin 2, Glory 2. Gaelic-speaking, Norse-named father. The best shot on the coast and the first to say so. **Looks:** signature colour weld-green (proposal); silhouette detail her bow. **Personal quest (proposal):** the man who killed her father lives in Saltvik. He is now a gentle father of three, and the killing was ordered by Gilla Muire himself. It is a revenge quest (section 11) with every other way out open.

#### Brother Senán (`C_SENAN`)
A monk of Kilbrecc of Norse-Gaelic birth who speaks both languages. Joins only if Kilbrecc is spared and the abbot agrees, as scribe, healer and mediator. **Values:** Faith 3 (Christ and the saints), Mercy 2, Word 2. Can also remain at Kilbrecc as a contact. **Secret (proposal):** Senán finds that the Bell's peace was bought with an old bargain, and that Abbot Colmán knows. Whether it was a saint's prayer or a bargain stays ambiguous.

### Hostages and guests
**Donnchad mac Muiredaig** (`H_DONNCHAD`), Muiredach's adult son, can be taken as a hostage at Carrick or arrive later as an envoy. He is Órlaith's foster-brother. Held well, he can become a friend; returned freely, he is a major peace lever with Ardcarn and Dún Fiach. **Secret (proposal), the hostage who will not go home:** Donnchad does not want to return, because of what waits for him at Ardcarn. Sending him home is still the peace lever, and now it has a cost to a person the household knows.

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
The reveal fires once, after at least twenty days of residence and two shared significant events, through one of: her own disclosure if her friendship is loyal or higher; a visitor from Inis Rón or Kaldness; or the player finding evidence (letters by seal, the hidden skin, a sea-light message). The trigger is saved so loading never repeats it.

### Branches
Nessa can **stay** as a trusted resident, **leave** for Inis Rón, **mediate** between the household and the Keepers, **defect** to Heid, or **turn hostile**. The branch follows her stance, her friendship and fear, her ties (especially with Ylva, Bran and Hild) and the player's choice at the reveal. Betrayal is possible only for the Bound stance and only if the player gives her no way out. Every stance contains at least one path in which she becomes the household's strongest friend.

## 04 / Leaders of the coast
*People with power, obligations and their own problems. Each wants something the player can provide and fears something the player can cause.*

Every settlement and camp has a named leader with a relationship to the household. Leaders hold friendship and fear towards the steerer as residents do (section 01): a leader's friendship is personal, while the faction's regard (section 07) is the standing of the whole people. They usually move together but can part, so Muiredach can come to like the steerer while Ardcarn still curses the sail.

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

### Leaders of the mainland
The mainland's smaller places have leaders of their own (Book 4 holds the twenty areas). The leaders above stay as they are.
| Leader | Place | Sketch |
|---|---|---|
| **Lasair** (`L_LASAIR`), head of the peat-cutters | Móin Mhór, the Great Bog | Old, sharp, knows every safe step in the bog |
| **Dubhthach** (`L_DUBHTHACH`), herder-chief of the shielings | Sliabh Carn | Hospitable, proud, at feud with Fiachra over grazing |
| **Cuán** (`L_CUAN`), the ford-keeper | The River Ford | Takes tolls from everyone; hears all news |
| **Hrefna** (`L_HREFNA`), Ottar's steward | Ottar's farms and salt pans | Hard and fair; keeps Ottar's secret books |
| **Ninnid** (`L_NINNID`), Colmán's reeve | Kilbrecc's tenant farms | Worries about the tithe, the pilgrims and the poor |
| **Faolán Wolf-Hand** (`L_FAOLAN`) | The outlaws' hill-fort on the moor | Outlaw chief with a hidden past |
| **Hrolf the Barrow-King** (`L_HROLF`), dead | The Mound Field | A haugbúi who still keeps court among his goods |

### Notes for play
- **Fiachra** can be flattered, paid or shamed, but never ignored. He will grant land for service or a marriage tie, and demand hostages for either. His line has a bean sí; when she keens, someone of his blood is close to death.
- **Órlaith** is the real negotiator. A marriage tie between households is a political alliance between willing adults of the two households (Arnbjörn is the obvious candidate), never the steerer; there is no romance system. She will not agree to one that is only her father's idea.
- **Colmán** will mediate the final council if Kilbrecc is spared or compensated. **Muirenn's** annals are the human face of the deed ledger: at the council she reads out what the household did, accurately.
- **Muiredach** is a plain farmer with a guesthouse. His storehouse at Carrick is the first raid. He can forgive almost anything except his people starving, and will trade almost anything for his son.
- **Ottar** will sell to anyone and is privately considering submitting to Orm. **Gunnhild** respects skill and contracts above blood or belief.
- **Gilla Muire** wants someone to deal with Ulf. **Brónach** is gruff, old and Nessa's mother's sister.
- **Lasair** guides the household across Móin Mhór, or does not; without her the bog's plank road is the only safe line. **Dubhthach** feeds any guest at the shielings and expects the same pride in return; his feud with Fiachra makes him a friend worth having and a risk to Dún Fiach's goodwill.
- **Cuán** takes his toll from king, monk and raider alike, and what he hears at the ford he passes on, to the household or to anyone else who pays.
- **Hrefna** runs Ottar's farms and salt pans hard and fairly. Ottar's secret books are in her keeping, which matters to Runa's sister (section 02).
- **Ninnid** answers to Colmán for the tenant farms and is the first to suffer when the tithe barns are raided or the pilgrims' road is unsafe.
- **Faolán Wolf-Hand** leads the outlaws who ambush the roads and holds the hill-fort beyond the Mound Field, where the Frankish sword is kept (Book 6 section 13). **Secret (proposal), the outlaw prince:** he is Fiachra's eldest son, outlawed for refusing to burn Kilbrecc in an old feud. Restoring him can split Dún Fiach between him and Órlaith, and the Frankish sword in his fort is the proof of who he is.
- **Hrolf the Barrow-King** has been dead for two lifetimes and still behaves as a king. He keeps court in his mound with his draugar and his goods, guards the barrow mail, and can be spoken to as well as fought. **Secret (proposal), the barrow's silver:** Hrolf was Ottar's grandfather, buried with church silver stolen from Kilbrecc. Opening his mound exposes how Saltvik was founded, and Ottar's family claim the mail (Book 6 section 13).

## 05 / Rival captains
*Other people with ships and ambitions. They raid the same coast, want the same cargo and judge the household by sea-going standards.*

#### Ulf Hrafnsson, "the Crow" (`R_ULF`)
Captain at Crowwick with about twenty-five hungry raiders and a black sail marked with a raven. Can arrive at Carrick as the rival-crew complication. **Motives:** plunder, fame, contempt for "farmers". **Behaviour:** kills when it is quicker than talking; keeps a bargain while it pays. **Possible paths:** an ally who leads the van in the finale if given plunder rights and respect; an enemy who sells the household's plans to Orm; or a defeated rival whose camp at Crowwick is broken. Crowwick can only be taken by assault (Book 6 section 12). He sees the move ashore as betrayal of the raiding life.

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
Each faction tracks **regard** for the household (from hostile to sworn), **fear**, **debts and promises** in both directions, **known deeds** (only those its carriers have reported) and its own **resources**, which raids actually reduce. Regard and fear are separate: a faction can fear you and hate you, or respect you and not fear you. A faction's leader also holds personal friendship and fear towards the steerer (section 04).

The mainland's smaller groups are tracked through their leaders. Hrefna's salt pans belong to Saltvik and Ninnid's tenant farms to Kilbrecc. The peat-cutters of Móin Mhór (Lasair), the herders of Sliabh Carn (Dubhthach), the ford (Cuán) and the outlaws of the moor (Faolán) answer to no faction in the table above.

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
| Dubhthach and Fiachra | At feud over the grazing of Sliabh Carn | Who the household backs; a settlement brokered at the council |
| Hrefna and Ottar | Steward and master; she keeps his secret books | What the books hide coming out; Runa's quest |
| Ninnid and Colmán | Reeve and abbot | The tithe barns, the pilgrims' road |
| Faolán and Fiachra (proposal) | Outlawed eldest son and father | The Frankish sword as proof; restoration |
| Faolán and Órlaith (proposal) | Brother and sister, now rival claims to Dún Fiach | Whether Faolán is restored |
| Hrolf and Ottar (proposal) | Dead grandfather and grandson | The opening of the mound; the barrow mail and the church silver |
| Hild and Kolgrím (proposal) | The burned and the burner of Hvitness | Hild's vengeance, a duel, or letting it go |
| Áine and Gilla Muire (proposal) | Archer and the chief who ordered her father's killing | The truth coming out in Áine's revenge quest |
| Senán and Colmán (proposal) | Monk and the abbot who knows the Bell's secret | What Senán finds about the Bell's peace |
| The pedlar and Orm (proposal) | Seller and buyer of news | Whether the household finds out, and what it does |

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

## 10 / Disputes at home
*A household of ten or more quarrels. The steerer is the one who judges, and everyone watches how.*

### When disputes arise
Once ten or more residents live at the steading, a dispute arises about every five to eight days (Book 10 section 08, "Disputes"). Unhappy households quarrel more (section 01), and disputes can boil over while the steerer is away: the steward holds them for judgement on return, or, if they wait too long, the parties settle them their own way. Each dispute has two parties, named residents with a reason drawn from their values, ties and memories, and the residents who saw it.

### Kinds of dispute
| Kind | Typical case |
|---|---|
| Theft | Food or a keepsake missing; Oddi's stolen food on the second night is the first |
| Insults | A jibe at the fire that went too far |
| A fight | Two residents came to blows; one is hurt |
| Shirking | Someone left their share of the work to others |
| A share of plunder | Who carried what, who fought, who stayed with the boat |
| Belief | Whose shrine stands where: Eithne's cross or Runa's offering stone |
| An old grudge | Something from before the wreck, or from Orm's crews |
| A debt | Silver, a tool or a favour owed and not returned |
| A broken promise | One resident gave their word to another and did not keep it |

### The steerer's judgement
| Choice | What happens |
|---|---|
| **Take a side** | One party is satisfied and the other is not; watchers judge by their values |
| **Find a compromise** | Each party gets part of what they want; neither is fully content |
| **Punish** | A fine from their share, the worst work for some days, shaming at the fire, or being put out of the household. Punishment raises fear in the punished and in everyone watching. There is no torture. |
| **Pay compensation** | The household pays from its own stores so that nobody loses; it costs goods |
| **Call a household thing** | The residents decide together at the evening fire; the steerer is bound by the result, which may not be the one they wanted |
| **Ignore it** | Nothing is decided; the dispute can come back worse |

Each choice moves happiness, friendship and fear for the two parties and for those watching, by Book 10 section 08. Word-minded watchers care whether the judgement was fair, Kin-minded ones whether the household stays whole, and Gain-minded ones what it cost. A dispute is never decided silently: the outcome is spoken at the fire and remembered by both parties.

## 11 / Requests and quests
*Residents and leaders ask for things. What the steerer does with a request is a promise, and promises are remembered.*

### Requests
Residents and leaders make three sizes of request:
- **Small:** build me a loom; find my mother's brooch.
- **Personal:** lay my brother's ghost; take me to my sister.
- **Dangerous:** avenge my father.

The steerer can accept, decline or put it off. Accepting is a promise (`PROMISE_MADE`); doing it is a kept promise and failing it is a broken one, with the friendship that follows. Declining honestly costs less than accepting and forgetting. Requests come from memories, ties and values, so a resident asks for what they would really want, and leaders ask for what their people need. Book 10 section 08 ("Requests and quests") holds how often they come and what they move.

### Quests
Some requests become **quests** across the map, with steps in other areas and people met on the way. The current step is always shown. Quests intersect the main story: a personal quest can open an alliance, expose a secret or change who sits at the council.

### Revenge quests
Some quests are revenge, including **revenge killings in other towns**. A killing in a town is a deed with all its consequences: the town's guards, a feud with the dead person's kin, and the blood-price (éraic) they demand of the household (Book 6 section 14). Every revenge quest also allows another way out:
| Way out | How it works |
|---|---|
| A blood-price paid | The killer, or the killer's kin, pays the one who asked, publicly and by the law of that people |
| A duel | A formal fight before witnesses, by the challenger's choice of champion |
| Exile | The target leaves the coast and does not come back |
| The truth | The reveal that changes the demand: who really ordered it, or what the dead did first |

The one who asked judges the outcome by their values: Kin and Glory want blood, Word accepts a lawful price, and Mercy is content with exile or the truth. Taking another way out can still cost their friendship, and the cost is spoken, not hidden.

### Personal quest seeds (proposal)
Seven residents carry a personal quest in their entry in section 02: Hild, Oddi, Bran, Runa, Eithne, Thrand and Áine.

## 12 / Companions on foot
*Up to two residents walk the mainland with the steerer: they comment, help and fight.*

- **Who can come.** Any resident fit to walk, up to two at a time. Ylva, the wounded and the sick stay home. A resident away with the steerer does not work at home, which the home's report shows.
- **They talk.** Companions comment on places, people, the weather and what the steerer does (Book 8 section 14). Two companions talk to each other, and they disagree: Bran and Kári will not see a burned farm the same way.
- **They help.** Each brings their skills: Áine hunts and watches the high ground, Bran cooks at camp, Runa reads timber and stone, Oddi climbs and scouts, Eithne knows Ardcarn's people. A companion on watch makes a camp safer (Book 10 section 15).
- **They fight.** Companions follow the same orders as the crew in a raid and can be wounded, captured or killed. The steerer's death is game over; a companion's death is a death in the household.
- **They witness.** A companion sees every deed done in their company and judges it by their values, as at home. Time on the road together builds friendship.
- **They act on their own.** A companion whose values are crossed hard enough may refuse, argue or, rarely, act without orders (spare a fugitive, strike an insult), after the same warnings as at home (section 01).

## 13 / Wandering characters
*Four people with small stories who turn up again and again across the game.*

They travel the roads and the coast and are simulated like other travellers (Book 4). Each recurs, remembers what the household did when they last met, and carries news to and from it. Their details beyond the one-line descriptions are proposals.
| Character | Who they are | Values | Their story (proposal) |
|---|---|---|---|
| **The poet** | A Gaelic file who walks between the halls of the coast and writes satires about the steerer | Glory 2, Word 2 | Makes verses from what the household is known to have done. A satire spreads with travellers and hurts the household's standing where it is sung; a praise poem has to be earned, and a poet who is paid to praise is known to have been paid |
| **The pedlar** | A pedlar who always knows a rumour | Gain 3, Kin 1 | Sells needles, salt and news. He is the Gaelic pedlar who calls at the homestead once the household is on the mainland (Book 10 section 17). **Secret (proposal), the friendly pedlar:** he sells news to everyone, including Orm. He is not evil; he is poor |
| **The hermit** | A hermit who walks between holy wells and lonely places | Faith 3, Mercy 2 | Speaks little and notices much. Knows the old holy places of the mainland, and asks nothing |
| **The disgraced warrior** | A warrior who broke and ran in a battle and has not been forgiven | Glory 3, Word 1 | Hires on for food and a chance to put it right; may seek a good death, or come to want a life instead |

## 14 / Secrets that surface (proposal)
*The people's twists, gathered in one place. Each surfaces through play, not exposition.*

| Twist | People | Where it lives |
|---|---|---|
| The outlaw prince | Faolán, Fiachra, Órlaith | Section 04 |
| The barrow's silver | Hrolf, Ottar | Section 04; Book 6 section 13 |
| The abbot's calm water | Senán, Colmán | Section 02 (Senán) |
| The friendly pedlar | The pedlar, Orm | Section 13 |
| Ylva's last fetch | Ylva, the steerer | Section 02 (Ylva) |
| The hostage who will not go home | Donnchad | Section 02 (hostages) |
| The grateful survivor | Someone spared in an early raid | Below; Book 6 section 11 |

### The grateful survivor
Someone the household spared in an early raid (a guard who was let go, a keeper left alive, a fisherman not drowned) comes back at the worst moment, to help or to repay a different debt. They are a real person from the deed record, named and remembered, and what they do depends on what they saw. Book 4 holds the other twist seeds and the event deck.
