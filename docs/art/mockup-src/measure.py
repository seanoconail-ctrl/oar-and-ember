"""Motion coverage: with the camera still, the share of the screen that visibly moves.

The frame is cut into 20 x 20 pixel cells (32 x 18 of them). A cell "changes" between two frames
if at least 2% of its pixels change colour by more than a just-visible amount (a sum of 24 across
R, G and B). Two figures are reported:
- any change: the cell changes at some point in the clip;
- continuous motion: the cell changes between at least a quarter of consecutive frame pairs, so a
  one-off change (a light switching from dawn to day, a caption appearing) does not count.
The map marks cells without continuous motion in red.
"""
import sys
import numpy as np
from PIL import Image, ImageSequence

CELL = 20
THRESH = 24
SHARE = 0.02


def frames_of(path):
    im = Image.open(path)
    return [np.asarray(f.convert('RGB'), np.int16) for f in ImageSequence.Iterator(im)]


def continuous(frames, share_pairs=0.25):
    stack = np.stack(frames)
    diff = np.abs(stack[1:] - stack[:-1]).sum(axis=3) > THRESH
    n, h, w = diff.shape
    gh, gw = h // CELL, w // CELL
    per = diff[:, :gh * CELL, :gw * CELL].reshape(n, gh, CELL, gw, CELL).mean(axis=(2, 4)) > SHARE
    cells = per.mean(axis=0) >= share_pairs
    return cells.mean(), cells


def coverage(frames):
    stack = np.stack(frames)
    ref = stack[0]
    changed = (np.abs(stack - ref).sum(axis=3) > THRESH).any(axis=0)
    h, w = changed.shape
    gh, gw = h // CELL, w // CELL
    cells = changed[:gh * CELL, :gw * CELL].reshape(gh, CELL, gw, CELL).mean(axis=(1, 3)) > SHARE
    return cells.mean(), cells, changed


def motion_map(frame, cells, path):
    img = frame.astype(np.float32).copy()
    gh, gw = cells.shape
    for j in range(gh):
        for i in range(gw):
            blk = img[j * CELL:(j + 1) * CELL, i * CELL:(i + 1) * CELL]
            if not cells[j, i]:
                blk[:] = blk * 0.3 + np.array([200, 40, 40]) * 0.7
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(path)


if __name__ == '__main__':
    frames = frames_of(sys.argv[1])
    share, cells, _ = coverage(frames)
    cont, ccells = continuous(frames)
    print(f'{sys.argv[1]}: {len(frames)} frames; any change {share * 100:.1f}%, '
          f'continuous motion {cont * 100:.1f}% of {cells.size} cells')
    if len(sys.argv) > 2:
        motion_map(frames[0], ccells, sys.argv[2])
