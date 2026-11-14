# render

The WebGL2 renderer: the 640 x 360 frame, integer scaling and letterbox, atlases, tilemaps, cameras, lighting, gore decals, effects and the UI overlay. Reads views of sim state; never mutates it.

- **May depend on:** `core`, `content`, `sim` (views only).
- **Built in:** Stage 1 (presenter, palette, bitmap text), Stage 4 (full renderer and art pipeline)
