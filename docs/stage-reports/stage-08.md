# STAGE 8 REPORT: crew agents, schedules and conversation

In the Book 2 section 23 format: one heading per report field. Decisions are S8-1 to S8-28 in
`docs/decision-log.md`. Built without waiting on the new art's approval (DD-11); everything for the
user's review is listed under **Flagged for the user's review**.

## Implemented
- **People as Book 2 section 06 shapes them** (`src/sim/world.ts`, `src/sim/people/person.ts`):
  happiness (0 to 100), friendship (-100 to 100) and fear (0 to 100) replace the single `regard`;
  codes and code stance; two to four traits, known or discovered on a day drawn on the `people`
  stream 5 to 20 days after joining (Oddi's light-fingers only when his theft is found); likes and
  dislikes; a tendency; the reasons for today's mood (`moodToday`); a job; and the day's bookkeeping
  (`Person.life`: meals, the night, lasting moods, the warning flow, owed lines, time spent, topics,
  barks, a light-fingered stash). Every one of Book 5 section 17's seventeen residents is in
  `content/people.json` with their traits, likes, dislikes, tendency, codes, stance, faith, origin
  and Book 5's skills (S8-18, S8-19).
- **The three measures** (`src/sim/people/measures.ts`, Book 10 section 08): friendship by deed
  (`sum(weight x valence x witness x culture)`, clamped; the culture's reading first, the stronger of
  two codes; the drengr rule; Gentle, Pious, Grudge-holder and devotion), fear by deed or act, the
  day's happiness target from its inputs and the hourly drift, the work multiplier (happiness,
  fearful obedience, Diligent and Lazy unsupervised, Sea-sick on land), the loyal, leaving,
  fearful-obedience and devotion marks, the friendship bands, the voice at Book 10 section 23's
  thresholds (S8-3, S8-4, S8-13).
- **The household's day** (`src/sim/people/schedule.ts`, `src/sim/people/day.ts`,
  `content/household.json`): sleep, a meal, work, supper and the evening by the fire; meals only when
  there is one; outdoor work waiting for light; a grave wound in bed; the tendency at its hour and
  place (Hild walks the shore at dusk); every activity with its reason code (S8-6, S8-8). Residents
  walk between zones to what they are doing; the camp's facts (the first fire, the shelter, the first
  fish) and the steerer's care are remembered (S8-11).
- **Jobs and delegation** (`src/sim/people/talk.ts`, `assignJob`; the `ASSIGN_JOB` command and the
  "Work" topic): fishing from the rocks, keeping the camp (the fire fed from the woodpile), raising
  the sail shelter, resting today; refusals with reason codes; residents' work counts by the minute
  at Book 10's rates (S8-7).
- **Hild works from the start**: after leading the steerer to the broch and showing the camp, she
  goes straight to fish from the rocks, at half pace for her serious wound (S8-5, replacing S7-11).
- **Conversation** (`src/sim/people/talk.ts`, `content/talk.json`; `TALK`, `TALK_CHOOSE`, `TALK_END`;
  the overlay's talk panel in `src/scenes/playView.ts`): a greeting by time of day, activity, wound and
  voice; up to three topics drawn from memories by priority (a wound untended or tended, Hild's
  father, the rescue, the fire, the shelter, the fishing, Oddi missing, the season), each resting two
  days once talked through; their work always on offer; replies of Book 10's kinds; a wound's
  "Let me see to it" tends it; time goes on; walking away ends it (S8-9, S8-10, S8-12).
- **Barks as text with each speaker's voice blip** (`barkTick`): Book 8's priority and spacing, in
  earshot, warning lines first; a pressing topic brings a resident over (S8-16).
- **Friendship bands and the warning flow** (`checkFeelings`): steps in order, two days apart,
  driven by friendship's bands, leaving's effect and low happiness; the refusal of their work; the
  request to leave recorded for Stage 23; rising praise, help and a favour; fear and devotion lines
  (S8-15).
- **Oddi's food-theft scene** (`src/sim/people/scenes.ts`, `content/scenes.json`,
  `BEAT_1_ODDI_THEFT`): a real, data-driven scene: a light-fingered resident takes from the stores
  at bedtime unless watched; on his second night the finder at the fire brings it to the steerer, who
  judges; the effects follow Book 10's dispute judgements; the deed, memories, the trait made known,
  the dispute record and the outcome fact (S8-21). It is tested in a seeded world with Oddi; in
  normal play it can first fire the evening after Oddi's first night at home, once Stage 10's search
  brings him (day 2 at the earliest).
- **Strings** (`content/strings/en.json`): 314 new, all to Book 8's rules (the Chapter 1 crew's lines,
  S8-20; the steerer's replies; the interface's activity and reason words; report lines).
- **Audio** (`src/audio/synth/voice.ts`, `src/audio/synth/cues.ts`, `content/audio.json`): a voice
  blip for every resident, no two at one pitch; the dispute and judgement stingers with captions;
  the sound test's Stage 8 items listed apart (S8-24, S8-25).
