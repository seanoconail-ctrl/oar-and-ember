"""Renders Stage 14's movement-verb frames for review (Book 3: a new or redrawn character's frames
start as sheets at 1x and 4x with a short GIF; decision DH-2: flagged, not waited on): the
steerer's two bodies and the heavy build, each composited from its layers in draw order from the
compiled atlases, as the game draws them.

    python3 assets/art/authoring/stage14_people.py && npm run art:sheets && npm run art:compile
    python3 assets/art/authoring/stage14_review.py [out dir]

Writes, in docs/art/stage-14/people/: <who>_verbs@1x.png and @4x.png (every verb state; rows s, n,
e, w; frames across), <who>_<state>.gif (the four facings side by side at 3x) and <who>_verbs.gif
(each verb in turn, facing east, then the climb facing the rock).
"""
import json
import os
import sys

import stage09_people
from stage09_people import CELL, FACINGS, GROUND, composite, save_gif

from PIL import Image

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT = sys.argv[1] if len(sys.argv) > 1 else f'{REPO}/docs/art/stage-14/people'
stage09_people.ATLAS = f'{REPO}/assets/atlases'
LAYERS = f'{REPO}/assets/art/layers'
WHO = ['steerer_a', 'steerer_b', 'heavy']
VERBS = ['climb', 'slide', 'swim', 'sink', 'crawl', 'push', 'pull', 'jump']


def contact(layers, cache, anims, path):
    cols = sum(anims[s]['frames'] for s in VERBS)
    sheet = Image.new('RGBA', (cols * (CELL[0] + 2) + 2, len(FACINGS) * (CELL[1] + 2) + 2), GROUND + (255,))
    c = 0
    for s in VERBS:
        for i in range(anims[s]['frames']):
            for r, f in enumerate(FACINGS):
                sheet.paste(composite(layers[f], cache, s, f, i), (2 + c * (CELL[0] + 2), 2 + r * (CELL[1] + 2)))
            c += 1
    sheet.save(f'{path}@1x.png')
    sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(f'{path}@4x.png')
    return cols


def state_gif(layers, cache, anims, state, path):
    a = anims[state]
    frames = []
    for k in range(a['frames'] * 2):
        i = k % a['frames']
        f = Image.new('RGBA', (CELL[0] * 4 + 5, CELL[1] + 2), GROUND + (255,))
        for col, facing in enumerate(FACINGS):
            f.paste(composite(layers[facing], cache, state, facing, i), (1 + col * (CELL[0] + 1), 1))
        frames.append(f.resize((f.width * 3, f.height * 3), Image.NEAREST))
    save_gif(frames, max(40, round(a['ticks'] * 1000 / 60)), path)


def verbs_gif(layers, cache, anims, path):
    frames = []
    for s in VERBS:
        facing = 'n' if s in ('climb', 'slide') else 'e'
        a = anims[s]
        for k in range(a['frames'] * 2):
            i = k % a['frames']
            f = Image.new('RGBA', (CELL[0] + 2, CELL[1] + 2), GROUND + (255,))
            f.paste(composite(layers[facing], cache, s, facing, i), (1, 1))
            frames.append(f.resize((f.width * 3, f.height * 3), Image.NEAREST))
    save_gif(frames, 160, path)


def main():
    os.makedirs(OUT, exist_ok=True)
    cache = {}
    for who in WHO:
        with open(f'{LAYERS}/{who}.layers.json') as fh:
            layers = json.load(fh)['layers']
        body = [n for n in layers['s'] if n.startswith('actor_')][0]
        cache[body] = stage09_people.load(body)
        anims = cache[body][0]['anims']
        missing = [s for s in VERBS if s not in anims]
        if missing:
            raise SystemExit(f'{who}: no {missing} in the compiled atlas (run art:sheets and art:compile)')
        cols = contact(layers, cache, anims, f'{OUT}/{who}_verbs')
        for s in VERBS:
            state_gif(layers, cache, anims, s, f'{OUT}/{who}_{s}.gif')
        verbs_gif(layers, cache, anims, f'{OUT}/{who}_verbs.gif')
        print(f'{who}: {len(VERBS)} verb states, {cols} frames a facing')


if __name__ == '__main__':
    main()
