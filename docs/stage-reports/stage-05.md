# STAGE 5 REPORT: input, interface shell and audio engine

In the Book 2 section 23 format: one heading per report field.

## Implemented
- **Action map with keyboard and gamepad** (`src/input/actions.ts`): the 26 actions of Book 2 section 21, with default keyboard, mouse and standard gamepad bindings (decision S5-1), and labels for prompts.
- **Input mapper** (`src/input/inputState.ts`):
  - Each frame it reports held, pressed and released actions, and a movement vector no longer than 1, with a stick dead zone.
  - Hold-or-toggle covers run, sneak, block and the command ring (S5-2).
  - Taps shorter than a frame are latched (S5-3), and everything is released when the window loses focus.
  - `src/input/browserInput.ts` feeds it keys, the mouse and the first gamepad, and stops game keys from scrolling the page.
- **Remapping** (`rebind` in `actions.ts`, `src/input/settingsStore.ts`):
  - A new binding replaces the old one on the same device and is taken from any other action, which is reported.
  - Settings save to localStorage, and damaged or unknown settings fall back to the defaults, action by action.
- **Command ring and quick commands** (`src/input/commandRing.ts`): FOLLOW, HOLD, ATTACK, PROTECT, CARRY and WITHDRAW.
  - The quick keys 1 to 6 issue them directly.
  - Holding Tab opens a six-way ring that the pointer or stick steers; releasing issues the chosen order.
  - Orders reach the simulation as a `CREW_ORDER` command and come back as `CREW_ORDER_GIVEN`. The crew who obey arrive in Stages 8 and 9.
- **The safe rule for menus** (`src/ui/menus.ts`, `src/scenes/session.ts`):
  - Map, inventory, build, report and planning refuse to open while any hostile is aware, with the count as the reason.
  - The system menu always opens, as an overlay that does not stop time while hostiles are aware.
  - A safe menu stops simulation time; the command ring never does.
  - `Session` runs one frame: input, menus, ring, then whole 60 Hz ticks unless time is stopped.
- **Text overlay** (`src/ui/overlay.ts`): HTML text over the frame for captions, menus, the ring, prompts and panels. It is sharp at every scale, read by screen readers, and sized by the 100 to 200% text-size option (S5-5).
- **Web Audio engine** (`src/audio/webAudio.ts`):
  - One AudioContext, unlocked on first input.
  - Buses for master, music, ambience, effects, voice and tells, each with a volume.
  - At most 48 voices, music ducking, and ambience layers.
- **Music state machine** (`src/audio/music.ts`):
  - A state change lands on the next bar line of the playing cue.
  - Intensity rises within one bar and falls over four.
  - Stems mix by intensity, with the bed always playing.
  - Stingers duck the music for their length.
- **Audio routing and captions** (`src/audio/router.ts`):
  - Game events map to cues through `content/audio.json`.
  - Music, stingers and effects each show their caption, with direction where given ("Horn, north"); captions expire after `captionSeconds`.
  - Ambience layers are chosen by zone and time of day.
- **Audio content** (`content/audio.json`, validated by content lint):
  - 7 music states, 2 stingers, 4 effects and 3 ambience layers, with captions in `content/strings/en.json`.
  - Lint requires a tempo, bar length and stems for music, and a caption for every gameplay sound.
- **Check view** (`src/scenes/shellView.ts`, `?view=shell`): everything above around a running clock, with a test hostile on H (S5-9).

## Tests
- `npm run lint`: ESLint, no problems; Prettier, all files formatted; content lint, clean (16 audio cues); art lint, clean.
- `npm test`: **21 files, 253 tests, 253 passed, 0 failed**. Stage 5 added:
  - `tests/unit/input.test.ts`: the map; gamepad coverage; edges; tap latching; movement; toggles; focus loss; rebind with displacement; persistence; damaged settings.
  - `tests/unit/shell.test.ts`: the safe rule for every menu; the system overlay; closing on danger; the ring's segments; quick and ring orders; time running with the ring open; time stopping for a menu.
  - `tests/unit/audio.test.ts`: bar lines; switch timing, including a 300-case property test; intensity rise and fall; stem mix; every cue's caption; events with direction; stinger ducking and caption expiry; ambience by place; lint refusing a missing caption.
