# STAGE 3 REPORT: content, world state and saves

In the Book 2 section 23 format: one heading per report field.

## Implemented
- **Schemas, loaders and registries**:
  - `src/content/schema.ts`: typed validators that report every problem as file, path and reason, and that reject unknown fields.
  - `src/content/registry.ts`: one schema per content type and `loadContent`, which validates every file and then resolves every reference: places, regions, people, factions, string keys and Book 10 rows. It also checks every content ID against `content/ids.json`, ID prefixes against person kinds, and that ties go both ways.
  - `src/tools/content/loadContentFiles.ts` reads the files in Node.
- **balance.json generated from Book 10** (`src/tools/content/balanceFromBook.ts`; `npm run balance`): follows Book 10 section 01. Its output is identical, byte for byte, to the committed `content/balance.json`.
- **WorldState** (`src/sim/world.ts`): Book 2 section 05 with its people, deed, evidence, chapter and bargain types.
  - `newCampaign` lays out a new game from content: day 1 at 06:00, the starting crew missing, chapter 1 active, and Skarvholm known at stage S0.
  - Starting vitality and stamina are 100, read from Book 10's combat table.
  - The simulation from Stage 2 now runs on WorldState.
- **The ledger, evidence, facts and one-shots** (`src/sim/ledger/ledger.ts`):
  - Deeds and evidence can only be appended; each entry is frozen when added, and duplicates are refused.
  - Facts are superseded, never deleted.
  - A one-shot is recorded before its effect runs.
- **Content lint** (`src/tools/content/lint.ts`; `npm run content:lint`, also part of `npm run lint`).
- **Seed data**:
  - `content/places.json`: 28 places (sea map, home sites, Skarvholm).
  - `content/hazards.json` (4), `content/regions.json` (4 regions, 12 Skarvholm zones).
  - `content/people.json`: 36 people, with Book 5's values and stated ties.
  - `content/factions.json` (8), `content/hulls.json` (4), `content/fittings.json` (10).
  - 94 name strings added to `content/strings/en.json`.
  - All extracted from the books' tables and text, not retyped.
- **Versioned saves** (`src/persist/save.ts`): a header holding schema version, build, seed, day, chapter, state hash, kind, slot, sequence and time, over a deflated, base64 JSON world state.
  - Loading refuses files that aren't saves, unknown future versions and corrupt data (hash mismatch), and runs the migration chain.
- **Slots, autosaves and checkpoints** (`src/persist/manager.ts`):
  - Nine manual slots, refused under the safe rule while any hostile is aware.
  - Three rotating autosaves: on waking, before departure, before landing.
  - Labelled checkpoints, and `latestRestorePoint` for game over.
  - `attachWakingAutosave` saves on waking, before the morning report.
  - Stores: memory and guarded localStorage.
- **Golden save 1** (`tests/golden-saves/golden-01.json`, produced by `npm run golden`): a new campaign with the opening one-shot fired, a sleep after 18:00 on day 1, and a collapse at 02:00 on day 2. It ends at 08:00 on day 3 with stamina max −30.

## Tests
- `npm run lint`: ESLint, no problems; Prettier, all files formatted; content lint, clean.
- `npm test`: **17 files, 204 tests, 204 passed, 0 failed**. Stage 3 added:
  - `tests/unit/content.test.ts`: balance.json against Book 10; seed lint; counts; residents' values against Book 5's text; string keys; five deliberate breakages.
  - `tests/unit/saves.test.ts`: timing; reload hash and continued play; v1-to-v2 migration; refusals; base64; the safe rule; autosave rotation; restore points; the waking autosave's order; golden save 1.
  - `tests/property/ledger.property.test.ts`: 150 random sequences of up to 60 operations each.
- `npm run build`: passed. `npx playwright test --project=chromium`: 5 of 5 passed (nothing on screen changed).
- First run: 1 failure, a real weakness in content lint. One bad hull entry hid the problems in the others. Content lint now keeps checking the valid entries and reports every problem in one run (decision S3-9).

## Gate checks
1. **Lint passes on seed data; a broken reference fails with file, path and reason.** **PASS.**
   - The seed data has no issues.
   - A faction whose home is `TOWN_NOWHERE` gives exactly `content/factions.json: [0].home: unknown place "TOWN_NOWHERE"`.
   - Other deliberate breakages each report file, path and reason: a missing string key, a wrong ID prefix, an unknown field, a missing field, an unregistered ID, a missing Book 10 row, and a one-sided tie.
2. **Save under 200 ms; reload reproduces the state hash; a v1-to-v2 test migration passes.** **PASS.**
   - A late-campaign world (16 residents, 2,000 deeds, 2,000 pieces of evidence, 40 memories per person) saves in well under 200 ms, asserted by the test.
   - Reloading reproduces the state hash, and 50,000 further ticks from the reload match the run that never stopped.
   - A test migration from v1 to v2 (moving `player.name`) runs through the chain.
   - Future versions, missing migrations and corrupt data are refused with reasons.
   - Golden save 1 loads and is reproduced exactly by its scenario.
3. **Property tests: one-shots never refire; ledger and evidence are append-only.** **PASS.** Across 150 random sequences mixing deeds, evidence, one-shots, facts, save-and-reload and attempts to rewrite entries:
   - Every one-shot's effect ran exactly once.
   - The ledger and evidence only ever grew at the end, with earlier entries unchanged.
   - Writing to an appended entry throws.

## Art check
No art was added or changed in Stage 3.

## Balance
- `content/balance.json` is now generated from Book 10 and is unchanged.
- Newly used: starting vitality 100 and stamina 100 (Book 10 section 06, `vitalityStaminaAndArmour`).
- Hull and fitting content refers to Book 10 rows by name and copies no numbers.

## Deviations
- Decision log entries S3-1 to S3-9 (2026-11-10).
- **Books disagreeing (both resolved by Book 10 winning on numbers and names):**
  - Book 7 says T3 hulls have six fitting slots; Book 10 gives the knarr 5.
  - Book 7 calls the fitting "Grapnels and boarding planks"; Book 10 calls it "Grapnels and planks".
  - Slot counting is left to Stage 11 (S3-3).

## Known issues
- **Low:** origins are `UNSTATED` and three residents have no values in Book 5 (S3-5). Stage 8 should settle both.
- **Low:** saves use localStorage, which allows about 5 MB per site. A late-campaign save compresses to far less, but Stage 30's soak test should confirm.
- **Low:** questions for later stages, from seeding the ID registry and content, are listed in the Stage 1 report. None blocks Stage 4.

## Next stage ready
**YES.** All three acceptance checks pass.
