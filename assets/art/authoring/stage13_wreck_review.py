"""Renders the survivors of the wreck on Sgeir Dhubh for review (Book 3: a new character starts
with its sheets at 1x and 4x and a short GIF; decision DH-2: flagged, not waited on): Fínán,
Derbáil and Ívar, each composited from their layers in draw order from the compiled atlases (as the
game draws them), and the wreck's props.

    python3 assets/art/authoring/stage13_wreck_people.py && npm run art:sheets && npm run art:compile
    python3 assets/art/authoring/stage13_wreck_review.py

Writes docs/art/stage-13/<who>@1x.png and @4x.png (every state; rows s, n, e, w; frames across),
<who>_<state>.gif for the states the scene uses (all four facings side by side at 3x), and
survivors.gif (the three in their scene poses side by side, on the reef's wet shingle).
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import stage09_people  # noqa: E402
from stage09_people import CELL, FACINGS, composite, load, save_gif  # noqa: E402
import stage10_people  # noqa: E402
from PIL import Image  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
ATLAS = f'{REPO}/assets/atlases'
LAYERS = f'{REPO}/assets/art/layers'
OUT = f'{REPO}/docs/art/stage-13'
WHO = {
    'finan': ['call', 'idle', 'walk', 'carried'],
    'derbail': ['idlewind', 'idle', 'walk', 'call'],
    'ivar': ['down', 'carried', 'idle', 'walk'],
}
SCENE = [('finan', 'call', 'w'), ('derbail', 'idlewind', 'e'), ('ivar', 'down', 'n')]
PROPS = {'prop_sea_wreck': ['broken', 'cask', 'iron'], 'fx_sea_wreck': ['spray', 'kelp', 'sail']}
WET = (118, 112, 98)


def main():
    os.makedirs(OUT, exist_ok=True)
    stage09_people.ATLAS = ATLAS
    stage09_people.GROUND = WET
    stage10_people.GROUND = WET
    cache = {}
    layers_of = {}
    for who, shown in WHO.items():
        with open(f'{LAYERS}/{who}.layers.json') as f:
            layers = json.load(f)['layers']
        layers_of[who] = layers
        body = [n for n in layers['s'] if n.startswith('actor_')][0]
        cache[body] = load(body)
        anims = cache[body][0]['anims']
        n, cols = stage10_people.contact(layers, cache, anims, FACINGS, f'{OUT}/{who}')
        for s in shown:
            stage10_people.gif(layers, cache, anims, FACINGS, s, f'{OUT}/{who}_{s}.gif')
        print(f'{who}: {n} states, {cols} frames a facing')
    # The three in the scene's poses side by side, looping for a few seconds.
    frames = []
    for k in range(48):
        f = Image.new('RGBA', (CELL[0] * 3 + 4, CELL[1] + 2), WET + (255,))
        for col, (who, state, facing) in enumerate(SCENE):
            body = [n for n in layers_of[who]['s'] if n.startswith('actor_')][0]
            a = cache[body][0]['anims'][state]
            i = (k * 4 // max(1, a['ticks'])) % a['frames']
            f.paste(composite(layers_of[who][facing], cache, state, facing, i), (1 + col * (CELL[0] + 1), 1))
        frames.append(f.resize((f.width * 3, f.height * 3), Image.NEAREST))
    save_gif(frames, 67, f'{OUT}/survivors.gif')
    for prop, shown in PROPS.items():
        man, _ = load(prop)
        pc = {prop: load(prop)}
        by = {f: [prop] for f in (man.get('facings') or ['-'])}
        stage10_people.contact(by, pc, man['anims'], list(by), f'{OUT}/{prop}')
        for s in shown:
            stage10_people.gif(by, pc, man['anims'], list(by), s, f'{OUT}/{prop}_{s}.gif')
    print(f'wrote {OUT}')


if __name__ == '__main__':
    main()
