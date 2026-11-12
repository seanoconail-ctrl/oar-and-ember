# Oar and Ember: instructions for coding sessions

Oar and Ember is a pixel-art Viking settlement RPG for desktop browsers, built from scratch in
TypeScript (strict) with WebGL2. The design is complete and lives in `docs/`. Your job is to build
it one stage at a time, following `docs/03_stage_plan.md`.

## At the start of every session
1. Read this file and `docs/01_game_bible.md` in full.
2. Read `docs/decision-log.md` and the newest file in `docs/stage-reports/`.
3. Find the stage the user names in `docs/03_stage_plan.md`, and read every book section it lists.
4. If the user gives playtest notes, record them in the decision log and update the affected book
   before writing code.

## The books
| Book | File | Owns |
|---|---|---|
| 01 | docs/01_game_bible.md | Design intent and locked requirements |
| 02 | docs/02_coding_contracts.md | Architecture, data shapes, runtime rules, tests |
| 03 | docs/03_stage_plan.md | Build order, gates, Stage 0 decisions, prompts |
| 04 | docs/04_setting_and_campaign.md | World, seasons, regions, supernatural rules, chapters |
| 05 | docs/05_people_and_factions.md | Characters, values, relationships, alliances |
| 06 | docs/06_voyages_and_raids.md | Complete scenarios and consequence chains |
| 07 | docs/07_ship_and_visual.md | Ship appearance and all art rules |
| 08 | docs/08_dialogue_and_voice.md | How everyone speaks; string rules |
| 09 | docs/09_level_layouts.md | Tile plans; the grids are in docs/levels/ |
| 10 | docs/10_balance_sheet.md | Every tuning number (exported to content/balance.json) |
| 11 | docs/11_audio_and_music.md | Music, sound and voice |

PDF copies for people are in `docs/pdf/`. The markdown files are the source of truth. Design
addenda 2.2, 2.3 and 2.4 (`docs/design-addendum-2.2.md`, `docs/design-addendum-2.3.md`,
`docs/design-addendum-2.4.md`) are folded into the books (decision log DA-1 to DA-16, DC-1 to DC-16
and DE-1 to DE-34); they are kept as a record only, and the books win over them from now on.

## Authority when books disagree
The user's latest instruction > Book 1 > Books 4 to 11 > Book 2 > Book 3.
Book 10 and `content/balance.json` are the only source of tuning numbers.

## Rules that never change
- Do only the named stage. Never start the next one. Stop at the build gates (Stages 12, 20, 24 and
  33) so the user can playtest.
- Follow Book 2. Never hard-code a tuning number; read it from `content/balance.json`.
- Real time with no tactical pause. The steerer's death is game over.
- Never use a gendered word for the steerer (Book 8 section 03).
- Never add children as actors, sexual violence, or a player torture action.
- Art is final art authored by you: palette-indexed sources per Book 7, compiled, rendered at 1x
  and 4x, and inspected. Never permanent boxes, circles or emoji. Flag any placeholder.
- Any work that adds or changes something visible must meet the Book 7 terrain art standard
  (section 14: terrain, decoration, animation, movement, wind, water, life, lighting, camera feel,
  shadows and idles). It ends with a screenshot and a 10-second capture saved to
  `docs/art/captures/stage-NN/` (`npm run capture -- stage-NN`), and the stage report compares them
  with `docs/art/reference/`. No "polish later": if it does not meet the standard, the stage is
  not done. Art lint and `tests/*/standard.*` enforce the measurable parts; never weaken their
  thresholds to pass.
- A new place starts with a mockup; wait for the user's approval before building it (Book 3).
- A new or redrawn character starts with its sprite sheets rendered at 1x and 4x and a short GIF in
  `docs/art/`; wait for the user's approval before wiring it into the game (Book 3).
- The game generates all of its own audio (Book 11 section 12): music as note data played by the
  in-game synthesiser, effects, ambience and voice blips in code. No recordings, composer, voice
  acting, or licensed or sampled music. Any work that adds a place, character or system adds its
  sounds and music to the Book 11 audio standard, with captions, and listens back
  (`npm run audio:render`) against the standard before it is shown.
- Write tests for every acceptance check, run them, and report results honestly, failures included.
- Record every departure from the books in `docs/decision-log.md` with the reason.
- If something is missing, contradictory or needs a decision, stop and ask.

## At the end of every session
- Run `npm run lint`, `npm test` and `npm run build` (from Stage 1 onwards), and the browser
  tests (`npm run test:browser`) when the stage touches anything visible.
- For visible work, run `npm run capture -- stage-NN` and compare the capture with
  `docs/art/reference/` in the report.
- Write `docs/stage-reports/stage-NN.md` in the Book 2 report format, including the latest CI
  results for Chromium, Firefox and WebKit. All three block publishing (decisions BR-2 to BR-7,
  which ended BR-1 and S1-18).
- Commit with a clear message and tell the user, in plain words, what changed, what to try at the
  published link, and anything they need to decide.
