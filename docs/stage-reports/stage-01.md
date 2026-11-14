# STAGE 1 REPORT: project setup

In the Book 2 section 23 format: one heading per report field.

## Implemented
- **Toolchain** (`package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc.json`, `playwright.config.ts`): TypeScript 6.0 in strict mode (plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and related checks), Vite 8, Vitest 5, ESLint 10 with type-aware typescript-eslint, Prettier 3, Playwright 1.63. Scripts: `dev`, `build`, `test`, `lint`, plus `test:browser`, `art:check`, `format` and `preview`.
- **Book 2 folder layout**: `src/core`, `content`, `sim` with all sixteen subsystem folders, `scenes`, `render`, `audio`, `input`, `ui`, `persist` and `tools`; `content/`, `assets/` (`palette`, `art`, `atlases`, `audio`) and `tests/` (`unit`, `property`, `scenario`, `reachability`, `golden-saves`, plus `browser`). Each has a README naming what it owns, what it may depend on and the stage that builds it. Modules with nothing yet hold an empty `index.ts`.
- **Layer rules as lint** (`eslint.config.js`): each layer's forbidden imports from Book 2 section 02 (for example, `sim` may not import `render`, `audio`, `ui`, `input`, `scenes`, `persist` or `tools`), and Node built-ins only in `src/tools`.
- **Title screen** (`index.html`, `src/main.ts`, `src/scenes/boot.ts`, `src/scenes/title.ts`, `src/render/*`):
  - `src/render/presenter.ts` draws the 640 x 360 frame on a WebGL2 canvas at the largest whole-number scale, centred, with letterbox bars. Each device pixel fetches exactly one texel (`texelFetch`), so nothing is filtered or blurred. It handles context loss and restore.
  - `src/render/viewport.ts` holds the scale and letterbox maths. `src/scenes/boot.ts` sizes the canvas in exact device pixels where the browser reports them (Chromium, Firefox) and uses CSS size times pixel ratio in Safari.
  - The frame reads "Oar and Ember" in authored title lettering over a night sea, with "Build 0.1.0+<commit>" beneath it.
  - Without WebGL2 the page says why, in words, instead of showing a blank canvas.
  - All text comes from `content/strings/en.json` by Book 8 keys (`ui.title.name`, `ui.title.build`, `ui.title.screen_label`, `ui.boot.webgl2_missing`). The canvas carries an accessible label that includes the build.
- **Art pipeline for Stage 1**:
  - `assets/palette/book07.json`: the Book 7 palette and blood reds, with codes.
  - `src/render/palette.ts`, `artSource.ts` (source format; errors name the file, line and reason), `bitmapFont.ts` (Scale2x, ink outline, upper-left shading, named ramps), `indexedImage.ts` and `backdrop.ts` (sky and sea bands with 4 x 4 Bayer dithering).
  - Sources: `assets/art/ui/font_title.txt`, `assets/art/ui/font_small.txt` and `assets/art/ui/title_screen.json`.
  - Render-to-image check: `src/tools/art/render-title-check.ts`, with `png.ts` and `loadTitleArt.ts`.
- **Build id** (`src/core/build.ts`, `vite.config.ts`): `<package version>+<short commit>`, injected at build time.
- **GitHub Actions** (`.github/workflows/ci.yml`):
  - On every push and pull request: `npm ci`, lint, unit tests, build, and the browser smoke tests in Chromium, Firefox and WebKit.
  - On `main` only: uploads `dist/`, deploys it to GitHub Pages, then runs the smoke tests again against the published address.
- **ID registry** (`content/ids.json`, `src/core/ids.ts`, `src/content/idRegistry.ts`):
  - 402 IDs seeded from Books 4 to 11: 91 stated in the books, 13 expanded from shorthands, and 298 assigned under the Book 2 prefixes and the books' own naming style.
  - Also 6 ID families (such as `MUS_FINALE_*` and `VO_<stringKey>`) and the 19 deed tags of Book 6.
  - Every entry cites book and section and quotes the book verbatim. 65 doubtful candidates were held back (decision log S1-10 to S1-12).