- **Art**: Hild's eating loop (S8-22), and glints on the wet foreshore (S8-28).
- **World state version 6** with a migration from 5 (it reads `content/people.json` and
  `content/household.json`); golden save 6 new; golden saves 1 to 5 frozen and load (S8-23).
- **Book 10** (`docs/10_balance_sheet.md`, `content/balance.json` regenerated): "The household day
  and talk", "Conversation replies", "Deed weighing" and a "Traits per person" heading (S8-1, S8-2,
  S8-12); Book 2 section 05 notes version 6.
- **Test and capture hooks** `oddi=1`, `oddi=theft`, `zone=`; overlay attributes for the tests
  (S8-26); the capture's Stage 8 views (`src/tools/art/capture.ts`).

## Tests
- `npm run lint`: ESLint clean; Prettier clean; content lint clean (767 strings, 2 zone maps, 430
  registered IDs); art lint clean (57 sheets, 6872 frames, 0 placeholders).
- `npm test`: 35 files, **458 passed, 0 failed**. New: `tests/unit/people.test.ts` (39). Updated for
  Stage 8: `saves.test.ts` (schema 6, golden 5 frozen with its migration, golden 6), `home.test.ts`
  (Hild goes to work from the camp; tending through the talk), `opening.test.ts` (Hild joins the
  household's day when safe), `synth.test.ts` and `audioCoverage.test.ts` (a voice for every
  resident).
- `npm run build`: passes.
- `npm run test:browser -- --project=chromium`: **41 passed, 0 failed**, including the new
  `tests/browser/stage08.spec.ts` (4 tests, stepped with `oeStep` from the camp hooks). No existing
  browser spec was edited.
- `npm run audio:render`: 85 items rendered, the loudest peak 0.81, nothing clips.
- CI results: the work-in-progress commits that followed the Stage 8 commit were checked together with Stage 9. Run 43113361613 (commit a215ad9, which contains all of Stage 8):
  - Chromium: passed.
  - Firefox (macOS): passed.
  - WebKit (Linux, Playwright image): passed.
  - Pages deployed. The published-address checks passed in all three browsers.

## Gate checks
1. **Hild starts useful work immediately after her rescue and is always visibly doing something:
   PASS.** `people.test.ts`: played from the wreck, she leads to the broch, shows the camp, and is at
   work within two game minutes, fishing at half pace with her leg untended, and lands fish that
   morning; through three days and nights at every minute she is at an activity of the household's
   day (work, meals, the evening fire, her dusk walk, sleep, waiting for light) and never stands
   idle and still in view; every refusal and rest has its reason. `stage08.spec.ts`: from the camp
   hooks at 08:00 she is at work, walks down to the rocks and works there in the fish loop, and is
   always doing something for the next hours.
2. **Talking to a wounded resident offers a topic about the wound: PASS.** `people.test.ts`: the
   wound is Hild's first topic, its line plays, "Let me see to it" tends it (friendship +4 and a
   memory), and a tended wound has its own topic; Oddi, wounded in a seeded world, is offered his.
   `stage08.spec.ts`: the panel opens on E, lists "Your wound" first, plays her line, and tends.
3. **Unit tests: PASS.** `people.test.ts`: friendship and fear deltas by deed (values, witness,
   culture for and against, two codes, the drengr rule, the clamp, Gentle and Pious, the fear
   table, the rescue in play); happiness inputs (fed, warmth, bed, safety, success, grief fading,
   treatment, likes and dislikes, hunger) and the drift; the work multiplier (0.8 to 1.2, fearful
   obedience 0.85, Diligent 1.1, Lazy 0.85, Sea-sick 1.05); loyal at 40, leaving at -40 with fear
   below 30, fearful obedience, devotion at fear 60 with friendship 40; the bands; three bands
   crossed in a day giving a remark on day 1, a complaint on day 3, a refusal on day 5 and, with
   leaving's effect, the request to leave on day 7, and the flow starting again as friendship rises.
