# Decision log

One entry per decision or departure from the books: date, stage, decision, reason, books affected, approved by.

## 2026-11-10, Stage 0 decisions (approved by the user)
| # | Decision | Decided |
|---|---|---|
| 1 | Engine and language | TypeScript (strict) with WebGL2; a new project built from scratch |
| 2 | Platforms and input | Desktop browser first; keyboard, mouse and gamepad |
| 3 | Art production | Final art authored by Claude as palette-indexed sources, compiled and visually checked; the user reviews at gates |
| 4 | Art scale | 640 x 360 viewport, 24 px tiles, 32 x 40 people; all art new |
| 5 | Combat model | Real time, no pause: light attack, charged heavy, parry, block, dodge, stamina, facing |
| 6 | Player character | The player names the steerer and chooses one of two body models; gender never stated |
| 7 | Steerer death | Yes: game over, with reload; optional Second wind |
| 8 | Crew permadeath | Yes, with the Rán's mercy option |
| 9 | Campaign length | OPEN. Provisional 40 to 60 hours over 270 days, days of about 17 minutes; confirm after Build 2 |
| 10 | Sea map | Charted routes on a node graph |
| 11 | Sea battles | One-on-one first; up to three ships late; no fleet command |
| 12 | Violence | Mature: heavy blood and gore; civilians and the surrendered can be killed, with consequences from witnesses and evidence. Hard limits: no children as actors, no sexual violence, no player torture |
| 13 | Myths | Ambiguous: powers seen through signs and proxies; relics never settled |
| 14 | Language and names | Native-form names with accents; English dialogue with a curated glossary (Book 8) |
| 15 | Nessa's stance | Random per campaign, hidden |
| 16 | Saves | Free saves when safe, rotating autosaves, checkpoints |
| 17 | Romance | None; characters may have existing relationships |
| 18 | Authored versus procedural | Hand-authored scenarios and cast; generated residents and minor variants only |
| 19 | Audio | Voiced barks at most; music is a priority (Book 11) |
| 20 | Gate sign-off and title | The user playtests each build gate. Title: Oar and Ember (no existing game found by web search; trademark check still needed) |

## 2026-11-10, further design decisions
- The home (Skarvholm, later the mainland home) is fully playable on foot, with tasks, building designation, conversations and combat. Books 1, 2, 4, 9, 10.
- A 120-day year of four seasons with consequences is the rhythm of a 270-day campaign. Books 1, 4, 10.
- Late game: the required Return to Skarvholm, held by Orm's garrison, to recover Manannán's Cup. Books 1, 4, 5, 6, 9, 10.
- No existing codebase: Stage 1 creates the project and publishes it to GitHub Pages. Books 2, 3.
- Open: who composes the final music (Book 11 section 11).
