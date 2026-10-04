"""Visual regression for the performance pass: the same page, the same scroll
position, two builds. A performance change must not change what you see.

  python tests/perf/visual_diff.py --before http://localhost:3005 --after http://localhost:3004

For each page x viewport x scroll position (fractions of the page) it jumps to
the position, waits for entrance reveals to finish, freezes decorative loops and
videos (so grain jitter and video frames are not counted as changes), and diffs
the viewport pixel by pixel. Writes .tresor/perf/visual-diff.json, plus side-by-
side images for any frame that differs (git-ignored screenshots folder).
"""
import argparse, asyncio, io, json, os
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', '.tresor', 'perf')
SHOTS = os.path.join(HERE, '..', '..', '.tresor', 'test-results', 'screenshots', 'perf-visual')
PAGES = {'home': '/', 'story': '/about', 'product-cake': '/shop/salted-caramel', 'menu': '/shop', 'customize': '/customize', 'cart': '/cart'}
STOPS = [0, 0.04, 0.09, 0.15, 0.22, 0.3, 0.38, 0.46, 0.55, 0.64, 0.73, 0.82, 0.91, 1]
FREEZE = """
(() => {
  const s = document.createElement('style');
  s.textContent = '*, *::before, *::after { animation-play-state: paused !important; caret-color: transparent !important; } .film-grain, .love-grain, .scroll-cue i { visibility: hidden !important; }';
  document.head.appendChild(s);
  document.querySelectorAll('video').forEach((v) => { try { v.pause(); v.currentTime = 0; } catch (e) {} });
})();
"""

async def shoot(browser, base, path, width, stops, reduced):
    mobile = width <= 430
    ctx = await browser.new_context(viewport={'width': width, 'height': 844 if mobile else 900}, is_mobile=mobile, has_touch=mobile,
                                    device_scale_factor=1, reduced_motion='reduce' if reduced else 'no-preference')
    page = await ctx.new_page()
    await page.goto(base + path, wait_until='load', timeout=60000)
    await page.wait_for_timeout(3200)  # hero entrance choreography
    height = await page.evaluate('document.documentElement.scrollHeight - innerHeight')
    shots = []
    for f in stops:
        y = round(height * f)
        await page.evaluate(f'window.scrollTo(0, {y})')
        await page.wait_for_timeout(2600)  # reveals (≤1.4 s + delays) settle
        await page.evaluate(f'window.scrollTo(0, {y})')  # in case a late layout change moved it
        await page.wait_for_timeout(250)
        await page.evaluate(FREEZE)
        await page.wait_for_timeout(120)
        shots.append((f, y, await page.screenshot(), await page.evaluate('scrollY')))
        await page.evaluate("document.querySelectorAll('style').forEach((s) => { if (s.textContent.startsWith('*, *::before')) s.remove(); })")
    await ctx.close()
    return height, shots

def diff(a_png, b_png):
    a = np.asarray(Image.open(io.BytesIO(a_png)).convert('RGB')).astype(np.int16)
    b = np.asarray(Image.open(io.BytesIO(b_png)).convert('RGB')).astype(np.int16)
    if a.shape != b.shape: return 100.0, None
    d = np.abs(a - b).max(axis=2)
    changed = d > 24
    return round(100 * changed.mean(), 3), changed

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--before', default='http://localhost:3005'); ap.add_argument('--after', default='http://localhost:3004')
    ap.add_argument('--pages', default=','.join(PAGES)); ap.add_argument('--viewports', default='1440,390')
    ap.add_argument('--reduced-motion', action='store_true'); ap.add_argument('--label', default='visual-diff')
    a = ap.parse_args()
    os.makedirs(SHOTS, exist_ok=True)
    report = {'before': a.before, 'after': a.after, 'reducedMotion': a.reduced_motion, 'threshold': 'a pixel counts as changed if any channel differs by more than 24/255', 'frames': []}
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='chrome')
        for key in a.pages.split(','):
            stops = [0, 0.5, 1] if key in ('cart', 'menu', 'customize') else STOPS
            for w in [int(x) for x in a.viewports.split(',')]:
                hb, sb = await shoot(browser, a.before, PAGES[key], w, stops, a.reduced_motion)
                ha, sa = await shoot(browser, a.after, PAGES[key], w, stops, a.reduced_motion)
                for (f, y, pb, yb), (_, _, pa, ya) in zip(sb, sa):
                    pct, mask = diff(pb, pa)
                    row = {'page': key, 'width': w, 'stop': f, 'y': y, 'scrollYBefore': yb, 'scrollYAfter': ya, 'pageHeightBefore': hb, 'pageHeightAfter': ha, 'changedPct': pct}
                    if pct > 0.3:
                        name = f'{key}-{w}-{int(f * 100):03d}.png'
                        ib, ia = Image.open(io.BytesIO(pb)).convert('RGB'), Image.open(io.BytesIO(pa)).convert('RGB')
                        side = Image.new('RGB', (ib.width * 3, ib.height), 'white')
                        side.paste(ib, (0, 0)); side.paste(ia, (ib.width, 0))
                        if mask is not None:
                            heat = np.zeros((*mask.shape, 3), dtype=np.uint8); heat[mask] = (255, 0, 80)
                            side.paste(Image.fromarray(heat), (ib.width * 2, 0))
                        side.save(os.path.join(SHOTS, name)); row['image'] = name
                    report['frames'].append(row)
                    print(f"{key:13} {w:5} {f:4.2f} y={y:6} {pct:7.3f}%{'  <-- ' + row.get('image', '') if pct > 0.3 else ''}", flush=True)
        await browser.close()
    fr = report['frames']
    report['summary'] = {'frames': len(fr), 'identical': sum(1 for r in fr if r['changedPct'] == 0), 'under0.3pct': sum(1 for r in fr if r['changedPct'] <= 0.3),
                         'maxChangedPct': max((r['changedPct'] for r in fr), default=0)}
    json.dump(report, open(os.path.join(OUT, f'{a.label}.json'), 'w', encoding='utf-8'), indent=1)
    print(report['summary'])

if __name__ == '__main__':
    asyncio.run(main())
