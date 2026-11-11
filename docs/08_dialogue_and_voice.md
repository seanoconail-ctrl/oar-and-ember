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
- Period attitudes to women and men exist in the world and may be spoken (Eithne's marriage, Órlaith's), but no line applies them to the steerer or reveals the steerer's gender (section 16).

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

**Hild names the bow.** After the rescue, once she is sitting above the tide line, Hild tells the steerer what the wreck may still hold: `Hild: Father's hunting bow was in the stern. If it came ashore, look east.` When the steerer comes back with it: `Hild: That's his bow. He'd want it drawn, not mourned.` Her lines name the bow and the stern, never the steerer's gender (section 03).

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

### Fire talk
On evenings with a feast, a storm or a death, the household gathers at the fire. Two or three residents speak in turn; the player can join, prompt a story, or stay silent. Fire talk is where values clash openly and where songs and stories (Book 11) are performed.

## 10 / Writing for content files
### String rules
- Subtitles: at most two lines of 42 characters each.
- String keys: `<speaker>.<context>.<id>`, for example `c_hild.bark.danger.03`. Caption strings start `caption.`.
- Variables in braces: `{steerer}`, `{ship}`, `{place}`, `{count}`, `{speaker}`, and in interface text `{control:<action>}` for a control as currently bound. Never a pronoun variable for the steerer.
- Tags: `ADDRESS_STEERER`, `ABOUT_STEERER`, `VOICED`, `GLOSSARY:<word>`, and on every caption string `SPEECH` or `INFO`.

### Modern moral words
Dialogue strings, meaning every line spoken by a person (keys whose speaker is a person: `c_`, `l_`, `r_`, `e_`, `h_`, `p_`), never use modern moral vocabulary: **rights, war crime, genocide, trauma, civilian, ethics, morality, values, consent, abuse, victim, tolerance, equality**. Dialogue says "farmers", "folk" or "people who bore no weapon" rather than "civilians". "Innocent" is allowed: it is a Church word. Interface text, such as the household screen, and information captions are exempt. Content lint (Book 2) flags these words in dialogue strings, as it flags gendered words about the steerer (section 03).

### Subtitles and captions
Subtitles show two kinds of line, and they look different:
- **Speech** is what someone says: the speaker's name, a colon and the words, in upright type. `Hild: Here! Over here, past the rocks!` Speech follows every rule of this book.
- **Information** is a sound, a direction or another cue that is not speech: *italic*, with no speaker prefix and no quotation marks. *Hild, calling from the west*; *Surf breaking on the rocks*; *A horn, far off to the north*.

| Rule | Detail |
|---|---|
| Information lines | Under eight words, in the present tense, with a direction when it helps the player find the source. Plain, modern-neutral English: no glossary words, no slang, no period voice |
| Unmet speakers | A speaker the player has not met is named by what they appear to be ("Monk:", "Stranger:", "Ardcarn guard:") until introduced |
| Hidden identities | A subtitle name never gives away a hidden identity: Nessa's secret, a disguised enemy, an outlaw prince |
| Both at once | The information line sits above the speech line |
| Italic | A real italic of the caption font, or a hand-made slanted variant if the font is a pixel font; crisp at 1x, never a blurred, synthetic skew |
| Settings | Information captions can be turned off separately from speech subtitles (Book 2 section 21) |
| Tags and lint | Every caption string is tagged `SPEECH` or `INFO`. Content lint checks that a `SPEECH` string has a speaker (it starts `{speaker}: `) and an `INFO` string has none (no "Name:" prefix, no quotation marks, under eight words) |

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
- The current goal is one plain line, fitting one subtitle line (section 10): "Find the man Áine names in Saltvik."
- Goals are written as instructions with no pronoun for the steerer.
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
