"""Draws the KIN wordmark and app icons. Usage: python3 icons.py <out dir>"""
import sys, os
from PIL import Image, ImageDraw, ImageFont

FONT = "/home/claude/kin/node_modules/@fontsource/figtree/files/figtree-latin-800-normal.woff"
GREEN = (43, 106, 85); PLUM = (104, 70, 137); LILAC = (205, 184, 227); WHITE = (255, 255, 255)

def wordmark(size, ink, dot, scale=4):
    """Transparent image of 'kin' (dotless i plus a round dot), font size `size` px."""
    s = size * scale; f = ImageFont.truetype(FONT, s)
    k_w = f.getlength("k"); i_w = f.getlength("ı"); text_w = f.getlength("kın")
    asc, desc = f.getmetrics()
    d = int(s * 0.30)
    im = Image.new("RGBA", (int(text_w + s * 0.1), asc + desc + d), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    top_pad = d // 2
    dr.text((int(s * 0.05), top_pad), "kın", font=f, fill=ink)
    stem_top = f.getbbox("ı")[1] + top_pad
    cx = s * 0.05 + k_w + i_w / 2; gap = s * 0.07
    dr.ellipse([cx - d / 2, stem_top - gap - d, cx + d / 2, stem_top - gap], fill=dot)
    im = im.crop(im.getbbox())
    return im.resize((max(1, im.width // scale), max(1, im.height // scale)), Image.LANCZOS)

def icon(px, radius_frac=0.22, rounded=True):
    big = px * 4
    im = Image.new("RGBA", (big, big), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    if rounded: dr.rounded_rectangle([0, 0, big - 1, big - 1], int(big * radius_frac), fill=GREEN)
    else: dr.rectangle([0, 0, big, big], fill=GREEN)
    wm = wordmark(int(big * 0.42), WHITE, LILAC, scale=1)
    if wm.width > big * 0.76: wm = wm.resize((int(big * 0.76), int(wm.height * big * 0.76 / wm.width)), Image.LANCZOS)
    im.alpha_composite(wm, ((big - wm.width) // 2, (big - wm.height) // 2 + int(big * 0.01)))
    return im.resize((px, px), Image.LANCZOS)

if __name__ == "__main__":
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    icon(512).save(f"{out}/icon-512.png"); icon(192).save(f"{out}/icon-192.png")
    icon(180, rounded=False).convert("RGB").save(f"{out}/apple-icon.png")   # iOS rounds the corners itself
    icon(512, rounded=False).convert("RGB").save(f"{out}/icon-maskable-512.png")
    icon(64).save(f"{out}/icon.png")
    icon(48).save(f"{out}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    wordmark(240, GREEN, PLUM).save(f"{out}/wordmark.png")
    wordmark(240, WHITE, LILAC).save(f"{out}/wordmark-white.png")
    print("done")
