"""Renders the boat's work in hand for review (the user's fourth playtest, request 14; decision
DH-62), from the compiled atlases as the game draws them, at 1x and 4x, with a short GIF:

- boat_stages@1x.png, @4x.png: the hull wrecked, trimmed, half boarded, boarded and riveted, and
  patched; then the rigging lying in the boat, stepped unstayed, and set up.
- boat_stages.gif: the boat going through its work stage by stage, its wind frames playing.

    python3 assets/art/authoring/pt4_boat_review.py
"""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import stage09_people as P   # noqa: E402
import stage11_review as R   # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT = f'{REPO}/docs/art/playtest-4/people'

STAGES = [
    ('wrecked', [('ship_t1', 'hull_wrecked')]),
    ('trim', [('ship_t1_work', 'hull_trim')]),
    ('boards', [('ship_t1_work', 'hull_boards')]),
    ('rivets', [('ship_t1_work', 'hull_rivets')]),
    ('patched', [('ship_t1', 'hull_patched')]),
    ('mast lying', [('ship_t1', 'hull_patched'), ('ship_t1_rigwork', 'lying')]),
    ('stepped', [('ship_t1', 'hull_patched'), ('ship_t1_rigwork', 'stepped')]),
    ('rigged', [('ship_t1', 'hull_patched'), ('ship_t1_parts', 'rig')]),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    tiles = [R.boat(layers, 0) for _, layers in STAGES]
    cols = 4
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * 218 + 2, rows * 206 + 2), (40, 42, 46, 255))
    for k, t in enumerate(tiles):
        sheet.paste(t, (2 + (k % cols) * 218, 1 + (k // cols) * 206))
    sheet.save(f'{OUT}/boat_stages@1x.png')
    sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(f'{OUT}/boat_stages@4x.png')
    frames = []
    for _, layers in STAGES:
        for i in range(8):
            frames.append(R.boat(layers, i))
    P.save_gif(frames, 125, f'{OUT}/boat_stages.gif')
    print('wrote', OUT)


if __name__ == '__main__':
    main()
