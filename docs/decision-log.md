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
| S1-16 | Firefox and WebKit browser checks run on GitHub's macOS runners (Intel `macos-15-intel`, because arm64 `macos-latest` jobs were twice cancelled unassigned for lack of capacity); Chromium stays on Linux. Approved by the user (2026-11-10) | Twice on Linux runners, Firefox had WebGL2 turned off and WebKit returned black screenshots. macOS runners have a GPU and run WebKit much closer to real Safari | The user checks Firefox and Safari by hand | 3 (Stage 1 check 2) |
| S1-17 | While Stages 1 to 6 are built on `claude/lucid-bell-kgmdfi`, pushes to that branch also publish to GitHub Pages, so every stage is playable at the link before the single final pull request. Remove the branch from the workflow once it is merged. Approved by the user (2026-11-10) | Stage 1 check 2 needs a published address, and the user wants one pull request at the end | Publish from main only | 2 (section 01), 3 (Stage 1) |
| S1-18 | Publishing waits for Chromium (Linux) and Firefox (macOS) only. The WebKit check still runs on every push and against the published address, but does not block (`continue-on-error`). The game records its start-up steps on the canvas (`data-boot`, `data-error`) so the WebKit stall can be diagnosed. Approved by the user (2026-11-10) | WebKit failed three times in CI: black screenshots on Linux, and a stall before the title on macOS with no error. The user checks real Safari at the published link | Keep WebKit blocking; drop it | 3 (Stage 1 check 2) |

## 2026-11-10, Stage 2 (core runtime and calendar)
Approved by: pending the user's review (the user authorised Stages 1 to 6 to continue without waiting).

