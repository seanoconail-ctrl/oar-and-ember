# STAGE 6 REPORT: player controller and the opening

In the Book 2 section 23 format: one heading per report field.

## Implemented
- **Naming and body choice** (`src/scenes/namingView.ts`):
  - The title now waits for any key or click (S6-18), then shows "Who washed up on Wreck Strand?".
  - It has a name field; an empty name becomes "Steerer" (S6-11).
  - Two body models stand side by side with no label, each turning slowly so it can be seen from every side; screen readers hear "First body" and "Second body" (S6-10). Click or the arrow keys choose; Enter wakes.
- **Play on foot** (`src/scenes/playView.ts`, `src/scenes/zoneScene.ts`, `src/scenes/lightPhase.ts`):
  - A camera follows the steerer, kept inside the zone.
  - Ground, edges, props and people are drawn through the WebGL renderer under dawn light (S6-14).
  - The overlay shows Hild's subtitles with the direction of her voice, the one prompt that fits the moment, and refusal reasons.
- **The controller** (`src/sim/land/onFoot.ts`, `src/scenes/session.ts`):
  - Walk, run and sneak at the Book 10 speeds, with an analogue stick giving less than full speed.
  - Collision against the terrain under the current tide: the sea and rock always block; the flats block until low tide.
  - Movement is applied at the start of the very next tick, so there is no added input latency.
- **Interaction and carrying** (`onFoot.ts`, `src/sim/simulation.ts`):
  - New `MOVE` and `INTERACT` commands.
  - The nearest target in reach is marked with a small chevron (S6-9).
  - Lifting someone switches to carry speed whatever else is held, and attacks are refused with the reason "Your hands are full".
  - Setting down is allowed only on dry ground above the tide line; otherwise it is refused with the reason (S6-2).
- **Wreck Strand from Book 9** (`src/tools/levels/zones.ts`, `content/zones/zone_sk_strand.plan.json`, generated `content/zones/zone_sk_strand.json`, read by `src/content/zoneMap.ts` and `src/sim/land/zoneMap.ts`):
  - 96 x 64 tiles expanded from the island grid (S6-1): machair, shingle, the foreshore below the tide line, the tidal flats, the sea, skerries, the Kelda stream, and the wreck on its skerry.
  - Two rock outcrops are added for Book 4's "beyond the rocks" (S6-19).
  - `npm run zones` regenerates the map; content lint fails if it is out of step.
- **The opening, Chapter 1 beat 1** (`src/sim/narrative/opening.ts`, `content/opening.json`):
  - Hild lies beyond the western rocks and calls 1 second after waking, then every 6 seconds, in three lines, with her direction.
  - Lifting her is a fact, and her status becomes wounded; she speaks.
  - A wet set-down is refused, and she says why.
  - Setting her down above the tide line fires `BEAT_1_WAKE`, makes her a resident and sets her sitting. Her lines are given in S6-6.
- **World state version 2** (`src/sim/world.ts`, `src/persist/save.ts`): the new `onFoot` field and a real v1-to-v2 migration.
  - Golden save 1 stays frozen at schema 1.
  - Golden save 2 is the scripted rescue followed by two days (`tests/golden-saves/golden-02.json`, S6-3).
- **Steerer wording lint** (`src/content/steererWords.ts`, run inside content lint):
  - Strings tagged ADDRESS_STEERER or ABOUT_STEERER may not contain any of Book 8's banned words, or other common gendered terms.
  - A string that names the steerer through `{steerer}` must carry one of those tags.
  - Possessives about someone else ("Thorkel's sister's child") pass.
- **Art** (see Art check below): steerer body models A and B with idle, walk, run, sneak and carry; Hild with idle, walk, down, carried and sit; rock outcrops; the wreck; the strand's terrain sheet; the target marker.
- **Art pipeline** (`src/tools/art/materials.ts`, `src/tools/art/terrain.ts`, `src/render/sheet.ts`, `src/tools/art/artLint.ts`):
  - The sprite generator gains derived states, per-frame part moves, a crouch, facing aliases and per-frame poses (S6-20).
  - A new terrain generator writes ground and edge tiles (S6-7).
  - `pose.<state>` headers mark lying, carried and seated states (S6-8).
  - `npm run art:check` now also renders the opening for both bodies.
- **Test helpers:**
  - `src/tools/play/openingBot.ts` is a scripted player that path-finds over the tiles and plays the rescue with `MOVE` and `INTERACT` commands.
  - `record` and `replay` take the on-foot content.

