"""Renders Stage 13's sea-map art for review (CLAUDE.md: rendered at 1x and 4x and inspected) into
docs/art/stage-13/: the token in its eight headings and four sail states (with its wake), every sail
mark set and reefed, the chart's marks, the chart in each of the voyage's lights, and a GIF of the
token riding the swell with its wake in each heading.

    python3 assets/art/authoring/stage13_review.py
"""
import json
import os

from PIL import Image

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT = f'{REPO}/docs/art/stage-13'
ATL = f'{REPO}/assets/atlases'
SEA = (53, 104, 119, 255)
HEADINGS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']


def atlas(name):
    m = json.load(open(f'{ATL}/{name}.json'))
    return m, Image.open(f'{ATL}/{name}.png').convert('RGBA')


A = {n: atlas(n) for n in ('token_t1', 'fx_seawake', 'ui_seaicons', 'ui_seamap', 'ui_seavoyage',
                           'fx_seabolt')}


def frame(sheet, key):
    m, img = A[sheet]
    x, y = m['frames'][key]
    return img.crop((x, y, x + m['width'], y + m['height'])), m['pivot']


def put(canvas, sheet, key, fx, fy):
    f, p = frame(sheet, key)
    canvas.alpha_composite(f, (int(fx - p['x']), int(fy - p['y'])))


def save(img, name):
    img.save(f'{OUT}/{name}.png')
    img.resize((img.width * 4, img.height * 4), Image.NEAREST).save(f'{OUT}/{name}@4x.png')


def tokens():
    states = ['furled', 'row', 'set_raven_woad', 'reefed_raven_woad', 'set_plain',
              'set_stripes_broad_madder', 'set_lozenge_weld', 'set_cross_woad']
    c = Image.new('RGBA', (len(HEADINGS) * 36 + 4, len(states) * 30 + 4), SEA)
    for r, st in enumerate(states):
        for i, h in enumerate(HEADINGS):
            x, y = 20 + i * 36, 18 + r * 30
            if st.startswith(('set', 'reefed', 'row')):
                put(c, 'fx_seawake', f'wake/{h}/2', x, y)
            put(c, 'token_t1', f'{st}/{h}/0', x, y)
    save(c, 'token-headings')
    m, _ = A['token_t1']
    marks = sorted({k.split('/')[0][4:] for k in m['frames'] if k.startswith('set_')})
    c = Image.new('RGBA', (len(marks) * 30 + 4, 2 * 22 + 6), SEA)
    for i, mk in enumerate(marks):
        put(c, 'token_t1', f'set_{mk}/e/0', 16 + i * 30, 14)
        put(c, 'token_t1', f'reefed_{mk}/e/0', 16 + i * 30, 36)
    save(c, 'token-marks')
    frames = []
    for k in range(24):
        c = Image.new('RGBA', (8 * 40, 40), SEA)
        for i, h in enumerate(HEADINGS):
            put(c, 'fx_seawake', f'wake/{h}/{k % 6}', 20 + i * 40, 20)
            put(c, 'token_t1', f'set_raven_woad/{h}/{k % 4}', 20 + i * 40, 20)
        frames.append(c.resize((c.width * 4, c.height * 4), Image.NEAREST).convert('P', palette=Image.ADAPTIVE))
    frames[0].save(f'{OUT}/token-sailing.gif', save_all=True, append_images=frames[1:], duration=133, loop=0)


def icons():
    m, _ = A['ui_seaicons']
    states = list(m['anims'])
    cols = 12
    rows = (len(states) + cols - 1) // cols
    c = Image.new('RGBA', (cols * 20 + 4, rows * 20 + 4), SEA)
    for i, st in enumerate(states):
        put(c, 'ui_seaicons', f'{st}/-/0', 10 + (i % cols) * 20, 18 + (i // cols) * 20)
    save(c, 'chart-marks')


def lights():
    names = [('ui_seamap', 'chart'), ('ui_seavoyage', 'land_lit'), ('ui_seavoyage', 'storm'),
             ('ui_seavoyage', 'storm_lit'), ('ui_seavoyage', 'flash'), ('ui_seavoyage', 'night'),
             ('ui_seavoyage', 'night_lit'), ('ui_seamap', 'fog'), ('ui_seavoyage', 'fog_thin')]
    c = Image.new('RGBA', (3 * 644, 3 * 364), (20, 20, 24, 255))
    for i, (sheet, f) in enumerate(names):
        img, _ = frame(sheet, f'{f}/-/0')
        c.paste(img, ((i % 3) * 644, (i // 3) * 364))
    c.save(f'{OUT}/chart-lights.png')
    bolt = Image.new('RGBA', (60, 70), (20, 30, 44, 255))
    put(bolt, 'fx_seabolt', 'bolt/-/0', 16, 66)
    put(bolt, 'fx_seabolt', 'bolt/-/1', 44, 66)
    save(bolt, 'bolt')


def main():
    os.makedirs(OUT, exist_ok=True)
    tokens()
    icons()
    lights()


if __name__ == '__main__':
    main()