- `npm run build`: passed.
- `npx playwright test --project=chromium`: **17 tests, 17 passed**. Stage 5 added `tests/browser/shell.spec.ts` with 4 tests, using a real keyboard and mouse:
  - the safe rule with the test hostile;
  - the command ring;
  - captions;
  - a remap surviving a reload.
- First run: 2 browser failures. Both came from a real input bug: key taps shorter than one frame were lost. I fixed it by latching presses (S5-3) and added a unit test; all passed after that.

## Gate checks
1. **Menus refuse to open while a test hostile is aware of the player.** **PASS.**
   - In unit tests, every non-system menu is refused with the reason `HOSTILES_AWARE`, and time does not stop.
   - In Chromium with real keys, the test hostile is toggled on and M is refused with "hostile aware". The system menu opens as an overlay while the tick keeps rising. With the hostile off, the map opens and the tick stops.
2. **Remapping persists; the command ring never stops time.** **PASS.**
   - **Remapping:** after rebinding Interact to G, saving and loading, G triggers Interact and E no longer does. In Chromium, F2 then G shows "G, Pad 0", and it is still G after a page reload.
   - **Ring:** with the ring held for 120 frames, all 120 ticks run, and the order is issued on release. In Chromium, the tick rises by more than 10 in half a second with the ring open.
3. **A music test switches states on bar boundaries and every test cue produces a caption.** **PASS.**
   - **Bar boundaries:** a request at 3.1 s in a 2-second bar switches at exactly 4.0 s. 300 random request times all land exactly on a bar line, within one bar.
   - **Captions:** each of the 13 gameplay cues produces its caption. In Chromium, the horn ("Horn, north"), a music change ("Music: ...") and the stinger ("A horn call") all appear.

## Art check
No new art in Stage 5. The overlay uses HTML text, as Book 7 allows, and the title's pixel fonts are unchanged.

## Balance
- Used: Book 10's clock values, through the simulation, for the running clock in the check view.
- The audio tempos and bar lengths are provisional data in `content/audio.json`, not Book 10 numbers (S5-6).

## Deviations
Decision log entries S5-1 to S5-9 (2026-11-10).

## Known issues
- **Placeholders (temporary audio, flagged as Book 11 plans):** all 16 audio cues in `content/audio.json` are synthesized test tones with `temporary: true`:
  - Music: `MUS_HOME_DAWN`, `MUS_HOME_DAY`, `MUS_HOME_DUSK`, `MUS_HOME_NIGHT`, `MUS_RAID_APPROACH`, `MUS_RAID_ALARM`, `MUS_COMBAT_1`.
  - Stingers: `MUS_STINGER_HORN`, `MUS_STINGER_DISCOVERY`.
  - Effects: `SFX_HORN`, `SFX_CHARGE_LEVEL_2`, `SFX_PARRY`, `SFX_TELL_RAN`.
  - Ambience: `AMB_SURF_SHINGLE`, `AMB_WIND_HEATHER`, `AMB_HEARTH`.
  - They are replaced when the music and sound are produced (Book 11 section 11; the composer is still an open decision).
- **Low:** the crew don't yet acknowledge orders aloud. Barks and icons come with the crew in Stages 8 and 9.
- **Low:** the remapping screen is the check view's simple F2 flow. A full controls menu comes with the options screen.
- **Low:** WebKit still has no working WebGL on GitHub's macOS runner, so it fails without blocking. Safari remains the user's check.

## Next stage ready
**YES.** All three acceptance checks pass.