## Tests
- `npm run lint`: ESLint, no problems; Prettier, all formatted.
  - Content lint, clean: 179 strings, 1 zone map, the steerer wording rule.
  - Art lint, clean: 10 sheets, 775 frames, 0 placeholders.
- `npm test`: **24 files, 279 tests, 279 passed, 0 failed.** Stage 6 added:
  - `tests/unit/opening.test.ts` (14 tests):
    - the map is clean and in step;
    - the opening tide;
    - the reachability flood fill at the opening tide;
    - the wreck reachable only at low tide;
    - control on the first tick;
    - no added latency;
    - Book 10 walk, run and sneak speeds measured over one second;
    - carry speed whatever is held, and attacks disabled;
    - sea, rock and flats blocking until low tide;
    - Hild's call schedule and direction;
    - the full rescue event sequence and end state;
    - the prompt offered at each step;
    - the refusal when nothing is in reach;
    - the whole rescue replaying to identical state hashes.
  - `tests/unit/steererWords.test.ts` (5 tests): Book 8's list; matching rules; flagging; deliberate violations rejected by content lint; Hild's lines tagged.
  - `tests/unit/strandArt.test.ts` (4 tests):
    - both body models share their states, facings and footprint, which matches `content/onfoot.json`;
    - Book 7 frame counts;
    - no placeholders;
    - every frame the strand scene can request exists, in every gait, facing, pose and both tides, for both bodies.
  - Updated: the save tests (golden saves 1 and 2, schema 2), the atlas packing test, the sheet list, and two Stage 5 input tests (see below).
- `npm run build`: passed.
- `npx playwright test --project=chromium`: **19 tests, 19 passed.** New `tests/browser/opening.spec.ts`:
  - **Control from the naming screen:** title, Enter, naming screen, type "Ash", choose the second body, Enter, hold D. The steerer moved **1.1 seconds** after the naming screen appeared (the page reports 18 to 52 ms from Wake to the first controllable frame).
  - **The whole rescue played with real key presses** (21.8 s):
    1. Hild's call caption "Hild, calling, west".
    2. Walking a path to her.
    3. "E  Lift Hild".
    4. Carrying.
    5. The tide refusal.
    6. Up past the weed line.
    7. "E  Set Hild down".
    8. Hild sitting, `BEAT_1_WAKE` fired.
- **What failed along the way, and the fixes:**
  - **Stage 5's CI run failed one Chromium test.** On the slower CI machine, Esc and M arrived in one frame and the system menu reopened over the map. Fixed: the system key is handled first and closes any open menu; a key tapped again in the next frame counts as a new press; auto-repeat no longer counts. This was committed as a Stage 5 follow-up, and CI then passed and published.
  - **A real renderer bug, found when the game drew every frame.** The frame texture left bound by the previous present formed a WebGL feedback loop. `glRenderer.ts` now unbinds it before drawing.
  - **The key that left the title also submitted the naming form.** Its default action is now cancelled.
  - **The scene asked for a carried frame that did not exist** when the gait and carrying disagreed, which the coverage test found. Carrying now decides the state.
  - **Art lint, first pass (dozens of issues), fixed rather than waived:**
    - Hild was redrawn on the 32 x 40 adult canvas.
    - Lying, carried and seated poses are marked (S6-8).
    - Edge tiles are exempt from opacity (S6-7).
    - `ui_` was added (S6-9).
    - Model B's profile got its cloak column back.
    - The wreck's pivot was set on its lowest row.
  - **Two Stage 4 browser tests needed updating.** The title pixel test now checks the "Press any key" line and then sets that HTML text aside before comparing the frame. The GPU/CPU sheet test now uses the rock sheet, because the steerer's sheet with 120 frames no longer fits one 640 x 360 frame.

## Gate checks
1. **Control within five seconds of the naming screen.** **PASS.**
   - In Chromium, from the naming screen appearing (including typing a name and choosing a body) to the steerer moving took 1.1 s. There is no cutscene: control is live on the first frame after Wake.
   - In unit tests, a `MOVE` on tick 1 moves the steerer, and a key held before a frame moves the steerer in that frame.
