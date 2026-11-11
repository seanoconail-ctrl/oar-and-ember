# Oar and Ember, Book 05: People and Factions

*Crew, leaders, rival captains, motives, relationships and possible alliances.*

Sixteen residents should feel like sixteen people. The coast should feel like a crowd of rivals with their own plans, not a list of quest-givers waiting for the player.

**How to use:** Use this book for named characters, faction goals, relationship ties and alliance terms. Stable IDs here are the keys for Book 2's content files. Values, traits, ties and stances are design truth; dialogue is illustrative and may be rewritten. Most people are ordinary, with simple motives: food, safety, family, money, pride, fear, a grudge, a debt. Only a few are schemers, and none are philosophers.

_All characters are fictional. Ages are adult for every resident. There is no romance system; existing relationships are listed here. Hidden stances and secrets are listed here for implementation and must never be shown to the player before they are discovered._


## 01 / How people work
*Every person judges by the code of their own culture and by their values, behaves by their traits, and has ties that bind them to others, memories of what they saw and a reason to stay or go.*

### Values
Each resident and leader has two or three of six values, weighted 1 (cares) to 3 (defining).
| Value | Approves of | Disapproves of |
|---|---|---|
| **Gain** | Rich hauls, good trades, hard bargains | Leaving wealth behind, paying compensation |
| **Mercy** | Sparing people, rescue, avoiding needless killing | Burning homes, killing the surrendered or people who bore no weapon, cruelty to captives (not their capture), cruelty by allies |
| **Glory** | Bold attacks, holding ground, famous deeds | Retreat, paying tribute, hiding the sail, refusing a challenge, settling a killing with silver ("carrying your kin in your purse") |
| **Kin** | Protecting the household, bringing everyone home | Risking residents for strangers or loot; stealing from the household's own stores |
| **Faith** | Respect for what that person holds sacred | Desecration of it; mockery; the dead left without rites |
| **Word** | Keeping promises and oaths, honest dealing | Broken agreements, lies, betrayal of guests or hosts, a killing kept hidden |

Values say what a person cares about. Traits say how they behave (section 17). Their culture's code, and their **stance** towards it, say how they judge a deed and how they justify themselves (section 16). A witnessed deed is weighed first by the witness's culture (Book 6 section 01), then by their values, traits and stance. Everyone, the household included, judges by the ethics of their own people around AD 900, and speaks of right and wrong as honour and shame, luck, oaths, kin and vengeance, hospitality, blood-price, sin and penance, and what the gods or saints will do; never in modern terms (Book 8 section 16).

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
Witnessed deeds move a resident's friendship and fear, as their culture, values, traits and stance read them; daily life moves their happiness, and their likes and dislikes (section 17) move it too. Friendship moves through visible bands: **devoted, loyal, content, uneasy, resentful, estranged** (Book 10 section 08, "Friendship bands"). Each step down in friendship, or happiness that stays low, appears first as a remark, then a complaint at the fire, then refusal of a specific kind of order ("I will not burn a church"), then a request to leave. Fear shows in its own way: people go quiet when the steerer comes near, work without care, and flinch at a raised voice. A resident who is afraid and not a friend shows that they may desert or betray before they do it: whispered talk a friend reports, provisions put by, a look towards the boat. Each step up appears as praise, offers of help and, at the top, personal favours and loyalty in a crisis. No resident leaves, deserts or betrays without warning, and no hidden threshold fires silently. Book 8 section 11 holds how each step is spoken.

### Living at home
Every resident follows a daily schedule shaped by job, season, weather and wounds, so the player always finds them doing something: mending nets, arguing over the forge, nursing a hand, teaching a song. Talking to them opens topics drawn from their memories: the last raid, a death, a wound, the weather, their worries and their ties. Some residents seek the player out when something matters to them, with a request (section 11) or a grievance against someone else (section 10). Every resident also has a **tendency**, a small daily habit that makes them readable (one prays at dawn, one walks the shore at night, one hoards stones, one sings at the oars; section 17). Every resident has one **signature colour** from the Book 7 palette and one **silhouette detail** that picks them out at a glance; those chosen so far (Hild, Bran, Runa and Áine) are in their entries, and the rest are still to be chosen. Most people have one of the two ordinary builds; a few have the **heavy build** of Book 7 section 07 (broad shoulders, a thick torso and limbs, big hands; men and women both). Among the residents, Bran, Kolbeinn and Tófi One-Eye are heavy (proposal); among enemies, Kolgrím the Burner, some of Orm's grey-cloaks, Fiachra's champion and the berserkers (proposal); and about one in six generated people, farmers and smiths as well as fighters (proposal; Book 10 section 24, "Heavy build"). It is occasional, never the norm, and the steerer keeps the two existing models. Heavy residents carry loads and downed allies faster but tire sooner when running. Book 8 holds how they speak.