| # | Decision | Reason | Alternatives | Books affected |
|---|---|---|---|---|
| S2-1 | Spring tides fall on days 1, 2, 3 and 16, 17, 18 of each season (Book 10), not days 1 and 16 (Book 2 section 03) | The books contradict each other. Book 10 is the only source of numbers (CLAUDE.md authority rule), and the user did not object when this was raised | Book 2's two days | 2 (section 03), 10 (section 02) |
| S2-2 | A calendar day runs from 06:00 to the next 06:00, so its watches are Morning, Day, Evening and Night (00:00 to 06:00). `minuteOfDay` is clock time after midnight | Book 10 lists the night watch as the day's fourth watch, and a day runs from waking to waking | Turn the day at midnight | 2 (section 03), 10 (section 02) |
| S2-3 | Low water falls where an ebb watch turns to flood. When the one-watch shift every three days puts two ebb watches together, they make one long ebb with a single low water at its end | Book 10 says "low water at the end of each ebb watch" and "1 watch every 3 days"; this reads both literally without two low waters six hours apart | Two low waters in a row | 2 (section 03), 10 (section 02) |
| S2-4 | The year (120 days) and season (30 days) lengths are calendar constants citing Book 1 section 12, and the 60 Hz tick is a constant citing Book 2 section 03; none is in `balance.json` | They are locked requirements and contracts, not tuning numbers, and Book 10 does not list them | Add them to balance.json (Stage 3 could, with the user's agreement) | 1, 2, 10 |
| S2-5 | Stage 2's simulation state holds only the calendar, the on-foot clock, the player's waking state and the RNG streams; tide is computed from the calendar rather than stored. Stage 3 grows it into Book 2's full WorldState | Stage 3 owns WorldState; derived values in saved state could drift from their rules | Store tide state | 2 (sections 03, 05) |
| S2-6 | The game minute advances in integer steps: each tick adds 100 units, and a minute costs secondsPerHour x day-length percent units. A refused command emits COMMAND_REFUSED with a reason code and the limit (for example 18:00) | Integer arithmetic keeps replays exact at every day-length option (0.75 gives 37.5 ticks per minute); reasons let the UI explain every refusal (Book 2 section 21) | Floating-point minutes | 2 (sections 03, 21) |
| S2-7 | The determinism lint rule also covers `src/core`, and bans Date, performance, timers and crypto randomness as well as Math.random | core holds the RNG and tick that sim builds on | sim only | 2 (sections 03, 24) |

## 2026-11-10, Stage 3 (content, world state and saves)
Approved by: pending the user's review (the user authorised Stages 1 to 6 to continue without waiting).

| # | Decision | Reason | Alternatives | Books affected |
|---|---|---|---|---|
| S3-1 | Seeded content: Book 4's sea-map places, home sites, Skarvholm places, sea hazards, regions and Skarvholm zones; Book 5's 36 named people and 8 factions; Book 7 and 10's 4 hulls and 10 fittings. Tasks, buildings, scenarios, puzzles and dialogue are left to the stages that build them | Stage 3 asks for seed data from Books 4, 5, 7 and 10; content without its system would only drift | Seed every book now | 4, 5, 7, 10 |
| S3-2 | Content holds no numbers: hulls and fittings name their Book 10 row (`balanceRow`), and content lint checks the row exists | Book 10 and balance.json are the only source of numbers; Book 10 section 01 says content refers to keys | Copy stats into content | 2 (section 04), 10 (section 01) |
| S3-3 | `FIT_GRAPNELS_BOARDING_PLANKS` uses Book 10's row "Grapnels and planks" (Book 7 says "Grapnels and boarding planks"). Fitting slots include Book 7's gunwale, bow identity and mast identity. How those count against slot totals is open: Book 7 gives T3 hulls six slots, but Book 10 gives the knarr 5 | The books name and count them differently; Book 10 wins on numbers, so the slot rules wait for Stage 11 | Decide slot counting now | 7 (section 03), 10 (section 05) |
| S3-4 | Seeded ties are only the existing relationships Book 5 states: Gudrun and Arnbjörn, Gudrun and Ylva, Kári and Kolla (kin); Tófi and Ylva, Kolbeinn and Asa (spouses); Runa and Asa (sisters). Ties must be reciprocal | No romance system; residents may arrive with existing relationships (Book 1 section 02, Book 2 section 06) | Infer more ties from prose | 5 (sections 02, 08) |
| S3-5 | `Person.origin` is `UNSTATED` and each person's values come only from Book 5's text (Nessa, Ylva and Asa have none stated). The starting crew begin `missing` and are found in Chapter 1 | Book 5 does not give every origin; inventing them would be a design change. Stage 8 (people) settles origins | Infer origins from names | 2 (section 06), 5 |
| S3-6 | Saves are JSON with a header and a deflated (fflate), base64-encoded world state. Slots: `manual-1` to `manual-9`, three rotating autosaves chosen by a save sequence number (not the wall clock), and `checkpoint:<label>`. The browser store is localStorage, with every access guarded | Book 2 section 20 asks for compressed JSON with a header and hash; the sequence keeps rotation deterministic | IndexedDB (later if saves outgrow localStorage) | 2 (section 20) |
| S3-7 | The design set's revision in balance.json is read from Book 1 ("Revision 2.1"), because Book 10's markdown does not state it | balance.json already carried revision 2.1; the generator must reproduce the file exactly | Hard-code it | 10 (section 01) |
| S3-8 | WorldState follows Book 2 section 05 field for field, except that weather is absent until Stage 13 and tide is computed (S2-5); `Deed.doer` is an ID or "HOUSEHOLD" | The sea map owns weather; storing derived tide invites drift | Placeholder weather | 2 (section 05) |
| S3-9 | Content lint runs as part of `npm run lint`, and also alone as `npm run content:lint`. A list with a bad item still checks its good items, so one run reports every problem | CI then enforces content correctness on every push | Separate CI step | 2 (section 04) |

## 2026-11-10, Stage 4 (WebGL renderer and art pipeline)
Approved by: pending the user's review (the user authorised Stages 1 to 6 to continue without waiting).

| # | Decision | Reason | Alternatives | Books affected |
|---|---|---|---|---|
| S4-1 | People and props are authored as material maps (one letter per material, plus marks such as eyes). A committed, deterministic generator (`src/tools/art/materials.ts`) turns each map into the palette-coded sheet: ink outline, three-tone shading lit from the upper left, the idle breath frames, and the unarmed west facing mirrored from east before shading. The palette-coded sheet is committed and is what the compiler reads; art lint fails if it falls out of step with its map | Book 7 section 11 allows deterministic generator scripts committed with their output. Shading after mirroring keeps the light from the upper left | Hand-shade every frame | 7 (section 11) |
| S4-2 | Sheet names add `prop_` (scenery such as the Grey Men stones) and `decal_` (blood decals) to Book 7's `actor_`, `ship_`, `token_`, `tile_`, `bld_` and `fx_` | Book 7's table has no pattern for scenery props or gore decals, which Book 2 section 19 keeps as separate sheets | Put them under `fx_` | 7 (section 11) |
| S4-3 | One atlas per sheet (PNG plus JSON manifest) in `assets/atlases/` | Few sheets so far; shared atlases can come when the sheet count makes draw calls matter | Shared atlases now | 2 (section 19) |
| S4-4 | Lighting and cutaway art direction lives in `assets/art/render.json`: ambient light per phase (day 255,255,255; dusk 240,196,160; night 92,116,164), light pools in 3 bands, and a 50% cutaway fade | These are art direction from Book 7 section 08, not tuning numbers, and Book 10 has none for them | Put them in balance.json | 7 (section 08), 10 |
| S4-5 | A tall object drawn in front of the player and overlapping them is cut away with a 50% ordered-dither fade (the 4 x 4 Bayer pattern) | Book 7 section 01 asks for "a cutaway or fade"; a dithered fade keeps the pixel look and costs no extra art | Cut-away sprites per object | 7 (section 01) |
| S4-6 | Renderer check views stay in the published build at `?view=art-test&case=front|behind|dusk|night` and `?view=sheet&sheet=<name>` | The browser tests need them, and the user can see the renderer and the art at the published link | Test-only build | 3 (Stage 4) |
| S4-7 | The steerer's body model A wears a madder-red tunic, a weld-green cloak pinned at the shoulder, woad trousers and undyed leg-wraps. Skin uses undyed wool, bleached linen and shingle, because the Book 7 palette has no skin ramp | Book 7 section 07 describes Norse household dress; the palette's cloth colours make a restrained, readable figure | Add skin tones to the palette (a Book 7 change for the user) | 7 (sections 07, 08) |
| S4-8 | The idle animation is 4 frames at 15 ticks each | Book 7 sets idle at 4 frames but gives no timing, and Book 10 lists none for idle | Another timing | 7 (section 01) |