- **Decision log** (`docs/decision-log.md`): the twenty Stage 0 decisions were already recorded. Stage 1 entries S1-1 to S1-13 have been added. `docs/stage-reports/` holds this report.

## Tests
- `npm ci && npm run lint && npm test && npm run build` from a clean `node_modules`: exit code 0.
- `npm run lint`: ESLint, no problems; Prettier, all files formatted.
- `npm test`: **10 files, 129 tests, 129 passed, 0 failed**. The files cover:
  - viewport: scale and letterbox at 11 screen sizes, and a sweep of 3,000 more
  - palette: Book 7 counts, blood hexes and reserved accents
  - art source: parse errors with file and line
  - fonts: Scale2x, outline, shading, coverage of every title and build-id character, measured width equal to drawn width
  - title frame: centring, materials, only palette colours, no reserved accents, deterministic
  - backdrop dithering
  - strings
  - ID registry: structure, verbatim refs against the books, stated against assigned, every ID written in Books 4 to 11 and the level grids registered, deed tags equal to Book 6
  - decision log: 20 decisions matching Book 3 section 03
  - layer rules: ESLint rejects 8 forbidden imports and Node built-ins
  - project layout, workflow content, build id and PNG round trip
- `npx playwright test --project=chromium`, run locally against the production build: **5 tests, 5 passed**.
  - Four screens: 1280 x 720, 1500 x 900 and 900 x 500 at pixel ratio 1, and 1000 x 600 at pixel ratio 2. For each, a real screenshot matches the frame composed in Node at every device pixel, letterbox bars included.
  - The no-WebGL2 explanation.
  - The pixel-ratio-2 case found a real bug: emulated browsers report CSS pixels as "device pixels", and trusting them let the browser stretch the canvas. Fixed (decision S1-15).
