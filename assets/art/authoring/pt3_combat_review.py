"""Renders the user's third playtest's new fighting states for review (Book 3: new frames start as
sheets at 1x and 4x and a short GIF; decisions DG-2 to DG-10): the reel, a guard turned, the let-go
gesture, Ketill's red blow and its overbalanced miss, and a finisher per weapon standing and lying
(the seax, the hand axe, the spear, the sword, the Dane axe and the club), for the steerer's two
bodies, the heavy build (Bran's and Ketill's) and the three wreck-scavengers; and the red glint.

    python3 assets/art/authoring/people48.py && node src/tools/art/proposed.ts
    python3 assets/art/authoring/pt3_combat_review.py

Writes docs/art/playtest-3/combat/sheets/<who>_pt3@1x.png and @4x.png (rows s, n, e, w and the
bloodied south row; frames across) and <who>_pt3.gif (south and east side by side at 3x), and
red_glint@1x.png / @4x.png.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import stage09_people as s9  # noqa: E402

s9.OUT = os.path.join(s9.REPO, 'docs', 'art', 'playtest-3', 'combat', 'sheets')
KINDS = ['seax', 'axe', 'spear', 'sword', 'dane', 'club']
NEW = ['reel', 'guard_turn', 'spare', 'red', 'red_miss'] + [f'fin_{k}_{v}' for k in KINDS for v in 'sl']
s9.FIGHT = NEW
SEQUENCE = {
    'steerer_a': ['idle', 'fin_seax_s', 'idle', 'spare', 'idle', 'fin_axe_l', 'idle'],
    'steerer_b': ['idle', 'fin_spear_s', 'idle', 'fin_sword_l', 'idle', 'spare', 'idle'],
    'heavy': ['idle', 'fin_dane_s', 'idle', 'fin_club_l', 'idle'],
    'bran': ['idle', 'fin_axe_s', 'idle', 'guard_turn', 'idle'],
    'wrecker_ketill': ['idle', 'red', 'red_miss', 'idle', 'guard_turn', 'reel', 'reel'],
    'wrecker_svart': ['idle', 'guard_turn', 'idle', 'reel', 'reel'],
    'wrecker_conn': ['idle', 'reel', 'reel', 'idle'],
}
WHO = list(SEQUENCE)


def red_glint():
    from PIL import Image
    path = os.path.join(s9.REPO, 'assets', 'art', 'sheets', 'fx_red_glint.txt')
    with open(path, encoding='utf8') as f:
        text = f.read()
    pal = {e['code']: e['hex'] for e in json.load(open(os.path.join(s9.REPO, 'assets', 'palette', 'book07.json')))['entries']}
    frames, cur = [], None
    for line in text.splitlines():
        if line.startswith('frame '):
            cur = []
        elif line == 'end' and cur is not None:
            frames.append(cur)
            cur = None
        elif cur is not None:
            cur.append(line)
    img = Image.new('RGBA', (len(frames) * 18 + 2, 18), s9.GROUND + (255,))
    for k, rows in enumerate(frames):
        for y, r in enumerate(rows):
            for x, ch in enumerate(r):
                if ch in pal and ch != '.':
                    h = pal[ch].lstrip('#')
                    img.putpixel((2 + k * 18 + x, 1 + y), tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,))
    img.save(f'{s9.OUT}/red_glint@1x.png')
    img.resize((img.width * 4, img.height * 4), Image.NEAREST).save(f'{s9.OUT}/red_glint@4x.png')


def main():
    os.makedirs(s9.OUT, exist_ok=True)
    s9.WHO[:] = WHO
    cache = {}
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
        sheet.save(f'{s9.OUT}/{who}_pt3@1x.png')
        sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(f'{s9.OUT}/{who}_pt3@4x.png')
        frames = []
        for st in SEQUENCE[who]:
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
        s9.save_gif(frames, 120, f'{s9.OUT}/{who}_pt3.gif')
        print(f'{who}: {len(states)} new states, {cols} frames a facing')
    red_glint()


if __name__ == '__main__':
    main()
