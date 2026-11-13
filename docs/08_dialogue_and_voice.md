# Oar and Ember, Book 08: Dialogue and Voice Guide

*How every character and culture speaks, how Norse and Irish words appear in English, how the steerer is addressed, and how barks and conversations are written.*

Without a voice guide, LLM-written dialogue drifts into one polite, modern, explanatory voice. This book gives every person and culture a recognisable way of speaking, with sample lines to imitate and rules to check against.

**How to use:** Writers and the coding LLM read section 01 to 03 and section 16 before writing any line, then the section for the speaker. Sample lines are illustrative and original; they may be reused or rewritten. Section 10 is the checklist every string passes before it is committed.

_Writing specification. All lines are original to this project. No line quotes or adapts a copyrighted text; Old Norse and Old Irish words are used as vocabulary, not quotation._


## 01 / Principles
*Plain, physical English with the weight of the period. Short sentences. Things before ideas.*

- **Concrete before abstract.** Rope, salt, iron, blood, barley, the wind's direction. People talk about what is in front of them.
- **Short lines.** Most spoken lines are under 15 words. Long speeches belong to poets, priests and Heid.
- **Subtext over exposition.** Nobody explains the plot to someone who already knows it. Information arrives sideways, in arguments, jokes and complaints.
- **People reveal their values.** A Mercy-minded speaker notices the hurt; a Gain-minded one notices the price. Book 5 values should be audible.
- **Period ethics.** Everyone judges by the code of their own culture around AD 900, the household included. Right and wrong are spoken of as honour and shame, luck, oaths, kin and vengeance, hospitality, blood-price, sin and penance, and what the gods or saints will do; never in modern terms (section 16).
- **Ordinary people talk about ordinary things.** Most people's motives are simple: food, safety, family, money, pride, fear, a grudge, a debt. Minor characters are not schemers or philosophers.
- **Humour is dry and frequent.** Understatement, insult between friends, gallows jokes. The harder the moment, the drier the joke.
- **No modern register.** No therapy-speak, no management language, no "okay", no "guys", no winking at the player.
- **No mock-archaic either.** No "thee" and "thou", no "ye olde", no stage dialect, no phonetic accents.
- **Violence is spoken plainly.** People describe wounds and deaths without relish or euphemism. The crew does not cheer a slaughter, except those whose values say they would. Each tradition's cruelty is shown through its believers, never glorified, and always beside believers who are kind, doubtful or ashamed (section 16).

## 02 / Norse and Irish words in English
*The decided mix: names keep their native forms; dialogue is English; a small curated set of native words appears untranslated where English would lose something.*

### Names
Personal and place names keep their native spellings and accents: Hild Thorkelsdóttir, Áine, Brónach, Dún Fiach, Inis Rón. Patronymics are used in formal speech and introductions, never in quick barks. Nicknames do most of the work: Sea-Mare, Cold-Hand, Halfhand, the Crow.

### The glossary
Each word below may appear untranslated. Its meaning must be clear from context the first time it appears, and it has a tooltip. Never more than one glossary word in a line.
| Word | From | Meaning and use |
|---|---|---|
| jarl | Norse | A great lord. Used of others; the household has none |
| þing (thing) | Norse | An assembly. Written "thing" in dialogue |
| drengr | Norse | A bold, honourable fighter; praise among Norse |
| níð | Norse | Shaming insult, a curse of dishonour |
| skáld | Norse | A poet who makes praise and blame |
| völva | Norse | A seeress; said of Heid, never of Nessa |
| seiðr | Norse | The sorcery a völva works |
| draugr | Norse | The walking dead; plural draugar |
| landvættir | Norse | Land-spirits |
| skál | Norse | The toast at a feast |
| naust | Norse | A boatshed |
| rí | Irish | A king; Fiachra is a rí |
| tuath | Irish | A people and its territory |
| briugu | Irish | A hospitaller; Muiredach's office |
| file | Irish | A poet; feared for satire |
| éraic | Irish | Blood-price owed for a killing |
| geis | Irish | A sacred prohibition laid on a person |
| aos sí | Irish | The people of the mounds |
| sídh | Irish | A fairy mound |
| bean sí | Irish | The keening woman of a family |
| each-uisce | Irish and Scottish | The water-horse |
| a chara | Irish | Friend, in address |
| Gaill | Irish | Foreigners: what Gaels call the Norse |
| Pax vobiscum | Latin | Peace be with you: monks' greeting |
| Deo gratias | Latin | Thanks be to God |

### How the peoples name each other
Gaels call the household **Gaill** (foreigners) or "the men of the black ships" when hostile, and by the household's name once they know it. Norse call Gaels **Irish** or **Gaels**, and Saltvik people "half-and-halfs" when rude. Monks call raiders "the heathen" whether they are or not. The household calls Orm's men "grey-cloaks".

### Oaths, curses and blessings
Write specific oaths rooted in each culture rather than generic Viking shouting. Norse: "Rán take it", "by the hammer", "may your keel split", "Hel can have him". Gaelic: "God and Brigid keep you", "may the sea not have you", "my curse on your sail". Monks: "God forgive us", "Christ between us and harm". Use them sparingly, at moments that earn them.

## 03 / Addressing the steerer
*The game never states the steerer's gender. Every line obeys this, without exception.*

- People address the steerer by **name**, as **Steerer**, or as **you**. Formal speakers may say "the steerer of the household" or "Thorkel's kin".
- Never: he, she, him, her, his, hers, lad, lass, lord, lady, brother, sister, son, daughter, man, woman, sir, madam, king, queen, or any gendered term, about or to the steerer.
- When speaking about the steerer in the third person, use the name or "the steerer", or "they" if unavoidable.
- Neutral kinship terms are allowed: cousin and kin. Instead of nephew or niece, say "Thorkel's sister's child".
- Content lint (Book 2) flags any string tagged `ADDRESS_STEERER` or `ABOUT_STEERER` that contains a word from the banned list.
- **A gendered word for someone else** in a line addressed to the steerer (Hild's "He wore the key round his neck" of her father, or "her" of a boat) is allowed only when the string also carries `REFERS:<id>` naming whom the word means (`REFERS:c_thorkel`, `REFERS:ship`), and never in a string that names the steerer (`{steerer}`). Content lint then allows only the words that fit that referent; a reviewer reads every such line. Write round it where the line reads as well without (decision DE-31).
- Period attitudes to women and men exist in the world and may be spoken (Eithne's marriage, Órlaith's), but no line applies them to the steerer or reveals the steerer's gender (section 16).
- **The steerer's own words** (the user's fourth playtest, decisions DH-24 to DH-26): besides the spare shout (section 07), the steerer says a short word over a body when the player looks at it: Thorkel's first, a line each look in order ("Thorkel. You brought us this far. I'll take them the rest of the way." / "Cold as the sea that had you. Rest. We'll see you right." / "You'd laugh at the boat we're patching. Then you'd show us how."), the first with his key when it is taken from his body; and one line over each fallen foe, never the last one said twice running ("All this for a wreck's leavings." / "You should have walked on." / "Someone will wait for you, and wonder." / "The tide will have you before your friends do."). Shown under the steerer's name with a breath out and no blip (Book 11 section 08), tagged `ABOUT_STEERER` so the lint reads them, and written round any word that could tell the steerer's gender.

| Instead of | Write |
|---|---|
| "Well done, lad." | "Well done, Steerer." |
| "He's lost his nerve." | "The steerer's lost their nerve." or "{steerer}'s lost their nerve." |
| "My lord, the ships are ready." | "Steerer, the ships are ready." |
| "She'll lead us to ruin." | "This one will lead us to ruin." |

## 04 / Cultural voices
### The Norse household
Blunt, understated, fatalistic and proud. Talks about luck, reputation, kin and a good death. Uses proverb-like lines of the speaker's own making. Insults are a form of affection. Never gushes.
> "The sea gives. Then it asks."
> "Fair wind. Somebody's paying for it."
> "If I die tomorrow, I want it said I ate well tonight."

### The Gaelic communities
More rhetorical and elaborate, attentive to lineage, hospitality and law. Blessings and curses are serious. Grievance is precise: names, numbers, days. Satire is feared, so insults are careful and sharp.
> "You ate at my fire once. Remember that before you put a hand on my door."
> "Three sacks of seed and a man who will never walk again. That is what you owe."
> "God keep you on the road, and keep you off mine."

### Monks of Kilbrecc
Measured, ironic, literate. Latin tags in moments of feeling. They keep records and quote them. Their courage is quiet.
> "Brother Senán will write this down. He writes everything down. It is a terrible habit."
> "We have prayed for raiders before. Some of them even stopped."

### Norse-Gaelic traders
Quick, pragmatic, code-switching. Prices first, morals later. They tell you what everyone else thinks, for a fee.
> "Grain with Brigid's cross on the sack. Lovely. I'll take it at half and forget where I saw it."
> "Orm's sail was seen north of the Sound. I'd sell your iron now, while it's still yours."

### Orm's people
Formal, ordered, coldly courteous. They speak of law, tribute and order, never of greed. Threats are stated as facts.
> "The Sea King asks a tenth. Most men think it fair, once they have seen the alternative."

### The Keepers of Inis Rón
Old, unhurried, plain about strange things. Seal and tide images. They do not riddle for fun; when they are unclear it is because the truth is.
> "The sea keeps what it is given. You were not given. You were lent."