2. **Movement, interaction and carrying are taught by the rescue, without a control list.** **PASS.**
   - **Movement:** Hild calls within a second, from the west, every 6 seconds.
   - **Interaction:** "E  Lift Hild" appears only beside her, with a marker over her.
   - **Carrying:** the steerer slows to carry speed, and setting her down on the wet stones is refused with "The tide comes this far. Carry Hild up past the weed line." Hild adds "Not here... Higher, up past the weed."
   - The only control text that can appear unprompted is a single movement hint after 8 seconds without moving.
   - The browser test played the rescue with keys and recorded every prompt shown. Only lift, set-down, the tide refusal, notices or the move hint appeared, and no prompt ever named Shift, Ctrl, Space, Tab or the mouse.
   - A scripted player completed the rescue in under 17 seconds of game time at walking pace.
3. **No string addresses or describes the steerer with gendered terms (lint).** **PASS.**
   - Content lint runs the Book 8 section 03 check on every tagged string and requires a tag on any string that names the steerer. The real content passes.
   - A deliberate "Up you get, lad." in Hild's line and an untagged `{steerer}` line are both rejected, with file, key and reason.

## Art check
Rendered with `npm run art:check` into `artifacts/`, at 1x and 4x, and inspected: every sheet's preview, plus the opening at four moments (waking, beside Hild, carrying, safe) for both body models. Close strips of each new state were also inspected at 6x.
- **Steerer A and B** (`assets/art/maps/actor_p_steerer_{a,b}.map.txt`):
  - idle 4, walk 6, run 8, sneak 6 and carry 6, in four facings (west mirrored, unarmed);
  - the front and back walks lift each foot in turn;
  - in profile, the legs stride from a drawn cycle with the far leg darker, and the run leans forward;
  - the sneak crouches 3 pixels and stoops;
  - the carry raises the hands to the shoulders.
  - B is slighter, with a long tail of hair. Both read at 1x.
- **Hild** (`assets/art/maps/actor_c_hild.map.txt`):
  - idle and walk;
  - down: lying propped on an elbow, the calling arm waving over 2 frames;
  - carried: across the shoulders, front and side, with the steerer's face left clear;
  - sit: south, north and east.
  - Her braid, green shawl, woad tunic and bound leg distinguish her from the steerer at 1x.
- **The strand ground** (`tile_strand`, 163 states): sea and flooded flats sway; the shingle and foreshore pebbles are lit from the upper left. The weed line marks the tide line, and foam edges the water.
  - The first renders showed the tile grid, gutters between tiles and box-like rock slabs. I revised them to rounded stones that wrap across tile edges, six variants, and edge bands that wander and join at the tile corners.
- **Props:** two boulder piles sized to cover their rock tiles; the wreck (tarred planking lying over, the stern stove in with ribs showing, the mast snapped); the chevron marker.
- **Placeholders remaining:** none (0 in the manifest).
- **Known art weaknesses, for the user's review at the art gate:**
  - Large terrain areas still show their 24-pixel stepping at convex corners.
  - The carried pose seen from the side is a compact shape.
  - Skin still uses the wool and linen ramp (S4-7).

## Balance
- Book 10 values used, all read from `content/balance.json` by the new `parseMovementBalance`: sneak 1.75, walk 3.5, run 6.0, carry 1.8 tiles per second; the tidal ground window (3 game hours around low water).
- No Book 10 value changed.
- Values Book 10 lacks are in `content/onfoot.json`, flagged provisional (S6-4): interaction radius 1.5 tiles, footprint 10 x 4 pixels, set-down reach 14 pixels.

## Deviations
S6-1 to S6-21 in `docs/decision-log.md`. S5-3 was extended by the Stage 5 follow-up.

## Known issues
- **Medium:** S6-4's numbers need the user's approval or replacement.
- **Low:** WebKit on the macOS CI machine still loses its WebGL context, so its job fails without blocking publication (the user's choice, S1-18). The new opening tests will fail there too. Real Safari needs checking by hand.
- **Low:** Hild's voice is shown, not heard (S6-17). The opening's only sound is the temporary surf ambience.
- **Low:** The flats switch between flooded and dry all at once when the tidal window opens. A rising tide drawn over the foreshore belongs to the weather and tide presentation of later stages.
- **Low:** Saving and loading on foot works through the migration, but there is no save menu in play yet (later stages).

## Next stage ready
YES. Stage 7 (day and night, shelter and first tasks: the broch, fire, treating Hild's injury) can start from `BEAT_1_WAKE` and Hild sitting safe on the strand. Per the user's instruction, Stage 6 is the last stage of this session.
