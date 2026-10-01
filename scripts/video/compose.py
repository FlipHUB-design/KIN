"""Builds the KIN walkthrough video from screenshots and a storyboard.

Usage: python3 compose.py storyboard.json out.mp4
Each screen scene shows a captioned panel on the left (who is using KIN and what's
happening) and the app screen in a phone frame on the right, with an optional
highlight box drawn around the part of the screen being talked about.
"""
import json, math, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1920, 1080, 30
FONTS = "/home/claude/kin/node_modules/@fontsource"
def font(w, size, fam="figtree"):
    name = f"{FONTS}/figtree/files/figtree-latin-{w}-normal.woff" if fam == "figtree" else f"{FONTS}/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-{w}-normal.woff"
    return ImageFont.truetype(name, size)

BG = (242, 244, 241); INK = (22, 32, 27); MUTED = (86, 99, 91); ACCENT = (43, 106, 85); SOFT = (220, 235, 227); WHITE = (255, 255, 255)
COL = {"plum": (104, 70, 137), "blue": (42, 88, 149), "amber": (134, 86, 0), "coral": (174, 59, 38), "accent": ACCENT, "ink": INK}

def ease(t): return 0.5 - 0.5 * math.cos(math.pi * max(0, min(1, t)))

def wrap(d, text, f, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f) <= width: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def rounded(im, r):
    m = Image.new("L", im.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1], r, fill=255)
    out = Image.new("RGBA", im.size); out.paste(im, (0, 0), m); return out

def background():
    bg = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(bg)
    d.ellipse([1150, -350, 2300, 800], fill=(226, 238, 231)); d.ellipse([-300, 700, 500, 1500], fill=(232, 236, 230))
    return bg.filter(ImageFilter.GaussianBlur(60))
BGIMG = background()

def logo(d, x, y, size=34, colour=ACCENT):
    d.text((x, y), "KIN", font=font(800, size), fill=colour)

def chip(d, x, y, name, role, colour):
    f1, f2 = font(700, 30), font(400, 26, "atk")
    c = COL.get(colour, ACCENT)
    d.ellipse([x, y, x + 64, y + 64], fill=c)
    d.text((x + 32, y + 32), name[0], font=font(800, 32), fill=WHITE, anchor="mm")
    d.text((x + 82, y + 2), name, font=f1, fill=INK)
    d.text((x + 82, y + 38), role, font=f2, fill=MUTED)

class Shot:
    def __init__(self, path, crop):
        im = Image.open(path).convert("RGB")
        if crop: im = im.crop(crop)
        self.crop = crop or (0, 0, im.size[0], im.size[1]); self.im = im

def phone(shot, scale):
    """Screen inside a rounded phone-like frame, returned with its placement scale."""
    w, h = shot.im.size
    sw, sh = int(w * scale), int(h * scale)
    screen = rounded(shot.im.resize((sw, sh), Image.LANCZOS), 34)
    pad = 14
    frame = Image.new("RGBA", (sw + pad * 2, sh + pad * 2), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame); fd.rounded_rectangle([0, 0, frame.size[0] - 1, frame.size[1] - 1], 46, fill=(28, 34, 31))
    frame.paste(screen, (pad, pad), screen)
    return frame, pad

def shadow(size, r=46, blur=30, alpha=70):
    s = Image.new("RGBA", (size[0] + 120, size[1] + 120), (0, 0, 0, 0))
    ImageDraw.Draw(s).rounded_rectangle([60, 70, 60 + size[0], 70 + size[1]], r, fill=(0, 0, 0, alpha))
    return s.filter(ImageFilter.GaussianBlur(blur))

