# STAGE 4 REPORT: WebGL renderer and art pipeline

In the Book 2 section 23 format: one heading per report field.

## Implemented
- **WebGL2 renderer at 640 x 360 with integer scaling and letterbox** (`src/render/glRenderer.ts`, `src/render/presenter.ts`):
  - Sprites are drawn into an off-screen 640 x 360 target. Every texel is fetched exactly (no filtering), and positions are snapped to whole logical pixels.
  - Consecutive sprites from the same atlas are batched.
  - The presenter now presents GPU textures as well as CPU frames, shares its shader helpers, and tells other renderers when a lost context is restored.
- **Atlas and manifest loader** (`src/render/atlas.ts`, `src/scenes/artView.ts`):
  - Each sheet packs into a PNG atlas plus a JSON manifest: frames, pivot, footprint, facings, animations, events and the placeholder flag.
  - The browser bundles every atlas and uploads it with colour conversion and premultiplication turned off.
- **Palette-indexed art source format and compiler** (`src/render/sheet.ts`, `src/tools/art/compile.ts`; `npm run art:compile`):
  - One text file per sheet.
  - Compiling fails, naming the file and line, on an unknown palette code, a wrong frame size, an undeclared state or facing, a frame index out of range, or a missing frame.
- **Material-map generator** (`src/tools/art/materials.ts`; `npm run art:sheets`): turns authored maps into palette-coded sheets with the ink outline, shading lit from the upper left, the idle breath and the mirrored unarmed facing (decision S4-1).
- **Depth sorting and cutaways** (`src/render/scene.ts`):
  - Draw order is ground, then decals, then actors and props by foot line.
  - A tall object in front of the player that overlaps them is cut away with a 50% ordered-dither fade.
- **Day, dusk and night lighting**: ambient light per phase, plus light pools in three bands (`assets/art/render.json`). The GPU and CPU use the same arithmetic.
- **Decal layer for blood**: decals draw on their own layer, under actors and over the ground (`decal_blood_01`: a pool and drops in the Book 7 blood palette).
- **Art lint** (`src/tools/art/artLint.ts`, `src/tools/art/lint.ts`; part of `npm run lint`). It checks the rules of Book 7 section 11:
  - Naming.
  - The actor canvas: 32 x 40, foot anchor at (16,39), about 18 x 30 occupied, four facings.
  - Tiles: 24 x 24 and opaque.
  - A one-pixel ink outline on sprites and props.
  - Reserved accents used only where declared.
  - Feet on the pivot row in every frame.
  - Placeholders listed.
  - Generated sheets and atlases in step with their sources.
- **Render-to-image tool**:
  - `src/render/cpuRenderer.ts` is the CPU reference renderer.
  - `src/tools/art/render-check.ts` (`npm run art:check`) writes every sheet's preview and the four test scenes at 1x and 4x into `artifacts/`.
- **Test sheet as final art: the steerer, body model A, idle** (`assets/art/maps/actor_p_steerer_a.map.txt` → `assets/art/sheets/actor_p_steerer_a.txt` → `assets/atlases/actor_p_steerer_a.png`):
  - Four facings (s, n, e, w) of 4 frames each.
  - Norse household dress (Book 7 section 07): a madder tunic, a weld-green cloak pinned at the shoulder, woad trousers, undyed leg-wraps.
- **Test scenes and their art**:
  - `tile_machair_01`: machair grass with spring flowers, seamless.
  - `prop_greymen_stone`: a weathered standing stone, tall enough to hide a person.
  - `decal_blood_01`.
  - `src/scenes/artTest.ts` defines four cases: front, behind, dusk and night.
- **Check views in the build**: `?view=art-test&case=front|behind|dusk|night` and `?view=sheet&sheet=actor_p_steerer_a` (decision S4-6).

