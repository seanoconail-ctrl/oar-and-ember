# STAGE 10 REPORT: the three searches and the southern island

In the Book 2 section 23 format: one heading per report field. Decisions are S10-1 to S10-23 in
`docs/decision-log.md`. Built under DD-11 without waiting for approval of the new places or the
new people. Everything for the user's review is listed under **Flagged for the user's review**.

## Implemented
- **The southern island** (S10-1 to S10-4), generated from the island's block grid like the strand
  and the machair (`content/zones/*.plan.json`, `npm run zones`):
  - **the Hag's Seat headland** (`ZONE_SK_HAGSEAT`): the standing stone, rock ridges with a short
    neck of turf between them, a geo of sea, cliffs, and a shingle cliff path round the south;
  - **the Hollow Cairn** (`ZONE_SK_CAIRN`): the grassed mound with its kerb and sealed east door,
    and the drystone sheepfold below it, its gate on the west;
  - **the Kelda Spring**: a pool on the machair north-east of the broch, with its stream to the burn.
  - Several links can now share one edge (S10-2). Built things are solid tiles: they block walking,
    sight and missiles and grow no plants (S10-3).
- **The three searches** (`src/sim/narrative/searches.ts`, `content/searches.json`). They open when
  Hild has led to the broch, all three at once, in any order, and Hild tells of them (S10-13).
  - **Oddi**, hurt on the shingle near the wreck, with Thorkel's chest a little along from him. He
    calls when the steerer comes near.
    - Carry the chest off the strand first and it is saved (`CHEST_FIRST`).
    - Take Oddi home first and the scavengers take the chest (`ODDI_FIRST`).
    - Either way he joins the household (S10-7).
  - **Bran** guards Thorkel's body in the sheepfold, with the three wreck-scavengers at its gate
    (moved from the strand, S10-9). Three ways (S10-8):
    - **fight**, with Bran at the steerer's side as an ally;
    - **sneak**, unseen, round the fold to its back wall: Bran climbs out with the body;
    - **bargain** with Ketill while he holds his parley: Thorkel's silver from the saved chest buys
      the body.
    - Bran then carries Thorkel home to a bier by the broch and joins the household.
  - **Runa**, hurt below the Hag's Seat, followed a strange light. While the stone weeps, the gale
    on the neck lets no one carry anything across. Two ways (S10-5, S10-6):
    - **offer** at the stone (a confession, the seax or the bow): it stops weeping;
    - **take her tools round by the cliff path**.
    - Once her tools are safe past the neck she limps home and joins.
  - Each search records its outcome as a fact (`search.oddi`, `search.bran`, `search.runa`, plus
    `ch1.chest`, `ch1.wreckers`, `ch1.thorkel_body` and `hagseat.offering`).
  - Friendship moves by Book 10's new "The three searches" table (S10-10).
  - The three done completes the beat. Oddi's theft (S8-21) then turns up on his second night at
    home in ordinary play.
- **The Hag's Seat's sign** (`OMEN_HAGSEAT_STONE`), with all four parts declared and linted:
  - the sign: the stone weeps, a pale light hangs by it, and its tell plays;
  - the rule: the gale on the neck;
  - the response: an offering, or the cliff path;
  - the consequence: the fact, the Cailleach's power, Runa's friendship, and one line in the next
    morning report.
- **Search talks** (S10-11): a new talk kind, opened from a person or a thing. Prompts: "Talk to
  Bran", "Talk to Ketill" in parley, "Talk to Runa", and "Leave an offering" at the stone. Choices
  can be conditional or said once.
- **Checkpoints** before Oddi's and Runa's searches, and the wreckers' one, now at the fold (S10-12).
- **Fights** (S10-9, S10-15, S10-22):
  - wreck-scavengers who see an empty-handed, walking steerer hold a parley for Book 10's `parley`
    seconds;
  - allies fight beside the steerer;
  - fighters path round walls;
  - sight stops at walls.
- **Art** (S10-18, S10-20), all palette-indexed, compiled and linted:
  - Oddi, Bran, Runa and Thorkel's body;
  - the Hag's stone, dry and weeping;
  - the two chests, lying and carried;
  - the cairn's mound in 12 bands, with turf sorted with each band;
  - the fold's 32 wall pieces;
  - the pale light, with a small light pool, and the spring's bubbles;
  - thrift and grass in the cliff-top rock.
  - Carried chests and Bran carrying the body are drawn in their carry poses.
