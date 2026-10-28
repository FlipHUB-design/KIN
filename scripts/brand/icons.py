"""Draws the Many Hands wordmark and app icons. Usage: python3 icons.py <out dir>"""
import sys, os
from PIL import Image, ImageDraw, ImageFont

FONT = "/home/claude/kin/node_modules/@fontsource/figtree/files/figtree-latin-800-normal.woff"
GREEN = (43, 106, 85); INK = (22, 32, 27); MINT = (123, 198, 167); WHITE = (255, 255, 255)

def text_img(parts, size, scale=4, tracking=-0.02):
    """Transparent image of coloured text runs [(text, colour), ...] at font size `size` px."""
    s = size * scale; f = ImageFont.truetype(FONT, s)
    widths = [f.getlength(t) + tracking * s * len(t) for t, _ in parts]
    asc, desc = f.getmetrics()
    im = Image.new("RGBA", (int(sum(widths) + s * 0.2), asc + desc + int(s * 0.2)), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    x = s * 0.1
    for (t, col), w in zip(parts, widths):
        for ch in t:
            dr.text((x, s * 0.1), ch, font=f, fill=col); x += f.getlength(ch) + tracking * s
    im = im.crop(im.getbbox())
    return im.resize((max(1, im.width // scale), max(1, im.height // scale)), Image.LANCZOS)

def wordmark(size, many, hands, scale=4):
    return text_img([("many", many), ("hands", hands)], size, scale)

def icon(px, radius_frac=0.22, rounded=True):
    big = px * 4
    im = Image.new("RGBA", (big, big), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    if rounded: dr.rounded_rectangle([0, 0, big - 1, big - 1], int(big * radius_frac), fill=GREEN)
    else: dr.rectangle([0, 0, big, big], fill=GREEN)
    mark = text_img([("mh", WHITE)], int(big * 0.46), scale=1, tracking=-0.04)
    if mark.width > big * 0.7: mark = mark.resize((int(big * 0.7), int(mark.height * big * 0.7 / mark.width)), Image.LANCZOS)
    im.alpha_composite(mark, ((big - mark.width) // 2, (big - mark.height) // 2))
    return im.resize((px, px), Image.LANCZOS)

if __name__ == "__main__":
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    icon(512).save(f"{out}/icon-512.png"); icon(192).save(f"{out}/icon-192.png")
    icon(180, rounded=False).convert("RGB").save(f"{out}/apple-icon.png")   # iOS rounds the corners itself
    icon(512, rounded=False).convert("RGB").save(f"{out}/icon-maskable-512.png")
    icon(64).save(f"{out}/icon.png")
    icon(48).save(f"{out}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    wordmark(240, GREEN, INK).save(f"{out}/wordmark.png")
    wordmark(240, MINT, WHITE).save(f"{out}/wordmark-white.png")
    print("done")
