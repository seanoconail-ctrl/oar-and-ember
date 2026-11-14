# THE USER'S FOURTH PLAYTEST: the people (requests 9 to 14)

In the Book 2 section 23 format. One of the parts of the user's fourth playtest (decisions DH-40 to
DH-66 in `docs/decision-log.md`, "Building the people (the user's fourth playtest)"). The final pass
brings the parts together, regenerates golden save 11 and writes the combined report.

## Implemented
- **Request 9, bound still; one who refuses** (DH-40 to DH-43). A resident being bound is `TENDED`:
  they sit still where they are, facing the steerer, until the binding ends. **Runa refuses** by her
  Superstitious trait ("Another's hands on my hurt, and the sea marks me. I'll bind it."), the first
  time it is offered for a wound and again that day; the talk then offers "Then bind it yourself.
  I'll hold the end." (taken up at once), "The boat needs you whole." (does not move her) and "Suit
  yourself."; asked on a later day she gives in. The refusal is data (`content/company.json`
  `care.refusers`), keyed to the trait. `src/sim/people/company.ts`, `src/sim/people/talk.ts`,
  `src/sim/people/schedule.ts`, `src/sim/people/day.ts`; talk nodes in `content/talk.json`.
- **Request 10, talk among the household** (DH-48 to DH-52): 18 exchanges of two or three lines
  (46 lines), chosen by ties (Hild and Oddi friends, Bran Oddi's mentor: Book 5's table now in
  `content/people.json`), traits and events (the fold, the theft, the hull patched, Thorkel's rites
  waiting), least lately heard then most particular; speech lines in the speakers' blips, never in a
  fight or out of the steerer's hearing, never back to back (90 to 180 s apart), never within 6 s of
  another speech line, barks waiting while one is spoken.
- **Request 11, nudges** (DH-53 to DH-56): `content/guidance.json`, by aim and speaker (Hild for every
  aim from the old tower on, Oddi, Bran and Runa for every aim open from day 2), for any chapter's
  aims. The nearest resident in earshot with a line for the current aim says it (else for the next
  open aim: the next person to find), 30 s after the aim opens, then every 60 s, at most 4 an aim.
- **Request 12, "Ask for advice"** (DH-57, DH-58): offered by Hild always and by any resident at
  friendship 40 or more (later the steward); the advisor's opening line, then their lines for the
  current aim and the next one.
- **Request 13, their own hours** (DH-44 to DH-47). The cause: `activityOf` put everyone to bed
  whenever the steerer lay down. Now each sleeps by their own hours: Diligent and Pious rise 45 game
  minutes early (Bran at his prayers, Runa at the boat before the steerer wakes), those who love the
  fire stay an hour late (Hild), one keeps the night watch by turns until 02:00 (feeding the fire)
  and sleeps on to 07:00. The steerer's sleep still passes the night; afterwards everyone is placed
  where their own day has them.
- **Request 14, boat work** (DH-59 to DH-64): six spots round the boat (either side, stem and
  stern, standing and kneeling) and three seated ones for the seriously wounded, one worker a spot,
  none on the steerer's own work spot; "The boat" asked of the boat's hands gives what it needs next
  in their voice (36 lines); the boat drawn gradually: the hull wrecked, trimmed and shored, half
  boarded, boarded and riveted, patched; the rigging lying in the boat, stepped unstayed, set up
  (new sheets `ship_t1_work`, `ship_t1_rigwork`; `assets/art/authoring/pt4_boat_art.py`); each
  worker heard at the boat.
- Books 2, 5, 7, 8, 10 and 11; Book 10 section 08 gains "Own hours", "Binding a wound", "Talk among
  the household", "Nudges and advice" and "Boat work" (`src/content/companyBalance.ts`);
  `content/balance.json` regenerated.

## Tests
- `tests/unit/pt4people.test.ts` (new, 21 tests): **21 passed.**
- `tests/browser/pt4people.spec.ts` (new, 6 tests, stepped): **6 passed** in Chromium against this
  tree's build. WebKit not run (it cannot be downloaded here).
- Changed with the behaviour (DH-66): `tests/unit/opening2.test.ts` "two nights running" and
  `tests/scenario/rescued.test.ts` (the night's watch awake by the fire at the night check; kneeling
  at the boat counts as work); `tests/unit/art.test.ts` lists the two new sheets.
- `tests/scenario/repairs.test.ts`: 13 passed run alone (in the full parallel run two timed out under
  the load of five builders' runs and a capture).
- Failing in the shared tree at the time of writing, from other parts' work in progress (not this
  part's): the rescue scenario's Oddi runs and `searches.test.ts` ODDI_FIRST (the chest/silver), the
  Hag's rescue runs ("the frame was not begun"), the launch readiness, the chapter-run telemetry
  ("the household was not called to council"), `workLoops` "draws the sleeper asleep", the bargain
  without the chest, the ID registry's `SFX_FIND_*`, the art test's list of sheets (others' new
  sheets), arrows in the dead, out-of-reach commands, the save timing under load, and golden save
  11's reproduction (expected: the world changed; the final pass regenerates it).

## Timing
The chapter run (`chapterRun.ts chapter-1 human`) cannot finish in the shared tree: it stops at
another part's household council. Up to there, at a human pace: home 21:4, the boards 21:9, the
rigging 25:5, the oar 41:0, the boat ready 42:3 (third playtest: the hull 43:49, the fitting 45:32).
The early risers add about 45 minutes of the shipwright's work a day, and the watch loses an hour a
night of one person's morning; the boat is ready no later than before.

## GIFs
`docs/art/playtest-4/people/`: `boat-work.gif` (everyone at the boat, spread out, standing and
kneeling), `boat-changes.gif` (the same in time-lapse: the patch's stages, then the mast),
`exchange.gif` (an evening exchange at the fire), `refusal.gif` (Runa refusing, then bound holding
the end, sitting still), and the boat's stages at 1x and 4x (`boat_stages@1x.png`, `@4x.png`,
`boat_stages.gif`). Captured by `node src/tools/art/capturePeople4.ts`.

## Known issues
- The six new boat spots put one kneeling worker just beside the boards' pile while it lies there.
- No new sound: exchanges, nudges and advice use the speakers' blips; the boat's workers reuse the
  repair's cue. Not listened back (no speakers here).