## Tests
- `npm run lint`: ESLint, no problems; Prettier, all files formatted; content lint, clean; art lint, clean (4 sheets, 20 frames, 0 placeholders).
- `npm test`: **18 files, 225 tests, 225 passed, 0 failed**. Stage 4 added `tests/unit/art.test.ts` with 21 tests:
  - compiler errors;
  - art lint on every committed sheet, plus deliberate violations (non-ink edge, reserved accent, feet off the pivot, bad name);
  - sources in step;
  - the generator's outline, light and mirroring;
  - atlas packing;
  - the draw list (snapping, order, cutaway);
  - the steerer drawn over the stone, and showing through it;
  - the light arithmetic, and the warm-dusk and blue-night means.
- `npm run build`: passed.
- `npx playwright test --project=chromium`: **13 tests, 13 passed**. Stage 4 added `tests/browser/art.spec.ts` with 8 tests:
  - the four scenes, WebGL against the CPU reference;
  - pixel snapping at 1x, 2x and 3x;
  - the sheet against its preview.
- Firefox runs the same tests on GitHub's macOS runner, and WebKit runs them without blocking (decision S1-18).
- First run: 7 browser failures. The cause was a stale atlas: I had regenerated the stone's sheet without recompiling it, so the GPU drew the old stone. After recompiling, all passed. Art lint now fails whenever an atlas or generated sheet is out of step with its source.

## Gate checks
1. **Art lint passes; pixel snapping holds at 1x, 2x and 3x.** **PASS.**
   - Art lint is clean on all four sheets, and each deliberate violation fails.
   - At 640 x 360, 1280 x 720 and 1920 x 1080 the browser screenshot equals the CPU frame at every device pixel, and every logical pixel is one uniform block.
   - The scene's positions are deliberately fractional (for example x 323.4), so snapping is actually exercised.
2. **A test sheet compiled from source renders identically to its preview image.** **PASS.** The steerer sheet, drawn through the compiled atlas by WebGL, matches the CPU preview rendered from the source with zero differing pixels.
3. **A test scene shows depth sorting, a cutaway and a lighting change correctly.** **PASS.**
   - **Front:** the steerer is drawn over the stone, and the overlapping pixel shows the tunic colour.
   - **Behind:** the stone is drawn after the steerer and cut away; the steerer shows through in the dither pattern.
   - **Dusk and night:** dusk is measurably warmer and night darker and bluer, with the lantern pool brighter near its centre.
   - WebGL matches the CPU reference exactly by day, and within ±2 per channel under dusk and night light. Unit tests assert each property on the CPU frames.

## Art check
- Rendered with `npm run art:check` to `artifacts/` at 1x and 4x, and inspected:
  - `sheet-actor_p_steerer_a`, `sheet-prop_greymen_stone`, `sheet-tile_machair_01`, `sheet-decal_blood_01`;
  - `scene-front`, `scene-behind`, `scene-dusk`, `scene-night`;
  - the title and fonts.
- **Steerer.** A first draft's cloak bulged like a backpack and its back was a flat block. I redrew it slimmer, with fold lines and a ragged hem. It reads at 1x in all four facings, and the idle breath shows on frames 1 and 2.
- **Stone.** The first stone read as a capsule; I redrew it with a weathered, irregular silhouette.
- **Tile and decals.** Accepted at first render. The tile repeats without seams. The blood stays readable at night.
- **Placeholders remaining: none.**

## Balance
- No Book 10 value is used or changed.
- Lighting, cutaway fade and idle timing are art direction, in `assets/art/render.json` and the sheet header (decisions S4-4 and S4-8).

## Deviations
- Decision log entries S4-1 to S4-8 (2026-11-10).
- **Open question for the user:** Book 7's palette has no skin tones and no neutral greys. The steerer's skin uses undyed wool, linen and shingle, and the stone uses the blue-grey overcast ramp. Later stages need varied people and stone, so it would help to add a few skin and stone ramps to the Book 7 palette (S4-7).

## Known issues
- **Low:** WebKit (Safari's engine) still has no working WebGL on GitHub's macOS runner, so its checks fail without blocking. Safari remains the user's check.
- **Low:** light pools have hard band edges. Book 7 accepts banded pools; dithered edges could come with the hearth light in Stage 7.
- **Low:** the frame loop does not yet run the scene renderer continuously, because the title is static. Stage 6 animates the steerer in play.

## Next stage ready
**YES.** All three acceptance checks pass.
