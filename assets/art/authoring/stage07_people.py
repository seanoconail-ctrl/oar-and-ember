"""Renders Stage 7's new people animations for review (Book 3: a new or redrawn character starts with
its sheets at 1x and 4x and a short GIF): the work loops (gather, fish, kneel, build) and sleep, for
the steerer's two bodies, the heavy build and Hild, each composited from its layers in draw order.

    python3 assets/art/authoring/people48.py && node src/tools/art/proposed.ts
    python3 assets/art/authoring/stage07_people.py [atlas dir] [out dir]

Reads the compiled atlases (assets/atlases by default, or the proposed ones) and writes
docs/art/stage-07/people/: <who>_<state>@1x.png and @4x.png (rows s, n, e, w; frames across) and
<who>_<state>.gif (the south and east facings side by side at 3x, timed from the animation ticks).
"""
import json
import os
import subprocess
import sys
import tempfile

from PIL import Image

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
ATLAS = sys.argv[1] if len(sys.argv) > 1 else f'{REPO}/assets/atlases'
OUT = sys.argv[2] if len(sys.argv) > 2 else f'{REPO}/docs/art/stage-07/people'
LAYERS = f'{REPO}/assets/art/layers'
STATES = ['gather', 'fish', 'kneel', 'build', 'sleep']
WHO = ['steerer_a', 'steerer_b', 'heavy', 'hild']
GROUND = (128, 112, 92)       # the broch's trodden earth, mid tone
FACINGS = ['s', 'n', 'e', 'w']


def load(name):
    with open(f'{ATLAS}/{name}.json') as f:
        man = json.load(f)
    img = Image.open(f'{ATLAS}/{name}.png').convert('RGBA')
    return man, img


def frame(man, img, key):
    at = man['frames'].get(key)
    if at is None:
        return None
    return img.crop((at[0], at[1], at[0] + man['width'], at[1] + man['height']))


def composite(layers, cache, state, facing, i, cell=(48, 56), anchor=(24, 51)):
    out = Image.new('RGBA', cell, GROUND + (255,))
    for name in layers[facing]:
        if name not in cache:
            cache[name] = load(name)
        man, img = cache[name]
        fr = frame(man, img, f'{state}/{facing}/{i}')
        if fr is None:
            continue
        out.alpha_composite(fr, (anchor[0] - man['pivot']['x'], anchor[1] - man['pivot']['y']))
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    cache = {}
    for who in WHO:
        with open(f'{LAYERS}/{who}.layers.json') as f:
            layers = json.load(f)['layers']
        body = layers['s'][0] if who == 'hild' else [n for n in layers['s'] if n.startswith('actor_')][0]
        if body not in cache:
            cache[body] = load(body)
        anims = cache[body][0]['anims']
        for state in STATES:
            a = anims.get(state)
            if a is None:
                print(f'{who}: no {state}')
                continue
            n = a['frames']
            sheet = Image.new('RGBA', (n * 50 + 2, 4 * 58 + 2), GROUND + (255,))
            for r, f in enumerate(FACINGS):
                for i in range(n):
                    sheet.paste(composite(layers, cache, state, f, i), (2 + i * 50, 2 + r * 58))
            sheet.save(f'{OUT}/{who}_{state}@1x.png')
            sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(
                f'{OUT}/{who}_{state}@4x.png')
            # A short GIF: south and east side by side at 3x, two loops, timed from the ticks.
            frames = []
            for k in range(n * (1 if n <= 2 else 2)):
                i = k % n
                f = Image.new('RGBA', (100, 58), GROUND + (255,))
                f.paste(composite(layers, cache, state, 's', i), (1, 1))
                f.paste(composite(layers, cache, state, 'e', i), (51, 1))
                frames.append(f.resize((300, 174), Image.NEAREST))
            ms = max(20, round(a['ticks'] * 1000 / 60))
            with tempfile.TemporaryDirectory() as tmp:
                for k, f in enumerate(frames):
                    f.convert('RGB').save(f'{tmp}/{k:03d}.png')
                subprocess.run([
                    'ffmpeg', '-v', 'error', '-y', '-framerate', f'{1000 / ms:.4f}',
                    '-i', f'{tmp}/%03d.png', '-filter_complex',
                    '[0]split[a][b];[a]palettegen=reserve_transparent=0:stats_mode=full[p];[b][p]paletteuse=dither=none',
                    '-loop', '0', f'{OUT}/{who}_{state}.gif'], check=True)
            print(f'{who} {state}: {n} frames')


if __name__ == '__main__':
    main()