- **Sound** (S10-17), all generated:
  - an ambience for each southern place: the spring (louder near its pool), the Hag's Seat gale and
    the fold's sheep and heath;
  - the Cailleach's tell: hail on the stone, a cold wind, then drips. It plays every 14 to 26 s
    while the stone weeps and the steerer is on the headland, panned to the stone;
  - every sound captioned, and listed in the sound test's southern section.
- **World state version 8** with a 7 to 8 migration, and a new golden save 8. Golden saves 1 to 7
  are frozen and still load (S10-14).

## Tests
- `npm run lint`: clean. That covers ESLint, Prettier, content lint (911 strings, 451 registered
  IDs, 12 zones) and art lint (104 sheets, 26,826 frames, 0 placeholders).
- `npm test`: **41 files, 541 passed, 0 failed.** New tests:
  - `tests/scenario/searches.test.ts`: 11 tests, played by `SearchBot`, which walks, lifts,
    carries, talks and fights through the sim's commands only;
  - `tests/reachability/southern.test.ts`: 4 tests over both tides, 8 cases;
  - `tests/unit/omen.test.ts`: 3 tests.

  Updated tests:
  - `combat.test.ts`: the Stage 9 checks now run on a Stage 9 fixture, plus a new check that the
    wreckers are at the fold (S10-16);
  - `saves.test.ts`: schema 8, golden 7 frozen, golden 8 added;
  - `audio.test.ts`: southern ambience by zone;
  - `art.test.ts`: the census of sheets.
- `npm run build`: passes.
- `npm run test:browser -- --project=chromium`: **48 passed, 0 failed** (the whole suite).
  - New: `tests/browser/stage10.spec.ts`, 2 tests, stepped with `oeStep`:
    - the Hag's Seat: the stone weeps; the gale holds the steerer carrying Runa's tools at the
      neck; an offering stills it; then the tools cross;
    - the fold: Bran's talk offers the sneak (unseen) and the fight; choosing the fight engages
      with Bran in it.
  - `tests/browser/stage09.spec.ts` plays the same four checks at the fold, west of the wreckers,
    instead of on the strand (S10-16).
- `npm run audio:render`: every item is rendered and none clips. The southern levels are in
  **Balance**.
- CI results: see the run for this commit.

## Gate checks
1. **Each search has at least two viable approaches and records its decision as a fact: PASS.**
   `searches.test.ts` plays each one through the sim:
   - Oddi: `CHEST_FIRST` and `ODDI_FIRST`;
   - Bran: `FIGHT` (a careful player wins at least 3 of 8 seeds), `SNEAK` and `BARGAIN`;
   - Runa: `OFFERING` and `CLIFF_PATH`;
   - and that there is no bargain without the chest.
2. **Reachability of the southern zones at high and low tide: PASS.** `southern.test.ts` covers:
   - the strand: Oddi and the chest;
   - the machair: the Kelda pool's banks;
   - the Hag's Seat: the stone and Runa, by the neck and by the cliff path, the path at least 1.5
     times longer;
   - the cairn: the fold through its gate only, Bran and the body, and the mound's door.
3. **The Hag's Seat event declares sign, rule, response and consequence: PASS.** `omen.test.ts`
   covers the content, a lint that fails a missing part, and all four in play. The scenario tests
   cover the gale's rule.
4. **The Book 7 section 14 standard: PASS.** `npm run capture -- stage-10` wrote to
   `docs/art/captures/stage-10/`. Motion with the camera still (threshold 80%):

   | View | Motion |
   |---|---|
   | Wreck Strand | 93.9% |
   | Hag's Seat | 88.4% |
   | Hag's neck | 89.9% |
   | Sheepfold | 81.6% |
   | Hollow Cairn | 91.0% |
   | Kelda Spring | 93.8% |

   There is also a 10-second clip of the headland walk (`hagseat-walk.mp4`). See **Art check**.
5. **The Book 11 audio standard, with captions: PASS.**
   - Each southern zone has its ambience (`audio.test.ts`).
   - The sign has its captioned tell (`audio.test.ts` plays every cue and checks its caption).
   - Rendered and checked by levels and spectrograms against Book 11 section 09: ambience about
     -22 dBFS RMS, tells standing out. See **Balance**.
   - I can't hear the renders myself. The user should listen to them in the sound test.

