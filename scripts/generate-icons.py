#!/usr/bin/env python3
"""Generate every PolyCanvas icon asset from one vector definition.

Draws the same mark as /polycanvas-logo.svg with Pillow (no SVG rasteriser is
needed), then writes:

  packages/frontend/core/public/            favicon-{32,36,48,72,96,144,192}.png,
                                            apple-touch-icon.png, favicon.ico
  packages/frontend/apps/electron/resources/icons/
                                            icon.png, icon.ico, icon.icns and the
                                            per-channel icon_<ch>{.ico,.icns,.png,
                                            _64x64.png,_512x512.png} files

Run from the repo root:  python3 scripts/generate-icons.py
`.icns` needs macOS `iconutil`; it is skipped elsewhere.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'packages/frontend/core/public'
ELECTRON_ICONS = ROOT / 'packages/frontend/apps/electron/resources/icons'

# Geometry in the 120x120 design space of polycanvas-logo.svg
DESIGN = 120
GRAD_A = (0x4F, 0x46, 0xE5)
GRAD_B = (0x0E, 0xA5, 0xE9)



def render(size: int, supersample: int = 4) -> Image.Image:
    supersample = 2 if size >= 512 else supersample
    s = size * supersample
    k = s / DESIGN  # design units -> pixels

    # diagonal gradient tile: blend a vertical and a horizontal ramp
    ramp_v = Image.linear_gradient('L')
    ramp_h = ramp_v.transpose(Image.Transpose.ROTATE_90)
    diag = ImageChops.add(ramp_v, ramp_h, scale=2.0).resize((s, s), Image.BILINEAR)
    grad = ImageOps.colorize(diag, GRAD_A, GRAD_B)
    mask = Image.new('L', (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, s - 1, s - 1], radius=28 * k, fill=255
    )
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    img.paste(grad, (0, 0), mask)

    d = ImageDraw.Draw(img, 'RGBA')

    def rr(x, y, w, h, r, width, alpha):
        d.rounded_rectangle(
            [x * k, y * k, (x + w) * k, (y + h) * k],
            radius=r * k,
            outline=(255, 255, 255, alpha),
            width=max(1, round(width * k)),
        )

    # Tiny sizes: drop the back frame so the mark stays legible.
    if size >= 48:
        rr(22, 30, 60, 48, 8, 5, 140)
    rr(38, 42, 60, 48, 8, 6, 255)

    d.line(
        [(50 * k, 66 * k), (86 * k, 66 * k)],
        fill=(255, 255, 255, 255),
        width=max(1, round(5 * k)),
    )
    for cx in (50, 86):
        r = 7 * k
        d.ellipse(
            [cx * k - r, 66 * k - r, cx * k + r, 66 * k + r],
            fill=(255, 255, 255, 255),
        )

    return img.resize((size, size), Image.LANCZOS)


def write_png(path: Path, size: int):
    path.parent.mkdir(parents=True, exist_ok=True)
    render(size).save(path, 'PNG')
    print('wrote', path.relative_to(ROOT))


def write_ico(path: Path, sizes=(16, 24, 32, 48, 64, 128, 256)):
    imgs = [render(sz) for sz in sizes]
    imgs[0].save(
        path, 'ICO', sizes=[(sz, sz) for sz in sizes], append_images=imgs[1:]
    )
    print('wrote', path.relative_to(ROOT))


def write_icns(path: Path):
    if not shutil.which('iconutil'):
        print('skip', path.relative_to(ROOT), '(iconutil not available)')
        return
    with tempfile.TemporaryDirectory() as tmp:
        iconset = Path(tmp) / 'icon.iconset'
        iconset.mkdir()
        for base in (16, 32, 128, 256, 512):
            render(base).save(iconset / f'icon_{base}x{base}.png')
            render(base * 2).save(iconset / f'icon_{base}x{base}@2x.png')
        subprocess.run(
            ['iconutil', '-c', 'icns', str(iconset), '-o', str(path)],
            check=True,
        )
    print('wrote', path.relative_to(ROOT))


def main():
    # web
    for sz in (32, 36, 48, 72, 96, 144, 192):
        write_png(PUBLIC / f'favicon-{sz}.png', sz)
    write_png(PUBLIC / 'apple-touch-icon.png', 180)
    write_ico(PUBLIC / 'favicon.ico')

    # electron
    write_png(ELECTRON_ICONS / 'icon.png', 1024)
    write_ico(ELECTRON_ICONS / 'icon.ico')
    write_icns(ELECTRON_ICONS / 'icon.icns')
    write_png(ELECTRON_ICONS / 'icon_stable_64x64.png', 64)
    write_png(ELECTRON_ICONS / 'icon_stable_512x512.png', 512)
    for ch in ('canary', 'beta', 'internal'):
        write_png(ELECTRON_ICONS / f'icon_{ch}.png', 1024)
        write_png(ELECTRON_ICONS / f'icon_{ch}_64x64.png', 64)
        write_png(ELECTRON_ICONS / f'icon_{ch}_512x512.png', 512)
        write_ico(ELECTRON_ICONS / f'icon_{ch}.ico')
        write_icns(ELECTRON_ICONS / f'icon_{ch}.icns')


if __name__ == '__main__':
    sys.exit(main())
