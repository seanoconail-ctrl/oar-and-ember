"""Renders Svart with his shield slung on his back for review (design addendum 2.4, decision DE-14:
he fights the dusk fight with the spear in both hands, the shield on his back), composited from his
layers in draw order with layer_shield_back_svart in place of layer_shield_round_svart, in every
state his sheet has and all four facings; and the same frames with the shield on his arm, beside
them, to compare.

    PEOPLE_ONLY=svart python3 assets/art/authoring/people48.py && node src/tools/art/proposed.ts
    python3 assets/art/authoring/combat24_slung.py

Writes docs/art/rework-2.4/combat/sheets/wrecker_svart_slung@1x.png (one row a state, its frames
in s, n, e, w groups), wrecker_svart_slung_fight@4x.png (the fighting states at 4x), and
wrecker_svart_slung.gif (south, east, north and west side by side at 3x: idle, walk, the charged
heavy, the light thrusts, parried, stagger, the fall).
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import stage09_people as s9  # noqa: E402
from PIL import Image  # noqa: E402

OUT = os.path.join(s9.REPO, 'docs', 'art', 'rework-2.4', 'combat', 'sheets')
FIGHT = ['windup', 'light1', 'charge', 'heavy', 'parry', 'dodge', 'stagger', 'riposte', 'lunge',
         'parried', 'backstab', 'getup', 'surrender', 'downed', 'dead']
GIF = ['idle', 'walk', 'charge', 'heavy', 'light1', 'light2', 'parried', 'stagger', 'downed', 'dead']


def main():
    os.makedirs(OUT, exist_ok=True)
    with open(f'{s9.LAYERS}/wrecker_svart.layers.json') as f:
        layers = json.load(f)['layers']
    slung = {fc: [n.replace('layer_shield_round_', 'layer_shield_back_') for n in ns]
             for fc, ns in layers.items()}
    cache = {}
    body = [n for n in layers['s'] if n.startswith('actor_')][0]
    cache[body] = s9.load(body)
    anims = cache[body][0]['anims']
    for ns in list(layers.values()) + list(slung.values()):
        for n in ns:
            if n not in cache:
                cache[n] = s9.load(n)
    CW, CH = s9.CELL
    states = list(anims)
    cols = max(anims[s]['frames'] for s in states) * 4
    sheet = Image.new('RGBA', (cols * (CW + 2) + 2, len(states) * (CH + 2) + 2), s9.GROUND + (255,))
    for r, st in enumerate(states):
        n = anims[st]['frames']
        for k, fc in enumerate(s9.FACINGS):
            for i in range(n):
                c = k * n + i
                sheet.paste(s9.composite(slung[fc], cache, st, fc, i), (2 + c * (CW + 2), 2 + r * (CH + 2)))
    sheet.save(f'{OUT}/wrecker_svart_slung@1x.png')
    # The fighting states at 4x: slung (left) and on the arm (right), south and east.
    fight = [s for s in FIGHT if s in anims]
    width = max(anims[s]['frames'] for s in fight) * 4
    big = Image.new('RGBA', (width * (CW + 2) + 2, len(fight) * (CH + 2) + 2), s9.GROUND + (255,))
    for r, st in enumerate(fight):
        n = anims[st]['frames']
        c = 0
        for look in (slung, layers):
            for fc in ('s', 'e'):
                for i in range(n):
                    big.paste(s9.composite(look[fc], cache, st, fc, i), (2 + c * (CW + 2), 2 + r * (CH + 2)))
                    c += 1
    big.resize((big.width * 4, big.height * 4), Image.NEAREST).save(f'{OUT}/wrecker_svart_slung_fight@4x.png')
    big.save(f'{OUT}/wrecker_svart_slung_fight@1x.png')
    frames = []
    for st in GIF:
        if st not in anims:
            continue
        n = anims[st]['frames']
        hold = 4 if n <= 2 else 2
        for i in range(n):
            for _ in range(hold):
                fr = Image.new('RGBA', (CW * 4 + 5, CH + 2), s9.GROUND + (255,))
                for k, fc in enumerate(s9.FACINGS):
                    fr.paste(s9.composite(slung[fc], cache, st, fc, i), (1 + k * (CW + 1), 1))
                frames.append(fr.resize((fr.width * 3, fr.height * 3), Image.NEAREST))
    s9.save_gif(frames, 120, f'{OUT}/wrecker_svart_slung.gif')
    print(f'wrecker_svart slung: {len(states)} states, {len(fight)} fighting states at 4x, {len(frames)} GIF frames')


if __name__ == '__main__':
    main()
