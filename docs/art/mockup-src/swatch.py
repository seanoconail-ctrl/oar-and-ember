"""Writes docs/art/palette-proposed.png: every proposed ramp as a row of swatches, shadow to light."""
import os
from PIL import Image, ImageDraw
from palette import RAMPS, hex_rgb

OUT = os.path.join(os.path.dirname(__file__), '..', 'palette-proposed.png')
S = 20
rows = list(RAMPS.items())
img = Image.new('RGB', (160 + 11 * S + 10, len(rows) * (S + 4) + 10), (34, 40, 52))
d = ImageDraw.Draw(img)
for j, (name, cols) in enumerate(rows):
    y = 6 + j * (S + 4)
    d.text((8, y + 5), name, fill=(220, 220, 210))
    for i, c in enumerate(cols):
        d.rectangle([160 + i * S, y, 160 + i * S + S - 2, y + S - 1], fill=hex_rgb(c))
img.save(OUT)
print(OUT)
