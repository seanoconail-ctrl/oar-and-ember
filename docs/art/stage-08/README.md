# Stage 8 art, for review (decision DD-11: built without waiting, flagged here)

Every sheet below is in the game already; the user may still ask for changes.

| Folder | What it shows | How it was made |
|---|---|---|
| `people/` | Hild's new `eat` loop (4 frames, 36 ticks each): seated by the fire with a wooden bowl in her lap, the spoon taken to her mouth and down again; from behind, her elbow lifts with each mouthful. `hild_eat@1x.png` and `@4x.png` (rows s, n, e, w; layers composited) and `hild_eat.gif` (south and east side by side at 3x, timed from the animation) | `python3 assets/art/authoring/people48.py` (`hild_eat`), adopted into `assets/art/sheets`, then `PEOPLE_STATES=eat PEOPLE_WHO=hild python3 assets/art/authoring/stage07_people.py assets/atlases docs/art/stage-08/people` |
| `sheets/` | Hild's body and dress sheets and her composite, every frame at 1x and 4x, as proposed before adoption | `PROPOSED_OUT=docs/art/stage-08/sheets node src/tools/art/proposed.ts` (the other people's sheets did not change and were left out) |

Nothing else is new to draw: Hild at her work uses Stage 7's fish loop, at her dusk habit the
braced idle (`idlewind`), resting and in the evening her sitting pose, asleep the sleep loop. The
conversation panel is interface text on the overlay. Oddi, Bran and Runa are not drawn until Stage
10 brings them (their sheets come first, for review).

## Weak spots (flagged)
- At 1x the bowl is small: from the front it is mostly hidden by her hands, and from the side it
  reads as a dark patch on her knees; the spoon's rise to the mouth is what carries the loop.
- From behind there is little to see (only the elbow lifting).