## Art check
- **The captures against `docs/art/reference/`** (`docs/art/captures/stage-10/`):
  - The new places use the reference's palette and terrain rules: dual-grid noise edges, a moving
    sward, drifts, cloud shadows and contact shadows. Every view is above the motion threshold.
  - What stays still: wall faces, the stone and the trodden paths. The fold is closest to the line,
    at 81.6%.
  - The Hag's Seat sways no harder than the strand (S10-21). Its gale is heard rather than seen.
- **The mockups** are in `docs/art/mockups/stage-10/`: the Hag's Seat and the fold, each a still and
  a 4-second loop at 640 x 360, with a self-review against each point of Book 7 section 14. They
  are renders of the built places (S10-19).
- **People** (`docs/art/stage-10/people/`): every state of Oddi, Bran, Runa and Thorkel at 1x and
  4x (rows s, n, e, w), GIFs of the states that matter in the searches, and the chests and the
  stone. Inspected:
  - Oddi: grey tunic and seax.
  - Bran: heavy build, cream tunic, round shield on his back, axe and ladle; his carry pose holds
    the body across his shoulders.
  - Runa: brown dress, a knot of hair and an adze; lying hurt, she raises an arm.
  - Thorkel: grey-haired, in a blue cloak, lying dead.
  - Their proposed maps match what ships, so `npm run art:adopt` reverts nothing.
- **Fixed after the first capture:**
  - the fold's north-south walls were drawn as turf only; they now have capstones, joints and hard
    edges;
  - the cairn's mound was lit from the wrong side, and its turf was hidden under its own bands;
  - the bare rock fields and short turf were still (S10-20).

## Balance
- **New in Book 10** ("The three searches", exported by `npm run balance`): oddiCall 9 tiles,
  chestSilver 4 oz, chestFirst +3 and chestLost -3 for Oddi, limp 0.9 tiles a second, parley 30 s,
  guard 3 tiles, offering +5 and cliffPath -3 for Runa.
- **Audio levels** (`npm run audio:render`; Book 11 section 09 asks for about -22 dBFS RMS for
  ambience):

  | Sound | Peak | RMS | RMS in dBFS |
  |---|---|---|---|
  | Kelda Spring | 0.496 | 0.0607 | -24.3 |
  | Hag's Seat gale | 0.429 | 0.0647 | -23.8 |
  | Cairn and fold | 0.288 | 0.0423 | -27.5 |
  | Cailleach tell | 0.400 | 0.0658 | -23.6 |

  The tell is close to Manannán's (0.437 peak, 0.049 RMS).
- **Fights:** the careful-player bot beats the wreckers with Bran beside it in at least 3 of 8 seeds
  (the test's floor).

## Deviations
- None from the books. Every choice the books leave open is logged as S10-1 to S10-23.

## Known issues
- The fold view only just meets the motion standard (81.6%). Its walls and paths are a large still
  share of the view.
- In daylight the pale light by the stone is small and its light pool faint.
- The cairn's mound reads mainly by its turf and kerb. Its sealed door is small at 1x.
- `hagseat-walk.gif` is 9 MB. The whole headland's grass moves, and the encoder keeps every change.
- The Cailleach's tell needs the audio unlocked. In stepped browser tests it is checked through the
  sound test and the unit tests, not in play.

## Flagged for the user's review
1. **The new people:** Oddi, Bran, Runa and Thorkel's body (`docs/art/stage-10/people/`), wired in
   without approval (S10-18).
2. **The new places:** the Hag's Seat and the fold, mockups rendered from the built places
   (`docs/art/mockups/stage-10/`, S10-19). Also the Hollow Cairn's mound and the Kelda pool
   (`docs/art/captures/stage-10/`).
3. **The chest rule:** the scavengers take Thorkel's chest if the steerer leaves the strand without
   it once Oddi has called. The sea does not take it (S10-7).
4. **The Hag's Seat rule:** the gale holds only someone carrying, and Runa will not go home until
   her tools are safe past the neck (S10-5, S10-6).
5. **The sneak** goes round the fold and over its east wall. **The bargain** needs the chest saved
   first (S10-8).
6. **The wreckers' parley** with an empty-handed steerer (S10-9) and Bran fighting as an ally.
7. **The Book 10 numbers** (S10-10), which are starting values.
8. **The Hag's Seat's wind** is heard, not seen (S10-21).
9. **The southern sounds and the tell**, to be listened to in the sound test (S10-17).

## Next stage ready
Yes. Stage 11 can start when the user names it. Stage 12 is a build gate.
