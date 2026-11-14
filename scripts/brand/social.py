"""Social images: Instagram profile picture and the waiting list link preview. Usage: python3 social.py <out dir>"""
import sys, os
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(__file__))
from icons import text_img, GREEN, INK, MINT, WHITE

F800 = "/home/claude/kin/node_modules/@fontsource/figtree/files/figtree-latin-800-normal.woff"
PALE = (220, 235, 227); BG = (242, 244, 241); MUTED = (86, 99, 91)

def profile(px=1080):
    """Square green tile; Instagram crops it to a circle, so the mark sits well inside."""
    im = Image.new("RGB", (px, px), GREEN)
    mark = text_img([("mh", WHITE)], int(px * 0.42), tracking=-0.04)
    im.paste(mark, ((px - mark.width) // 2, (px - mark.height) // 2 + int(px * 0.01)), mark)
    return im

def og():
    w, h = 1200, 630
    im = Image.new("RGB", (w, h), BG); dr = ImageDraw.Draw(im)
    dr.rectangle([0, 0, 22, h], fill=GREEN)
    logo = text_img([("many", GREEN), ("hands", INK)], 84)
    im.paste(logo, (90, 80), logo)
    f1 = ImageFont.truetype(F800, 64); f2 = ImageFont.truetype(F800, 34)
    dr.text((90, 230), "Many hands make", font=f1, fill=INK)
    dr.text((90, 305), "light work.", font=f1, fill=INK)
    dr.text((90, 410), "Keeping families connected. Making care simple.", font=f2, fill=GREEN)
    pill = "Join the waiting list"; pw = dr.textlength(pill, font=f2) + 70
    dr.rounded_rectangle([90, 490, 90 + pw, 560], 35, fill=GREEN)
    dr.text((125, 503), pill, font=f2, fill=WHITE)
    return im

if __name__ == "__main__":
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    profile().save(f"{out}/manyhands-instagram-profile.png")
    og().save(f"{out}/og-waitlist.png")
    print("done")
