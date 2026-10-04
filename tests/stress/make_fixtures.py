"""Synthetic upload fixtures for the stress test (no real people or photos).
Writes to tests/stress/fixtures/ (git-ignored)."""
import os, random
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), 'fixtures')
os.makedirs(OUT, exist_ok=True)

def scene(w, h, seed, mode='RGB'):
    r = random.Random(seed)
    im = Image.new(mode, (w, h), (169, 183, 182, 255) if mode == 'RGBA' else (169, 183, 182))
    d = ImageDraw.Draw(im)
    for _ in range(14):
        x, y = r.randrange(w), r.randrange(h)
        s = r.randrange(min(w, h) // 10, min(w, h) // 3)
        c = (r.randrange(120, 250), r.randrange(110, 230), r.randrange(100, 220))
        d.ellipse([x - s, y - s, x + s, y + s], fill=c + ((200,) if mode == 'RGBA' else ()))
    d.text((w // 20, h // 20), f'TEST {w}x{h}', fill=(32, 38, 37))
    return im

def noise(w, h, seed):
    r = random.Random(seed)
    return Image.frombytes('RGB', (w, h), bytes(r.getrandbits(8) for _ in range(w * h * 3)))

files = {
    'landscape.jpg': lambda p: scene(1600, 1200, 1).save(p, quality=90),
    'portrait.jpg': lambda p: scene(1200, 1800, 2).save(p, quality=90),
    'square.jpg': lambda p: scene(1400, 1400, 3).save(p, quality=90),
    'highres.jpg': lambda p: scene(6000, 4000, 4).save(p, quality=85),
    'transparent.png': lambda p: Image.new('RGBA', (1200, 1200), (0, 0, 0, 0)).save(p) if False else scene(1200, 1200, 5, 'RGBA').save(p),
    'webp.webp': lambda p: scene(1300, 1000, 6).save(p, 'WEBP', quality=85),
    'lowres-ok.jpg': lambda p: scene(700, 700, 7).save(p, quality=90),           # accepted, but prints soft when large
    'too-small.jpg': lambda p: scene(400, 300, 8).save(p, quality=90),           # rejected: < 600 px
    'oversized.jpg': lambda p: noise(2900, 2900, 9).save(p, quality=100),        # rejected: > 8 MB
    'wrong-type.gif': lambda p: scene(800, 800, 10).save(p, 'GIF'),             # rejected: type
}
for name, make in files.items():
    path = os.path.join(OUT, name)
    if not os.path.exists(path):
        make(path)
with open(os.path.join(OUT, 'not-an-image.jpg'), 'w') as f:
    f.write('this is a text file pretending to be a jpeg')
with open(os.path.join(OUT, 'corrupt.jpg'), 'wb') as f:
    good = open(os.path.join(OUT, 'square.jpg'), 'rb').read()
    f.write(good[:2000])                                                       # truncated JPEG
for n in sorted(os.listdir(OUT)):
    print(f'{n:22s} {os.path.getsize(os.path.join(OUT, n)) // 1024:>7} KB')
