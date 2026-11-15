import os
from PIL import Image, ImageDraw

def make_icon(path, size, maskable=False):
    """Draw app/icon.svg (an oak drawer of paper files with a brass handle) as a PNG. The shapes are the SVG's,
    on its 64-unit grid, drawn 8x large and scaled down so the edges are smooth. A maskable icon fills the square
    with oak and keeps the drawing inside the middle 80%, the part every phone's mask leaves showing."""
    big = size * 8
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    unit = big / 64

    def grad(box, top, bottom, radius):
        # a vertical gradient clipped to a rounded rectangle
        x0, y0, x1, y1 = [round(v) for v in box]
        layer = Image.new('RGBA', (big, big), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        for y in range(y0, y1):
            t = (y - y0) / max(1, y1 - y0 - 1)
            ld.line([(x0, y), (x1, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)) + (255,))
        mask = Image.new('L', (big, big), 0)
        ImageDraw.Draw(mask).rounded_rectangle(box, radius=radius, fill=255)
        img.paste(layer, (0, 0), mask)

    oak = ((0xb9, 0x82, 0x4a), (0x8f, 0x5c, 0x2f))
    if maskable:
        grad((0, 0, big, big), *oak, 0)
        scale, off = unit * 0.8, big * 0.1
    else:
        grad((0, 0, big, big), *oak, 14 * unit)
        scale, off = unit, 0
    P = lambda pts: [(off + x * scale, off + y * scale) for x, y in pts]
    R = lambda x, y, w, h: (off + x * scale, off + y * scale, off + (x + w) * scale, off + (y + h) * scale)
    line = max(1, round(0.6 * scale))

    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle(R(9, 16, 46, 26), radius=3 * scale, fill='#3f2512')       # the open drawer
    for pts, fill in (([(15, 21), (26, 21), (27.5, 17), (36.5, 17), (38, 21), (49, 21), (49, 42), (15, 42)], '#e7dbbf'),
                      ([(13, 25), (17, 25), (18.5, 21), (27.5, 21), (29, 25), (51, 25), (51, 42), (13, 42)], '#f1e7cf'),
                      ([(12, 29), (33, 29), (34.5, 25), (45.5, 25), (47, 29), (52, 29), (52, 42), (12, 42)], '#fbf5e6')):
        draw.polygon(P(pts), fill=fill, outline='#a88f62', width=line)             # three files, back to front
    draw.polygon(P([(34.5, 25), (45.5, 25), (47, 29), (33, 29)]), fill='#c9584f')  # the front file's red tab
    grad(R(6, 38, 52, 19), (0x9a, 0x64, 0x34), (0x6e, 0x42, 0x20), 4 * scale)     # the drawer front
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle(R(6, 38, 52, 2), radius=scale, fill='#b47f4c')  # the lip's highlight, already blended (drawing over RGBA replaces, it does not mix)
    grad(R(23, 45.5, 18, 5), (0xf0, 0xcf, 0x7a), (0xb9, 0x8a, 0x2e), 2.5 * scale)  # the brass handle
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle(R(23, 45.5, 18, 5), radius=2.5 * scale, outline='#7d5a17', width=line)

    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.resize((size, size), Image.LANCZOS).save(path)


make_icon('app/icons/icon-192.png', 192)
make_icon('app/icons/icon-512.png', 512)
make_icon('app/icons/icon-maskable-512.png', 512, maskable=True)
