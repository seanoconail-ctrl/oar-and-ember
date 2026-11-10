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

## 2026-11-10, Stage 1 (project setup)
Decisions taken while setting up the project. None changes a locked Book 1 feature. Approved by: pending the user's review.

| # | Decision | Reason | Alternatives | Books affected |
|---|---|---|---|---|
| S1-1 | Toolchain pinned: TypeScript 6.0.3, Vite 8.3.5, Vitest 5.1.0, ESLint 10.13.0 with typescript-eslint 8.72.1, Prettier 3.9.10, Playwright 1.63.0, Node 22 | typescript-eslint does not yet support TypeScript 7. Vitest 5.0.5 cannot be installed (npm's resolver crashes on its open-ended optional peer), so 5.1.0 is used. Playwright 1.63.0 matches the browser pre-installed in the build environment | TypeScript 7 without type-aware lint; Vitest 4 | 2 (section 01) |
| S1-2 | The palette's hex values are transcribed from the Book 7 PDF figure (section 08, page 9) into `assets/palette/book07.json`, with one-character codes for art sources | The markdown Book 7 says the palette is "drawn in the PDF version" and gives only the blood reds as text | Ask for the values to be added to the markdown first (recommended for the future: add the 24-colour table to Book 7 section 08) | 7 (sections 08, 11) |
| S1-3 | The title lettering is authored as glyph masks finished deterministically (Scale2x, one-pixel ink outline, three-tone ramp lit from the upper left); a named ramp maps the result to palette codes when text is drawn | One glyph must be drawn in two materials (the "r" of "Oar" in wool and of "Ember" in hearth colours), which rows of fixed palette codes cannot do. Every pixel is still a palette entry, and the outline and lighting follow Book 7 section 11 | Duplicate every glyph per colour | 2 (section 19), 7 (section 11) |
| S1-4 | Stage 1 compiles the two font sources when the page loads and composes the static title frame on the CPU; WebGL2 presents it at a whole-number scale | The art compiler, atlases and GPU sprite drawing are Stage 4 deliverables. The same deterministic code runs in the browser, the tests and the render-to-image check, so they agree pixel for pixel | Build the Stage 4 pipeline early | 2 (section 19), 3 (Stage 4) |
| S1-5 | Below 640 x 360 device pixels the scale stays at 1 and the frame is cropped evenly rather than shrunk; letterbox bars use Outline ink `#22313A` | The books require whole-number scaling and letterboxing but do not cover windows smaller than the frame or name a bar colour | Fractional down-scaling (would blur pixels) | 1 (section 17), 7 (section 01) |
| S1-6 | The build id is `<version>+<short commit>` (e.g. `0.1.0+9d16de8`), with version `0.<stage>.<patch>` | A playtest note can then always be matched to the exact code that ran | CI run number | 2 (section 20) |
| S1-7 | The Book 2 layer rules are enforced by lint (`no-restricted-imports`), and Node built-ins are allowed only in `src/tools` | Catches a forbidden dependency the moment it is written | Review by hand | 2 (section 02) |
| S1-8 | Added `tests/browser/` (Playwright smoke tests in Chromium, Firefox and WebKit) beside the Book 2 test folders | Acceptance check 2 needs a browser test, and the workflow repeats it against the published address | Manual checks only | 2 (sections 02, 23) |
| S1-9 | WebKit (Safari's engine, run by Playwright on Linux) stands in for Safari in automated checks; real Safari is checked by the user at the published address | GitHub's Linux runners cannot run Safari itself | macOS runners with safaridriver | 3 (Stage 1 check 2) |
| S1-10 | The ID registry is `content/ids.json`: 402 entries (91 stated in the books, 13 expanded from shorthands such as `MUS_HOME_DAWN/DAY/DUSK/NIGHT`, 298 assigned in Stage 1), 6 ID families and the 19 Book 6 deed tags. Each entry cites its book and section and quotes the book verbatim; tests check both. 65 candidate IDs the extraction marked as doubtful were held back for the stage that needs them | Stage 1 asks for a registry seeded from Books 4 to 11, but most named things in Books 6, 7, 8 and 10 have no written ID. Seeding only confident IDs protects the "stable forever" rule | Seed stated IDs only | 2 (section 04) |
| S1-11 | Registry naming: proper names join into one token as the books do (`FORT_DUNFIACH`); descriptive words are separated (`SK_WRECK_STRAND`). `REG_SK` is assigned for Skarvholm's on-foot region, because the stated `ZONE_SK_*` zones need a parent. The Keepers' faction is `FAC_KEEPERS`; the Return scenario is `SCN_RETURN`, with its complications `CMP_RETURN_*`. `MUS_THEME_*` leitmotifs are left out because they are material inside cues, not cues. Seven tasks cite Book 2 section 07 and `SCN_CARRICK` is stated in Book 2 section 23, both outside Books 4 to 11 | Consistency with the stated IDs; short, readable IDs | `FAC_INISRON`, `SCN_RETURN_SKARVHOLM` | 2 (section 04), 4, 5, 6, 11 |
| S1-12 | An assigned ID may be renamed, with a decision-log entry, only until content first uses it (Stage 3 onwards); after that it is frozen like a stated ID | IDs are stable forever, but nothing uses the assigned ones yet | Freeze all IDs now | 2 (section 04) |
| S1-13 | Interface strings use the speaker `ui` in Book 8 keys (e.g. `ui.title.name`) | Book 8 section 10 defines `<speaker>.<context>.<id>` but has no speaker for interface text | `sys` | 8 (section 10) |
| S1-14 | The Firefox smoke test sets the preference `webgl.force-enabled` | GitHub's runners have no GPU, and headless Firefox there turned WebGL off (the game correctly showed its "needs WebGL2" message). The preference makes Firefox use its software renderer. It changes only the test browser, not the game | Skip Firefox in CI | 3 (Stage 1 check 2) |
| S1-15 | The canvas size in device pixels is CSS size times the pixel ratio. The browser's exact device-pixel size is used only when it agrees within one pixel | Emulated (and some headless) browsers report CSS pixels as "device pixels". Trusting them made the browser stretch the canvas, which blurs the art at ratios such as 1.25 or 1.5. Found by the pixel-ratio-2 browser test | Trust the reported size | 1 (section 17), 7 (section 01) |
