"""The game's people sprites, recoloured with the proposed hue-shifted ramps.

The sprites come from the committed material maps (assets/art/maps), exported with one code per
material and tone by export_people.ts, so skin, cloth, hair and leather each take their own ramp.
"""
import json
import os
import subprocess
from functools import lru_cache
from core import C, Sprite

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
CACHE = os.path.join(os.path.dirname(__file__), '.people.json')

# Material letter: (ramp, shadow, base, highlight)
STEERER = {
    'H': ('hair_brown', 1, 2, 4), 'F': ('skin_light', 2, 3, 4), 'T': ('madder', 1, 3, 4),
    'C': ('weld', 1, 3, 4), 'L': ('woad', 1, 2, 4), 'M': ('woad', 0, 1, 2), 'W': ('wool', 2, 3, 5),
    'V': ('wool', 1, 2, 3), 'S': ('tar', 1, 2, 4), 'Z': ('tar', 0, 1, 2), 'B': ('tar', 0, 1, 2),
}
HILD = {
    'H': ('hair_blond', 2, 3, 5), 'F': ('skin_light', 2, 3, 4), 'T': ('woad', 1, 3, 4),
    'U': ('weld', 2, 3, 5), 'L': ('earth', 2, 3, 5), 'M': ('earth', 1, 2, 3), 'W': ('wool', 2, 3, 5),
    'V': ('wool', 1, 2, 3), 'S': ('tar', 1, 2, 4), 'Z': ('tar', 0, 1, 2), 'B': ('tar', 0, 1, 2),
    'l': ('wool', 4, 5, 6),
}
MARKS = {'e': ('ink', 0), 'p': ('trefoil', 3), 'f': ('weld', 1), 'q': ('madder', 1),
         'h': ('hair_blond', 1), 'd': ('madder', 1)}
# Which material is the loose cloth that the wind catches.
CLOTH = {'actor_p_steerer_a': 'C', 'actor_p_steerer_b': 'C', 'actor_c_hild': 'U'}


def _data():
    if not os.path.exists(CACHE):
        out = subprocess.run(['node', 'docs/art/mockup-src/export_people.ts'], cwd=ROOT,
                             capture_output=True, text=True, check=True).stdout
        with open(CACHE, 'w') as f:
            f.write(out)
    with open(CACHE) as f:
        return json.load(f)


@lru_cache(maxsize=None)
def sprite(sheet, state, facing, frame):
    """The frame as a Sprite (anchor at the feet), with a mask of its loose cloth."""
    d = _data()[sheet]
    rows = d['frames'][f'{state} {facing} {frame}']
    table = HILD if sheet == 'actor_c_hild' else STEERER
    s = Sprite(len(rows[0]), len(rows), 16, 39)
    s.cloth = [[False] * s.w for _ in range(s.h)]
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == '.':
                continue
            label = d['legend'][ch]
            if label == 'ink':
                col = C('ink', 0)
            elif label.startswith('mark:'):
                name, i = MARKS[label[5:]]
                col = C(name, i)
            else:
                letter, tone = label.split(':')
                name, sh, base, hi = table[letter]
                col = C(name, {'sh': sh, 'base': base, 'hi': hi}[tone])
                if letter == CLOTH[sheet]:
                    s.cloth[y][x] = True
            s.px(x, y, col)
    return s


def flutter(spr, gust, facing, tick):
    """Secondary motion: the cloak's leeward edge lifts and ripples in the wind (east here)."""
    out = Sprite(spr.w, spr.h, spr.ax, spr.ay)
    out.rgb[:] = spr.rgb
    out.mask[:] = spr.mask
    if gust < 0.15:
        return out
    for y in range(spr.h):
        xs = [x for x in range(spr.w) if spr.cloth[y][x]]
        if not xs:
            continue
        edge = max(xs)
        # Lower rows of the cloak swing further; a ripple runs down it.
        reach = int(round(gust * (1.0 + (y - 16) / 10) + (0.6 if (y + tick) % 4 < 2 else 0)))
        if reach <= 0 or y < 17:
            continue
        col = spr.rgb[y, edge].copy()
        for k in range(1, reach + 1):
            if edge + k + 1 < spr.w:
                out.px(edge + k, y, col * (0.92 if k == reach else 1.0))
                out.px(edge + k + 1, y, C('ink', 0))
    return out
