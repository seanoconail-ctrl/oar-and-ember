# ART PASS REPORT: the terrain art standard (a change request between Stages 6 and 7)

In the Book 2 section 23 format. This is not a numbered stage: the user asked for the environment
art to be raised to the approved mockups (Step 1, approved with one note on the walk) and for the
standard to be made permanent and enforced. Stage 7 has not been started.

## Implemented
- **Palette and materials** (AP-2): 254 colours in `assets/palette/book07.json`, 37 named
  hue-shifted ramps; map sources name a ramp and a step (`src/render/palette.ts`,
  `src/tools/art/materials.ts`).
- **People** (AP-1, AP-14): a grounded 8-frame walk at 2.0 tiles a second, with a 12-pixel stride
  so the planted foot keeps pace with the ground; bouncier run; idles (breath, look round,
  bracing with the cloak fluttering in a gust); a contact shadow for everyone
  (`assets/art/authoring/people.py`).
- **Terrain** (AP-3): dual-grid autotiles with organic, noise-wandering boundaries
  (`src/render/autotile.ts`, `src/render/noise.ts`) painted per terrain with edge detail: the
  grass lip and undercut over a new bank with strata and a shadowed foot, cuts where paths climb,
  rippled dry sand, the wet foreshore, rippled flats, a textured sea bed, faceted rock with weed
  and lichen (`src/tools/art/strandArt.ts`). 938 visual tiles in `tile_strand`.
- **Decoration and plants**: pebble clusters with calm sand between, shells, the wrack line,
  twigs, stones in the turf, worn footpaths from each cut (`decal_strand`); grass, tussocks,
  marram, thrift, clover and trefoil in four variants and seven lean frames (`plant_strand`);
  placed by `src/tools/levels/zones.ts` (1,997 decals and 29,599 plants on the strand).
- **Props and wildlife** (`assets/art/authoring/props.py`): boulders, heather, small stones,
  debris (logs, planks, barrel, net, rope); gulls (flying, standing), a cormorant drying its
  wings, a seal, crabs; every one with a ground shadow.
- **Renderer** (AP-5, AP-6; `src/render/glRenderer.ts`, `src/render/glEffects.ts`,
  `src/render/elevation.ts`):
  - the ground and decals, then water over a shore height field baked from the drawn terrain:
    colour by depth, broad swells rolling in, a surf zone, the shore break and swash, a wet
    sheen behind each wave, sand drying after the tide, stream flow with foam at the banks,
    kelp, glints;
  - ground shadows: soft contact ellipses for everyone, and long cast silhouettes away from a
    low sun; flying birds shadow the ground below them;
  - the actor layer sorted by foot line;
  - a post pass: ambient and pools exactly as before, then drifting cloud shadows, light shafts
    at low sun, a gust sheen on grass, sand drifting along the dry beach, the time-of-day grade,
    mist and a flash.
- **Wind** (`src/render/wind.ts`): one wind drives plant lean, travelling gusts, sway out of
  step, grass parting round walkers, blown sand, the cloak, and the shaders' gust.
- **Visual state** (`src/scenes/zoneVisuals.ts`, AP-8): smooth camera follow with look-ahead,
  moving with the steerer by whole pixels (no jitter), a shake API; the tide eased between the
  simulation's states; footprints (wet ones taken by the tide), dust when running, splashes and
  ripples in water, spray on the rocks, blown sand, midges by the stream; footsteps by surface
  (AP-10, temporary synthesized sound).
- **Adaptive detail** (AP-16): full, lite and low effect levels; the play view steps down when
  frames keep coming slower than ten a second; `?quality=` forces one.
- **Reduced motion** (AP-9, `src/input/displaySettings.ts`): from the system preference,
  `?motion=reduced|full`, or M in the system menu (remembered).
- **Enforcement** (AP-11, AP-12):
  - art lint (`src/tools/art/standard.ts`, run by `npm run lint`): ground shadows on every actor
    and prop sheet; no boundary straight for more than 16 px; at least 8 plain variants per
    terrain; grass decoration density;
  - `tests/unit/standard.test.ts` and `tests/browser/standard.spec.ts`;
  - `npm run capture -- <label>` (`src/tools/art/capture.ts`, AP-13) with the game's capture
    mode `?capture`.
- **Books and rules:**
  - Book 7 section 14 "Terrain art standard" covers terrain, decoration, animation, movement,
    wind, water, life, light, camera feel, shadows and idles, links the references, and gives
    the thresholds; sections 08 and 11 updated (light, style rule, naming, QA checklist).
  - The approved mockups and clips moved to `docs/art/reference/`.
  - CLAUDE.md: visible work must meet the standard and end with a capture compared with the
    reference; no "polish later".
  - Book 3: the standard acceptance check on Stages 7 to 30 (except 18 and 20); a mockup-first
    step on Stages 7, 10, 14, 16, 21, 27 and 29.
  - Decision log AP-2 to AP-15.

## Tests
- `npm run lint`: ESLint and Prettier clean; content lint clean (180 strings, 1 zone map); art
  lint clean (21 sheets, 1,678 frames, 0 placeholders, standard checks passing).
- `npm test`: **25 files, 287 tests, 287 passed, 0 failed.** New: `tests/unit/standard.test.ts`
  (8 tests). Updated: the sheet list in `tests/unit/art.test.ts`.
