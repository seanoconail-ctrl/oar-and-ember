"""Renders Stage 12's art for review (CLAUDE.md: rendered at 1x and 4x and inspected) into
docs/art/stage-12/: the boat at each step of the launch (drawn up ready, afloat, the crew
aboard, the yard going up, the sail dropping and set), every sail mark on the boat, the sea
map with its token and smoke, and a GIF of the launched boat rowing with its sail full.

    python3 assets/art/authoring/stage12_review.py
"""
import json
import os

from PIL import Image

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT = f'{REPO}/docs/art/stage-12'
ATL = f'{REPO}/assets/atlases'
BG = (152, 138, 112, 255)
SEA = (41, 86, 105, 255)


def atlas(name):
    m = json.load(open(f'{ATL}/{name}.json'))
    return m, Image.open(f'{ATL}/{name}.png').convert('RGBA')


ATLASES = {n: atlas(n) for n in ('ship_t1', 'ship_t1_parts', 'ship_t1_launch', 'ship_t1_sail',
                                  'ship_t1_crew', 'ui_seamap', 'fx_seamap', 'token_t1')}


def frame(sheet, key):
    m, img = ATLASES[sheet]
    x, y = m['frames'][key]
    return img.crop((x, y, x + m['width'], y + m['height'])), m['pivot']


def put(canvas, sheet, key, fx, fy, dx=0):
    f, p = frame(sheet, key)
    canvas.alpha_composite(f, (int(fx - p['x'] + dx), int(fy - p['y'])))


SEATS = [0.31, 0.43, 0.57, 0.69]


def seat_dx(seat):
    return round(20 + 168 * SEATS[seat]) - 104


def boat(mark, step, k=0, crew=('hild', 'oddi', 'runa', 'bran'), body='a'):
    """The boat at a step of the launch, on a 240 x 210 canvas with sand above sea."""
    c = Image.new('RGBA', (240, 214), BG)
    if step != 'ready':
        c.paste(SEA, (0, 186, 240, 214))
    fx, fy = 120, 196
    if step == 'ready':
        put(c, 'ship_t1', 'hull_patched/-/0', fx, fy)
        put(c, 'ship_t1_parts', f'rig/-/{k}', fx, fy)
        put(c, 'ship_t1_parts', 'oar/-/0', fx, fy)
        put(c, 'ship_t1_parts', 'ready/-/0', fx, fy)
        return c
    put(c, 'ship_t1_launch', f'afloat/-/{k}', fx, fy)
    put(c, 'ship_t1_launch', f'mast/-/{k}', fx, fy)
    put(c, 'ship_t1_launch', 'oar/-/0', fx, fy)
    if step == 'hoist':
        put(c, 'ship_t1_sail', f'hoist/-/{k}', fx, fy)
    elif step == 'drop':
        put(c, 'ship_t1_sail', f'drop_{mark}/-/{min(k, 2)}', fx, fy)
    elif step in ('set', 'row'):
        put(c, 'ship_t1_sail', f'set_{mark}/-/{k}', fx, fy)
    if step != 'afloat':
        for i, who in enumerate(crew):
            put(c, 'ship_t1_crew', f'{who}_{i}/-/{k if step == "row" else 0}', fx, fy, seat_dx(i))
        put(c, 'ship_t1_crew', f'helm_{body}/-/{k}', fx, fy, round(20 + 168 * 0.13) - 104)
    return c


def scaled(img, n):
    return img.resize((img.width * n, img.height * n), Image.NEAREST)


def strip(images, gap=4):
    w = sum(i.width for i in images) + gap * (len(images) - 1)
    h = max(i.height for i in images)
    out = Image.new('RGBA', (w, h), (34, 49, 58, 255))
    x = 0
    for i in images:
        out.paste(i, (x, 0))
        x += i.width + gap
    return out


def grid(images, cols, gap=4):
    rows = [images[i:i + cols] for i in range(0, len(images), cols)]
    strips = [strip(r, gap) for r in rows]
    w = max(s.width for s in strips)
    h = sum(s.height for s in strips) + gap * (len(strips) - 1)
    out = Image.new('RGBA', (w, h), (34, 49, 58, 255))
    y = 0
    for s in strips:
        out.paste(s, (0, y))
        y += s.height + gap
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    steps = strip([boat('raven_woad', s, 0) for s in ('ready', 'afloat', 'hoist', 'drop', 'set')]
                  + [boat('raven_woad', 'row', 2)])
    steps.save(f'{OUT}/launch_steps@1x.png')
    scaled(steps, 4).save(f'{OUT}/launch_steps@4x.png')
    marks = [s for s in ATLASES['ship_t1_sail'][0]['anims'] if s.startswith('set_')]
    sails = grid([boat(m[4:], 'set', 0) for m in marks], 7)
    sails.save(f'{OUT}/sail_marks@1x.png')
    scaled(sails, 2).save(f'{OUT}/sail_marks@2x.png')
    detail = strip([boat(m, 'set', 0).crop((60, 20, 180, 120)) for m in
                    ('stripes_broad_madder', 'lozenge_weld', 'raven_woad', 'sunwheel_madder',
                     'serpent_weld', 'cross_woad')])
    scaled(detail, 4).save(f'{OUT}/sail_marks_detail@4x.png')
    gif = [scaled(boat('stripes_broad_madder', 'row', k), 2) for k in range(4) for _ in range(4)]
    gif[0].save(f'{OUT}/launch_row.gif', save_all=True, append_images=gif[1:], duration=62, loop=0,
                disposal=2)
    # The sea map with the token and the smoke.
    sea, _ = frame('ui_seamap', 'chart/-/0')
    places = json.load(open(f'{REPO}/content/launch.json'))['seaMap']['places']
    sk, ca = places['ISLE_SKARV'], places['SITE_CARRICK']
    m = sea.copy()
    put(m, 'fx_seamap', 'smoke/-/2', ca['x'], ca['y'])
    put(m, 'token_t1', 'raven_woad/-/0', sk['x'], sk['y'] + 14)
    m.save(f'{OUT}/seamap@1x.png')
    scaled(m, 2).save(f'{OUT}/seamap@2x.png')
    for v in ('lit', 'shade', 'fog'):
        f, _ = frame('ui_seamap', f'{v}/-/0')
        f.save(f'{OUT}/seamap_{v}@1x.png')
    toks = grid([scaled(frame('token_t1', f'{s}/-/0')[0], 4) for s in ATLASES['token_t1'][0]['anims']], 7)
    toks.save(f'{OUT}/tokens@4x.png')
    print(f'wrote {OUT}')


if __name__ == '__main__':
    main()
