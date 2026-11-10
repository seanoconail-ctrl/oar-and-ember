# Oar and Ember, Book 08: Dialogue and Voice Guide

*How every character and culture speaks, how Norse and Irish words appear in English, how the steerer is addressed, and how barks and conversations are written.*

Without a voice guide, LLM-written dialogue drifts into one polite, modern, explanatory voice. This book gives every person and culture a recognisable way of speaking, with sample lines to imitate and rules to check against.

**How to use:** Writers and the coding LLM read section 01 to 03 before writing any line, then the section for the speaker. Sample lines are illustrative and original; they may be reused or rewritten. Section 10 is the checklist every string passes before it is committed.

_Writing specification. All lines are original to this project. No line quotes or adapts a copyrighted text; Old Norse and Old Irish words are used as vocabulary, not quotation._


## 01 / Principles
*Plain, physical English with the weight of the period. Short sentences. Things before ideas.*

- **Concrete before abstract.** Rope, salt, iron, blood, barley, the wind's direction. People talk about what is in front of them.
- **Short lines.** Most spoken lines are under 15 words. Long speeches belong to poets, priests and Heid.
- **Subtext over exposition.** Nobody explains the plot to someone who already knows it. Information arrives sideways, in arguments, jokes and complaints.
- **People reveal their values.** A Mercy-minded speaker notices the hurt; a Gain-minded one notices the price. Book 5 values should be audible.
- **Humour is dry and frequent.** Understatement, insult between friends, gallows jokes. The harder the moment, the drier the joke.
- **No modern register.** No therapy-speak, no management language, no "okay", no "guys", no winking at the player.
- **No mock-archaic either.** No "thee" and "thou", no "ye olde", no stage dialect, no phonetic accents.
- **Violence is spoken plainly.** People describe wounds and deaths without relish or euphemism. The crew does not cheer atrocity, except those whose values say they would.

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
| Kári | Loud, hungry for fame; admires cruelty; brave | "They ran! Did you see them run?" / "Burn it. Let them see the smoke at Dún Fiach." |
| Kolla | Dry, protective of her twin, practical | "He's an idiot. He's my idiot. I'll handle it." |
| Tófi One-Eye | Hard old truth-teller; tender only with Ylva | "That's not glory. That's butchery with a good song." / "Eat, love. Eat a bit more." |
| Ylva | Frail, uncanny, matter-of-fact about omens | "Bran's other self was at the door again. Tell him to rest." |
| Kolbeinn | Grumbling craftsman, proud of his work, devoted to Asa | "This forge is a disgrace. Give me two days." / "Asa does the counting. I do the hitting." |
| Asa | Sharp with numbers, softer with Runa | "We owe Ottar forty. Not forty-one. I checked." |
| Thrand | Clipped, soldierly, haunted by what he saw | "Orm's men hold their line. Break the line, not the men." / "I watched her give them to the sea. I won't again." |
| Áine | Boastful, funny, deadly | "Name a crow. I'll put it down." / "You protect my cattle, I'll protect your neck. Fair?" |
| Senán | Gentle, bilingual, wryly devout | "Pax vobiscum. Mind the step. The heathen broke it in my grandfather's time." |

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
| Reactions to brutality | "That wasn't a fight." (Bran) / "Now that's a story." (Kári) / "God forgive us." (Eithne) / "We'll pay for that." (Tófi) |
| Return to Skarvholm | "That's our roof. Their smoke." / "They've salted the spring." / "Father's stones are still there." (Hild) |

## 09 / Conversations at home
*Talking to a resident opens a short conversation built from topics. It should feel like catching someone at work.*

### Structure
1. **Greeting** that reflects what they are doing and their regard ("Hand me that rope, if you're staying.").
2. **Up to three topics**, chosen by priority from memories: a recent deed they saw, a wound, a death, their job, the weather and season, a tie, a worry, a request.
3. **One player choice** per topic at most: agree, disagree, ask more, or move on. Choices can change regard.
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
- String keys: `<speaker>.<context>.<id>`, for example `c_hild.bark.danger.03`.
- Variables in braces: `{steerer}`, `{ship}`, `{place}`, `{count}`. Never a pronoun variable for the steerer.
- Tags: `ADDRESS_STEERER`, `ABOUT_STEERER`, `VOICED`, `GLOSSARY:<word>`.

### Checklist before committing a line
1. Does it sound like this speaker and no one else?
2. Is it concrete, short and in plain period English?
3. No banned modern words (okay, guys, cool, stress, process, deal with it) and no mock-archaic forms.
4. At most one glossary word, clear from context.
5. No gendered term for the steerer.
6. Does it reveal or hide only what the speaker would know?
7. Is violence described plainly, without relish (unless the speaker's values say otherwise)?
8. No quotation or close adaptation of any copyrighted text.
