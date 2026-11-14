"""A still mock of the proposed interface over the approved Wreck Strand mockup (Book 7 sections 10
and 14), for the user's approval:

    python3 assets/art/authoring/ui48.py && node src/tools/art/proposed.ts
    python3 assets/art/authoring/ui_mock.py

Writes docs/art/stage-06-rework/ui-mock.png (640 x 360) and ui-mock@4x.png. It composes the
compiled atlases in assets/art/proposed/atlases/ only; overlay text (the slot's name, refusal words)
is the game's native-resolution text layer and is not drawn here.
"""
import json
import os

from PIL import Image

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
ATLAS = os.path.join(REPO, 'assets', 'art', 'proposed', 'atlases')
OUT = os.path.join(REPO, 'docs', 'art', 'stage-06-rework')
BACKGROUND = os.path.join(REPO, 'docs', 'art', 'reference', 'wreck-strand-target.png')


def load(name):
    with open(os.path.join(ATLAS, f'{name}.json'), encoding='utf8') as f:
        m = json.load(f)
    img = Image.open(os.path.join(ATLAS, m['image'])).convert('RGBA')
    w, h = m['width'], m['height']
    frames = {k: img.crop((x, y, x + w, y + h)) for k, (x, y) in m['frames'].items()}
    return frames, (m['pivot']['x'], m['pivot']['y']), (w, h)


def main():
    scene = Image.open(BACKGROUND).convert('RGBA')
    hotbar, _, _ = load('ui_hotbar')
    icons, _, _ = load('ui_icons')
    digits, _, _ = load('ui_digits')
    cursor, cpiv, _ = load('ui_cursor')
    glyph, _, _ = load('ui_cursor_glyph')
    aim, apiv, _ = load('ui_aim')
    bar, _, _ = load('ui_stamina')
    reason, _, _ = load('ui_stamina_reason')
    fx, fpiv, _ = load('fx_people')

    def put(img, x, y):
        scene.alpha_composite(img, (int(x), int(y)))

    # Particles on the real ground: prints up the dry sand, ripples and a splash in the shallows.
    for i, (x, y) in enumerate([(230, 150), (238, 158), (246, 166), (254, 174)]):
        put(fx[f'print_dry_e/-/{i % 2}'], x - fpiv[0], y - fpiv[1])
    for i, (x, y) in enumerate([(300, 214), (310, 222), (320, 228)]):
        put(fx[f'print_wet_e/-/{i % 2}'], x - fpiv[0], y - fpiv[1])
    put(fx['ripple/-/3'], 380 - fpiv[0], 262 - fpiv[1])
    put(fx['ripple/-/5'], 380 - fpiv[0], 262 - fpiv[1])
    put(fx['splash/-/1'], 420 - fpiv[0], 282 - fpiv[1])
    put(fx['dust/-/1'], 160 - fpiv[0], 186 - fpiv[1])

    # The steerer stands at the mockup's figure (its feet at about 190,118), aiming the bow.
    feet = (190, 118)
    hand = (196, 104)
    put(aim['facing_e/-/0'], feet[0] + 14 - apiv[0], feet[1] - apiv[1])
    # The target tile within reach, and one beyond it.
    tile = (216, 120)      # top left of a 24 x 24 tile
    put(cursor['valid/-/0'], tile[0] - 2, tile[1] - 2)
    put(glyph['sword/-/0'], tile[0] + 18, tile[1] - 4)
    far = (360, 168)
    put(cursor['reach/-/0'], far[0] - 2, far[1] - 2)
    put(glyph['sword/-/0'], far[0] + 18, far[1] - 4)
    # The aim line: dots spaced wider as the draw grows, ending in the cross at the aim point.
    target = (300, 74)
    dx, dy = target[0] - hand[0], target[1] - hand[1]
    length = (dx * dx + dy * dy) ** 0.5
    step = 9.0
    t = step
    while t < length - 6:
        k = 0 if t < length * 0.3 else (1 if t < length * 0.7 else 2)
        put(aim[f'dot/-/{k}'], hand[0] + dx * t / length - apiv[0], hand[1] + dy * t / length - apiv[1])
        t += step + 2 * k
    put(aim['cross/-/0'], target[0] - apiv[0], target[1] - apiv[1])

    # The stamina bar, top left: full length 100, the maximum cut to 70 by cold (20) and hunger
    # (10), and 48 left.
    x0, y0 = 8, 8
    full, maximum, current = 100, 70, 48
    put(bar['cap_left/-/0'].crop((0, 0, 4, 9)), x0, y0)
    for x in range(maximum):
        put(bar['frame/-/0'].crop((0, 0, 1, 9)), x0 + 4 + x, y0)
    put(bar['cap_right/-/0'].crop((0, 0, 4, 9)), x0 + 4 + maximum, y0)
    for x in range(current - 2):
        put(bar['fill/-/0'].crop((0, 0, 1, 9)), x0 + 4 + x, y0)
    put(bar['fill_end/-/0'].crop((0, 0, 2, 9)), x0 + 4 + current - 2, y0)
    gx = x0 + 8 + maximum
    segments = [('cold', 20), ('hunger', 10)]
    for i, (name, n) in enumerate(segments):
        for x in range(n):
            put(bar['groove/-/0'].crop((0, 0, 1, 9)), gx + x, y0)
        put(reason[f'{name}/-/0'], gx + n // 2 - 4, y0 + 10)
        gx += n
        if i < len(segments) - 1:
            put(bar['groove_cut/-/0'].crop((0, 0, 3, 9)), gx, y0)
            gx += 3
    put(bar['groove_end/-/0'].crop((0, 0, 2, 9)), gx, y0)

    # The hotbar: 12 slots between carved end-posts on the bottom edge; slot 7, the bow, selected.
    items = ['axe', 'spade', 'sickle', 'seed_bag', 'pail', 'hammer', 'bow', 'spear',
             'fishing_line', 'seax', 'bread', 'rope']
    counts = {3: 12, 7: 3, 10: 4, 11: 1}
    selected = 6
    sx0 = (640 - 22 * 14) // 2
    sy0 = 360 - 30
    put(hotbar['cap_left/-/0'], sx0, sy0)
    for i, item in enumerate(items):
        x = sx0 + 22 * (i + 1)
        sel = i == selected
        put(hotbar[('slot_selected' if sel else 'slot') + '/-/0'], x, sy0)
        oy = sy0 + (0 if sel else 4)
        put(icons[f'{item}/-/0'], x + 3, oy + 5)
        put(digits[('key_selected' if sel else 'key') + f'/-/{i}'], x, oy + 3)
        if i in counts and counts[i] > 1:
            text = str(counts[i])
            for j, ch in enumerate(text):
                put(digits[f'count/-/{ch}'], x + 3 + 16 - 4 * (len(text) - j) - 1, oy + 5 + 16 - 6)
    put(hotbar['cap_right/-/0'], sx0 + 22 * 13, sy0)

    os.makedirs(OUT, exist_ok=True)
    scene.convert('RGB').save(os.path.join(OUT, 'ui-mock.png'))
    scene.convert('RGB').resize((640 * 4, 360 * 4), Image.NEAREST).save(os.path.join(OUT, 'ui-mock@4x.png'))
    print('docs/art/stage-06-rework/ui-mock.png')


if __name__ == '__main__':
    main()
