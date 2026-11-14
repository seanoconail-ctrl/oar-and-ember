"""Renders Stage 10's people and carried things for review (Book 3: a new or redrawn character starts
with its sheets at 1x and 4x and a short GIF): Oddi, Bran, Runa and Thorkel's body, each composited
from its layers in draw order, and the two chests and the Hag's Seat stone from their prop sheets.

    python3 assets/art/authoring/people48.py && node src/tools/art/proposed.ts
    python3 assets/art/authoring/stage10_people.py [atlas dir] [layers dir] [out dir]

Writes <who>@1x.png and @4x.png (every state; rows s, n, e, w, frames across, the states in the order
the atlas lists them), <who>_<state>.gif for the states that matter in the searches (all four
facings side by side at 3x), and the props' sheets the same way.
"""
import json
import os
import sys

from stage09_people import CELL, FACINGS, GROUND, composite, load, save_gif

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
ATLAS = sys.argv[1] if len(sys.argv) > 1 else f'{REPO}/assets/art/proposed/atlases'
LAYERS = sys.argv[2] if len(sys.argv) > 2 else f'{REPO}/assets/art/proposed'
OUT = sys.argv[3] if len(sys.argv) > 3 else f'{REPO}/docs/art/stage-10/people'
SHEETS = f'{REPO}/assets/atlases'
WHO = {
    'oddi': ['idle', 'walk', 'down', 'carried', 'light1', 'sneak'],
    'bran': ['idle', 'walk', 'carry', 'light2', 'block', 'downed'],
    'runa': ['idle', 'walk', 'down', 'carried', 'kneel', 'call'],
    'thorkel': ['dead', 'carried'],
}
PROPS = {'prop_chest_thorkel': ['down', 'carried'], 'prop_chest_runa': ['down', 'carried'],
         'prop_hagstone': ['dry', 'wet']}

from PIL import Image  # noqa: E402


def contact(names_by_facing, cache, anims, facings, path):
    states = list(anims.keys())
    cols = sum(anims[s]['frames'] for s in states)
    sheet = Image.new('RGBA', (cols * (CELL[0] + 2) + 2, len(facings) * (CELL[1] + 2) + 2), GROUND + (255,))
    c = 0
    for s in states:
        for i in range(anims[s]['frames']):
            for r, f in enumerate(facings):
                sheet.paste(composite(names_by_facing[f], cache, s, f, i), (2 + c * (CELL[0] + 2), 2 + r * (CELL[1] + 2)))
            c += 1
    sheet.save(f'{path}@1x.png')
    sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(f'{path}@4x.png')
    return len(states), cols


def gif(names_by_facing, cache, anims, facings, state, path):
    a = anims[state]
    frames = []
    for k in range(max(2, a['frames'] * 2)):
        i = k % a['frames']
        f = Image.new('RGBA', (CELL[0] * len(facings) + len(facings) + 1, CELL[1] + 2), GROUND + (255,))
        for col, facing in enumerate(facings):
            f.paste(composite(names_by_facing[facing], cache, state, facing, i), (1 + col * (CELL[0] + 1), 1))
        frames.append(f.resize((f.width * 3, f.height * 3), Image.NEAREST))
    save_gif(frames, max(20, round(max(a['ticks'], 6) * 1000 / 60)), path)


def main():
    os.makedirs(OUT, exist_ok=True)
    cache = {}
    for who, shown in WHO.items():
        with open(f'{LAYERS}/{who}.layers.json') as f:
            layers = json.load(f)['layers']
        body = [n for n in layers['s'] if n.startswith('actor_')][0]
        cache[body] = load(body)
        anims = cache[body][0]['anims']
        n, cols = contact(layers, cache, anims, FACINGS, f'{OUT}/{who}')
        for s in shown:
            if s in anims:
                gif(layers, cache, anims, FACINGS, s, f'{OUT}/{who}_{s}.gif')
        print(f'{who}: {n} states, {cols} frames a facing')
    # The props come from the compiled atlases (src/tools/art/compile.ts), like the game draws them.
    import stage09_people
    stage09_people.ATLAS = SHEETS
    pcache = {}
    for prop, shown in PROPS.items():
        man, _ = stage09_people.load(prop)
        pcache[prop] = stage09_people.load(prop)
        facings = man.get('facings') or ['-']
        by = {f: [prop] for f in facings}
        n, cols = contact(by, pcache, man['anims'], facings, f'{OUT}/{prop}')
        for s in shown:
            gif(by, pcache, man['anims'], facings, s, f'{OUT}/{prop}_{s}.gif')
        print(f'{prop}: {n} states, {cols} frames a facing')


if __name__ == '__main__':
    main()