- GitHub Actions, run 1 ([42847724006](https://github.com/seanoconail-ctrl/oar-and-ember/actions/runs/42847724006)): `npm ci`, lint, unit tests and build **passed**. Browser tests: Chromium 4 of 4 passed. Firefox and WebKit passed the no-WebGL2 test and failed the 3 screen comparisons each:
  - Firefox: headless Firefox had WebGL2 turned off on the GPU-less runner, so the game showed its "needs WebGL2" message.
  - WebKit: my test ignored Playwright's Retina emulation (pixel ratio 2).
- GitHub Actions, run 2 ([42848786424](https://github.com/seanoconail-ctrl/oar-and-ember/actions/runs/42848786424)), after the fixes: `npm ci`, lint, unit tests and build **passed**. Browser tests: Chromium 5 of 5 passed. Firefox and WebKit passed the no-WebGL2 test and failed the 4 screen comparisons each:
  - Firefox: WebGL2 still off despite `webgl.force-enabled`.
  - WebKit: every screenshot entirely black.
  - Both look like limits of headless browsers on GPU-less Linux runners rather than game defects. That is not proven, because Firefox and WebKit cannot run in this session.

## Gate checks
1. **`npm ci && npm run lint && npm test && npm run build` passes locally and in GitHub Actions.** Locally: **PASS** (exit code 0, figures above). In GitHub Actions: **PASS**. `npm ci`, lint, unit tests and build passed in runs 1 and 2 (links above). The first push had been refused for lack of GitHub access until the user fixed it.
2. **The published Pages address shows the title screen in Chromium, Firefox and Safari.** **PASS for Chromium and Firefox; Safari to be checked by the user** (decision S1-18, approved by the user).
   - Run 5 ([42856868851](https://github.com/seanoconail-ctrl/oar-and-ember/actions/runs/42856868851)) published the branch to GitHub Pages. It then ran the pixel-exact check against the published address in Chromium (Linux, 5 of 5) and Firefox (macOS, 5 of 5): both passed.
   - WebKit (macOS, not blocking) failed. The start-up diagnostic showed that the renderer's shader failed to compile with an empty log. In response, the presenter now draws its triangle from a vertex buffer instead of `gl_VertexID`, and its error names the shader and the context state. The WebKit check keeps running on every push.
3. **The decision log contains all twenty Stage 0 decisions.** **PASS**: `tests/unit/decisionLog.test.ts` reads rows 1 to 20 from the log and Book 3 section 03, and finds decision 9 still open in both.

## Art check
- Rendered with `npm run art:check` to `artifacts/` (not committed): `title`, `font_title` and `font_small`, each at 1x and 4x. All inspected.
  - **Title lettering**: a heavy face with insular touches (a round uncial E, a wedge-topped d); a one-pixel ink outline; light from the upper left with three-tone ramps. "Oar and" is in wool (linen, wool, shingle) and "Ember" in hearth colours (wool, ochre, madder). It reads clearly at 1x and holds crisp edges at 4x. The first draft was too small and too generic; it was redrawn larger before acceptance.
  - **Backdrop**: a night sky (ink to night water) over a sea horizon with a one-row shallows glint. The deep sea darkens toward the foot of the frame. Ordered dithering is used only in these sky and water gradients (Book 7 section 11).
  - **Small lettering**: 7 px digits, ".", "+", "B" and lowercase hex; legible at 1x.
- The Chromium screenshot at 1500 x 900 shows the frame at 2x, centred, with 110 px and 90 px ink bars and no blur.
- Only palette colours are used, and no reserved accents (both tested).
- **Placeholders remaining: none.** The fonts hold only the glyphs Stage 1 needs; later text must add glyphs first, and the renderer refuses text it cannot draw.

## Balance
- No Book 10 value is used or changed. `content/balance.json` is untouched.
- The 640 x 360 frame size comes from Book 1 section 17 and Book 7 section 01 (an art contract, not a tuning number).
- The title layout's pixel positions are art data in `assets/art/ui/title_screen.json`.

## Deviations
- Decision log entries S1-1 to S1-13 (2026-11-10).
- The main ones: S1-2, the palette values transcribed from the Book 7 PDF; S1-3, the font source format; S1-4, fonts compiled at load until Stage 4; S1-10 to S1-12, how the ID registry was seeded and when assigned IDs freeze.

## Known issues
- **Medium:** WebKit, Safari's engine, failed to compile the presenter's shader on GitHub's macOS runner (empty log). The vertex-buffer change may fix it; the user's own Safari check at the published link is the real test.
- **Medium:** gate check 2 is unverified until Pages is switched on and the work is published from a branch Pages accepts (`main` by default).
- **Low:** WebKit on Linux is Safari's engine, not Safari. The user should open the published address in Safari once.
- **Low:** `npm audit` reports a moderate advisory in `minimatch`, pulled in by ESLint and typescript-eslint. It is used only for linting, is never shipped to players, and the suggested fix downgrades ESLint. Accepted for now.
- **Low:** Safari reports no exact device-pixel size, so on some zoom levels the canvas may be off by one device pixel and be resampled slightly by the browser. Chromium and Firefox are exact.
- **For later stages (questions found while seeding IDs; none blocks Stage 2):**
  - Book 5 states 17 `C_` residents against a roster cap of 16.
  - Several named people and things have no Book 2 prefix: Thorkel, Colla, Ruairí, supernatural speakers, Nessa's stance IDs, landing points, scenes, festivals, endings, trophies and livestock.
  - Some stated IDs use different stems for one place (`SK_TIDECAVE` and `ZONE_SK_SEALCAVE`; `SK_ROOKHILL` and `ZONE_SK_ROOK`; `REG_CARRAIG` and "Carrick").
  - Book 7 gives T3 hulls six fitting slots where Book 10 gives the knarr five, and the books disagree on the re-caulking cost. Book 10 wins on numbers.
  - Book 3 Stage 14 says "four puzzles" where Book 9 lists six "puzzle or secret" rows.

## Next stage ready
**YES.** Checks 1 and 3 pass. Check 2 passes in Chromium and Firefox at the published address; Safari is the user's check, as agreed.