## 05 / The household's voices
**Hild on her father follows the facts** (the user's fourth playtest, decisions DH-20 to DH-22): before his body is found, "We've not found Father yet. Bran went after him, and Bran doesn't let go." and, on the shore, "Still looking, Father."; once Bran has brought him home she never says he was never found ("Bran carried him home. I keep waiting for him to sit up and shout at us."; on the shore, "Loud, he was. The shore's too quiet without him."), and her topics offer "Your father's rites", which opens the rites' choice wherever she is; after the rite, "Rán has him now. I hope the sea likes loud company." or "He's under the stones now, looking out to sea. Where he'd want to be."; if the scavengers took him from the fold, "They took him from the fold, the scavengers. He'll get no rites from us now." If the fold is settled before the first night's fire, its lines that still look for him are said as "Bran brought Father home. Bran never lets go of anything." and "Oddi was by the stern when she broke." **Runa's reminder** (DH-31): "My tool chest's still out on the headland. Bring it into the broch, would you?" / "Those tools are all I have. Into the broch with them, out of the wet." / "The chest. My tools. The broch. I'll not ask again."
| Speaker | Voice | Sample lines |
|---|---|---|
| Hild | Warm, quick, jokes when it is worst; grief breaks through in short sentences | "Up you get. The sea's not having you today." / "Father would have hated this boat. That's how I know it's sound." / "Don't. Not yet. I'll say when." |
| Oddi | Fast, defensive, cheeky, frightened underneath; talks money | "I found it. Finding isn't stealing." / "How much is a share? Exactly how much?" / "Next time, give me the job nobody wants. I'll do it." |
| Bran | Slow, gentle, two languages; says grace; refuses quietly and finally | "No. Not him. He's done." / "Eat first. Then decide who we are." / "I was at Kilbrecc once. I'd rather not say more on an empty stomach." |
| Runa | Blunt, technical, superstitious and proud of it; tools before people, sometimes | "My chest. Then me. Then argue." / "That plank will hold. I don't care what the sea thinks." / "Unship the head before we land. You want the land angry?" |
| Eithne | Precise, counting, Christian; quietly fierce about fairness | "Eleven days of food. Ten if Kári keeps eating like that." / "I will not lie for you. I will keep silent, which is not the same." |
| Nessa | Gentle, observant, oddly calm about the sea; deflects personal questions with questions | "The swell's changing. Can you feel it?" / "Why do you want to know where I came from?" / "Keep him warm tonight. The sea likes the cold ones." |
| Gudrun | The voice of the family's memory; tart, unafraid of the steerer | "Thorkel raided too. He also buried his dead properly." / "Feed them before you count them." |
| Arnbjörn | Mild, careful, kind; apologises too much | "Sorry. The cow got out. Sorry." / "I'm not much in a fight. I'm good with fences." |
| Kári | Loud, hungry for fame; admires boldness and a hard fight; brave; lives the drengr ideal, so he finds no glory in killing farmers and scorns stealth raids and blood-price as unworthy of a drengr | "They ran! Did you see them run?" / "Burn it. Let them see the smoke at Dún Fiach." / "Creeping about at night. That's thieves' work." |
| Kolla | Dry, protective of her twin, practical | "He's an idiot. He's my idiot. I'll handle it." |
| Tófi One-Eye | Hard old truth-teller; tender only with Ylva | "That's not glory. That's butchery with a good song." / "Eat, love. Eat a bit more." |
| Ylva | Frail, uncanny, matter-of-fact about omens | "Bran's other self was at the door again. Tell him to rest." |
| Kolbeinn | Grumbling craftsman, proud of his work, devoted to Asa | "This forge is a disgrace. Give me two days." / "Asa does the counting. I do the hitting." |
| Asa | Sharp with numbers, softer with Runa | "We owe Ottar forty. Not forty-one. I checked." |
| Thrand | Clipped, soldierly, haunted by what he saw | "Orm's men hold their line. Break the line, not the men." / "I watched her give them to the sea. I won't again." |
| Áine | Boastful, funny, deadly | "Name a crow. I'll put it down." / "You protect my cattle, I'll protect your neck. Fair?" |
| Senán | Gentle, bilingual, wryly devout | "Pax vobiscum. Mind the step. The heathen broke it in my grandfather's time." |

**Hild in the opening** (Book 4 section 08, beats 3 to 12; design addendum 2.4). Her lines carry the chapter's first aims, and she jokes when it is worst:

| Moment | Line |
|---|---|
| Calling from the net (her direction in an information caption) | `Hild: Here! Over here, past the rocks!` / `Hild: I'm caught in the net! The water's coming in!` / `Hild: Over here! I'd come to you, but the net has other ideas.` |
| Reached without a blade | `Hild: The net, I can't get out of it. Find something sharp! Father's seax was in the stern.` |
| As a wave breaks over her | `Hild: That one went up my nose.` |
| Cut free | `Hild: Oh, thank the gods. Thank you.` then `Hild: Next time, cut the net before the swim.` |
| Set down above the tide line | `Hild: That'll do. The sea's not having either of us today.` then, looking up the bank, `Hild: There's an old tower up on the bank, north of here. Go and see if it'll keep the wind off us.` (the user's third playtest, decision DG-13) |
| First sight of Thorkel's chest | `Hild: Father's chest. Get it up to the camp. He wore the key round his neck.` (`REFERS:c_thorkel`) |
| Arriving at the camp, after the first fire | `Hild: Get the sail up between those oars, before the rain comes.` then the first stage, `Hild: Oars first. Stand two up against the wall and lash them where they cross.` (decision DG-12) |
| The frame stands | `Hild: Now the sail over the top. Lash it down tight, and stones on the foot.` |
| By the old boat under the bank | `Hild: Father would've had her floating by the next tide.` (`REFERS:ship`) |
| The lean-to up (the first night) | `Hild: There. A roof. Of sorts.` then `Hild: We'll make it a proper one in the morning.` |
| The second morning, at the camp | `Hild: The lashings stretched in the wet. Help me tighten them, then we'll turf the weather side.` |
| The shelter finished | `Hild: Now that's a shelter. Father would've slept the night through under that.` |
| Giving the dusk aim | After `Hild: Someone's down at the stern. Hear that? Iron on wood.`, the cue for the sneak hint (Book 10 section 21, sneakHint): `Hild: Keep low in the dune grass. See them before they see you.` (decision DG-25) |
| Thorkel taken by the sea | As the ring of foam fades (Book 10 section 08, seaAfter), to her father: `Hild: Gone. Rán has you now, Father. Be kind to her.` (decision DG-14) |
| The first night's fire, ending | `Hild: Oddi was by the stern when she broke. Bran went after Father.` (`REFERS:ship`) then `Hild: And Runa will have gone after that light. Of course she has.` |
| The chest opened | `Hild: That's his bow. He'd want it drawn, not mourned.` (`REFERS:c_thorkel`) |
| The stores on the mast | `Hild: That's our salt fish up the mast. An arrow through the rope would bring it down.` |

**Runa's tool chest** (Book 4 section 08, beat 13; decision DE-21). Once the chest has been set down somewhere safe, the next talk with Runa opens on it: `Runa: My chest. Where have you put it?` The steerer's answers name a place: "By the fire." / "In the shelter." / "By the boat." Told the truth: `Runa: Good. Off the wet ground, I hope.` Told a lie, she finds it out when she goes to look: `Runa: It's not where you said. Why say it, then?`, and it counts against Word.

**What the household lacks, in their own voices** (the user's request "give the player a reason to make the first raid"; decisions DH-130 to DH-159; Book 4 section 08, "Needs before aims"; Book 5 section 02). From day 1 the four speak, now and then, of iron, grain, cloth and salt, each tied to what they are doing (content/raid.json). They are barks under section 08's rules, with Book 10's own spacing on top (needLineGap, needLinesPerDay), and talk topics while the need is felt (section 09). Bran's line is spoken at the evening fire, where he works the notches out of his axe with Thorkel's whetstone in hand; no sharpening loop is drawn yet (decision DH-133, flagged).

| Speaker | Doing | Line |
|---|---|---|
| Runa | At work | `Runa: Nine nails. Nine. I've counted them twice.` / `Runa: The sail's chafed through at the lashing. Nothing to patch it with.` |
| Runa | Asked to make the hull patch good for the open sea (her topic, "Nails") | `Runa: Not with wooden pegs. She'd come apart in the first swell.` (`REFERS:ship`): she will not do iron work without iron |
| Hild | At a meal; at the evening fire | `Hild: Thinner porridge tomorrow. The meal-sack's down to the seam.` / `Hild: Counted the stores again. They don't grow for counting.` |
| Hild | Fishing | `Hild: Bent another hook on the rocks. That was the last good one.` / after a poor day, `Hild: One fish all day. The sea's keeping the rest.` / with fish and no salt, `Hild: No salt. Whatever I catch has two days in it.` |
| Bran | At the evening fire | `Bran: More notch than edge, this axe. We'll want iron before winter.` / `Bran: A whetstone can only take so much off. Then it's gone.` |
| Bran | A wound and no linen | `Bran: No clean linen for that. I'll boil what rags we have.` |
| Oddi | At a meal; at work | `Oddi: Is that all the porridge? I'm only asking.` / `Oddi: One knife with an edge on it. That's all I'd ask.` |
| Oddi | Thorkel's chest opened (he keeps the chart) | `Oddi: Thorkel's chart. I'll keep it. Grain, iron, few spears, at Carrick.` and, when the scavengers' word or their boat agrees, `Oddi: Carrick. It's on Thorkel's chart, plain as day.` |
| Whoever of the household is at the Hag's Seat on a clear day, Runa first | Pointing out the Irish coast, with the information line *Smoke, far off to the south-west* | `Runa: Smoke, south and west. Folk over there. Fields, too.` (Hild: "See that smoke? The Irish shore. Folk over there. Fields, too."; Oddi and Bran in their own words) |

**The council at the fire** (Book 4 section 08, beat 16; decisions DH-140 to DH-143). Called at the fire once the boat is ready and everyone is found. The household gathers and speaks in turn, then Hild asks the steerer, and the steerer chooses. Each line is a period voice: grain, kin and the smoke for Hild; the chart and the share for Oddi; the beach at Kilbrecc for Bran; iron for Runa.

| Who | Counsel |
|---|---|
| Hild | `Sit, all of you. We're not rowing out with no notion where to.` / `Grain for a few days more. Then it's limpets and seaweed.` / `If Father's people got out, they'll look for our smoke. Keep it lit.` |
| Oddi | `It's on the chart. Carrick. Grain, iron, few spears. Thorkel's own hand.` (if the chest is still shut: `Thorkel had a chart in that chest. Open it, and we'll know where.`) / if no one has looked in the scavengers' boat, `I went through their boat at the cave. Carrick grain. Carrick nails.` / `And a share's a share. Mine counted out like anyone's.` |
| Bran | `I went up a beach like that once. Kilbrecc. I still see a face.` / `Take what we need. Not one life more than that.` |
| Runa | `Iron. Nails, rivets, a forge's worth. However it's got.` / `Bought or carried off, iron's iron. The boat doesn't care.` |
| Hild | `Well, Steerer? How do we go?` |

The steerer's four answers, each a period voice: "By night, quietly. Take what we need and be gone." (quiet) / "In daylight, armed. They'll give it up rather than bleed." (threat) / "With what we can spare. We bargain first." (trade-goods) / "We take it. Anyone who stands in the way falls." (force). Each resident answers it in turn (Hild to quiet: "Creeping in. Father never hid his sail. Still, everyone home." `REFERS:c_thorkel`; Bran to force: "Then I'll carry. I'll not strike first. Not again."; the rest in content/raid.json). At Carrick (Stage 16) each reminds the party of what was agreed as they land ("Show the axe. Don't use it.") and judges the raid against it afterwards ("We said no more than we needed. We took more.").

The first night's fire scene is fire talk (section 09) with Hild alone: her grief comes through in short sentences between the jokes ("He'd have hated being carried. He'd have hated all of it."), and it ends on the morning's aims. Her lines name the people and things they mean and never the steerer's gender (section 03).

## 06 / Voices of the coast
| Speaker | Voice | Sample lines |
|---|---|---|
| Fiachra | Proud, formal, ever aware of being watched | "A rí does not bargain at his own gate. Come inside, and we will speak as the heads of two households." / "My clients look to me. What do I tell them?" |
| Órlaith | Shrewd, courteous, cuts to the point | "My father wants your submission. I want your ships. One of us will be disappointed." |
| Fergal | Hot, honourable, direct | "You owe éraic for my men. Pay it, or meet me on the strand." |
| Colmán | Patient, ironic, immovable on the Bell | "Take our grain, and we will curse you. Take the Bell, and God will not need our help." |
| Muirenn | Precise and unforgiving; reads the record aloud | "On the eighth day of spring, a black ship at Carrick. Two dead. I have the names." |
| Muiredach | Plain farmer, tired, grieving or grateful | "You left the seed. I don't know why. My people will eat because of it." |
| Ottar | Smooth, mercantile, never quite honest | "Everyone is welcome at Saltvik. Some are welcome for longer." |
| Gunnhild | Blunt, professional, contemptuous of cheats | "Pay on the day, and I'll build you a ship that outlives you." |
| Gilla Muire | Weary, practical, wants peace for his cattle | "I don't care whose god you pray to. Keep the Crow off my grass." |
| Brónach | Ancient, terse, dryly funny | "You smell of salt and other people's houses." |
| Lasair | Old, sharp, impatient with fools; speaks of the bog as if it listens | "Step where I step. Not near it. Where." / "The bog takes a cow a year and a fool every second year. You're early." |
| Dubhthach | Hospitable, proud and loud; his grievance against Fiachra is exact | "Sit. Eat. Nobody leaves my fire hungry, not even Fiachra's riders, more's the pity." / "Forty cows on that slope in my father's day. Forty. Ask the rí how many now." |
| Cuán | Easy, nosy, mercenary; trades in who passed and when | "Toll first. News is extra." / "A monk at dawn, two riders at noon, and now you. Busy day at the ford." |
| Hrefna | Norse, hard and fair, few words; shuts every question about the books | "Ottar's debts are paid on the day. So are the debts owed to him." / "The books are not for reading. They are for keeping." |
| Ninnid | Anxious, kindly, counts everything; Christian | "The tithe is short, the pilgrims are early, and the poor came on time, as ever." / "God keep you. And keep your people off the barn roof." |
| Faolán Wolf-Hand | Rough outlaw speech with a king's hall underneath; amused, then suddenly bitter | "Outlaws keep no fasts and pay no tolls. We keep our word, which surprises people." / "I was taught to pour wine for kings. Now I take it off their carts." |

## 07 / The enemy and the supernatural
### Rival captains and the enemy
| Speaker | Voice | Sample lines |
|---|---|---|
| Ulf the Crow | Swaggering, contemptuous, funny in a cruel way | "Farmers with a boat. Look at you." / "You bury your dead? We just leave ours where they fall. Saves digging." |
| Asgrim Cold-Hand | Clipped, correct, joyless | "A tenth, and one hostage. I will wait one day." |
| Gilla Ciaráin | Easy, mercenary, oddly honest | "I'm paid to burn your boatshed. You could pay me more not to." |
| Orm | Calm, reasonable, terrifying because sincere | "I'm not your enemy. I'm the end of your troubles. Kneel, and the sea goes quiet." |
| Heid | Incantatory, grieving, cold and then suddenly raw | "I have seen my sons in the green light. Do not tell me what the sea owes." |
| Kolgrím the Burner | Orm's garrison chief on Skarvholm; coarse, proud of fire | "Nice island. Your well's gone salt. I've been drinking ale. Want some?" |
| Gróa | Heid's apprentice at the cairn; eager, frightened, devout | "She said the door would open if I gave it enough. I gave it everything." |

### Scavengers, thieves and wary locals
They want loot, not a death (Book 1 section 09; Book 10 section 07, "Warnings"). Since the user's third playtest they, like most enemies, speak first (below); those who warn then warn again as the steerer comes on, short and plain, and a walk away ends it. The wreck-scavengers at the stern, as the steerer comes on: `Svart: This wreck is ours. Walk on.` / `Svart: One more step and you'll bleed.` (and `Svart: Keep out of this.` if a weapon is drawn). Offered food: `Conn: Fish? Svart, it's fish.` / `Svart: Leave it there. Now go.` When one falls, the other's flight: `Conn: Not for a wreck. Not for this.` Wary farmers on the mainland: "That's far enough." / "We've nothing worth your trouble." / "Go round. Go round, I said."

**The wreck-scavengers are Carrick folk** (decision DH-137): neighbours who rowed over for a wreck, as anyone on the coast would, never written as villains. Asked where they came from (at Ketill's parley, in the cave, or beaten at the steerer's mercy: "Where have you come from?"), each names Carrick in their own voice, and the custom: `Ketill: Carrick, over the water. A wreck's anyone's who gets there first.` / `Ketill: Colla keeps a storehouse at the landing. Grain, iron, three old spears.`; `Svart: Carrick Landing. We rowed over for the wreck, as anyone would.` / `Svart: There's a storehouse there. Grain and iron. Few spears to keep it.`; `Conn: Carrick. My uncle Colla keeps the store at the landing.` / `Conn: Grain and iron, and hardly a spear. Please. Leave them be.` Beaten, before the question: `Ketill: Well? Finish it, or ask what you're going to ask.` / `Svart: Enough. I'm done. What do you want?` / `Conn: I yield. I yield. I'll tell you anything.`

### First sight
*The user's third playtest (decision DG-8; Book 10 section 07, "First sight"). Every enemy in Chapter 1, and most later enemies, speaks on first noticing the steerer, before any attack. Alone, weak or outnumbered, it is a **warning** to leave; confident or in a group, a **taunt or threat**. It replaces design addendum 2.4's "warn first" as the general rule.*
- Lines follow the speaker's culture and period voice (section 04): Norse outlaws are blunt and boastful, with the gods and the gulls in their mouths; Gaels speak of God, the poets and their own ground; a scavenger talks like someone who wants the loot, not the fight.
- Short: under eight words where it can be, never more than two subtitle lines. Addressed to the steerer, so never a gendered word for the steerer (section 03): "you", "stranger", "castaway", "sea-thief".
- They vary: each named enemy has a pool of its own, and everyone else draws from their voice's pool; no line follows itself, no two enemies in a row say the same line, and no line comes again until its pool has been used through.
- In a group one speaks first; one other may add a line or a bark a moment later. Beasts, the dead, berserkers and a sentry whose first act is the alarm have none. A first line is never a hint and never a lie about the fight to come.
- The pause after it (Book 10, pauseWarning and pauseTaunt) is for the player: back off, bargain or strike first.

| Speaker or voice | Warnings (alone, weak or outnumbered) | Taunts and threats (confident, or in a group) |
|---|---|---|
| Svart (`e_wrecker_svart`) | "Walk away while you can." / "Turn round. There's nothing here for you." / "This is ours. Go back the way you came." / "Leave it. You don't want this." | "Another one for the crabs." / "Come on, then. The spear's long enough." / "You'll float back out on the tide." / "Two of us, and you half drowned." |
| Conn (`e_wrecker_conn`) | "Go away! I mean it!" / "Stay back. I've an arrow on the string." / "We don't want trouble. Just go." / "Please. Walk on. It's only salvage." | "I'll put one through your eye." / "Svart'll have you. Won't you, Svart?" / "Run, and I'll not waste an arrow." / "Look at the state of you. Easy." |
| Ketill (`e_wrecker_ketill`) | "Get out of here. This is ours." / "Walk away. I'll not say it twice." / "Back the way you came, castaway." / "Nothing on this hill for you but a grave." | "I'll gut you like a herring." / "Come here. I've dug graves before." / "The sea spat you out. I'll finish its work." / "One more for the fold, then." |
| Norse outlaws and raiders (`e_generic_norse`) | "Not one step more. Go." / "Turn round, and you live." / "This ground's spoken for. Off it." / "Nothing here worth bleeding for. Go home." / "Leave now, and we'll forget your face." | "Feed the gulls, then." / "Good. I've not had a fight in days." / "Your bones will whiten on this shingle." / "Come on. Make it a tale worth telling." / "Odin's watching. Make it a good one." |
| Gaelic farmers, guards and outlaws (`e_generic_gael`) | "That's far enough, stranger." / "Turn back. This is our ground." / "Leave us be, and go in peace." / "Not a step nearer. God sees you." / "Go back to your boat." | "Come on, then, sea-thief." / "The poets will laugh at how you died." / "The ravens are hungry today." / "We've buried better than you." / "Come and meet a Gael's spear." |

The user's own lines are Ketill's and Svart's first: "Get out of here. This is ours." and "I'll gut you like a herring." (Ketill); "Walk away while you can." and "Another one for the crabs." (Svart). Keys: `<speaker>.sight.warn.NN` and `<speaker>.sight.taunt.NN`; the generic pools speak under the enemy's own subtitle name ("Outlaw:", "Ardcarn guard:").

### Let go: the spare shout and the reply
*Decision DG-4. When the steerer lets a beaten foe go (Book 1 section 09), the steerer shouts and the foe answers as they go. The shout is speech under the steerer's name, with no voice blip (the steerer has no voice; Book 11 section 08); it never names who is spared and carries no gendered word. No shout follows itself.*

`{steerer}:` "Get out of here." / "Go. Before I change my mind." / "Up. Go. Don't come back." / "Take your life and go." / "Run. And keep running." / "Go home. Leave this be." (keys `p_steerer.spare.NN`)

The reply comes from the spared foe's own pool, or their voice's. It never gives away the fate the spare drew (Book 10 section 17): a grateful word may be followed by an ambush, and a sour one by a favour. When a spared person comes back, they speak first with one of the returned lines, before anything else happens (an ambush still shows its sign first).

| Speaker or voice | Spared, as they go | Back to repay the favour | Back to ambush |
|---|---|---|---|
| `e_wrecker_svart` | "Huh. I'll remember that." / "Fine. Fine. I'm going." | "I'll stand out of this one. Call it square." | "Letting me go was a mistake." |
| `e_wrecker_conn` | "Thank you. Gods, thank you." / "I'm gone. I'm gone." | "The oar's in the skiff. Take it. I never saw you." | "I'm sorry. I've no choice." |
| `e_wrecker_ketill` | "You'll be sorry for that, or you won't." / "A life. I'll not forget whose." | "You let me walk. I'll let you." | "Mercy's for fools. Come on." |
| `e_generic_norse` | "I'll not forget this." / "A life owed. I'll pay it, one way or another." / "The gods keep you. I'm gone." | "I owe you a life. Here's some of it." / "Told you I'd pay. Now we're square." | "You let me go once. Not twice." / "Remember me? I've thought of nothing else." |
| `e_generic_gael` | "God reward you." / "I'll remember your face." / "May you never need the like." | "God sent me back to you. Stand easy." / "A life for a life. Take it." | "You shamed me before my own. No more." / "I prayed for you. Then I stopped." |

### Bran's shouts at the fold (the user's fourth playtest)
Decisions DH-32 and DH-33. At the fold Bran shouts the way of each teaching foe at the moment it is needed, never two shouts back to back (Book 10 branAdviceGap): as Svart winds up a thrust at the steerer, "Svart's thrusting! Meet it, turn it aside, then strike!" (`c_bran.teach.svart_parry`); as Ketill winds up his red blow, "Not on the shield! Step out from under it!" (`c_bran.teach.red.01`). A shout due inside the gap waits for that foe's next wind-up. "Svart's guard won't break. Turn the spear aside, then strike." is now said on the first blow Svart turns only if his thrust's shout has not yet come (the steerer struck first).

### The teaching foes' guidance
*Decision DG-9; Book 10 section 07, "Teaching foes". The guidance is speech: a boast from the foe or a shout from Bran, never an instruction about keys (the prompt at the screen's edge does that).*

| Foe | When | Line |
|---|---|---|
| Svart (parry) | His first blow turned on his guard | `Svart: Nobody gets past this shaft.` |
| Svart | His third blow turned | `Svart: Only one ever did. Turned my own thrust aside.` |
| Svart | The first time he is parried | `Svart: Lucky. Do it again, then.` |
| Svart, first met at the fold | His first blow turned, with Bran beside the steerer | `Bran: Svart's guard won't break. Turn the spear aside, then strike.` |
| Ketill (dodge), at the fold | His first red blow | `Bran: Not on the shield! Step out from under it!` |
| Ketill, at the fold | The first guard broken through, or the first parry beaten | `Bran: That blow goes through wood. Get clear, then hit.` |
| Ketill, at the fold | The second red blow taken | `Bran: Wait for the swing. Then go in.` |
| Ketill, in Seal Cave | His first red blow | `Ketill: No shield ever stopped this one.` |
| Ketill, in Seal Cave | The steerer's first blow turned on his shield | `Ketill: Stand there, then. It's quicker.` |

### At the fold: Bran and the scavengers
*Decision DG-26; Book 10 section 07, "At the fold". Arriving while they are all unaware of the steerer, the steerer finds them in the middle of it: Bran over Thorkel's body, the scavengers wanting what is on it. Heard from cover, it rewards sneaking up: the key on its cord, the bargain they want (the ship's silver), Bran's wound, who stands where (Ketill and Svart at the gate, Conn on the mound, so the east wall is unwatched) and that they will take the skiff round to the cave at dark. Bran speaks slowly, refuses quietly and finally, and says grace; Ketill is a hard, tired leader who would rather be paid than fight; Svart wants it over; Conn is frightened. The exchanges loop in a shuffled order with no exchange twice in a row, leave out anyone absent (dead, held or gone), and stop the moment any of them notices the steerer, when their first-sight lines take over. These lines are not addressed to the steerer.*

| Exchange | Lines, in order | Plays |
|---|---|---|
| key | `Ketill: The key on his neck, Bran. Hand it over.` / `Bran: No. He's done. Leave him be.` | always |
| wound | `Ketill: Your leg's bleeding through. How long can you stand?` / `Bran: Longer than you can wait, Ketill.` | always |
| silver | `Ketill: There was silver aboard. Bring us the box and keep your dead.` / `Bran: The silver's not mine to give.` | always |
| posts | `Ketill: Conn's on the mound with his bow. Svart and I have the gate.` / `Bran: I can count, Ketill.` | only with Conn and Svart there |
| gate | `Ketill: I've the gate, Bran. You'll not walk out past me.` / `Bran: I'm not walking anywhere.` | always |
| skiff | `Ketill: At dark we take the skiff round to the cave, with him or without.` / `Bran: Then go at dark.` | always |
| kin | `Ketill: Nobody's coming for you. They're all drowned.` / `Bran: Not all. Thorkel's kin don't leave their dead.` | always |
| finish | `Svart: Let me finish it, Ketill. One thrust.` / `Ketill: And have his kin on us? Wait.` | only with Svart there |
| prayer | `Conn: He's praying again, Ketill.` / `Bran: Christ keep him. Christ keep all of us.` / `Ketill: Pray quieter.` | only with Conn there |
| ring | `Ketill: That ring's gold. Gold's no use to the dead.` / `Bran: It's Thorkel's. It goes with him.` | always |

The user's fourth playtest (decision DH-15): the fold remembers who took the ship's silver from the strand. While `ch1.silver_taken_by` is set, **silver** is not heard (they have it), and one of these is, by who took it:

| Exchange | Lines, in order | Plays |
|---|---|---|
| stolen | `Ketill: Conn's brought us the ship's silver. So what's left to bargain with?` / `Bran: Then you've what you came for. Go, and leave him be.` | only when Conn took it, with Conn there |
| stolen_svart | `Ketill: Svart's brought us the ship's silver. So what's left to bargain with?` / `Bran: (as stolen)` | only when Svart took it, with Svart there |
| stolen_ketill | `Ketill: Their silver's in my lap now. So what's left to bargain with?` / `Bran: (as stolen)` | only when Ketill took it |

### The strongbox taken in sight (the user's fourth playtest)
*Decisions DH-12 to DH-16. While the steerer carries Oddi, one of the band breaks from the dune grass and takes the ship's silver in a brief scene. Lines in content/strings/en.json.*

| Moment | Speaker | Line |
|---|---|---|
| He hauls the box up | Conn | "Silver! Ketill can haggle for the dead. This is ours." |
| | Svart | "The tide pays after all." |
| | Ketill | "Kind of you to mind it for us." |
| Oddi shouts after him | Oddi | "Oi! Thief! That's the ship's silver!" |
| Run down, he drops it | Conn | "Take it! Take the cursed box!" |
| | Svart | "Keep it. It's not worth a spear in the back." |
| | Ketill | "Have it, then. I'll have it back another day." |
| Oddi set down while the thief runs | Oddi | "Never mind me! After the thief, before the dunes hide the silver!" |
| Oddi safe, the thief away | Oddi | "That was Conn, the thin one with the bow. Our silver's gone up to the fold." (Svart: "That was Svart, the spearman. ..."; Ketill: "Ketill, that was, their leader. ...") |
| Oddi safe, the thief run down | Oddi | "You ran the thief down! Silver's in the sand. Don't leave it lying." |
| Oddi safe, none of the band free | Oddi | "Thanks for the carry. The silver's still down in the wash. Fetch it up when you can." |

### Supernatural voices
- **The Blue Men** speak in rhymed couplets. They give two lines and wait for two more. The player's choices are four couplets: one bold and fitting (success), one clever but slow (partial), one timid (failure), one insulting (they laugh, then attack). Write new couplets each time; never use well-known verses.
- **The Ferryman** says very little, slowly, in complete sentences. He asks; he never threatens. "Tell me something true, and I will tell you the way."
- **The Cailleach** sounds like a sharp old woman who has seen a thousand winters and liked few of them. "You want calm water in my season? What did it cost you to ask?"
- **The aos sí** speak with exact, legal precision and treat words as binding. "You said 'take'. You did not say 'borrow'."
- **The draugr** speak in fragments, the last things they cared about. "Cold. The rope. Who has my sword."
- **Hrolf the Barrow-King**, a haugbúi, speaks in whole sentences, unlike the draugr: a dead king keeping court, proud, possessive, counting his goods, treating the living as guests or thieves and never sure how long he has lain there. "Who comes to my hall without a gift? Sit. Tell me who is king now." / "Every ring is counted. I count them each night. One is missing."
- **The washer at the ford** answers only what she is asked, without emotion. "This one is Kolla's. This one is yours, if you sail by the north channel."
- **The Door of Three Truths** in the Hollow Cairn does not speak. It listens. Its silence is the response.

## 08 / Barks
*Short, unblocking lines that make the world feel alive. Most under eight words.*

### Rules
- Barks never block play and never deliver required information alone; important facts also appear in the report or on screen.
- No identical bark from the same speaker within ten minutes; no two speakers repeating the same line within a minute.
- Priority: danger, orders, wounds, discoveries, reactions, idle.
- Barks are text; as one appears its speaker's voice blip plays (Book 11 section 08). Nothing is voice-acted, and the steerer has no blip.
- **First sight** (decision DG-8): an enemy's first line on noticing the steerer comes before any attack, and follows the pool rules of section 07: no line twice running from anyone, none again before its pool is used through.
- **In a fight, barks are the only lines on screen** (design addendum 2.5; section 10, "On-screen text: less of it"). One speech line shows at a time, so a new bark replaces the last; a fight's barks are short (under six words) so they read at a glance. Enemies' awareness is shown by their barks and bodies ("Who's there?", then "There!"), not by marks or words.

### Samples by category
| Category | Samples |
|---|---|
| Order acknowledged | "With you." / "Holding." / "That one? Done." / "I've got her." / "Back to the boat!" / "Carrying. Clear the way." |
| Danger | "Sail! North!" / "Horn from the hill!" / "They're behind us!" / "Dogs!" / "Watch the charge!" |
| Combat | "Shields!" / "He's down." / "Left! Left!" / "I'm cut. Still standing." / "They're breaking!" |
| Wounds | "Leg's gone. Leave me the axe." / "Not my sword arm. Lucky." / "It's only blood." |
| Raid | "Boat's full." / "That's seed. Leave it?" / "Someone ran for the road." / "Tide's turning!" |
| At sea | "Wind's backing." / "Land, port bow." / "Rowers, together!" / "Something under us." |
| Home work | "Peat's dry enough." / "One more row and I'm done." / "Who left the gate open?" / "Fish for supper, again." |
| Idle and evening | "Sing the one about the goat." / "Dry feet. I'd forgotten." / "Pass the ale before Kári sees it." |
| Weather and season | "Smell that? Snow." / "Gulls inland. Storm tomorrow." / "Long light. Too long to sleep." |
| Supernatural signs | "The water's moving wrong." / "Footprints. Wet ones." / "That fog's going against the wind." |
| Needs (decision DH-133) | "Nine nails. Nine. I've counted them twice." (Runa) / "We'll want iron before winter." (Bran) / "Counted the stores again. They don't grow for counting." (Hild). Occasional: never within Book 10's needLineGap of another need line, never more than needLinesPerDay a day, and never over the household's own exchanges |
| Awareness (enemies) | Suspicious: "Who's there?" / "Thought I heard something." / "Show yourself." Alert: "There!" / "Up! Up, we've company!" Losing the trail: "Wind in the grass. That's all." |
| Wounded enemies | "I'm cut! To me!" / "Back, back, give me room." / "Enough. Enough, I yield." |
| Reactions to brutality | "That wasn't a fight." (Bran) / "Farmers. No name to be won off farmers." (Kári) / "God forgive us." (Eithne) / "We'll pay for that." (Tófi) / "No need of that. Bad luck, that." (Kolla) |
| Assault | "Horn! More coming." / "Lock shields!" / "Hold the beach!" / "Archers on the roof!" / "Fall back to the ships!" |
| Return to Skarvholm | "That's our roof. Their smoke." / "They've salted the spring." / "Father's stones are still there." (Hild) |

## 09 / Conversations at home
*Talking to a resident opens a short conversation built from topics. It should feel like catching someone at work.*

### Structure
1. **Greeting** that reflects what they are doing, the season and the time of day, their happiness and their friendship ("Hand me that rope, if you're staying.").
2. **Up to three topics**, chosen by priority from memories: a recent deed they saw, a wound, a death, their job, the weather and season, a tie, a worry, a request. For a major character each topic is a branch of one of their topic trees (section 17).
3. **A player choice** per step of a topic: agree, disagree, ask more, or move on, worded as period voices (section 16). "Ask more" can open a further branch; most topics end within two or three steps. Choices can change friendship, and sometimes happiness or fear.
4. **Exit** that returns them to their work.

### Topic samples
| Topic | Example exchange |
|---|---|
| A wound | Bran: "Stitches are pulling. Nessa says three days." Choices: "Rest." / "We need you on the oar." / "Show me." |
| A deed | Eithne: "The keeper at Carrick had a wife. I knew her." Choices: "I'm sorry." / "It had to be done." / "Say no more." |
| A death | Hild: "We put him in the stones. He'd want a better song than mine." Choices: "Sing it anyway." / "Ask Tófi." |
| The season | Runa: "Twenty days to Samhain. If the boat's not in the naust by then, I'm sleeping in it." |
| A worry | Kolla: "Kári's been talking to the Crow's men at Saltvik. Too much." |
| A request | Áine: "Give me a day on the hill with my bow. I'll bring you a deer." |
| Ordinary life | Kolbeinn: "Asa thinks I snore. I think the wind snores." |
| A need (decision DH-134; offered while it is felt) | Runa: "Nine nails. That's what I have. Nine." Choices: "Can you make the patch good for open sea?" (Runa: "Not with wooden pegs. She'd come apart in the first swell.") / "Make do with them." Hild ("The stores"), Bran ("Your axe") and Oddi ("Thorkel's chart") have their own |

### Fire talk
On evenings with a feast, a storm or a death, the household gathers at the fire. Two or three residents speak in turn; the player can join, prompt a story, or stay silent. Fire talk is where values clash openly and where songs and stories (Book 11) are performed.

### Talk among the household (the user's fourth playtest)
Short exchanges of two or three lines between residents, overheard, never addressed to the steerer (decisions DH-48 to DH-52; content/company.json `exchanges`, keys `<speaker>.chat.<exchange>.<n>`, tagged `VOICED` only). Each is chosen by the speakers' ties, traits and what has happened, and sounds like both of them: Oddi counting, Bran gentle and final, Runa blunt about luck, Hild joking. Samples: Bran: "Eat slower. Nobody's taking it from you." / Oddi: "You don't know that." / Bran: "I do. I'm watching." (Bran is Oddi's mentor). Runa: "Stop that." / Oddi: "I wasn't doing anything." / Runa: "You were about to whistle." (Runa's superstition). Hild: "You held that fold alone, Bran?" / Bran: "Not alone. Your father was there." (after the fold). Oddi: "When we sail, who decides the shares?" / Bran: "Eat first." / Hild: "Then decide who we are." Each line is one speech line with its speaker's blip; the next replaces it.

### Asking about the boat (the user's fourth playtest)
A resident whose job is the boat's answers "The boat" with what it needs next, in their own voice (decisions DH-62, DH-63; keys `<speaker>.boat.<need>`): the boards, the patch under way, the rigging to fetch at low water or the mast being stepped, the oar to fetch, being carved or to lash on, the fitting, or ready. Runa: "Strakes are stove in. Bring the boards from the debris." Oddi: "Hammering. Lots of it. Some of it by me." Bran: "The mast goes up today, if the stays hold."

### Binding refused (the user's fourth playtest)
Runa's refusal and its answers (decisions DH-41 to DH-43): `Runa: No. Another's hands on my hurt, and the sea marks me. I'll bind it.` The steerer: "Then bind it yourself. I'll hold the end." / "The boat needs you whole." / "Suit yourself." Held: `Runa: Hm. Hold the end, then. Tight. Don't tell the sea.` Pressed with the boat: `Runa: The boat needs me stubborn. Leave it.` Asked on a later day: `Runa: Fine. Yesterday's luck is spent. Bind it.`

## 10 / Writing for content files
### String rules
- Subtitles: at most two lines of 42 characters each.
- String keys: `<speaker>.<context>.<id>`, for example `c_hild.bark.danger.03`. Caption strings start `caption.`.
- Variables in braces: `{steerer}`, `{ship}`, `{place}`, `{count}`, `{speaker}`, and in interface text `{control:<action>}` for a control as currently bound. Never a pronoun variable for the steerer.
- Tags: `ADDRESS_STEERER`, `ABOUT_STEERER`, `VOICED`, `GLOSSARY:<word>`, and on every caption string `SPEECH` or `INFO`.
- **No ID ever reaches the screen** (the user's fourth playtest, request 25; decisions DH-110 to DH-114). Everything the game names on screen (a person, a load carried, an item, a place, a task) is named from a string: a person by `person.short.<id>` or their name, a load carried by `person.short.<id>` (the rigging: "The rigging"), a hotbar item by its `nameKey`, any other item by `item.name.<word>`, a zone by its place name. Something with no name shows as "that" (`ui.name.unknown`), never its ID. The ID lint (part of `npm run lint`) fails the build if a player-facing string has a token that looks like an ID, in capitals or in lower case (`C_HILD`, `c_hild`) or an unfilled string key (`ui.prompt.sleep`), or if anything content can show by name has no name string; the developer menu's strings (`ui.dev.*`, only under `?dev`) are excepted.

### Modern moral words
Dialogue strings, meaning every line spoken by a person (keys whose speaker is a person: `c_`, `l_`, `r_`, `e_`, `h_`, `p_`), never use modern moral vocabulary: **rights, war crime, genocide, trauma, civilian, ethics, morality, values, consent, abuse, victim, tolerance, equality**. Dialogue says "farmers", "folk" or "people who bore no weapon" rather than "civilians". "Innocent" is allowed: it is a Church word. Interface text, such as the household screen, and information captions are exempt. Content lint (Book 2) flags these words in dialogue strings, as it flags gendered words about the steerer (section 03).

### Subtitles and captions
Subtitles show two kinds of line, and they look different:
- **Speech** is what someone says: the speaker's name, a colon and the words, in upright type. `Hild: Here! Over here, past the rocks!` Speech follows every rule of this book.
- **Information** is a sound, a direction or another cue that is not speech: *italic*, with no speaker prefix and no quotation marks. *Hild, calling from the west*; *Surf breaking on the rocks*; *A horn, far off to the north*.

| Rule | Detail |
|---|---|
| Information lines | Under eight words, in the present tense, with a direction when it helps the player find the source. Plain, modern-neutral English: no glossary words, no slang, no period voice |
| Edges | Walking into an edge gives one of three information lines, at most once in a few seconds (Book 10 section 25): *Nothing that way*; *The water's too deep*; *Too steep to climb*. They say why, never that the steerer "cannot" |
| Actions | The opening's tactile moments (*The net parts*; *Sparks from the flint*; *The flame takes*; *The sail fills and settles*; *The lashing parts*; *A splash in the shallows*; *A door creaks open*) are no longer captioned: each is seen and heard (design addendum 2.5; the audit below). Their strings may stay in the table, unshown |
| Unmet speakers | A speaker the player has not met is named by what they appear to be ("Monk:", "Stranger:", "Ardcarn guard:") until introduced |
| Hidden identities | A subtitle name never gives away a hidden identity: Nessa's secret, a disguised enemy, an outlaw prince |
| Both at once | The information line sits above the speech line; never more than one of each (below, "On-screen text: less of it") |
| Italic | A real italic of the caption font, or a hand-made slanted variant if the font is a pixel font; crisp at 1x, never a blurred, synthetic skew |
| Settings | Information captions can be turned off separately from speech subtitles (Book 2 section 21) |
| Tags and lint | Every caption string is tagged `SPEECH` or `INFO`. Content lint checks that a `SPEECH` string has a speaker (it starts `{speaker}: `) and an `INFO` string has none (no "Name:" prefix, no quotation marks, under eight words) |

### On-screen text: less of it
Design addendum 2.5 section 2 (decisions DF-11 to DF-14): text stacked up and covered the action, and most of it was no use. The rules, for every line the game shows:
- **One caption line and one speech line at most.** A new line replaces the old one of its kind; they never stack or queue. A repeated line is suppressed (an information line within 20 seconds; speech by the bark rules of section 08). Lines fade in and out quickly (Book 10 section 21, "On-screen text").
- **At the bottom, clear of the action**: low and centred above the hotbar, information above speech.
- **Cut what the picture or sound already says.** A caption is for what the player could not otherwise know: a sound from out of sight, a direction, a consequence off screen, a reason. A door that visibly opens, a flame that visibly takes, a kneeling foe, gets none.
- **In a fight, only speech barks show** (Book 2 section 18). Combat is read by sight and sound: no line ever reports a hit, a block, a parry, a dodge, damage or a state, and there are no damage numbers or log. Information lines wait until the fight ends (one is kept, if still fresh), except **safety lines**, which show at once: the edge lines (*Nothing that way*; *The water's too deep*; *Too steep to climb*) and the neck's gale; a horn or the alarm, with its direction; a supernatural tell (*A hum under the water*, *Hooves on the water*, *Dripping, coming closer*, *Hail rattling on the standing stone*); a blade raised over a downed ally (*A blade raised over {target}*); the steerer down with an ally near (*Down. An ally can lift you*); and an arrow from a shooter out of sight (*An arrow whistles past*, with its direction).
- **Tutorial prompts** ("W A S D to move", a timed task's press) and pickup tooltips fade out during story beats, scenes and talk, and whenever a speech line shows; they disappear for good once the player has done the thing; they never sit alongside a narrative line.
- **Refusal words** beside the cursor stay: one or two words answering a press ("Too far", "No arrows"), one at a time. A refusal the body already shows has none.
- Combat sounds are never captioned, in any mode or setting: each has its drawn twin (the draw-back, the flash, the sparks) instead (decision DF-80, the user's ruling; DF-14's accessibility option is withdrawn).

#### The audit
Every kind of message the game showed when design addendum 2.5 was written (`content/strings/en.json`, `src/scenes/playView.ts`, the audio router's sound captions), with what happens to it. **Keep** stays, under the rules above; **Cut** is no longer shown; **Merge** folds it into another line or another kind of message. Class is the information priority (Book 2 section 18): safety, direction, story or sound. A new kind of message needs a row here before it is shown.

| Category | Examples (keys) | Where shown today | Verdict | How, after 2.5 |
|---|---|---|---|---|
| Speech: talk, barks, warnings, hints | `c_*.bark.*`, `c_*.talk.*`, `c_*.hint.*`, `c_*.warn.*`, `e_wrecker_*.bark.*` | Captions, up to three lines stacked with others | Keep | One speech line; a new one replaces it. The only lines in a fight, besides safety |
| A distant call | `caption.voice.*_calling` with `caption.format.with_direction`, and the caller's speech line | Captions: an information line and a speech line | Keep | Direction class: the information line names the caller and direction, the speech line the words |
| Someone walking up | `caption.voice.approach` ("{name}, coming over") | Captions | Cut | The person is seen walking up, and speaks on arrival |
| Talk and search information | `caption.search.*`, `caption.scene.theft_found`, `info.boat.*`, `info.launch.not_yet` | Captions, and the talk panel | Keep | Story class (waits in a fight); `caption.search.neck_gale` is a safety line. In talk they stay in the talk panel |
| A foe yields or runs | `caption.info.surrender`, `caption.info.flee` | Captions, in the fight | Cut | The kneeling, the weapon thrown down and the running show it |
| Brought home, left behind | `caption.info.brought_home`, `caption.info.left_behind` | Captions | Keep | Story class: held until the fight ends (the one held line) |
| A finishing blow raised; second wind | `caption.info.finish_warning`, `caption.info.second_wind` | Captions | Keep | Safety lines, shown in a fight |
| Healing | `ui.heal.bind`, `ui.heal.eat`, `ui.heal.interrupted` | Captions | Cut | The kneeling loop and its sound show it; a cut-short heal shows the flinch |
| Edges | `caption.edge.nothing`, `caption.edge.deep`, `caption.edge.steep` | Captions, once each 4 s | Keep | Safety lines |
| Doors | `caption.door.open`, `caption.door.flap`, `caption.door.close` | Captions, and sound captions | Cut | The door is seen and heard opening |
| The opening's actions | `caption.action.*` (the net parts, sparks, the flame takes, the sail fills, the lashing parts, a splash) | Captions, and sound captions | Cut | Each has its animation, particles and sound (Book 7, Book 11) |
| The opening's moments | `caption.net.wave`, `caption.wake.cough`, `caption.chest.*`, `caption.cold.storm`, `caption.cold.timber`, `caption.cold.strike`, `caption.ring.clink` | Captions and sound captions | Cut | Seen and heard |
| Thorkel's shout in the cold open | `caption.cold.shout` | An information line beside his speech | Merge | Into his speech line, which names him |
| The Hag's Stone | `caption.hag.light`, `caption.hag.hush`, `caption.hag.whisper`, `caption.hag.gust` | Captions and sound captions | Keep the light and the whisper; cut the hush and the gust | *A pale light, far off* gains its direction (direction class); *A whisper by the stone* is a sound with nothing seen (story class); the stillness and the gust are seen in the grass and the mist |
| Music | `caption.music.*` | Sound captions | Cut | Music is mood, not information. The alarm drums merge into the horn's safety line |
| Stingers | `caption.stinger.horn`, `.discovery`, `.dispute`, `.judgement`, `.boat_ready`, `.game_over`, `.chapter_end` | Sound captions | Keep the horn and the dispute; cut the rest | The horn is a safety line with its direction; *Trouble at the fire* is story class. The others are shown by their screens and scenes |
| Combat sounds | `caption.sfx.light_attack`, `.heavy_swing`, `.hit_*`, `.block`, `.parry`, `.parry_ring`, `.guard_break`, `.charge_level_1`, `.charge_level_2`, `.dodge`, `.shove`, `.grunt`, `.steerer_breath`, `.riposte`, `.lunge`, `.backstab`, `.sidestep`, `.alert`, `.gore_*`, `.downed`, `.body_fall`, `.weapon_drop` | Sound captions, several at once in a fight | Cut | Read by sight and sound: the telegraph's draw-back and flash, sparks, the parry's spark, the bodies. Shown only with the combat sound captions option (off by default) |
| Missile sounds | `caption.sfx.bow_draw`, `.bow_loose`, `.arrow_*`, `.spear_throw`, `.quiver_empty` | Sound captions | Cut, but for one | *An arrow whistles past* stays as a safety line when the shooter is out of sight, with its direction. The empty quiver is the refusal word *No arrows* |
| Work, camp, repairs, rites and launch sounds and moments | `caption.sfx.task_*`, `.driftwood_pickup`, `.fire_*`, `.timing_good`, `.sleep`, `.pickup`, `.splash`, `.task_repair`, `.rigging_cut`, `.load_laid`, `.repair_done`, `.oar_taken`, `.fitting_*`, `.work_adze`, `.stones_set`, `.sea_burial`, `.beaching`, `.oar_*`, `.sail_*`, `caption.repair.*`, `caption.rites.*`, `caption.launch.*` | Sound captions and captions | Cut, but for one | Each is seen in its work loop or scene. *They saw you take it* (`caption.repair.oar_seen`) stays: a consequence not otherwise shown (story class) |
| Supernatural tells | `caption.tell.*`, `caption.sfx.tell_ran` | Sound captions | Keep | Safety lines with their direction: a sound heard before anything is seen |
| Footsteps and ambience | `caption.sfx.footsteps.*`, `caption.amb.*` | The sound test page only | Keep there | Never in play |
| Interaction prompts | `ui.prompt.lift`, `.set_down`, `.pick_up`, `.talk`, `.task`, `.cut_net`, `.open_chest`, `.shelter_frame`, `.shelter_sail`, `.door`, `.finish` and their `_click` forms | The prompt line, one at a time | Keep | Hidden during story beats, scenes and talk |
| Tutorial prompts | `ui.prompt.move`, `ui.prompt.timing` | The prompt line | Keep | Faded during story beats, talk and speech lines; gone once done (Book 10 `promptDone`) |
| Notices in the prompt line | `ui.prompt.below_tide`, `.no_room`, `.hands_full`, `.need_wood`, `.too_early`; `ui.reason.*`; a crew member's "Cannot fight" | The prompt line, over the prompt | Merge | Into refusal words at the cursor ("Below the tide line", "No room", "Hands full", "No driftwood", "Too early to sleep"); a refused job into the person's reply in the talk panel; a refused order into the person's bark |
| Refusal words | `ui.refusal.*` | Beside the cursor | Keep, but for one | One at a time, 1.2 s. *Too spent* (`ui.refusal.exhausted`) is cut: the exhausted body and breathing show it |
| Pickup tooltips | `ui.tip.*` | Top right, once per item kind | Keep | Faded during story beats, talk and speech lines; gone after 8 s or once the controls are used twice; kept in the help pages |
| The slot's name | an item's `item.name.*` | Above the hotbar, 1.5 s | Keep | |
| Panels the player opens or the day brings | the clock, the stamina bar's reasons, the journal and morning report, the talk panel, the help pages, menus, game over, the launch's readiness, naming and mark panels, the chapter's end, the sea map's labels, the timings readout | Their own panels | Keep | Never in a fight (the safe rule closes menus); the morning report opens on waking only |
| Marks over the world | the awareness "?" and "!", a crew order's icon, the lock-on mark, the stance arrow, the bars | The pixel layer | Keep; the awareness marks off by default | Drawn shapes, not text |
| Combat prompts (the user's third playtest; decisions DG-7, DG-9, DG-11, DG-25) | `ui.prompt.combat.lock_on`, `.strike`, `.parry_dodge`, `.block`; `ui.prompt.heal_bind`, `.heal_eat`; `ui.prompt.sneak`; `ui.prompt.teach_parry`, `.teach_dodge`; `ui.prompt.finish_or_spare` (which replaces `ui.prompt.finish` in a fight) | New: the right edge of the view (Book 10 section 21, promptPlace) | Keep: the one exception to "no text in a fight" | Input prompts only: a control and a verb, never a hit, damage, a state or a log. The first five only in the first three fights; the heal prompt until three heals; the sneak hint at most three times; the teaching prompts until each lesson is done; the finish-or-let-go choice whenever offered. Faded while a fighter is drawn under them and during story beats, scenes and talk |
| Talk among the household, nudges, advice and the boat's need (the user's fourth playtest; DH-48 to DH-63) | `*.chat.*`, `*.nudge.*`, `*.advice.*`, `*.boat.*`, `*.care.*` | Captions (speech) | Keep | One speech line, a new one replacing the last; exchanges and nudges never in a fight (Book 10 section 08), never during talk or scenes; advice and the boat's need in the talk panel |
| First-sight lines, the spare shout and replies, the returned lines, the teaching foes' guidance, the fold's talk | `*.sight.*`, `p_steerer.spare.*`, `*.spared.*`, `*.returned.*`, `*.teach.*`, `*.fold.*` | Captions (speech) | Keep | One speech line; in a fight they are barks. The steerer's shout is the only speech line under the steerer's name, with no blip |
| The pause menu, saves, the title screen and settings | `ui.pause.*`, `ui.save.*`, `ui.title.new_game` and the rest, `ui.settings.*` | Their own panels | Keep | Panels the player opens; a refused save shows its reason in the panel (`ui.save.refused`) |
| The first raid's reasons (decisions DH-136, DH-138, DH-139) | `caption.raid.smoke_far`; `caption.raid.goods_stored`; `info.skinboat.*`; the morning report's `report.need.*` and `report.low.*` | Captions; the talk panel; the morning report | Keep | *Smoke, far off to the south-west* is direction class (the smoke is beyond the view's edge); *Grain, nails and net into the stores* is story class (a consequence off screen); the skin boat's lines are in the talk panel, as the boat's are; the report's need lines are at most two a morning (Book 10 reportNeedLines) |
| Skipping the intro | `ui.intro.skip`, `ui.intro.hold` | The cold open's bottom right | Keep | Only once the cold open has been seen; fades after a few seconds until a key is pressed |
| The developer menu | `ui.dev.*` | Top left, in developer mode only | Keep out of play | Never shown in a player's game: only in a debug build or with `?dev` (Book 2 section 21) |
| Strings never shown in play | `ui.activity.*`, `ui.work.result.*`, `ui.work.good`, `ui.play.zone.*`; `ui.play.label` (the canvas's screen-reader label only) | Nowhere on screen | Keep out | Not to be shown; the screen-reader label stays |

### Interface wording
- Interface words are short, plain and the same everywhere: one word for one thing.
- **The stamina bar's reason.** The bar's length shows its current maximum (Book 1 section 18). Beside it, each reason it is smaller appears as a short plain label, most serious first: "Cold", "Hungry", "Wounded", "Sick", "Tired", "Worn out from work". No numbers in the label, no game jargon ("debuff", "penalty", "max stamina"), and no sentence about the steerer: the label names the cause, not the person, so it can never carry a gendered word.
- Keys follow the string rules, for example `ui.stamina.reason.cold`.
- **Pickup tooltips** (Book 2 section 21). The first time an item of a kind is picked up, its tooltip gives the item's name and then one short line per control, the control first: `{control:use}: strike`, `Hold {control:use}: heavy strike`. Controls are always variables filled from the current bindings for the input in use (mouse and keyboard, keyboard only, or gamepad), never a key written into the string, so a rebind or a new device changes the tip. At most four control lines of 32 characters each; plain, modern-neutral interface English, as for information captions: no period voice, no glossary words, no slang, no word about the steerer's body or gender, and no "you must". It says what the controls do, not why. The tips are kept, word for word, in the help pages. Keys: `ui.tip.pickup.<item>.<line>`. The seax: strike, heavy strike, and that shove and dodge work with any weapon. The bow: hold to draw and release to loose, aim with the mouse or the right stick, the feet stay planted while drawn, cancel. Arrows: the count shows on the bow's slot; no arrows, no shot.

### Checklist before committing a line
1. Does it sound like this speaker and no one else?
2. Is it concrete, short and in plain period English?
3. No banned modern words (okay, guys, cool, stress, process, deal with it), no modern moral words (rights, war crime, genocide, trauma, civilian, ethics, morality, values, consent, abuse, victim, tolerance, equality) and no mock-archaic forms.
4. At most one glossary word, clear from context.
5. No gendered term for the steerer.
6. Does it reveal or hide only what the speaker would know?
7. Is violence described plainly, without relish (unless the speaker's values say otherwise)?
8. No quotation or close adaptation of any copyrighted text.
9. Interface words: short, plain, and the same word for the same thing everywhere.
10. Does the speaker judge by their own culture's code, giving a period reason (section 16)?
11. Is a caption string tagged `SPEECH` (with a speaker) or `INFO` (without one, under eight words)?
12. Does an information line say something the picture and sound do not? Is it in the audit (section 10), with its class?

## 11 / Happiness, friendship and fear in speech
*Nobody says "I am unhappy with you". People talk about the cold, the food, and what they saw the steerer do.*

### Rules
- Dialogue never names the measures or their numbers (Book 5 section 01). People speak of causes: the cold, the food, a death, a deed, a kept or broken promise.
- **Happiness** is heard in talk about today: hunger, wet bedding, a good meal, a feast, a grief.
- **Friendship** is heard in talk about the steerer over time: what they did, what they promised, whether they came back for someone.
- **Fear** is heard in what people stop saying. Frightened people answer shorter, agree faster and look for someone else to speak for them.
- Each step of the warning flow (Book 5 section 01) has its own line, in the speaker's voice, and the steps are never skipped.
- A major character's voice changes when friendship or fear crosses a threshold (Book 10 section 23, "Conversation depth"): warmer and more open as a friend, shorter and colder when resentful, quick and quiet when afraid (section 17).

### The warning flow
| Step | Friendship falling | Happiness low |
|---|---|---|
| **Remark** | "You could have let him go." (Bran) | "Cold again. Fish again." |
| **Complaint at the fire** | "I said nothing at Carrick. I'm saying it now." | "Three nights without a fire in the second house. People notice." |
| **Refusal** | "I will not burn a church. Find someone else." | "Not the peat banks. Not in this. Ask me tomorrow." |
| **Request to leave** | "Put me ashore at Saltvik. I'll not ask for a share." | "There's work in Saltvik with a roof over it." |

### Fear
| Situation | Sample lines |
|---|---|
| Fear rising | "As you say." / "Yes. Now. I'm going." / "I didn't see anything." |
| Fear without friendship: the warning, told by a friend | "Arnbjörn's been asking when the knarr sails. Not for himself, he says." / "Kári's putting fish by. For a journey, Kolla thinks." |
| Fear with friendship: fierce devotion | "Where you go. Don't ask me twice." / "Point at them. That's all you need do." |

### Friendship rising
| Step | Sample lines |
|---|---|
| Praise | "You brought everyone home. Thorkel couldn't always say that." |
| Offer of help | "If it's the north channel, take me. I know it." |
| Personal favour | "I mended your cloak. Don't thank me. It was ugly." |
| Loyalty in a crisis | "They want you? They'll have to come through the door first." |

## 12 / Disputes
*Two people, one grievance, and the whole household watching the steerer decide.*

### How a dispute is presented
1. **The parties bring it.** Each states their case in a line or two, in their own voice: Gaels with names, numbers and days; Norse bluntly.
2. **A witness** may add one line, which can help either side.
3. **The judgement** is offered as short choices that name the people. Each choice is a plain verb phrase. A choice may carry a few plain words on who it is likely to please or anger, when the steerer would know it, and never a number.
4. **The outcome** is spoken at the fire: one line from each party, and a reaction from someone who watched.

### Wording the judgement options
| Option | Example wording |
|---|---|
| Take a side | "Side with Kolla." / "Side with Kári." |
| Find a compromise | "Split it between them." |
| Punish | "Punish Oddi: his share goes to the store." |
| Pay compensation | "Pay Kolla from the store." |
| Call a household thing | "Put it to the thing tonight." |
| Ignore it | "Let it lie." |

### Sample dispute: a share of plunder
> Kári: "I took the gate. The arm-ring's mine."
> Oddi: "He took the gate. I carried the ring to the boat. Ask anyone."
> Kolla, watching: "Both true. Oddi did more carrying. Kári did more shouting."

Choices: "Give Kári the ring." / "Give Oddi the ring." / "Sell it and split the silver." / "Pay Oddi from the store; the ring to Kári." / "Punish them both: the ring goes to the store." / "Put it to the thing tonight." / "Let it lie."

### Sample dispute: whose shrine
> Eithne: "A cross by the well. That's all I ask."
> Runa: "That stone was by the well before your saints were born."

## 13 / Requests and quests
*A request sounds like the person asking. A quest reads like a plain instruction.*

### Asking
- **Small requests** are offhand, asked at work: Asa: "A loom. A proper one. I'm tired of weaving on a door."
- **Personal requests** come at a quiet moment, often at night or at the fire: Kolla: "Take me to Saltvik. I want to see who Kári's been talking to."
- **Dangerous requests** are formal. Gaels name lineage and the wrong; Norse speak it as an oath. Áine: "A man in Saltvik killed my father. I want him dead, and I want him to know why."
- **Leaders' requests** carry their people's need: Ninnid: "The pilgrims' road isn't safe past the farms. If your people walked it once, they'd stop being afraid."
- The steerer's answers are short choices: "I'll do it." / "No. Not that." / "After the harvest."

### The quest journal
- The current goal, or aim, is one plain line, fitting one subtitle line (section 10): "Find the man Áine names in Saltvik." It is always in the journal (J), for the player who wants it; there are no quest markers on screen (decision DE-23).
- Goals are written as instructions with no pronoun for the steerer.
- **Aims come from people first.** Each aim is given in speech by someone the steerer meets, and has two hints: the first offered by a nearby person after a spell with no progress, the second clearer, after a while longer (Book 10 section 25, "Guidance"). Hints are speech in the speaker's own voice and period English, never an instruction about controls, and never name a key. With no one near, a hint can come as a distant call with an information caption giving the direction.

### Chapter 1 aims
Every aim of Chapter 1 has its journal line and two hints (decision DE-24). The journal line is plain interface English; the hints are speech. The speaker in brackets is the default: when they are not near, the nearest resident of the household who knows of the aim speaks the hint in their own voice. **A hint that only makes sense in its place waits for it** (the user's fourth playtest, decisions DH-19 and DH-34): the stores' first hint only while the lashing is whole, and the second ("Stand still. Aim at the rope, not the bundle.") only on Wreck Strand near the mast, with the bow carried and the lashing whole.

| Aim | Journal | First hint | Second hint |
|---|---|---|---|
| Find who is calling | Find who is calling beyond the rocks. | (Hild, calling) "Over here! Past the rocks, to the west!" | (Hild, calling) "West! Follow the shore round the rocks!" |
| Free Hild | Cut Hild free of the net. | (Hild) "Something sharp. A blade. Look in the wreckage." | (Hild) "There was a glint on the shingle, back the way you came. Hurry." |
| Bring Hild ashore | Carry Hild above the tide line. | (Hild) "Higher. The tide comes this far." | (Hild) "Up past the weed. The dry stones. There." |
| See the old tower | Go up to the old tower to the north. | (Hild) "North. Up the bank, past the stream." | (Hild) "The old round tower. You can see the top of it from the shingle." |
| Carry the chest to the camp | Carry Thorkel's chest up to the old tower on the bank. | (Hild) "The old tower. Up the bank, past the stream." | (Hild) "Up the bank, then north. Set it down where the shelter goes." |
| Light a fire | Light a fire in the old tower. | (Hild, calling) "Wood! It's all along the tideline!" | (Hild, calling) "Two good pieces will do. Then the flint." |
| Raise the frame | Stand the oars up and lash them for the shelter's frame. | (Hild) "Two oars up against the wall. Lash them where they cross." | (Hild) "The third oar goes across the top. Then peg the ropes." |
| Raise the shelter | Raise the sail over the frame, before the rain. | (Hild) "The sail over the oars, before the rain." | (Hild) "Lash it along the top, and weigh the foot down with stones." |
| Finish the shelter | Help Hild finish the shelter. | (Hild) "The shelter wants finishing. Come and lend a hand." | (Hild) "Tighten the lashings, then turf on the weather side." |
| See to Hild's leg | See to Hild's leg. | (Hild) "My leg could use a look, when you've a moment." | (Hild) "Talk to me. I'll show you where it hurts." |
| The scavengers at the stern | See who is at the stern. | (Hild) "Someone's down at the stern. Hear that? Iron on wood." | (Hild) "Take care. Folk who strip wrecks don't like to be watched." |
| Sit at the fire | Sit with Hild by the fire. | (Hild) "Come and sit. It's been a long day." | (Hild) "The fire's warm. Come on." |
| Find Oddi | Find Oddi near the wreck. | (Hild) "Oddi was by the stern. Try the west end, by the wreck." | (Hild) "West end of the strand. Listen for him." |
| Find Bran | Find Bran and Father's body. | (Hild) "Bran went after Father. Up by the old mound, maybe." | (Hild) "East, past the machair. The sheepfold under the mound." |
| Find Runa | Find Runa at the Hag's Seat. | (Hild) "That light was out on the Hag's Seat. West." | (Hild) "West, out along the headland. Mind the wind on the neck." |
| Open Thorkel's chest | Open Thorkel's chest with the key. | (Hild) "You've the key. Father's chest is by the shelter." | (Hild) "Go on. Open it. He'd want it opened." (`REFERS:c_thorkel`) |
| Bring down the stores | Shoot down the stores from the broken mast. | (Hild) "That's our salt fish up the mast. An arrow through the rope would bring it down." | (Bran) "Stand still. Aim at the rope, not the bundle." |
| Patch the hull | Patch the old boat's hull with the boards. | (Runa) "The boards are on the shingle by the boat. Bring them." | (Runa) "Boards by the boat, then work. I'll help." |
| Cut the rigging free | Bring the rigging from the wreck at low water. | (Runa) "The rigging's on the skerry. Low water, or you swim." | (Runa) "Wait for the ebb. Then out over the flats." |
| Get a steering oar | Get a steering oar. | (Runa) "The scavengers had a skiff. Seal Cave, north-east." | (Runa) "Take theirs, buy theirs, or I carve one. Two days." |
| Thorkel's rites | Give Thorkel his rites, if the household will. | (Hild) "Father should have his rites before we sail." | (Hild) "Stones on the machair, or the sea. Talk to me." |
| Sit in council | Sit in council with the household at the fire. | (Hild) "Before we sail, we sit at the fire and settle it. All of us." | (Hild) "The fire, Steerer. Call everyone in. Then we sail." |
| Launch the boat | Launch the boat when the tide is in. | (Runa) "She's sound. Wait for the water and we'll run her down." (`REFERS:ship`) | (Hild) "Tide's in. Look the boat over and we'll go." |

The fire and shelter hints come as distant calls while Hild is still on the strand; the frame and sail hints call from the camp if the steerer is away. "See the old tower" is given by Hild's line on being set down (section 05) and is done on reaching the broch, or with the chest set at its outline; "Finish the shelter" opens at 06:00 on the second day (the user's third playtest, decisions DG-12 and DG-13). The Runa and Bran hints wait until they are in the household; until then Hild speaks them in her own words.

**Nudges and advice** (the user's fourth playtest, decisions DH-53 to DH-58; content/guidance.json; Book 10 section 08). Besides the two hints, each aim has a line for each resident who can be home while it is open (`<speaker>.nudge.<aim>`), saying what to do next in their own voice, as a remark rather than a hint: whoever is nearest says theirs, unprompted, now and then, and the nearest with no line for the current aim speaks of the next open one (the next person to find). The same line answers "Ask for advice", after the advisor's opening line (`<speaker>.advice.intro`: Hild "You're asking me? All right."), for the current aim and the next. Hild has a line for every aim from the old tower on; Oddi, Bran and Runa for each from the second day on. Samples: Hild (finding Oddi): "Oddi first, I'd say. He was by the stern when we broke." Oddi (Runa): "Runa? Chasing lights at the Hag's Seat. West. Mad as a gull." Bran (the oar): "The oar is in their skiff. Ask for it before you take it." Runa (the stores): "Fish on the mast. One arrow. Don't miss and sulk." Later chapters' aims gain lines in the same file.
- A revenge quest words every other way out as plainly as the killing: "Kill him." / "Offer him a duel." / "Make him leave the coast." / "Ask his kin for the blood-price." / "Tell Áine who ordered it."
- The one who asked speaks the ending by their values. Áine, after an exile: "He's gone. It's not what I wanted. It's something."

## 14 / Companions on the road
*Two residents walking with the steerer talk about what they see, to the steerer and to each other.*

### Rules
- Road comments are barks (section 08) and follow its rules: short, never blocking, never the only source of information.
- Triggers: a new place, a person met, the weather and season, a hazard, a discovery, a deed done in front of them, and the steerer's own state.
- Two companions talk to each other in exchanges of two or three lines. They disagree in character, and they sometimes leave the steerer out of it.
- When the steerer sneaks, companions whisper or stay silent; in a fight they use the combat barks.
- Comments on the steerer's state name the cause and never a gendered word: "You're shaking. Fire, now."

### Samples
| Category | Samples |
|---|---|
| Places | Bran near Kilbrecc: "I know this road. I wish I didn't." / Áine on Sliabh Carn: "Good height. Three valleys and a deer that doesn't know it's dead." / Eithne at Ardcarn: "That was my husband's field. Was." |
| Blocks and hazards | Runa at the High Pass: "That's six people's work for days, and none of them me." / "Ford's up. We wait or we swim." / "Green moss. Go round it." |
| The steerer's state | "You're blowing hard. Rest before the climb." / "Eat something. You're grey." / "Take my arm. Up." |
| Camping | "I'll take first watch. Wake me if the wolves come closer." / "Good fire. Good wall. Sleep." |
| Help | "Give me the end of the rope." / "Hold still. I'll cut you loose." |
| Disagreement | Kári: "Burn their huts. They'd burn ours." Bran: "They'd also run. Let them." |

## 15 / Travellers, wanderers and news
*The roads talk. Everything the household learns from far away comes from someone who saw it or heard it.*

### Travellers
One or two lines each, about their road and their reason, drawn from the minor characters' pools (section 17). A traveller the player has not met is named in the subtitle by what they appear to be ("Pilgrim:", "Rider:"), never by name (section 10).
| Traveller | Sample lines |
|---|---|
| Pilgrim | "Kilbrecc by the saint's day, if the ford lets us." |
| Herder | "Thirty head for the shielings. Mind your feet." |
| Fiachra's rider | "The rí's road. Keep to the side of it." |
| Refugee from Orm's raids | "Grey sails. Then fire. That's all I saw." |
| Tinker | "Pots mended, knives ground, no questions asked." |

### Wandering characters
| Speaker | Voice | Sample lines |
|---|---|---|
| The poet | A Gaelic file: formal, double-edged, delighted by their own words. The one speaker allowed long lines | "I have a verse about you. Would you like to hear it, or pay me not to finish it?" |
| The pedlar | Cheerful, quick, always selling, a little ashamed underneath | "News is cheap. Good news costs more." / "Needles, salt, or what Orm's men were asking about. Pick two." |
| The hermit | Few words, plain, unhurried | "The well is older than the saint. The saint knew it." / "Eat. Then go." |
| The disgraced warrior | Bitter, self-mocking, proud | "I ran once. Everyone knows. Now you know." / "Put me in the front. I'd like to find out." |

### Satire
- The poet's satires and praise poems are short verses of the poet's own making, built only from deeds the poet could have heard of. Write new verses each time; never adapt a known poem.
- A satire names the deed and the place, and calls the steerer by name, "the steerer" or "Thorkel's kin"; it never uses a gendered word.
- Samples, a satire and then a praise poem: "Ask at Carrick who came by night: / the seed was gone by morning light." / "Thorkel's kin left the seed in the sack: / the spring at Ardcarn will pay it back."

### News
- News always comes from a person: a traveller, a trader at the homestead, the ford-keeper, a monk, a fisherman. Important news also appears in the report (section 08).
- The speaker says what they know and how: **"I saw"** for certain, **"I had it from"** for likely, **"they say"** for rumour, matching the confidence words of Book 6 section 01.
- News of the household's own deeds names the sail and the place, never the steerer's gender.
- Samples: Cuán: "Riders crossed at noon. Fergal's. Going your way." / A Saltvik trader: "I saw Orm's ships at the Sound. Four. Maybe five." / The pedlar: "They say Carrick's keeper has two dogs now. Big ones." / A pilgrim: "Ardcarn's sowing failed. I had it from a carter. A black ship took the seed, he said."

## 16 / Period ethics in speech
*People judge by their own culture's code around AD 900, and say so in its words. Compassion is real; it speaks in period terms.*

### How each people speaks of right and wrong
Book 5 section 16 holds the codes and stances, and Book 6 section 01 how each people reads each deed. In speech:
| People | They speak of | Compassion sounds like | Sample lines |
|---|---|---|---|
| The Norse household, Orm's men, Ulf's | Honour and shame, luck, a good name, oaths, kin and vengeance, what the gods will do | "No need of that." "That brings bad luck." "His kin will come." "It shamed us." | Kolla: "No need of that. Now his brothers know our sail." / Gudrun: "We'll not have it said at Saltvik we kill men on their knees." |
| The Gaels | Honour-price and rank, éraic, hospitality, sureties, satire, geasa | "His honour-price is owed." "You ate at our fire." | Muiredach: "He was a free man of Ardcarn. His honour-price will be paid." / Órlaith: "Every feud my father starts, I inherit." |
| The Church | Sin and penance, the saints, God's judgement, sanctuary | "It is a sin." "Pray for him, and for yourself." | Senán: "It is a sin. I'll pray for you. I can't pray it away." / Muirenn: "Three dead. One of them innocent of any sword." |
| The Keepers | Give and take with the sea, oaths, what happens on their shore | "The sea will want something back." | Brónach: "You put blood on our stones. The sea keeps count." |
| Saltvik | The bargain, the scale, a debt paid | "Bad for trade." | Ottar: "Kill whom you like. Short my scales and you'll not sell here again." |

People of mixed birth (Bran, Senán, Áine) reach for either code, and sometimes argue with themselves: Bran: "A Gael would want silver for him. A priest would want my soul."

### The cruelty of each tradition, voiced
Each tradition's cruelty is spoken by those who practise it as ordinary, owed or necessary, and the writing never cheers it. A kind, doubtful or ashamed believer of the same faith is always within earshot (Book 5 section 15).
| Tradition | Its cruelty, said plainly | Its doubt or shame |
|---|---|---|
| Norse belief | Heid: "Rán is owed. I pay what is owed." / Orm: "Their families did not pay. The sea did not argue." | Thrand: "I held the rope. I'll carry that." / Tófi: "We called it glory. The widows called it something else." |
| The Church at Kilbrecc | Colmán: "The bondmen eat. Freedom never fed anyone." / Colmán: "We will fast against your house until God answers." | Senán: "They cannot leave. I tell myself the saint wants it so." / Muirenn: "I write our sins in the same ink as theirs." |
| Gaelic custom | The poet: "One verse, and no hall on this coast will feed you." | Órlaith: "The rich pay éraic. The poor pay in sons." |
| The Keepers and the old powers | Brónach: "The skin is the bond. Whoever holds it, she follows." | Nessa: "They leave the sick on the skerry. I hated the sea for that once." |

The hard limits hold in speech as everywhere: no line describes sexual violence, no child is on stage, and no line invites the player to torture. A seal-kin binding is spoken of as a hold over where she lives and whom she serves, and nothing more.

### Stance shapes what people say
| Stance | How they justify themselves | Sample |
|---|---|---|
| Conventional | Cites the code as plain fact | Runa: "You don't whistle on a boat. Everyone knows that." |
| Sceptical | Keeps the code, doubts it aloud | Tófi: "The gods won't mind. They never seem to." |
| Cynical | Uses the code's words for gain | Ottar: "Hospitality is sacred. So is my fee." |
| Transgressive | Owns the broken rule | Thrand: "I broke my oath to Orm. I'd break it again." |

### The steerer's choices are period voices
The steerer's dialogue options cover the range a person of the time might take, each with a period reason, never a modern one. The player can act against the household's code; the household reacts by that code (Book 5 section 16). A sample, when a guard at Carrick kneels and asks for quarter:
| Voice | Option |
|---|---|
| Conventional | "Quarter given. We don't kill men on their knees." |
| Pragmatic | "Dead men pay no silver. Bind him." |
| Merciful | "Let him go home. We are not Orm." |
| Cruel | "He saw our sail. He stays on the beach." |
| Transgressive | "Kill him and sink him. No one need know." |

Other period reasons to draw on: "Let their God judge them." / "His kin would come for us." / "The gods are watching this one." / "We ate at his fire." Option text never uses a gendered word for the steerer, and an option that speaks of the steerer carries the `ABOUT_STEERER` tag (section 03).

### Period views are spoken, never applied to the steerer
Characters may speak of thralls, the slave market, arranged marriages, blood-feud and harsh penance as ordinary, and some will urge the steerer to take captives for sale: Ulf: "Take the strong ones. Someone in the north will pay for them." The steerer's answers to such a line never lead to a sale; there is no market to take captives to, and captives are never currency (Book 5 section 01). Period attitudes to women and men are spoken in the world (Eithne's marriage, Órlaith's), but no line applies them to the steerer or reveals the steerer's gender (section 03).

## 17 / Conversation depth and line pools
*Major characters have branching, reactive conversation; minor characters have one or two lines that fit the moment.*

### Major characters
Leaders, antagonists, residents and quest characters are major (Book 5 section 18). Each has at least (Book 10 section 23, "Conversation depth"):
| Part | What it is | Sample |
|---|---|---|
| **Greetings by season and time of day** | One greeting for each season at morning, day, evening and night, and one for each feast day | Gudrun, a spring morning: "Light's early. So are you. Eat." / Gudrun, a winter night: "Shut the door. The dead are out walking tonight." / Gudrun at Yule: "Sit by me. I'll tell you who's missing this year." |
| **At least three topic trees** | Subjects the character returns to, each with branches that open by state and choice | Bran's trees: Kilbrecc and his old raid; the household's food and fire; the raiding life and what it costs |
| **Reactions to at least ten deed types** | A line for each deed in Book 6 section 01 they might see or hear of, in their culture's terms | Bran, below |
| **Callbacks** | Remembered events from the memory list (Book 5 section 01), named plainly | Hild: "You went back for Oddi at Carrick. I've not forgotten." |
| **A change of voice at thresholds** | Warmer and more open as a friend; short and cold when resentful; quick and quiet when afraid | Kári as a friend: "Point me at them." / resentful: "Ask someone else." / afraid: "Yes. Going." |

Branches change with time of day and season, the household's deeds and reputation, the speaker's happiness, friendship and fear, quest and story state, and recent events (a death, a raid, a storm).

Bran's reactions to ten deed types:
| Deed | Bran |
|---|---|
| `KILLING` | "They had spears. They chose it. Still." |
| `THEFT` | "Quiet work. Better than the other kind." |
| `CIVILIAN_KILLED` | "He had a hoe, not a sword. God saw it." |
| `SURRENDERED_KILLED` | "He was on his knees. That's murder in any tongue." |
| `SPARED` | "Good. Let him tell his kin who spared him." |
| `BURNING` | "That was someone's winter. Now it's smoke." |
| `SACRILEGE` | "I did this once. I'm still paying for it." |
| `HOSTAGE_TAKEN` | "Feed him at our fire. Then he's a guest, not a grudge." |
| `PROMISE_BROKEN` | "You gave your word. Now they know what it weighs." |
| `RITES_DENIED` | "Bury them. Theirs too. I'll dig." |

### Minor characters' line pools
Farmers, traders, guards, travellers and the people of a site have one or two lines each, drawn from pools keyed by **culture, season, time of day, weather and what the household has done**. Their motives are simple, and their lines are about what is in front of them. No identical line from the same speaker within ten minutes (section 08).
| Pool key | Sample |
|---|---|
| Gaelic farmer, spring, morning | "Seed's in. God and Brigid send rain." |
| Gaelic farmer, after `SEED_TAKEN` | "Nothing to sow. Thank your black ship for that." |
| Saltvik trader, rain | "Wet silver weighs the same. Buy something." |
| Kilbrecc lay brother, winter, evening | "Vespers soon. Shut the door behind you." |
| Ardcarn guard, after a fair bargain | "Colla says you paid fair. Go on, then." |
| Pilgrim on the Ridge Road, summer | "Fair at the cairns. Half the coast is walking." |
| Herder on Sliabh Carn, mist | "Mist on the tops. The cattle knew first." |
| Peat-cutter, after the household cleared a route of outlaws | "Road's quieter since you came through." |
| Saltvik fisher, after a raid on Carrick is known | "Carrick's grain, was it? Sell it somewhere else." |
| Charcoal burner, the Black Wood path (a true rumour) | "There was a farm here before the wood. They hid under the ground when raiders came." |
| Herder on the moor road (a wrong rumour) | "The old grave? That's the ring cairn on the ridge. Everyone knows." |

**Rumours of the secret entrances** (Book 6 section 13) live in these pools. A rumour is spoken as the speaker believes it, true or not, and nothing in the wording marks the wrong ones; about one in three is wrong (Book 10 section 20).
