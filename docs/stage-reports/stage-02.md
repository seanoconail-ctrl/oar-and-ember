# STAGE 2 REPORT: core runtime and calendar

In the Book 2 section 23 format: one heading per report field.

## Implemented
- **Fixed 60 Hz tick** (`src/core/fixedStep.ts`): `planSteps` turns elapsed frame time into whole ticks plus an interpolation fraction. A frame longer than 250 ms is not caught up in full.
  - `src/scenes/loop.ts` drives it from `requestAnimationFrame`. Wall-clock time is read only there, in `scenes/`.
  - The loop is not yet started on the title screen, which has nothing to simulate; the campaign starts it in Stage 6.
- **Calendar** (`src/sim/calendar/calendar.ts`):
  - Days, the 120-day year and its 30-day seasons, and the four watches.
  - Clock time in minutes after midnight, with the day turning at 06:00.
  - The tide: flood and ebb each watch, a one-watch shift every 3 days, low water where an ebb turns to flood, spring tides on days 1–3 and 16–18 of each season, and tidal ground open for the 3 game hours around low water.
  - Daylight by season.
- **On-foot clock, sleep and collapse** (`src/sim/simulation.ts`):
  - A game minute lasts `secondsPerHour` real seconds per hour, scaled by the day-length option (0.75 to 1.5). Integer arithmetic keeps every setting exact.
  - `SLEEP` works from 18:00 to 02:00 and advances to 06:00 the next day. Before 18:00 it is refused, giving the time it will work.
  - Staying awake to 02:00 is a collapse: waking at 08:00 the next day with maximum stamina −30 for that day.
  - Every waking emits `MORNING_REPORT_DUE`.
- **Named RNG streams** (`src/core/rng.ts`): the eight Book 2 streams (weather, encounters, loot, combat, ai, people, generation, gore).
  - Each is an sfc32 generator seeded from the campaign seed and the stream's name.
  - Its state is four numbers that save and reload exactly.
  - Helpers: whole numbers without bias, floats, chance and pick.
- **Command and event bus**:
  - `src/core/events.ts` is a typed `EventBus`.
  - Simulation commands (`SLEEP`, `SET_DAY_LENGTH`) are queued and applied at the start of the next tick, in order.
  - Systems emit typed events: watch started, tide turned, season started, slept, collapsed, woke, morning report due, day length changed, and command refused (with a reason code).
- **State hashing** (`src/core/hash.ts`): key-order-independent JSON with a 53-bit hash (cyrb53), giving 14 hex digits per state.
- **Record and replay harness** (`src/sim/replay.ts`):
  - A recording is the starting state, the commands with their ticks, and checkpoint hashes.
  - `replay` re-runs it and lists any checkpoint whose hash differs.
  - `snapshot` copies state the way a save file would.
- **Determinism lint rule** (`eslint.config.js`): in `src/sim` and `src/core` it rejects `Math.random`, `Date`, `performance`, timers and `crypto` randomness.
- **Book 10 time values** (`src/content/balance.ts`): `parseTimeBalance` reads the clock, daylight and tide tables from `content/balance.json`.
  - It parses Book 10's wording strictly, for example "1 watch every 3 days" and "Wake 08:00, stamina max -30 for the day".
  - Changed wording fails with the table, key and value.
  - `src/tools/content/loadBalance.ts` loads it in Node.

## Tests
- `npm run lint`: ESLint, no problems; Prettier, all files formatted.
- `npm test`: **14 files, 184 tests, 184 passed, 0 failed**. Stage 2 added three files with 51 tests:
  - `tests/unit/calendar.test.ts`: Book 10 values; refusing changed wording; seasons and years; the day turning at 06:00; daylight; the on-foot day; day length; sleep; collapse; every tide rule; tide events.
  - `tests/unit/runtime.test.ts`: RNG streams; the fixed step at 30, 60, 75 and 144 fps; the event bus; hashing; the determinism lint rule.
  - `tests/unit/replay.test.ts`: record, replay, resuming from a save, detecting a changed input, and a different seed.
