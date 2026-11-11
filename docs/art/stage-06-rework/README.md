# Stage 6 rework: proposed characters, water and controls (for approval)

Design addendum 2.2 sections 1 and 2, and the user's scale, controls and camera instruction of
11 November 2026. **Nothing here is in the game yet.** The sources are staged in
`assets/art/proposed/` (not read by the game) and wait for the user's approval before they are
wired in (Book 3 Stage 6; CLAUDE.md).

## What to look at
| File | Shows |
|---|---|
| `wade-a.gif`, `wade-b.gif` | Each body model walking from the sand into the shallows beside Hild, then back out. The renders use real Wreck Strand frames from the game (people left out, camera held) and the real water depth under every pixel. The body is masked at the waterline by depth band: knee 12 px, waist 22 px. Ripple rings show at every step and while standing, with splashes on entering. Hild stands waist deep in the surf, calling, with ripples and spray. Wading is slower; after leaving the water the steerer is darker and drips, leaving wet prints. 3x, 10 s |
| `compare-before.png`, `compare-after.png` | 1920 x 1080 (3x), the same frame of the strand. Before: the 32 x 40 people. After: the 32 x 48 people about 40 px tall, beside a broch doorway (48 px clear opening) and the T1 boat. The doorway and the boat are set side by side on the sand for scale |
| `hotbar.gif` | The 12-slot hotbar chosen in turn. The target-tile cursor sweeps round the steerer: in reach it shows the rim, corner ticks and the tool's glyph; out of reach, a broken red edge. The steerer turns to the cursor. The stamina bar shows two reasons it is smaller (cold, hunger) |
| `bow.gif` | Aiming the bow at the cursor: raise, draw, hold and loose. The aim line's dots spread as the draw grows, with a cross at the aim point and the facing arrow at the feet |
| `sheets/` | Every proposed sheet at 1x and 4x on sand, and each character's layers composited (`composite_*`). This includes the helmeted steerers, which show the helmet slot fits |
| `animations/` | One GIF per state with all four facings, for both body models and Hild (4x) |
| `ui-mock.png` | The interface over the approved strand mockup |

## Checked against the addendum and Book 7
- **Canvas and size:** 32 x 48 with the foot anchor at bottom centre. Each figure is 40 px from sole to crown. Measured at idle south: A is 18 x 40 bare and 22 x 40 dressed; B is 16 x 40 and 20 x 40; Hild is 16 x 40. Every standing frame's feet are on the pivot row.
- **Walk:** 6 frames. The crown rows over frames 0 to 5 are 8 9 8 8 9 8 in all four facings for all three people: exactly 1 px down on the two down frames. Arms swing well forward and back. In profile the planted heel moves 4 px a frame, which is the walking speed, so the feet do not slide.
- **Other animations:** run 8; idle 4 (breathing), shift 4, glance 4, gust idle 4; sneak 6; carry 6; draw 4 for the steerer, drawn in all four facings and never mirrored. Hild has call 6, plus down, carried and sit.
- **Secondary motion:** hair, Hild's braid, the steerer's sash tails and the cloaks lag a frame behind the body, and the cloaks stream in the run and the gust.
- **Layers:**
  - **Body, clothing and cloak:** separate sheets on the same frames and anchor, for each body model and Hild.
  - **Helmet:** a plain iron cap. The steerer starts with none.
  - **Bow:** slung on the back, in hand to draw.
  - **Draw order:** per facing in `assets/art/proposed/*.layers.json`.
- **Readability:**
  - The steerer's madder-red sash shows from the front and sides. From behind it is the cloak's madder hem.
  - Hild has her blond braid and weld-green shawl.
  - Both read at 1x against sand, grass and water.
- **Particles** (`fx_people`): dust, splash, ripple rings, drips, surf spray, and dry and wet footprints for each facing.
- **Shadows:** a soft oval under every person and prop (from the sheets' `shadow:` headers).

## Decisions for the user
1. **The steerer's colours change.**
   - The tunic is now brown and the cloak dark wool with a madder hem and sash. Decision S4-7 had a madder tunic and a weld-green cloak.
   - The cloak moved off weld green so that colour stays Hild's signature (Book 7 section 07).
2. **Hild's signature colour.** Book 5 calls it woad blue; Book 7 says the weld-green shawl. The drawing keeps both (a woad dress and a weld shawl). Which is her signature?
3. **The two body models read alike at 1x from the front.**
   - A has broader shoulders and short hair; B is slighter, with long hair in a tail.
   - The difference is clearer in profile and at 2x.
   - Say if B should differ more (for example the build, the hair or the face).
4. **The T1 boat looks small beside 40 px people.** It is drawn at the old scale. The rowing benches and deck spacing follow the people (Book 7 section 01), and the boat is redrawn in Stage 11 with the ship art. Say if you want it redrawn earlier.
5. **Approve or change** the hotbar, cursor, aim line and stamina bar look.

## Compromises and how these renders were made
- **Light:** the renders composite the sprites over finished game frames, so the people do not get the game's light and colour grade, which the renderer applies once wired in.
- **Water:**
  - The depth thresholds for the bands here (wet 0.012, ankle 0.05, knee 0.14, waist 0.30 in the game's height units) are for the preview. They become Book 10 numbers when wired in.
  - At high tide the strand's shallows are narrow, 15 to 25 px, so Hild's opening spot will move to waist depth at the opening's tide.
- **Planted feet:** they stay exactly planted only in profile. From the south or north a planted foot has to stay on the anchor row.
- **Run:** a toe is always on the ground.
- **Lag:** the cloak and hair lag within each cycle, but not across a change of state.
- **Carried pose:** Hild's carried frames are drawn to sit over the steerer's shoulders, so they look broken on their own.
- **Small icons:** at 8 x 8 the "hard day's work" and "lack of sleep" reasons and the seed glyph are the weakest; the hover word carries them.
- **Rebuilding the renders:**

  ```bash
  node src/tools/art/proposed.ts
  ```

  ```bash
  node src/tools/art/preview48.ts wade 30,38.6 125 12.5
  ```

  ```bash
  python3 assets/art/authoring/preview48.py
  ```
