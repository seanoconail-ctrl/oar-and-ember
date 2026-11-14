"""The game's 32 x 48 people (the Stage 6 rework, approved), composited from their layer sheets.

The sheets in assets/art/sheets are already painted in the approved book07 palette (the ramps of
palette.py), so the mockups decode them directly: each layers file lists, per facing, the sheets
drawn bottom to top (body, clothing, cloak, weapon). The composite is a core.Sprite anchored at the
foot pivot (16, 47), with a mask of its cloak and loose cloth for the wind.
"""
import json
import os
from functools import lru_cache
import numpy as np
from core import Sprite

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SHEETS = os.path.join(ROOT, 'assets', 'art', 'sheets')
LAYERS = os.path.join(ROOT, 'assets', 'art', 'layers')


@lru_cache(maxsize=None)
def _palette():
    d = json.load(open(os.path.join(ROOT, 'assets', 'palette', 'book07.json')))
    out = {}
    for e in d['entries']:
        h = e['hex'].lstrip('#')
        out[e['code']] = np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32)
    return out


@lru_cache(maxsize=None)
def _pivot(name):
    with open(os.path.join(SHEETS, name + '.txt'), encoding='utf8') as f:
        for line in f:
            if line.startswith('pivot:'):
                x, y = line[6:].strip().split(',')
                return int(x), int(y)
    return 16, 47


@lru_cache(maxsize=None)
def _sheet(name):
    frames, cur, rows = {}, None, []
    with open(os.path.join(SHEETS, name + '.txt'), encoding='utf8') as f:
        for line in f.read().split('\n'):
            if line.startswith('frame '):
                cur, rows = line[6:].strip(), []
            elif line == 'end' and cur is not None:
                frames[cur] = rows
                cur = None
            elif cur is not None:
                rows.append(line)
    return frames


@lru_cache(maxsize=None)
def _layers(who):
    return json.load(open(os.path.join(LAYERS, who + '.layers.json')))['layers']


def frames_of(who, state):
    """How many frames a state has (per facing) for a person."""
    body = _layers(who)['s'][0]
    return len([k for k in _sheet(body) if k.startswith(state + ' s ')])


@lru_cache(maxsize=None)
def sprite(who, state, facing, frame):
    """who: 'steerer_a', 'steerer_b' or 'hild'. Returns a Sprite with .cloth (bool array)."""
    pal = _palette()
    # A canvas wide enough for layers on larger canvases (the bow), anchored at the feet.
    s = Sprite(48, 56, 24, 51)
    s.cloth = np.zeros((56, 48), bool)
    key = f'{state} {facing} {frame}'
    for layer in _layers(who)[facing]:
        fr = _sheet(layer)
        if key not in fr:
            continue
        loose = 'cloak' in layer
        px, py = _pivot(layer)
        ox, oy = s.ax - px, s.ay - py
        for y, row in enumerate(fr[key]):
            for x, ch in enumerate(row):
                if ch == '.' or ch == ' ':
                    continue
                s.rgb[y + oy, x + ox] = pal[ch]
                s.mask[y + oy, x + ox] = True
                s.cloth[y + oy, x + ox] = loose
    return s


def lit(spr, warm, side=None):
    """A copy of a sprite with warm light added: `warm` is (r, g, b) multipliers on the side
    facing the fire (side = -1 for its left, +1 its right, None for all)."""
    out = Sprite(spr.w, spr.h, spr.ax, spr.ay)
    out.mask[:] = spr.mask
    rgb = spr.rgb.copy()
    if side is None:
        k = np.ones((spr.h, spr.w, 1), np.float32)
    else:
        xs = np.arange(spr.w, dtype=np.float32)
        k = np.clip(0.5 + side * (xs - spr.ax) / 10, 0.25, 1.0)[None, :, None] * np.ones((spr.h, 1, 1))
    rgb = rgb * (1 + k * (np.array(warm, np.float32) - 1))
    out.rgb[:] = rgb
    out.cloth = getattr(spr, 'cloth', np.zeros((spr.h, spr.w), bool))
    return out
