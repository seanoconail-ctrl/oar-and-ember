"""Renders Stage 11's art for review (Book 3: a redrawn T1 hull starts with its sheets at 1x and 4x
and a short GIF; DD-11: inspected and flagged rather than waited on), from the compiled atlases as
the game draws them:

- t1_states@1x.png, @4x.png: the coastal boat in each of its states, in order: wrecked, patched,
  patched and rigged, patched, rigged and steered (launch-ready), and launch-ready with each fitting.
- t1_repairs.gif: the boat going through its repairs, a state a second, its wind frames playing.
- props@1x.png, @4x.png: the skiff (with and without its oar), the rigging fouled on the wreck,
  the three loads (lying, s n e w), and the ship of stones (marked, half, done).

    python3 assets/art/authoring/stage11_review.py
"""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import stage09_people as P   # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
P.ATLAS = f'{REPO}/assets/atlases'
OUT = f'{REPO}/docs/art/stage-11'
GROUND = (150, 136, 110)

# Each state: its title and the layers drawn, hull first.
STATES = [
    ('wrecked', [('ship_t1', 'hull_wrecked')]),
    ('patched', [('ship_t1', 'hull_patched')]),
    ('rigged', [('ship_t1', 'hull_patched'), ('ship_t1_parts', 'rig')]),
    ('steered', [('ship_t1', 'hull_patched'), ('ship_t1_parts', 'rig'), ('ship_t1_parts', 'oar'),
                 ('ship_t1_parts', 'ready')]),
    ('hold', [('ship_t1', 'hull_patched'), ('ship_t1_parts', 'hold'), ('ship_t1_parts', 'rig'),
              ('ship_t1_parts', 'oar'), ('ship_t1_parts', 'ready')]),
    ('bow', [('ship_t1', 'hull_patched'), ('ship_t1_parts', 'rig'), ('ship_t1_parts', 'bow'),
             ('ship_t1_parts', 'oar'), ('ship_t1_parts', 'ready')]),
]

cache = {}


def frame(sheet, state, i, facing='-'):
    if sheet not in cache:
        cache[sheet] = P.load(sheet)
    man, img = cache[sheet]
    n = man['anims'][state]['frames']
    return man, P.frame(man, img, f'{state}/{facing}/{i % n}')


def boat(layers, i):
    out = Image.new('RGBA', (216, 204), GROUND + (255,))
    for sheet, state in layers:
        man, fr = frame(sheet, state, i)
        out.alpha_composite(fr, (108 - man['pivot']['x'], 196 - man['pivot']['y']))
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    tiles = [boat(layers, 0) for _, layers in STATES]
    sheet = Image.new('RGBA', (len(tiles) * 218 + 2, 206), (40, 42, 46, 255))
    for k, t in enumerate(tiles):
        sheet.paste(t, (2 + k * 218, 1))
    sheet.save(f'{OUT}/t1_states@1x.png')
    sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(f'{OUT}/t1_states@4x.png')
    # The GIF: each state for a second (its wind frames), at 2x.
    frames = []
    for _, layers in STATES:
        for i in range(8):
            frames.append(boat(layers, i).resize((432, 408), Image.NEAREST))
    P.save_gif(frames, 125, f'{OUT}/t1_repairs.gif')
    # The props.
    items = [('prop_skiff', 'oar', '-'), ('prop_skiff', 'bare', '-'), ('prop_rigging_tangle', 'fouled', '-')]
    for load in ('prop_boards', 'prop_rigging', 'prop_steering_oar'):
        for f in 's n e w'.split():
            items.append((load, 'down', f))
    for st in ('marked', 'half', 'done'):
        items.append(('prop_shipsetting', st, '-'))
    cells = []
    for sheet_, state, facing in items:
        man, fr = frame(sheet_, state, 0, facing)
        cell = Image.new('RGBA', (man['width'] + 4, man['height'] + 4), GROUND + (255,))
        cell.alpha_composite(fr, (2, 2))
        cells.append(cell)
    w = sum(c.width for c in cells) + 2 * len(cells)
    h = max(c.height for c in cells) + 4
    props = Image.new('RGBA', (w, h), (40, 42, 46, 255))
    x = 2
    for c in cells:
        props.paste(c, (x, 2))
        x += c.width + 2
    props.save(f'{OUT}/props@1x.png')
    props.resize((props.width * 4, props.height * 4), Image.NEAREST).save(f'{OUT}/props@4x.png')
    print(f'wrote {OUT}/t1_states, t1_repairs.gif and props')


if __name__ == '__main__':
    main()
