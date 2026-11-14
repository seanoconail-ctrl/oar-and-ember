"""Renders Stage 9's people for review (Book 3: a new or redrawn character starts with its sheets at
1x and 4x and a short GIF): the fighting states of the steerer's two bodies, the heavy build and the
three wreck-scavengers, and the scavengers' walk, run and idle, each composited from its layers in
draw order (the bloodied layer in a separate row).

    python3 assets/art/authoring/people48.py && node src/tools/art/proposed.ts
    python3 assets/art/authoring/stage09_people.py [atlas dir] [layers dir] [out dir]

Writes <who>_<state>@1x.png and @4x.png (rows s, n, e, w; frames across), <who>_fight.gif (a run of
blows, defences and falls, south and east side by side at 3x) and, for the scavengers,
<who>_<walk|run|idle>.gif.
"""
import json
import os
import subprocess
import sys
import tempfile

from PIL import Image

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
ATLAS = sys.argv[1] if len(sys.argv) > 1 else f'{REPO}/assets/art/proposed/atlases'
LAYERS = sys.argv[2] if len(sys.argv) > 2 else f'{REPO}/assets/art/proposed'
OUT = sys.argv[3] if len(sys.argv) > 3 else f'{REPO}/docs/art/stage-09/people'
GROUND = (150, 136, 110)       # the strand's shingle, mid tone
FACINGS = ['s', 'n', 'e', 'w']
CELL = (72, 72)
ANCHOR = (36, 58)
FIGHT = ['windup', 'light1', 'light2', 'light3', 'charge', 'chargewalk', 'heavy', 'block', 'parry',
         'dodge', 'shove', 'stagger', 'finish', 'surrender', 'downed', 'dead', 'dead_head', 'dead_arm',
         'dead_leg', 'piece_head', 'piece_arm', 'piece_leg']
SEQUENCE = ['windup', 'light1', 'light2', 'light3', 'block', 'parry', 'dodge', 'shove', 'charge',
            'heavy', 'stagger', 'surrender', 'downed', 'dead']
WHO = os.environ.get('PEOPLE_WHO', 'steerer_a,steerer_b,heavy,wrecker_ketill,wrecker_svart,wrecker_conn').split(',')


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


def composite(names, cache, state, facing, i, blood=False):
    out = Image.new('RGBA', CELL, GROUND + (255,))
    for name in names:
        if 'blood_wound' in name and not blood:
            continue
        if name not in cache:
            cache[name] = load(name)
        man, img = cache[name]
        fr = frame(man, img, f'{state}/{facing}/{i}')
        if fr is None:
            continue
        out.alpha_composite(fr, (ANCHOR[0] - man['pivot']['x'], ANCHOR[1] - man['pivot']['y']))
    return out


def save_gif(frames, ms, path):
    with tempfile.TemporaryDirectory() as tmp:
        for k, f in enumerate(frames):
            f.convert('RGB').save(f'{tmp}/{k:03d}.png')
        subprocess.run([
            'ffmpeg', '-v', 'error', '-y', '-framerate', f'{1000 / ms:.4f}',
            '-i', f'{tmp}/%03d.png', '-filter_complex',
            '[0]split[a][b];[a]palettegen=reserve_transparent=0:stats_mode=full[p];[b][p]paletteuse=dither=none',
            '-loop', '0', path], check=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    cache = {}
    for who in WHO:
        with open(f'{LAYERS}/{who}.layers.json') as f:
            layers = json.load(f)['layers']
        body = [n for n in layers['s'] if n.startswith('actor_')][0]
        if body not in cache:
            cache[body] = load(body)
        anims = cache[body][0]['anims']
        # One contact sheet of every fighting state: rows by facing, the bloodied row under.
        states = [s for s in FIGHT if s in anims]
        cols = sum(anims[s]['frames'] for s in states)
        sheet = Image.new('RGBA', (cols * (CELL[0] + 2) + 2, 5 * (CELL[1] + 2) + 2), GROUND + (255,))
        c = 0
        for s in states:
            for i in range(anims[s]['frames']):
                for r, f in enumerate(FACINGS):
                    sheet.paste(composite(layers[f], cache, s, f, i), (2 + c * (CELL[0] + 2), 2 + r * (CELL[1] + 2)))
                sheet.paste(composite(layers['s'], cache, s, 's', i, True), (2 + c * (CELL[0] + 2), 2 + 4 * (CELL[1] + 2)))
                c += 1
        sheet.save(f'{OUT}/{who}_fight@1x.png')
        sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(f'{OUT}/{who}_fight@4x.png')
        # The GIF: a sequence of blows, defences and the falls; south and east side by side.
        frames = []
        for s in SEQUENCE:
            if s not in anims:
                continue
            n = anims[s]['frames']
            hold = 3 if n == 1 else 1
            for i in range(n):
                for _ in range(hold):
                    f = Image.new('RGBA', (CELL[0] * 2 + 3, CELL[1] + 2), GROUND + (255,))
                    f.paste(composite(layers['s'], cache, s, 's', i, s in ('dead', 'downed')), (1, 1))
                    f.paste(composite(layers['e'], cache, s, 'e', i, s in ('dead', 'downed')), (CELL[0] + 2, 1))
                    frames.append(f.resize((f.width * 3, f.height * 3), Image.NEAREST))
        save_gif(frames, 140, f'{OUT}/{who}_fight.gif')
        if who.startswith('wrecker_'):
            for s in ('idle', 'walk', 'run'):
                a = anims[s]
                fr = []
                for k in range(a['frames'] * 2):
                    i = k % a['frames']
                    f = Image.new('RGBA', (CELL[0] * 4 + 5, CELL[1] + 2), GROUND + (255,))
                    for col, facing in enumerate(FACINGS):
                        f.paste(composite(layers[facing], cache, s, facing, i), (1 + col * (CELL[0] + 1), 1))
                    fr.append(f.resize((f.width * 3, f.height * 3), Image.NEAREST))
                save_gif(fr, max(20, round(a['ticks'] * 1000 / 60)), f'{OUT}/{who}_{s}.gif')
                st = Image.new('RGBA', (a['frames'] * (CELL[0] + 2) + 2, 4 * (CELL[1] + 2) + 2), GROUND + (255,))
                for r, facing in enumerate(FACINGS):
                    for i in range(a['frames']):
                        st.paste(composite(layers[facing], cache, s, facing, i), (2 + i * (CELL[0] + 2), 2 + r * (CELL[1] + 2)))
                st.save(f'{OUT}/{who}_{s}@1x.png')
                st.resize((st.width * 4, st.height * 4), Image.NEAREST).save(f'{OUT}/{who}_{s}@4x.png')
        print(f'{who}: {len(states)} fighting states, {cols} frames a facing')


if __name__ == '__main__':
    main()