- `npm run build`: passed.
- Browser smoke test (`npx playwright test --project=chromium`): 5 of 5 passed. Stage 2 changes nothing on screen.
- First run: 4 tests failed, all from mistakes in the tests, not the code:
  - Day 270 is day 30 of Spring in year 3, not Summer.
  - The tide-shift case used the wrong day's night watch.
  - The "changed input" case changed nothing: it shifted a refused sleep by one tick.
  - 250 ms is exactly 15 ticks, but floating point made the expected value 14.
- All four tests were corrected; none was weakened.

## Gate checks
1. **Replay reproduces identical state hashes.** **PASS.**
   - The script covers four on-foot days (240,000 ticks) with 20+ scripted sleep and day-length commands. Replaying it reproduces all 80 checkpoint hashes.
   - Resuming from a JSON save at the halfway point gives the same hashes as the run that never stopped.
   - One extra command changes the later hashes, and so does a different campaign seed. That shows the hashes are sensitive, not trivially equal.
2. **Calendar tests.** **PASS.**
   - **Day length:** the day runs from 06:00 to 02:00, exactly 60,000 ticks (1,000 real seconds, Book 10's 16.7 minutes). 50 real seconds make one game hour. The day-length option gives 45,000 ticks at 0.75 and 90,000 at 1.5; out-of-range values are refused with "0.75 to 1.5".
   - **Sleep:** a bed works at 18:00, 23:30 and 01:59, giving 06:00 next day and the morning report, and is refused at 17:59 with "18:00".
   - **Collapse:** at 02:00 it gives 08:00 next day with stamina max −30, cleared by the next proper sleep.
   - **Tide:** flood and ebb alternate by watch; low water falls at the end of the ebb; the tide shifts one watch every 3 days; spring tides fall on exactly the 24 Book 10 days a year; tidal ground opens from 90 minutes before low water to 90 minutes after.
3. **The lint rule fails a deliberate violation.** **PASS.** ESLint rejects six deliberate violations in both `src/sim` and `src/core`: `Math.random()`, `Date.now()`, `new Date()`, `performance.now()`, `setTimeout` and `crypto.randomUUID()`. It allows `performance.now()` in `src/scenes`.

## Art check
No art was added or changed in Stage 2.

## Balance
- Used from `content/balance.json` (Book 10 section 02):
  - Clock: secondsPerHour 50, dayStart 06:00, dayEnd 02:00, activeDayMinutes 16.7 (as a test target), sleepAfter 18:00, the collapse penalty (wake 08:00, stamina max −30), dayLengthOption 0.75 to 1.5, and watchHours 6. seaWatchAnimSeconds 4 is read for Stage 13.
  - Daylight: all four seasons.
  - Tide: alternation, phaseShift, springTideDays and tidalGroundWindow.
- Not in `balance.json`, held as constants with their source:
  - The 120-day year and 30-day seasons (Book 1 section 12).
  - The 60 Hz tick (Book 2 section 03).
- Nothing was changed.

## Deviations
- Decision-log entries S2-1 to S2-7 (2026-11-10).
- The main one is S2-1: Book 2 and Book 10 disagree on the spring-tide days, and Book 10 wins on numbers. The others are interpretations: the day turning at 06:00 (S2-2) and low water at the turn of the tide (S2-3).

## Known issues
- **Low:** Stage 2's state is deliberately minimal. Stage 3 builds Book 2's full WorldState, saves and migrations on top of it.
- **Low:** the frame loop (`src/scenes/loop.ts`) has no automated test of its own, because it needs a browser animation frame; the step plan it uses is tested.
- Carried from Stage 1: Safari (WebKit) is still to be confirmed by the user at the published link.

## Next stage ready
**YES.** All three acceptance checks pass.