def screen_frame(sc, t, cache):
    """t from 0 to 1 across the scene."""
    if "phone" not in cache:
        shot = Shot(sc["img"], sc.get("crop"))
        scale = min(960 / shot.im.size[1], 620 / shot.im.size[0])
        cache["phone"], cache["pad"] = phone(shot, scale); cache["scale"] = scale; cache["shot"] = shot
        cache["shadow"] = shadow(cache["phone"].size)
    im = BGIMG.copy(); d = ImageDraw.Draw(im)
    # left panel
    x0 = 130
    logo(d, x0, 90)
    if sc.get("step"): d.text((x0 + 100, 98), sc["step"], font=font(700, 24), fill=MUTED)
    y = 250
    if sc.get("persona"):
        p = sc["persona"]; chip(d, x0, y, p["name"], p["role"], p.get("colour", "accent")); y += 120
    a = ease(t * 4)
    f = font(800, 64); lines = wrap(d, sc["headline"], f, 820)
    for i, line in enumerate(lines):
        d.text((x0, y + i * 76 + int((1 - a) * 20)), line, font=f, fill=INK)
    y += len(lines) * 76 + 24
    f2 = font(400, 34, "atk")
    for i, line in enumerate(wrap(d, sc.get("sub", ""), f2, 800)):
        d.text((x0, y + i * 48), line, font=f2, fill=MUTED)
    # phone on the right, gentle drift in
    ph = cache["phone"]; px = 1820 - ph.size[0] - 40 + int((1 - ease(t * 3)) * 40); py = (H - ph.size[1]) // 2 + 10
    im.paste(cache["shadow"], (px - 60, py - 60), cache["shadow"])
    im.paste(ph, (px, py), ph)
    # highlight box
    if sc.get("highlight"):
        hx, hy, hw, hh = sc["highlight"]; cx0, cy0 = cache["shot"].crop[:2]; s = cache["scale"]; pad = cache["pad"]
        bx, by = px + pad + (hx - cx0) * s, py + pad + (hy - cy0) * s
        ha = ease((t - 0.25) * 5)
        if ha > 0:
            ov = Image.new("RGBA", im.size, (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
            grow = 10 + 4 * math.sin(t * 12)
            od.rounded_rectangle([bx - grow, by - grow, bx + hw * s + grow, by + hh * s + grow], 18, outline=(240, 160, 30, int(255 * ha)), width=6)
            im.paste(ov, (0, 0), ov)
            if sc.get("note"):
                nf = font(700, 28); tw = d.textlength(sc["note"], font=nf)
                nx = max(60, bx - tw - 70); ny = by + hh * s / 2 - 28
                ov2 = Image.new("RGBA", im.size, (0, 0, 0, 0)); o2 = ImageDraw.Draw(ov2)
                o2.rounded_rectangle([nx, ny, nx + tw + 40, ny + 56], 28, fill=(240, 160, 30, int(255 * ha)))
                o2.text((nx + 20, ny + 28), sc["note"], font=nf, fill=(40, 25, 0, int(255 * ha)), anchor="lm")
                im.paste(ov2, (0, 0), ov2)
    return im

def title_frame(sc, t, cache):
    im = Image.new("RGB", (W, H), ACCENT); d = ImageDraw.Draw(im)
    a = ease(t * 3)
    d.text((W // 2, 360 - int((1 - a) * 20)), "KIN", font=font(800, 150), fill=WHITE, anchor="mm")
    f = font(700, 60)
    for i, line in enumerate(wrap(d, sc["headline"], f, 1400)):
        d.text((W // 2, 540 + i * 74), line, font=f, fill=WHITE, anchor="mm")
    if sc.get("sub"):
        f2 = font(400, 36, "atk")
        for i, line in enumerate(wrap(d, sc["sub"], f2, 1300)):
            d.text((W // 2, 700 + i * 50), line, font=f2, fill=(205, 228, 216), anchor="mm")
    return im

def cast_frame(sc, t, cache):
    im = BGIMG.copy(); d = ImageDraw.Draw(im)
    logo(d, 130, 90)
    d.text((W // 2, 230), sc["headline"], font=font(800, 64), fill=INK, anchor="mm")
    if sc.get("sub"): d.text((W // 2, 310), sc["sub"], font=font(400, 34, "atk"), fill=MUTED, anchor="mm")
    people = sc["people"]; n = len(people); cw = 300; gx = (W - n * cw) // 2
    for i, p in enumerate(people):
        a = ease((t * n * 1.6) - i * 0.6)
        if a <= 0: continue
        cx = gx + i * cw + cw // 2; cy = 560 - int((1 - a) * 30)
        c = COL.get(p.get("colour", "accent"), ACCENT)
        d.ellipse([cx - 80, cy - 80, cx + 80, cy + 80], fill=c)
        d.text((cx, cy), p["name"][0], font=font(800, 72), fill=WHITE, anchor="mm")
        d.text((cx, cy + 125), p["name"], font=font(800, 36), fill=INK, anchor="mm")
        for j, line in enumerate(wrap(d, p["role"], font(400, 26, "atk"), cw - 30)):
            d.text((cx, cy + 172 + j * 34), line, font=font(400, 26, "atk"), fill=MUTED, anchor="mm")
    return im

def end_frame(sc, t, cache):
    im = Image.new("RGB", (W, H), ACCENT); d = ImageDraw.Draw(im)
    d.text((W // 2, 330), "KIN", font=font(800, 140), fill=WHITE, anchor="mm")
    d.text((W // 2, 500), sc["headline"], font=font(700, 56), fill=WHITE, anchor="mm")
    d.rounded_rectangle([W // 2 - 520, 590, W // 2 + 520, 690], 50, fill=WHITE)
    d.text((W // 2, 640), sc["url"], font=font(800, 46), fill=ACCENT, anchor="mm")
    if sc.get("sub"): d.text((W // 2, 780), sc["sub"], font=font(400, 34, "atk"), fill=(205, 228, 216), anchor="mm")
    return im

RENDER = {"screen": screen_frame, "title": title_frame, "cast": cast_frame, "end": end_frame}

def main(board, out):
    scenes = json.load(open(board))
    XF = int(0.45 * FPS)
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20", "-movflags", "+faststart", out], stdin=subprocess.PIPE)
    prev_last = None
    for sc in scenes:
        n = int(sc.get("dur", 5) * FPS); cache = {}
        r = RENDER[sc.get("type", "screen")]
        for i in range(n):
            frame = r(sc, i / max(1, n - 1), cache)
            if prev_last is not None and i < XF:
                frame = Image.blend(prev_last, frame, ease(i / XF))
            ff.stdin.write(frame.tobytes())
            last = frame
        prev_last = last
    ff.stdin.close(); ff.wait()

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