4. **Meets the Book 7 section 14 standard; capture compared with the reference: PASS.** Motion with
   the camera still (threshold 80%): Wreck Strand 93.9%, the broch by day 83.3%, by night 85.4%, at
   S1 81.1%, Hild fishing on the rocks 92.0%, at supper by the fire 82.5%, on the shore at dusk 90.6%
   (70.1% before S8-28's glints on the wet foreshore). See Art check.
5. **Sounds meet the Book 11 audio standard, with captions; every speaking resident has their voice
   blip: PASS.** `audioCoverage.test.ts` (every resident, every talk speaker and the scene's people
   have a voice; no two share a pitch; the steerer has none; every new cue has its sound and caption);
   `synth.test.ts`. Listened back by `npm run audio:render` (peak / RMS): the residents' voices from
   0.14 / 0.017 (Senán) to 0.32 / 0.030 (Hild), Oddi 0.31 / 0.024, Bran 0.19 / 0.023, Runa
   0.17 / 0.018, the others between (Nessa, Ylva and Áine were brought down about 7 dB to match); the
   dispute stinger 0.24 / 0.033 and the judgement 0.26 / 0.026, beside the horn stinger's 0.27 / 0.034;
   the hearth theme 0.48 / 0.095 and a light hit 0.51 / 0.065 as before.

## Art check
- **Capture** `docs/art/captures/stage-08/` (`npm run capture -- stage-08`): the strand still, its
  motion map and the reference beside it; the broch by day, by night and at S1 with motion maps and
  the Stage 7 mockup beside them; the fire-lighting and sleep clips; and Stage 8's views:
  `hild-fishing`, `hild-supper`, `hild-dusk` (1x, 2x and motion maps) and `talk.mp4`/`.gif` (the
  steerer goes up to Hild by the fire, the talk opens, her wound is taken up and tended).
- **Against `docs/art/reference/`**: the strand is as at Stage 7 but for a few glints on its wet
  shingle (S8-28), 93.9% motion (Stage 7: 93.8%). The broch views match Stage 7's. Hild now has
  somewhere to be at every hour: on the rocks below the path, at the fire eating, on the shore at
  dusk.
- **Sheets for review** (`docs/art/stage-08/`): Hild's eating loop at 1x and 4x with a GIF, and her
  proposed sheets. Inspected: the spoon to the mouth reads at 1x; the bowl is small (flagged).
- **Placeholders:** none. Oddi, Bran and Runa are not drawn (they arrive in Stage 10); the theft
  scene in the browser test runs with Oddi in the household but not yet on screen.

## Balance
- Added to Book 10 and regenerated: "The household day and talk" (12 keys), "Conversation replies"
  (7 rows), "Deed weighing" (the formula's numbers as a table), a "Traits per person" heading
  (S8-1, S8-2, S8-12).
- Used as written: section 08's friendship deltas by deed, deed reactions by culture, traits,
  likes and dislikes, happiness, friendship and fear (and their effects), happiness inputs,
  friendship from care and time, fear deltas, friendship bands, wounds; section 09's dispute
  judgements; section 23's voice thresholds; section 03's fishing rate and fuel; section 06's
  hungryAt.
- Kept out of Book 10: the household's hours (content, like S6-5 and S7-11), the voices' timbres
  (presentation), the capture's views.

## Deviations
S8-1 to S8-28 (`docs/decision-log.md`, "Stage 8 (crew agents, schedules and conversation)").

## Known issues
- **Minor:** residents' work is seen but not heard (their casting, hammering and the fire-keeping make
  no sound of their own yet); their voices and barks are heard.
- **Minor:** the thirteen residents who join from Chapter 3 have their people data and voices but no
  lines yet (S8-20); a conversation with one of them would offer only work.
- **Minor:** the warning flow's request to leave is recorded but leads nowhere until Stage 23's
  departure scene; the "told by a friend" warning for a fearful resident waits for a second resident.
- **Minor:** likes and dislikes about weather, gifts, places and the old rites wait for their systems
  (S8-14); stances move no number (S8-3).
- **Minor:** while open, the talk panel covers part of the right of the view; walking away closes a
  conversation.
- **Cosmetic:** Hild's bowl is small at 1x; from behind, eating shows only the elbow.
- **Cosmetic:** the Stage 7 strand at low water still has some still rock faces; the glints cover the
  wet shingle only.

## Flagged for the user's review
- **Hild working from the start** at half pace with her leg untended, and tending through the talk
  rather than a direct prompt (S8-5, S8-9).
- **The household's hours** (S8-6) and the Stage 8 jobs (S8-7). Driftwood was first left out as a
  resident's job; the user then left its rate to my judgement, and it is now a job at 2 of the
  steerer's searches per worker-day, 2 to 6 loads a day by season (S8-29).
- **The new Book 10 numbers** (S8-1, S8-12) and the re-headed tables (S8-2).
- **Stances move no number** until Book 10 gives a factor (S8-3); the culture "for/against" rule (S8-4).
- **People data choices** (S8-18): Bran's codes Norse and Church (stance conventional); Senán Church
  and Norse; Áine Gaelic and Norse; Kolbeinn and Asa Saltvik and Norse; Nessa conventional until her
  secret is seeded; Kolla's singing as the Storyteller trait; the kin ties to the steerer.
- **Oddi's theft scene** (S8-21): its window (20:30 to 22:00), the five judgements offered (no
  household thing or compensation yet; "beaten" left to the player's own hand in Stage 9), and when it
  first fires in normal play.
- **Lines for the Chapter 1 crew** (Hild, Oddi, Bran, Runa), written to Book 8 section 05 (S8-20).
- **The new art**: Hild's eating loop (S8-22) and the wet foreshore's glints, which also touch the
  approved strand (S8-28).
- **The dispute stingers brought forward** from Stage 23 (S8-24) and the seventeen voices (S8-25).

## Next stage ready
YES. Stage 9 can build combat on people who feel the household's deeds (the deltas and fear by
deed are in place for witnesses), on the warning flow and on residents' wounds and their topics.
