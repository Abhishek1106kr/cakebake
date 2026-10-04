"""Interleaved before/after measurement: for every page x width, the baseline
build and the final build are measured back to back (alternating reps), so both
see the same machine conditions. Use this for the headline comparison; separate
runs on a shared machine can drift (an unrelated load spike made one isolated
run show 22 fps on a page that measured 60 fps an hour earlier).

  python tests/perf/paired.py --before http://localhost:3005 --after http://localhost:3004
Writes .tresor/perf/paired.json.
"""
import argparse, asyncio, json, os, time, types
from playwright.async_api import async_playwright
import profile as prof  # tests/perf/profile.py

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--before', default='http://localhost:3005'); ap.add_argument('--after', default='http://localhost:3004')
    ap.add_argument('--pages', default='home,story,product-cake,customize,menu'); ap.add_argument('--viewports', default='1440,1024,390')
    ap.add_argument('--reps', type=int, default=3); ap.add_argument('--label', default='paired')
    a = ap.parse_args()
    opts = types.SimpleNamespace(no_lenis=False, reduced_motion=False, interact=True, idle=False, desktop_throttle=2)
    out = {'before': a.before, 'after': a.after, 'measuredAt': time.strftime('%Y-%m-%dT%H:%M:%S'), 'reps': a.reps,
           'method': 'Alternating reps (before, after, before, after...) per page x width; median run by p95 frame time; same harness as profile.py.', 'results': {}}
    path = os.path.join(prof.OUT, f'{a.label}.json')
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='chrome', args=['--enable-gpu-rasterization', '--ignore-gpu-blocklist'])
        for key in a.pages.split(','):
            for w in [int(x) for x in a.viewports.split(',')]:
                runs = {'before': [], 'after': []}
                for _ in range(a.reps):
                    for side in ('before', 'after'):
                        try: runs[side].append(await prof.run_once(browser, getattr(a, side), key, w, opts))
                        except Exception as e: print('  failed', side, key, w, repr(e)[:120])
                row = {}
                for side in ('before', 'after'):
                    m = prof.median_run(runs[side])
                    if m:
                        m['repsP95'] = [r['frameMs']['p95'] for r in runs[side]]; m['repsScriptMs'] = [r['cdp']['scriptMs'] for r in runs[side]]
                        m['repsFps'] = [r['fps'] for r in runs[side]]
                    row[side] = m
                out['results'][f'{key}@{w}'] = row
                b, f = row['before'], row['after']
                if b and f:
                    print(f"{key:13} {w:5} fps {b['fps']}->{f['fps']}  p95 {b['frameMs']['p95']}->{f['frameMs']['p95']}  drop {b['droppedPct']}->{f['droppedPct']}%  "
                          f"script {b['cdp']['scriptMs']:.0f}->{f['cdp']['scriptMs']:.0f}  style {b['cdp']['styleMs']:.0f}->{f['cdp']['styleMs']:.0f}  "
                          f"commits {b['reactCommits']}->{f['reactCommits']}  loaf {b['loaf']['totalMs']}->{f['loaf']['totalMs']}  anims {b['maxRunningAnimations']}->{f['maxRunningAnimations']}", flush=True)
                json.dump(out, open(path, 'w', encoding='utf-8'), indent=1)
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