- `npm run build`: passes (the usual large-chunk warning).
- `npm run art:check`: renders written to `artifacts/`.
- `npm run test:browser`, Chromium: **21 passed, 0 failed.** That includes the Stage 4 WebGL and
  CPU parity scenes, still exact pixel for pixel after the light moved to the post pass, and the
  two new standard tests. Firefox and WebKit are not installed in this container; CI runs them.
- The browser rescue test needed two robustness fixes, not changes to the game:
  - its key-holding bot overshot by 30 px under the heavier renderer and walked into the bank,
    so it now steps back after an overshoot;
  - its timeout went from 90 to 240 seconds, because the walk is slower since AP-1.

## Gate checks
This pass's checks, from the user's request:
1. **Book 7 standard written, with the references linked**: PASS (Book 7 section 14,
   `docs/art/reference/`).
2. **CLAUDE.md rule**: PASS.
3. **Automated checks on every build:**
   - Moving pixels with the camera still: PASS. 97.7% in the browser test and 96.0% in the
     capture, against a threshold of 80%. The reference measures 89.2% with clouds frozen and
     100% with them. With reduced motion at low detail: 71.7%, against a threshold of 50%.
   - A ground shadow under every character, creature and prop: PASS, in art lint and the unit
     test.
   - No straight boundary without a transition: PASS. The longest run is 16 px, against a
     limit of 16.
   - Terrain variants: PASS. Every terrain covering ground has at least 8 distinct plain tiles.
   - Grass decoration density: PASS. At least 6 plants a tile, and no bare two by two patch.
   - Performance: PASS.
     - Frame build: about 2.5 ms in the test runner, against a budget of 4 ms.
     - Browser script per frame: 3.3 to 4.7 ms under software GL, against a limit of 5.5 ms.
     - The Book 2 target of 60 fps at 1080p on integrated graphics cannot be measured here
       (no GPU). It is listed under known issues.
4. **Book 3 acceptance check and mockup-first steps**: PASS (AP-12).
5. **Logged**: PASS (AP-2 to AP-16).

## Art check
- Every new and changed sheet was rendered at 1x and 4x and inspected:
  - Fixed during inspection: boulder lichen and heather flowers came out as diagonal stripes
    (now clusters); grass and marram read as blocks (blades now splay and alternate in shade);
    the sea bed had a single variant; the footpath read too red.
- Captures, in `docs/art/captures/art-pass/`:
  - `still.png` and `still@2x.png`;
  - `walk.mp4`: 10 s up the strand, through the cut, onto the machair;
  - `compare.png`: the reference beside the capture;
  - `motion.png`.
- Compared with `docs/art/reference/wreck-strand-target.png`:
  - **Matches:**
    - water that darkens with depth, with swell bands, a white surf zone and a foam edge that
      runs up and back;
    - wet sand behind the waves;
    - organic boundaries;
    - the bank with its lip, strata and shadowed foot;
    - a sward that moves everywhere, with drifts;
    - cool shadows under everyone;
    - wildlife;
    - cloud shadows and blown sand.
  - **Differs:**
    - The capture is at the opening's dawn, before sunrise: no long cast shadows or glints, and
      the light is greyer than the reference's late afternoon.
    - The opening view is more sea than beach.
    - The pebble clusters are busier than the reference's.
    - The wrack line is fainter, because the high tide covers most of the foreshore at the
      opening.
    - There is no fire or smoke (see AP-15).
- Placeholders: none.

## Balance
No Book 10 numbers changed in this part of the pass (walk 2.0 tiles a second was AP-1, already
recorded). The standard's QA thresholds are art rules in Book 7 section 14, not tuning (AP-11).

## Deviations
Decision log AP-2 to AP-16 (palette, dual grid and bank, sheet kinds and names, water and the
height field, the post pass and CPU parity scope, first-light ambient, visual-only life, reduced
motion early, temporary footsteps, thresholds, permanence and extra mockup steps, captures,
idles, the parts of the standard with nothing to draw yet, and adaptive detail).

## Known issues
- **Medium:** parts of the standard have nothing to draw yet, so they are not in the game. Each
  arrives with the stage that brings its source (AP-15):
  - fire and lantern flicker, and smoke: the fire is Stage 7;
  - rain, lightning and fog banks: weather is Stage 13;
  - residents at tasks: Stage 8;
  - the wreck's sail and sheep: Stage 10.
- **Medium:** CI's macOS Firefox and WebKit render WebGL in software. The first renderer commits
  failed there: Firefox was too slow for the Stage 6 control check, and WebKit lost its WebGL
  context. Adaptive detail (AP-16) is the fix for Firefox. WebKit does not block publishing
  (S1-18), and its cause is not yet confirmed. See the CI result of the last commit.
- **Medium:** 60 fps on integrated graphics is unmeasured. Software GL here runs at well under
  60 fps. A check on real hardware is wanted at the next build gate.
- **Low:** footsteps are temporary synthesized sounds (AP-10).
- **Low:** the PDF copies in `docs/pdf/` do not yet include Book 7 section 14 or the Book 3
  changes. The markdown is the source of truth.
- **Low:** the plant density costs the most frame time, 1.3 ms of about 2.5. Denser places may
  need a cheaper plant pass.

## Next stage ready
YES. Stage 7 begins with its first step, a mockup of the broch shelter and the camp for the
user's approval (Book 3).