### Brutality and the crew
A few residents relish brutality (Kári, and Ulf's sort of raider), and call it the fear that spreads a name. Most are shaken by the killing of farmers and other people who bore no weapon, or of people who had surrendered, and say so in the terms of their own code: there was no glory in it, it brings bad luck, the dead have kin who will come, it shamed the crew, it was a sin, or an honour-price is owed (section 16). Taking captives in a fight is ordinary to most Norse residents: the Mercy-minded object to cruelty towards captives, not to their capture. Theft from the household's own stores is judged more harshly than open plunder abroad, because it robs one's own; secret theft from kin is the deepest Norse shame (Book 6 section 01). The steerer can order or commit such killings. Brutality raises the fear of everyone who sees it, and moves their friendship by their values: the crew's reactions follow Book 10 section 08 ("Friendship deltas by deed" and "Fear deltas") and never stay hidden.

### Change through experience
Values can shift by one point after strong shared events. A Glory-minded warrior saved by a merciful bargain may gain Mercy. A Mercy-minded healer who watches the merciful choice get a friend killed may lose it. Shifts are rare (no more than two per resident per campaign) and always shown with a scene. A stance (section 16) can shift after strong events in the same way, and is shown the same way.

### Ties and memory
A **tie** links two people: kin, spouse, friend, rival, grudge, debt, grievance, oath, mentor or drinking companion. Ties between residents form and break through shared events (section 17). Spouses and partners exist only where this book says so; there is no romance system and none are created in play. Ties carry a strength and a history. Each person keeps a short **memory list** of significant events they witnessed or were told, with the source. Memories drive dialogue and reactions; they are not deleted when they become inconvenient.

### Roster rules
- Sixteen permanent residents maximum, excluding the player.
- Hostages are held as guests outside the roster but cost food and a guard.
- Captives are never currency, and there is no slave market to sell them in. People may speak of thralls and of selling captives as ordinary (section 16); the systems never make it so.
- Hired oarsmen and allied warriors are temporary and do not count.
- Refugees can shelter temporarily with a visible food cost and a resolution plan.
- Any adult can learn any job. Origin and belief grant no stat bonuses.

## 02 / The household
*Thorkel Ketilsson's people, fled from Hvitness after Orm burned it. They wreck on Skarvholm with their chief drowned and the player suddenly in charge.*

### The player: the steerer
Thorkel's sister's child, raised in his household and trusted with his steering oar. The player names the steerer and chooses one of two body models. The game never states the steerer's gender, and no line uses a gendered word for them; people say the name, "Steerer" or "you" (Book 8). The steerer has no fixed values and no stance; the crew judges them by deeds, by the household's Norse code, and the player can act against that code (section 16). The steerer's dialogue choices are period voices, each with a period reason (Book 8 section 16). A madder-red accent (a sash, a cloak lining or a pin) picks the steerer out against sand and grass. On any expedition on foot, up to two companions can walk with the steerer (section 12). Stable ID: `P_STEERER`.

### Starting crew (Chapter 1)
#### Hild Thorkelsdóttir (`C_HILD`)
Fisher and sailor, Thorkel's daughter and the player's cousin. The first person rescued, calling from beyond the rocks. **Values:** Kin 3, Glory 2. **Stance:** conventional (proposal). **Skills:** sailing, fishing, spear. **Behaviour:** first to help, makes jokes when things are worst, will not stop looking for her father's body. **Arc:** her grief can harden into a demand for vengeance on Orm, or turn into fierce protection of the household. If Thorkel walks as a draugr, she is the one who can speak to him. **Wants from the player:** her father's rites; a place in the bow on the first raid. **Looks:** signature colour woad blue; silhouette detail her long braid. **Personal quest (proposal):** vengeance on the captain who burned Hvitness. It is Kolgrím the Burner, who later commands Orm's garrison on Skarvholm; her chance may come at the hólmganga in the Return (Book 6 section 10, approach E), or she may be talked into letting it go.

#### Oddi Gunnarsson (`C_ODDI`)
A wiry young deckhand, son of a poor freedman. Found injured near the wreck. **Values:** Gain 3, Kin 1. **Stance:** transgressive (proposal): he steals from his own, the deepest Norse shame, and knows it. **Trait:** Light-fingered. **Skills:** climbing, stealth, rope work. **Behaviour:** has already stolen food from the shared supplies; it is found in his bedding on the second night. **Arc:** treated fairly (shared shame, then responsibility) he becomes the household's best scout and scrounger. Shamed or beaten, he leaves at Saltvik and later sells what he knows to Ulf. **Secret:** he owes Ulf's men a debt from a dice game before the voyage. **Personal quest (proposal):** clearing his debt to Ulf's men without becoming their spy.

#### Bran Gilla Brigte (`C_BRAN`)
Norse-Gaelic former raider in his forties, ten years in Thorkel's household. Found in a sheepfold by the Hollow Cairn, guarding Thorkel's body from wreck-scavengers; he refuses to leave his chief. **Values:** Mercy 3, Word 2. **Stance:** between two codes (proposal): a Christian conscience inside a raider's past; he tries to keep both and keeps failing. Of mixed birth, he judges and is judged by either code. **Build:** heavy (proposal). **Skills:** axe and shield, Irish speech, cooking. **Behaviour:** hates needless killing, says grace in two languages, fights well and takes no pleasure in it. **Arc:** fifteen years ago he raided Kilbrecc; Sister Muirenn recorded his face. At Kilbrecc he can be recognised. Confession and penance make him a mediator with the Gaelic coast; concealment, if discovered, damages trust on both sides. **Looks:** signature colour bleached linen (proposal); silhouette detail the ladle at his belt. **Personal quest (proposal):** penance at Kilbrecc, and a meeting with a monk who lost a brother in Bran's raid. **Bran's reckoning (proposal; section 19):** the monk's family demand Bran's life as blood-price. He can go to his death, be exiled, or be defended at the cost of the Kilbrecc alliance.

#### Runa Ásdísardóttir (`C_RUNA`)
Boatwright in her thirties, found injured at the Hag's Seat after following a strange light. Insists on carrying her tool chest before anything else. **Values:** Word 2, Faith 2 (the old gods and the Cailleach), Kin 1. **Stance:** conventional (proposal): proudly superstitious; keeps every rite and judges those who don't. **Skills:** carpentry, ship repair, pilotage. **Behaviour:** blunt, practical, superstitious about the sea and proud of it. **Arc:** becomes the household's shipwright. Her sister Asa and Asa's husband Kolbeinn, a smith, are in debt to Ottar Silkbeard in Saltvik; Runa wants them out. She has a professional rivalry with Gunnhild Sea-Mare. Some quests need her as a companion: only Runa can judge a famous mast timber (section 12). **Looks:** signature colour ochre (proposal); silhouette detail the adze over her shoulder. **Personal quest (proposal):** getting Asa and Kolbeinn clear of Ottar's debt-books, which hide something; Hrefna, Ottar's steward, keeps those books (section 04).

### Later residents
#### Eithne ingen Domnaill (`C_EITHNE`)
A Gaelic widow from Ardcarn, about thirty. At Carrick Landing she asks to leave with the raiders: her late husband's kin plan to marry her off to settle a debt. **Values:** Word 3, Mercy 2, Kin 1. **Stance:** transgressive (proposal): she defied her husband's kin and their marriage plan, and holds herself to her word all the harder for it. **Skills:** stewardship, accounts, herding. **Arc:** becomes the steward. Ardcarn may call her abducted or a runaway, depending on what witnesses saw. She can carry messages to Ardcarn or be demanded back as part of a settlement. Christian; will want a cross at the steading. **Personal quest (proposal):** freeing her late husband's land at Ardcarn from a debt she suspects was forged.

#### Nessa of Inis Rón (`C_NESSA`)
Healer and net-maker, late twenties, seal-kin of Inis Rón. Arrives through the fog-light event in Chapter 3. See section 03.

#### Old Gudrun and the Followers (Chapter 3)
Six of Thorkel's household who escaped Hvitness in a second boat and find Skarvholm by the smoke. They double the mouths to feed.
| Resident | Role | Notes |
|---|---|---|
| Gudrun (`C_GUDRUN`) | Matriarch, story-keeper | Thorkel's aunt. Kin 3, Word 2. Stance conventional (proposal): keeper of the rites, the household's conscience by its own code. Opposes reckless raiding; insists on rites; remembers the old compacts in fragments. **Rán's debt (proposal; section 19):** when Thorkel's debt comes due, she offers herself to the sea. |
| Arnbjörn (`C_ARNBJORN`) | Herder | Gudrun's son. Cautious, kind, a poor fighter. Kin 2, Mercy 1. Candidate for a marriage tie with Glen Arra. |
| Kári (`C_KARI`) | Rower, fighter | Twin of Kolla. Glory 3. Stance conventional, to the hilt (proposal): lives the drengr ideal; despises stealth raids and blood-price. Wants fame, will follow Ulf if the household seems timid. May go berserk (proposal), and can die charging alone (section 19). |
| Kolla (`C_KOLLA`) | Rower, fisher | Twin of Kári. Kin 2, Gain 2. Holds her brother back, mostly. |
| Tófi One-Eye (`C_TOFI`) | Old warrior, trainer | Ylva's husband of forty years. Glory 2, Word 2. Stance sceptical (proposal): he has seen what glory costs. Heavy build (proposal). Teaches combat; tells the ugly truth about past raids nobody wants to hear. |
| Ylva (`C_YLVA`) | Dependant | Gudrun's elderly sister and Tófi's wife. Cannot work; needs care and warmth. Sees fetches. **Secret (proposal), her last fetch:** her sightings prove true whenever the warning is ignored. Then she sees the steerer's. |

#### Kolbeinn the Smith (`C_KOLBEINN`)
A Saltvik smith, married to Runa's sister Asa; both are in debt to Ottar Silkbeard. Joins if the player pays the debt, wins it at dice, or frees him from Ulf's men who are collecting it. Asa (`C_ASA`), a weaver who keeps accounts, comes with him if her own debt is settled too. **Values:** Gain 2, Glory 2 (pride in craft). **Build:** heavy (proposal). Turns iron into tools, axe-heads and ship fittings. Grumbles about the forge until it is built properly.

#### Thrand Halfhand (`C_THRAND`)
A veteran who deserted Orm after Heid ordered a captured crew thrown to Rán. Arrives in Chapter 4 as a castaway clinging to a spar. **Values:** Word 3, Mercy 1, Glory 2. **Stance:** transgressive (proposal): he broke his oath to Orm for conscience, and calls it the one right thing he has done. Knows Orm's tactics, ships and signals. Orm demands him back as a hostage. Keeping him is an act of defiance; giving him up is remembered by everyone. **Personal quest (proposal):** proving what Heid did, to Asgrim and to Orm's own crews. **Thrand's proof (proposal; section 19):** Thrand challenges Asgrim to prove Heid's crimes. Without the evidence, he dies in the duel.

#### Áine of Glen Arra (`C_AINE`)
A herder and archer. Joins if the player protects Glen Arra from Ulf or returns its stolen cattle. **Values:** Kin 2, Glory 2. **Stance:** conventional (proposal). Gaelic-speaking, Norse-named father: of mixed birth, she judges and is judged by either code. The best shot on the coast and the first to say so. **Looks:** signature colour weld-green (proposal); silhouette detail her bow. **Personal quest (proposal):** the man who killed her father lives in Saltvik. He is now a gentle father of three, and the killing was ordered by Gilla Muire himself. It is a revenge quest (section 11) with every other way out open.

#### Brother Senán (`C_SENAN`)
A monk of Kilbrecc of Norse-Gaelic birth who speaks both languages. Joins only if Kilbrecc is spared and the abbot agrees, as scribe, healer and mediator. **Values:** Faith 3 (Christ and the saints), Mercy 2, Word 2. **Stance:** conventional, uneasy (proposal): devout, and troubled by the abbey's bondmen and hired swords. Of mixed birth, he judges and is judged by either code. Can also remain at Kilbrecc as a contact. Some quests need him as a companion: only Senán can read a carved stone (section 12). **Secret (proposal):** Senán finds that the Bell's peace was bought with an old bargain, and that Abbot Colmán knows. Whether it was a saint's prayer or a bargain stays ambiguous.

### Hostages and guests
**Donnchad mac Muiredaig** (`H_DONNCHAD`), Muiredach's adult son, can be taken as a hostage at Carrick or arrive later as an envoy. He is Órlaith's foster-brother. Held well, he can become a friend; returned freely, he is a major peace lever with Ardcarn and Dún Fiach. **Secret (proposal), the hostage who will not go home:** Donnchad does not want to return, because of what waits for him at Ardcarn. Sending him home is still the peace lever, and now it has a cost to a person the household knows.

### Generated residents
Refugees and recruits outside the named cast use the same model. Generate varied adults across origin, appearance, build, skills and values; never let the opening depend on a rare roll. Each generated resident gets two to four traits (some hidden until discovered), a few likes and dislikes, and one tendency shown through behaviour (sings while rowing; hoards pretty stones; will not eat fish), all from section 17. About one in six generated people has the heavy build (proposal). Their motives are simple: food, safety, family, money, pride, fear, a grudge, a debt. Generated people are conventional by their culture's code unless a trait or event says otherwise.

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

### Her code
Nessa's hidden stance (Watcher, Bound or Runaway) is a different thing from the stance towards one's own code in section 16, and her subtitle name and conversation never give the hidden one away (Book 8 section 10). Her stance towards the Keepers' code follows the hidden one and shows only after the reveal (proposal): as Watcher she is conventional; as Bound or Runaway she is transgressive, the Bound one dealing with Heid against her own people for her brother, the Runaway one fleeing the binding her people hold to be lawful.

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
- **Colmán** will mediate the final council if Kilbrecc is spared or compensated. Stance cynical (proposal): he guards his community by any bargain and calls it God's will. The Church's cruelty is his to carry (section 15): the bondmen who work Kilbrecc's tithe farms and cannot leave, floggings for penance, hired swords when prayer fails, and **the abbot's curse**, a fast and a malediction against a household, after the Gaelic custom of fasting against an enemy. **Muirenn's** annals are the human face of the deed ledger: at the council she reads out what the household did, accurately. Stance sceptical of the powerful (proposal): she records the Church's own sins as faithfully as the heathens'.
- **Muiredach** is a plain farmer with a guesthouse, and a kind believer: his hospitality is a Christian duty and a briugu's honour at once. His storehouse at Carrick is the first raid. He can forgive almost anything except his people starving, and will trade almost anything for his son.
- **Ottar** will sell to anyone and is privately considering submitting to Orm. Stance cynical (proposal): he uses any code's words to close a deal. Saltvik judges mainly by the bargain: a fair weight and a paid debt are honoured, cheating at the scale is the great shame, and killing is bad for trade more than it is wrong (Book 6 section 01). **Gunnhild** respects skill and contracts above blood or belief.
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
Captain at Crowwick with about twenty-five hungry raiders and a black sail marked with a raven. Can arrive at Carrick as the rival-crew complication. **Motives:** plunder, fame, contempt for "farmers". **Behaviour:** kills when it is quicker than talking; keeps a bargain while it pays. One of the few enemies who finish off the downed, always with a visible warning first (proposal; section 19). **Possible paths:** an ally who leads the van in the finale if given plunder rights and respect; an enemy who sells the household's plans to Orm; or a defeated rival whose camp at Crowwick is broken. Crowwick can only be taken by assault (Book 6 section 12). He sees the move ashore as betrayal of the raiding life.

#### Gunnhild Sea-Mare (`L_GUNNHILD`, listed once as a leader)
Saltvik's best shipwright and a trader-raider in her own right. Competes for salvage and cargo; honours contracts exactly. Ally path: ships and repairs for the finale. Rival path: undercuts the household's trade and buys its enemies' debts.

#### Asgrim Cold-Hand (`R_ASGRIM`)
Orm's tribute-collector with three ships. Disciplined, cold, never cruel for sport. Arrives in Chapter 4 with Orm's demand. **Secret:** his brother was one of the crew Heid gave to Rán. Evidence of the bargain's true price can turn him: a defected Asgrim brings ships and Orm's signals to the alliance.

#### Fergal mac Cathail (`R_FERGAL`)
Dún Fiach's ship-captain, who lost a brother to a Norse raid. Leads retaliation in Chapter 5 if the household has shamed Fiachra. Honourable: accepts surrender, keeps truces, respects a fair fight. Compensation and a shared victory can make him an ally. Seeks Órlaith's hand as a political match. Fiachra's champion, who fights at his side, has the heavy build (proposal).

#### Gilla Ciaráin (`R_GILLACIARAIN`)
A Norse-Gaelic sellsword with one fast ship and no loyalties. Can be hired by Ardcarn or Kilbrecc to strike back, or by the player. Breaks contracts only when the other side breaks first.

## 06 / The enemy
*Orm is the external threat, but his offer is real. That is what makes him dangerous.*

#### Orm Sveinsson, Sea King of Kaldness (`E_ORM`)
About forty-five. Survived a wreck no one else survived and came out of it certain he was meant to rule the sea. He believes he is building order: one king, one tribute, safe water for everyone who pays. His fleet of six to ten ships never seems to meet a storm. **What he offers:** protection for tribute, a tenth of plunder and a hostage. **How he escalates:** demands grow until he asks for something the household cannot give, a drowning for Rán. **Ways to end him:** killed in battle, captured and held, exiled after his bargain breaks, or bargained with if he is beaten and Heid has broken her staff. **Stance:** cynical (proposal): he rules through Rán and Heid, and trusts his own luck more than the gods. He drowns hostages whose families failed to pay, and calls it the law of the sea (section 15).

#### Heid the Grey (`E_HEID`)
Orm's seeress, a völva who works seiðr with staff and song. Her twin sons drowned; in the sea-light she can see them in Rán's hall, and serving the bargain lets her keep watching. Her grief explains her choices without excusing them. **Stance:** conventional, to the extreme (proposal): she believes every cruel rite is owed and never doubts. She gives captured crews to Rán (section 15). **She can be turned:** freeing Breccán's crew with the Bell shows her that the drowned can be released; renewing Manannán's compact offers her sons a way out. Persuaded, she breaks her staff herself. Long ago she came to Inis Rón to learn, and Brónach turned her away.

#### Kolgrím the Burner (`E_KOLGRIM`)
Orm's harbour-taker and the commander of the garrison on Skarvholm in the late game. Coarse, proud, fond of fire and of an audience. Heavy build (proposal). One of the few enemies who finish off the downed, always with a visible warning first (proposal; section 19). He will accept a public challenge to a hólmganga because refusing would shame him in front of his men. Killed in fair combat, his garrison loses heart; killed by stealth, they fight to the end.

#### Gróa (`E_GROA`)
Heid's apprentice, young, devout and frightened, sent to dig the Cup out of the Hollow Cairn. She has already lost diggers to the cairn and the sea. She believes the Door can be forced with enough blood. She can be fought, captured, or persuaded to stop, and if spared she knows things about Heid that matter in the finale. She is the frightened believer beside Heid's certainty: a cruel rite seen through someone who half doubts it.

#### Kaldness
Orm's hall on a northern isle. His crews are exiles, adventurers, conscripted hostages and men who saw what happens to those who refuse. Not all are loyal; defections are possible when the weather turns against him. Some of his grey-cloaks have the heavy build (proposal).

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
| Ulf and Gilla Muire | Raider, and the chief whose cattle he lifts | The household's choice of side |
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
Once ten or more residents live at the steading, a dispute arises about every five to eight days (Book 10 section 08, "Disputes"). Unhappy households quarrel more (section 01), and disputes can boil over while the steerer is away: the steward holds them for judgement on return, or, if they wait too long, the parties settle them their own way. Each dispute has two parties, named residents with a reason drawn from their values, traits, ties and memories, and the residents who saw it. Hot-tempered, Greedy, Drinker and Grudge-holder residents start more of them; a Gentle resident nearby calms them (section 17).

### Kinds of dispute
| Kind | Typical case |
|---|---|
| Theft | Food or a keepsake missing; Oddi's stolen food on the second night is the first. Stealing from one's own is judged far more harshly than plunder abroad |
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

The one who asked judges the outcome by their culture and values: Kin and Glory want blood, Word accepts a lawful price, and Mercy is content with exile or the truth. A Gael holds a blood-price proper and expected; a Glory-minded Norse calls it carrying your kin in your purse (Book 6 section 01). A price paid or taken writes `BLOOD_PRICE_PAID` or `BLOOD_PRICE_TAKEN` (proposal; Book 6 section 01), and a challenge to a duel that is turned down writes `CHALLENGE_REFUSED` (proposal). Taking another way out can still cost their friendship, and the cost is spoken, not hidden.

### Personal quest seeds (proposal)
Seven residents carry a personal quest in their entry in section 02: Hild, Oddi, Bran, Runa, Eithne, Thrand and Áine.

## 12 / Companions on foot
*Up to two companions go with the steerer on any expedition on foot: they comment, help, fight and react through their traits.*

- **Who can come.** Any resident fit to walk, or a friendly character who has agreed to come, up to two at a time, on any expedition on foot: a raid's landing party, a crossing of a wilderness route (Book 4 section 03), a site or a dungeon. Ylva, the wounded and the sick stay home. A resident away with the steerer does not work at home, which the home's report shows.
- **They talk.** Companions comment on places, people, the weather and what the steerer does (Book 8 section 14). Two companions talk to each other, and they disagree: Bran and Kári will not see a burned farm the same way.
- **They help.** Each brings their skills, with puzzles and hazards as well as in a fight: Áine hunts and watches the high ground, Bran cooks at camp, Runa reads timber and stone, Oddi climbs and scouts, Eithne knows Ardcarn's people. A Keen-eyed companion spots an ambush's signs sooner. A companion on watch makes a camp safer (Book 10 section 15).
- **Some quests need one.** A few optional quests can only be done with a particular companion: Runa to judge a famous mast timber, Senán to read a carved stone (Book 6 section 13). The quest says so before it starts.
- **They fight.** Companions follow the same orders as the crew in a raid, and their traits show: a Brave one holds longer, a Cowardly one may break, a Berserk one may stop taking orders. A companion brought down is **downed, not dead**: there is no bleed-out timer, and carried to the boat, the village, a safe camp or a waystation before the scene ends they survive; left behind they are captured or killed, according to the enemy (section 19). The steerer's death is game over; a companion's death is a death in the household.
- **They witness.** A companion sees every deed done in their company and judges it by their culture's code and their values, as at home. Time on the road together builds friendship.
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

## 15 / The cruelty of every tradition
*Every tradition is shown with its cruelty as well as its comfort, even-handedly, through what its believers do. No tradition is the good one.*

| Tradition | Cruelty shown in play | Who carries it | Kind, doubtful or ashamed believers |
|---|---|---|---|
| Norse belief | Thralls killed to follow a chieftain into death; captured crews given to Rán; blood-oaths that bind sons to their fathers' feuds; hostages drowned when their families fail to pay | Heid, who gives captured crews to Rán; Orm, who drowns hostages whose families failed to pay; Kolgrím's fires | Thrand, who deserted over Heid's rite; Tófi, who tells the ugly truth about old raids; Gróa, frightened at the cairn; Gudrun, who keeps the rites and restrains the raiding |
| The Church at Kilbrecc | Bondmen who work the tithe farms and cannot leave; public floggings for penance; the abbot's curse, a fast and a malediction against a household (the Gaelic custom of fasting against an enemy); hired swords when prayer fails; shrines of the older faith smashed | Abbot Colmán; the hired swords he and Ardcarn can pay (Gilla Ciaráin) | Brother Senán, uneasy about the bondmen and the swords; Sister Muirenn, who records the Church's own sins; Ninnid, who worries for the poor of the tenant farms; Muiredach and Bran, whose faith is mostly kindness |
| Gaelic custom | Satire that can ruin a person; the blood-price that lets the rich kill the poor; hostages starved when treaties break; geasa that doom people to impossible choices | The poet (section 13); Fiachra, whose honour-price is a king's; Eithne's late husband's kin, who would marry her off to settle a debt | Órlaith, who wants fewer feuds; Muiredach the hospitaller; Dubhthach, who feeds even Fiachra's riders |
| The Keepers and the old powers | Seal-kin women bound by whoever holds their skin; the sick left on a skerry for the sea to judge; the Bog King's drowned offerings in the peat | The Keepers' law, which Brónach upholds; the Bog King (Book 6 section 13) | Nessa, who in every stance speaks of the skerry with grief, and who as the Runaway fled a binding (proposal) |

### Rules
- **Shown, not glorified.** Cruelty is seen in what believers do and say, never celebrated by the game and never rewarded by a system for its own sake.
- **Always with believers who are kind, doubtful or ashamed.** Every tradition that shows its cruelty also shows the people of the same faith who flinch from it.
- **Even-handed.** No tradition is the true or the good one; each comforts and each harms.
- **Hard limits remain.** No children as actors, no sexual violence and no player torture. A seal-kin binding is shown as a hold over where she lives and whom she must serve; nothing sexual is shown or implied. Thralls killed at a chieftain's burial and floggings for penance are told or seen at a distance in others' hands, never a player action.
- Book 8 section 16 holds how each tradition's cruelty is voiced.

## 16 / Codes and stances
*Everyone judges by the code of their own culture around AD 900, the household included. Each major character holds a stance towards that code.*

### The codes
| People | How they speak of right and wrong |
|---|---|
| The Norse (the household, Orm, Ulf) | Honour and shame, luck, a good name, oaths, kin and vengeance, what the gods will do |
| The Gaels (Dún Fiach, Ardcarn, Glen Arra) | Honour-price by rank, éraic, hospitality and the briugu's duty, sureties, satire and geasa |
| The Church (Kilbrecc) | Sin and penance, sanctuary, the saints' anger and favour, martyrdom |
| The Keepers (Inis Rón) | Give and take with the sea, oaths above all, what happens on their shore |
| Saltvik | The bargain: a fair weight and a paid debt are honoured, cheating at the scale is the great shame, and killing is bad for trade more than it is wrong |

People of mixed birth (Bran, Senán, Áine, Gilla Ciaráin and much of Saltvik) carry both codes, and judge and are judged by either. Book 6 section 01 holds how each people reads each deed, and Book 10 section 08 ("Deed reactions by culture") its weights.

**Compassion is real, and speaks in period terms.** A Mercy-minded Norse rower does not say a killing was wrong because the man was innocent. She says there was no need of it, that it brings bad luck, that his kin will come, that it shamed the crew. A monk calls it a sin. A Gael says his honour-price must be paid.

### Stances
A person's **stance** towards their own culture's code shapes how they justify themselves and what they say aloud. Values say what they care about; traits say how they behave. A stance can shift after strong events, as values do (section 01; Book 10 section 08, "Stances"). This is a different thing from Nessa's hidden stance (section 03).
| Stance | Meaning |
|---|---|
| **Conventional** | Most people: keeps the code and judges by it |
| **Sceptical** | Doubts the gods, the saints or the code's worth, but mostly keeps it |
| **Cynical** | Uses the code's words for gain |
| **Transgressive** | Openly breaks a central rule of the code, and knows it |

### Who holds which stance (proposal)
| Character | Stance | How it shows |
|---|---|---|
| Gudrun | Conventional | Keeper of the rites; the household's conscience by its own code |
| Runa | Conventional | Proudly superstitious; keeps every rite and judges those who don't |
| Kári | Conventional, to the hilt | Lives the drengr ideal; despises stealth raids and blood-price |
| Tófi One-Eye | Sceptical | Has seen what glory costs; tells the ugly truth about old raids |
| Bran | Between two codes | A Christian conscience inside a raider's past; tries to keep both and keeps failing |
| Oddi | Transgressive | Steals from his own, the deepest Norse shame, and knows it |
| Eithne | Transgressive | Defied her husband's kin and their marriage plan; holds herself to her word all the harder |
| Thrand | Transgressive | Broke his oath to Orm for conscience; calls it the one right thing he has done |
| Brother Senán | Conventional, uneasy | Devout; troubled by the abbey's bondmen and hired swords |
| Sister Muirenn | Sceptical of the powerful | Records the Church's own sins as faithfully as the heathens' |
| Abbot Colmán | Cynical | Guards his community by any bargain, and calls it God's will |
| Ottar Silkbeard | Cynical | Uses any code's words to close a deal |
| Orm | Cynical | Rules through Rán and Heid; trusts his own luck more than the gods |
| Heid | Conventional, to the extreme | Believes every cruel rite is owed; never doubts |
| Nessa | Follows her hidden stance | Conventional as the Watcher; transgressive as the Bound or the Runaway (section 03) |
| Every other major character | Conventional | Until a writer or an event gives cause otherwise |

### Period views are spoken; the hard limits hold in the systems
Characters may treat thralls, the slave market, arranged marriages, blood-feud and harsh penance as ordinary, and some will urge the steerer to take captives for sale. The game still has no slave-market loop, and captives are never currency (section 01). Period attitudes to women and men exist in the world (Eithne's marriage, Órlaith's), but no line applies them to the steerer or reveals the steerer's gender (Book 8 section 03).

### The household's code and the steerer
The household judges by the Norse code. The player can act against it, and the household reacts by that code: a merciful choice is praised as luck kept or a feud not started, not as kindness for its own sake; a cruel one is condemned as shame or bad luck, not as a crime against anyone's rights. The steerer's choices are period voices too (conventional, pragmatic, merciful, cruel, transgressive), each phrased with a period reason (Book 8 section 16).

## 17 / Traits, likes, relationships and tendencies
*Every resident and companion is a person with habits, tastes and friends, learned over time.*

### Traits
Every resident and companion has **two to four traits**. One or two show at once; the rest are discovered over time, through behaviour first and then on the household screen. Traits affect work, combat behaviour, reactions to deeds, disputes and conversation. Book 10 section 08 ("Traits") holds every number.
| Trait | Effect |
|---|---|
| Berserk | In combat, when wounded or when a friend falls, may go berserk: ignores orders, attacks the nearest enemy wildly (including those surrendering, and people who bore no weapon in reach), deals more damage, defends less. The deeds count against the household |
| Cowardly | Breaks first when cohesion falls; may flee a fight; hates night raids |
| Superstitious | Refuses tasks or voyages after bad omens; panics at supernatural signs; insists on rites |
| Brave | Holds the line longer; volunteers for danger |
| Greedy | Pockets loot; argues over shares |
| Pious (to a given faith) | Prays daily; reacts strongly to sacrilege and to its own faith's cruelty |
| Hot-tempered | Starts disputes; quick to fight |
| Gentle | Calms disputes; hates killing |
| Drinker | Drinks at feasts and in hard times; unreliable the morning after |
| Light-fingered | Steals small things from the stores (Oddi) |
| Keen-eyed | Spots things first at sea and on watch, and an ambush's signs sooner |
| Sea-sick | Worse at sea; better on land |
| Storyteller or singer | Raises happiness at the fire |
| Grudge-holder | Remembers every slight; feuds |
| Diligent or lazy | Works more or less without supervision |

### Likes and dislikes
Each person likes and dislikes particular foods (salt fish, honey, ale, kale), activities (fishing, carving, fighting), places, weather, people and gifts. Meeting a like raises happiness; ignoring one does not hurt, but meeting a dislike does. A gift that suits a like is the best gift (Book 10 section 08, "Likes and dislikes").

### Relationships between residents
Residents form and break ties with each other through shared events: friends, rivals, grudges, mentors, drinking companions, and family. A shared fight or a meal together draws two people closer; a dispute lost to the other drives them apart (Book 10 section 08, "Relationships"). There is no romance system: no romance tie forms in play, and existing marriages and family ties remain (section 08). Starting relationships beyond the family ties of section 08 (proposal):
| Residents | Relationship | Why |
|---|---|---|
| Tófi and Kári | Mentor | Tófi trains him, and tells him what glory costs |
| Bran and Kári | Rivals | They will not see a burned farm the same way |
| Bran and Oddi | Mentor | Bran gave him work instead of a beating once before |
| Hild and Oddi | Friends | Shipmates since the voyage south |
| Nessa and Ylva | Friends, from her first days | Ylva speaks to her about fetches as if they were ordinary |
| Eithne and Runa | Rivals | The cross or the stone by the well (section 10) |
| Tófi and Kolbeinn | Drinking companions, from his first feast | Two Drinkers and one fire |

### Tendencies
A tendency is a small daily behaviour that makes a person readable from across the steading: one prays at dawn, one wanders the shore at night, one hoards stones, one sings at the oars. It runs inside their schedule (section 01) and is not a job.

### The household screen
The household screen shows each person's known traits, likes and dislikes, relationships, happiness, friendship and fear, each with a line on why it is what it is ("Friendship: you brought her father's body home"; "Hidden traits: one still to learn"). It is interface text, so it may say things plainly that dialogue never would (Book 8 section 10); it never shows a trait that has not yet been discovered, or anyone's secret.

### The residents (proposal)
Every assignment below is a proposal except Oddi's Light-fingered trait, which is decided. Traits marked *hidden* are discovered in play.
| Resident | Traits | Likes | Dislikes | Tendency |
|---|---|---|---|---|
| Hild | Brave, Keen-eyed; *hidden:* Grudge-holder | Salt fish; fishing; the bow in a rising wind; jokes at the fire | Being told to rest; a flat calm; kale | Walks the shore at dusk, watching the water where her father drowned |
| Oddi | Light-fingered (found on the second night), Keen-eyed; *hidden:* Cowardly | Honey; dice; climbing; being trusted with a job | Being watched while he eats; rain; Ulf's men | Counts his share every evening, twice |
| Bran | Gentle, Pious (Christ and the saints, kept quietly); *hidden:* Diligent | Cooking for everyone; kale broth; Irish songs; a quiet morning | Boasting over kills; burned farms; the Kilbrecc road | Prays at dawn, in two languages |
| Runa | Superstitious, Diligent; *hidden:* Grudge-holder | Good oak; carving; a dry naust; rites kept | Green timber; whistling at sea; hands on her tool chest | Touches the stem-post and says a word to it before work |
| Eithne | Pious (Christ), Diligent; *hidden:* Grudge-holder | An honest tally; herding; kale; a cross by the well | Lies; waste; talk of marriage-brokers | Counts the stores aloud at dusk |
| Nessa | Gentle, Keen-eyed; *hidden:* Storyteller (old seal songs, once she trusts the household) | Fish; the sea in any weather; mending nets; Ylva's company | Seal meat; questions about where she came from; peat smoke | Swims at first light in water that would kill anyone else |
| Gudrun | Pious (the old gods), Storyteller; *hidden:* Grudge-holder | Rites kept; honey; the old stories; the family together at the fire | Reckless raiding; slack rites; being hurried | Pours a little ale on the ground for the land-spirits each evening |
| Arnbjörn | Gentle, Diligent; *hidden:* Cowardly | Cattle; mending fences; quiet; kale | Fighting; night raids; loud feasts | Checks every gate twice at dusk |
| Kári | Brave, Hot-tempered; *hidden:* Berserk | Fighting; ale; praise poems; a crowd to boast to | Stealth raids; blood-price; waiting | Practises with his axe at dawn where everyone can see |
| Kolla | Keen-eyed, Diligent; *hidden:* Singer | Fishing; salt fish; a fair share; a quiet sea | Kári's boasting; Ulf's men; waste | Sings at the oars |
| Tófi One-Eye | Brave, Storyteller; *hidden:* Drinker | Ylva's company; ale; teaching a fight; old songs | Glory-talk; boasting; the cold | Sharpens every blade in the house at the evening fire |
| Ylva | Superstitious, Gentle | Warmth; honey; Nessa's company; Tófi's stories | Cold; wind at the door; mockery of omens | Sits by the door at dusk and watches who passes |
| Kolbeinn | Hot-tempered, Diligent; *hidden:* Drinker | Good iron; ale; a proper forge; Asa's counting | A cold forge; debt; Ottar | Hums to the beat of the hammer |
| Asa | Diligent; *hidden:* Grudge-holder | A proper loom; honest accounts; Runa's visits | Ottar; waste; weaving on a door | Collects round shore stones for loom weights, far more than she needs |
| Thrand | Brave, Keen-eyed; *hidden:* Grudge-holder | Plain talk; salt fish; a sound watch | Heid's name; boasting; deep water at night | Walks the shore at night when he cannot sleep |
| Áine | Keen-eyed, Brave, Sea-sick; *hidden:* Grudge-holder | Hunting; the high ground; praise; honey | Ulf's Crows; being doubted; long voyages | Climbs to high ground every morning to look over the land |
| Brother Senán | Pious (Christ and the saints), Gentle; *hidden:* Diligent | Ink and vellum; quiet; honey; old carved stones | Burned books; cold hands; hired swords | Writes down the day's doings each night |

Kári's Berserk trait fits his drengr ideal and is the one most likely to kill him (section 19). Generated residents draw from the same lists (section 02).

## 18 / Who gets depth
*Major characters have branching conversation and reaction trees; minor characters have one or two lines.*

### Major characters
Leaders, antagonists, residents and quest characters are **major**: every named character in sections 02 to 06, and the four wandering characters of section 13 (proposal). Each has **branching conversation and reaction trees** that change with:
- time of day and season (a different greeting at dawn, at a winter fire, on a feast day);
- the household's deeds and reputation, read by their culture and values;
- their happiness, friendship and fear towards the steerer;
- quest and story state;
- recent events (a death, a raid, a storm).

### Minimum depth
Every major character has at least: greetings for each season and time of day; three topic trees; reactions to ten deed types; callbacks to remembered events from their memory list (section 01); and a change in voice when friendship or fear crosses a threshold (Book 10 section 23, "Conversation depth"). Book 8 section 17 holds how they are written, and content lint checks the minimum.

### Minor characters
Farmers, traders, guards, travellers and the people of a site have one or two lines, drawn from pools that vary by culture, season, time of day, weather and what the household has done (Book 8 section 17). Their motives are simple. They are not schemers or philosophers, and they do not explain the plot.

## 19 / Downed, captured and dead
*A downed ally is not dead. People die by being left behind, by berserkers and cruel enemies, and in scripted deaths, and every death matters.*

### Downed, not dead
- **No bleed-out timer.** A friendly character brought down is downed and stays downed until the scene ends. Downed allies generally survive if the steerer, or anyone, carries them back to the boat or the village before the scene ends; on a journey a safe camp or a waystation counts (Book 10 section 06, "Downed and carried"). They come home with a serious wound.
- **Carrying is slow** and leaves the carrier unable to fight. Heavy residents carry faster but tire sooner.
- **Enemies do not finish off the downed**, except berserkers and a few named cruel enemies (Ulf the Crow and Kolgrím the Burner, proposal), and those always give a visible warning first: a raised weapon, a shout.

### Left behind
A downed ally still lying on the field when the scene ends is captured or killed, according to the enemy: those who take captives (Norse raiders, Gaelic lords, Orm's men, the Church's hired swords) carry them off; outlaws in a hurry, wolves and the dead kill them. Captives can be rescued or ransomed later, and a captive resident's absence is felt at home. Leaving someone behind is a deed the household remembers (Book 10 section 08, "Resident left behind").

### Deaths
Crew permadeath comes mainly from being left behind, from berserkers and cruel enemies, and from **scripted deaths**. The *Rán's mercy* option still prevents unscripted deaths; scripted deaths still happen.

### Scripted deaths and death-choices (proposal)
| Death | Who it touches | What happens | Where |
|---|---|---|---|
| **Rán's debt** | Gudrun, and whoever the steerer chooses | Thorkel's debt to Rán comes due: someone must go into the sea. Gudrun offers herself; the steerer can accept, choose otherwise, or refuse and pay another way (the ship, the household's luck or a later life) | Book 4 section 12 (Thorkel's debt) |
| **The cairn door** | Whoever stays | In the Return, someone must hold the cairn door as the tide rises. Whoever stays dies, unless the party found the spring-room passage first | Book 6 section 10 |
| **Bran's reckoning** | Bran | A monk's family demands Bran's life as blood-price. Bran can go to his death, be exiled, or be defended at the cost of the alliance | Section 02; Book 6 section 17 |
| **Thrand's proof** | Thrand | Thrand challenges Asgrim to prove Heid's crimes. Without the evidence, he dies in the duel | Section 02; Book 6 section 17 |
| **The defence of Skarvholm** | Whoever leads the watch | On the night of the attack, the watch leader may die holding the landing, depending on preparation | Book 6 section 09 |
| **Berserk deaths** | Kári, or any Berserk resident | A berserker can die charging alone, through the trait | Section 17 |
| **The washer at the ford** | Whoever she names | Before the final battle she names who will die; changing orders can save them, at a cost elsewhere | Book 4 section 07 |

### Every death is consequential
Grief: happiness falls household-wide, hardest for the dead person's ties. Their skills and jobs are lost and must be learned again. Relationships change: a friend grieves, a rival is ashamed or relieved. There is a grave to tend and songs at the fire. Where the dead had unfinished business, a ghost or a fetch may come. Story branches the dead person carried close. Enemies mock the death, and allies honour it. No death is a silent change of numbers.
