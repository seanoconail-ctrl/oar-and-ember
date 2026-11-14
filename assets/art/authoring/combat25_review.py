"""Renders design addendum 2.5's new fighting states for review (Book 3: new frames start as
sheets at 1x and 4x and a short GIF; decisions DF-1 to DF-9 and DF-21): the wind-up draw-backs by
weight, the parry's wind-up, the block's raise, the guard broken by an empty bar, the exhausted
idle and walk, the dodge's planted recovery, the stance walk (back off and strafe), the flinch, the
knockdown, the sidestep, the archer's hop, binding a wound and eating, and the three death falls,
for the steerer's two bodies, the heavy build and the three wreck-scavengers.

    python3 assets/art/authoring/people48.py && node src/tools/art/proposed.ts
    python3 assets/art/authoring/combat25_review.py

Writes docs/art/rework-2.5/combat/sheets/<who>_combat25@1x.png and @4x.png (rows s, n, e, w and
the bloodied south row; frames across) and <who>_combat25.gif (south and east side by side at 3x).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import stage09_people as s9  # noqa: E402

s9.OUT = os.path.join(s9.REPO, 'docs', 'art', 'rework-2.5', 'combat', 'sheets')
NEW = ["windup_l", "windup_h", "windup_c", "parry_windup", "parry", "block_raise", "guard_break", "exhausted", "exhausted_walk", "dodge", "dodge_recover", "backoff", "strafe", "flinch", "knockdown", "sidestep", "hop", "bind", "eat_ration", "fall_fwd", "fall_back", "fall_crumple"]
s9.FIGHT = NEW
s9.SEQUENCE = ["idle", "windup_h", "parry_windup", "parry", "guard_break", "exhausted", "dodge", "dodge_recover", "hop", "fall_back", "dead"]
WHO = ['steerer_a', 'steerer_b', 'heavy', 'wrecker_ketill', 'wrecker_svart', 'wrecker_conn']


def main():
    os.makedirs(s9.OUT, exist_ok=True)
    s9.WHO[:] = WHO
    cache = {}
    import json
    from PIL import Image
    for who in WHO:
        with open(f'{s9.LAYERS}/{who}.layers.json') as f:
            layers = json.load(f)['layers']
        body = [n for n in layers['s'] if n.startswith('actor_')][0]
        if body not in cache:
            cache[body] = s9.load(body)
        anims = cache[body][0]['anims']
        states = [s for s in NEW if s in anims]
        cols = sum(anims[s]['frames'] for s in states)
        CW, CH = s9.CELL
        sheet = Image.new('RGBA', (cols * (CW + 2) + 2, 5 * (CH + 2) + 2), s9.GROUND + (255,))
        c = 0
        for st in states:
            for i in range(anims[st]['frames']):
                for r, fc in enumerate(s9.FACINGS):
                    sheet.paste(s9.composite(layers[fc], cache, st, fc, i), (2 + c * (CW + 2), 2 + r * (CH + 2)))
                sheet.paste(s9.composite(layers['s'], cache, st, 's', i, True), (2 + c * (CW + 2), 2 + 4 * (CH + 2)))
                c += 1
        sheet.save(f'{s9.OUT}/{who}_combat25@1x.png')
        sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(f'{s9.OUT}/{who}_combat25@4x.png')
        frames = []
        for st in s9.SEQUENCE:
            if st not in anims:
                continue
            n = anims[st]['frames']
            hold = 4 if n <= 2 else 2
            for i in range(n):
                for _ in range(hold):
                    fr = Image.new('RGBA', (CW * 2 + 3, CH + 2), s9.GROUND + (255,))
                    fr.paste(s9.composite(layers['s'], cache, st, 's', i), (1, 1))
                    fr.paste(s9.composite(layers['e'], cache, st, 'e', i), (CW + 2, 1))
                    frames.append(fr.resize((fr.width * 3, fr.height * 3), Image.NEAREST))
        s9.save_gif(frames, 120, f'{s9.OUT}/{who}_combat25.gif')
        print(f'{who}: {len(states)} new states, {cols} frames a facing')


if __name__ == '__main__':
    main()
