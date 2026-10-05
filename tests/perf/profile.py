"""Rendering profiler for the performance pass. Measures, never estimates.

  python tests/perf/profile.py --label A --base http://localhost:3004
  python tests/perf/profile.py --label B --no-lenis          # same build, Lenis switched off
  python tests/perf/profile.py --label A --pages home,story --viewports 1440,390 --reps 3

For each page x viewport it loads a production build in Chrome, then drives a
real scroll gesture (CDP Input.synthesizeScrollGesture: wheel ticks on desktop,
default (touch-emulated) gestures on phones) and records, for that scroll window only:
  - every requestAnimationFrame timestamp -> frame intervals, dropped frames
  - Long Animation Frames (with script attribution) and long tasks
  - React commits (a minimal DevTools hook counts onCommitFiberRoot)
  - CDP Performance metrics: script / layout / style time and counts, heap
  - running animations, playing videos, image over-decode, layout shifts
One extra traced pass per page x viewport sums main/raster thread work
(paint, raster, layerize, layout, style, script, image decode).
Phones get 4x CPU throttling and DPR 3; desktop 2x (a mid-range laptop; this
machine is a fast 8-core) and DPR 1.
Writes .tresor/perf/<label>.json.
"""
import argparse, asyncio, json, os, statistics, time
from playwright.async_api import async_playwright

# Demo deployment: skip the one-time warning and sign in to the mock admin before every page
# (the warning and the sign-in have their own tests in tests/demo/demo_e2e.py).
DEMO_INIT = "try{localStorage.setItem('tresor-demo-warning-seen','1');localStorage.setItem('tresor-demo-admin-auth',JSON.stringify({v:1,email:'test@omni.com',signedInAt:new Date().toISOString()}))}catch(e){}"


HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', '.tresor', 'perf')
PAGES = {
    'home': '/', 'menu': '/shop', 'product-cake': '/shop/salted-caramel', 'product': '/shop/almond-croissant',
    'story': '/about', 'customize': '/customize', 'cart': '/cart', 'checkout': '/checkout', 'admin': '/admin',
}
SCROLL_CAP = 12000
TRACE_CATS = 'devtools.timeline,disabled-by-default-devtools.timeline,blink,cc,gpu,disabled-by-default-devtools.timeline.frame'
TRACE_BUCKETS = {
    'script': {'FunctionCall', 'EvaluateScript', 'TimerFire', 'FireAnimationFrame', 'EventDispatch', 'V8.Execute', 'RunMicrotasks'},
    'style': {'UpdateLayoutTree', 'RecalculateStyles'},
    'layout': {'Layout'},
    'layerize': {'Layerize', 'UpdateLayerTree', 'PrePaint'},
    'paint': {'Paint', 'PaintImage'},
    'raster': {'RasterTask'},
    'decode': {'ImageDecodeTask', 'Decode Image', 'Decode LazyPixelRef'},
}

INIT = r"""
(() => {
  const s = window.__perf = { frames: [], rec: false, commits: 0, commitsAll: 0, loaf: [], longTasks: [], cls: 0, events: [], maxAnims: 0 };
  // Count React commits without React DevTools.
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true, isDisabled: false, renderers: new Map(), checkDCE() {},
    inject(r) { const id = this.renderers.size + 1; this.renderers.set(id, r); return id; },
    onCommitFiberRoot() { s.commitsAll += 1; if (s.rec) s.commits += 1; },
    onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, onScheduleFiberRoot() {},
  };
  let n = 0;
  const tick = (t) => {
    if (s.rec) { s.frames.push(t); if ((n += 1) % 40 === 0) s.maxAnims = Math.max(s.maxAnims, document.getAnimations().filter((a) => a.playState === 'running').length); }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const obs = (type, fn, extra) => { try { new PerformanceObserver((l) => l.getEntries().forEach(fn)).observe({ type, buffered: true, ...(extra || {}) }); } catch (e) {} };
  obs('long-animation-frame', (e) => { if (s.rec) s.loaf.push({ d: e.duration, b: e.blockingDuration, render: e.renderStart ? e.startTime + e.duration - e.renderStart : 0,
    scripts: (e.scripts || []).map((x) => ({ d: x.duration, src: (x.sourceURL || '').split('/').pop(), fn: x.sourceFunctionName, inv: x.invoker, type: x.invokerType })) }); });
  obs('longtask', (e) => { if (s.rec) s.longTasks.push(e.duration); });
  obs('layout-shift', (e) => { if (s.rec && !e.hadRecentInput) s.cls += e.value; });
  obs('event', (e) => { if (s.rec) s.events.push({ name: e.name, d: e.duration, target: e.target && (e.target.getAttribute('aria-label') || e.target.textContent || '').trim().slice(0, 30) }); }, { durationThreshold: 16 });
})();
"""
NO_LENIS = r"""
(() => { const mm = window.matchMedia.bind(window);
  window.matchMedia = (q) => q.replace(/\s/g, '') === '(pointer:coarse)' ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent() { return false; } } : mm(q);
})();
"""

def pct(xs, p):
    if not xs: return None
    xs = sorted(xs); k = (len(xs) - 1) * p; f = int(k); c = min(f + 1, len(xs) - 1)
    return round(xs[f] + (xs[c] - xs[f]) * (k - f), 2)

def frame_stats(ts):
    iv = [b - a for a, b in zip(ts, ts[1:])]
    if not iv: return {}
    dur = (ts[-1] - ts[0]) / 1000
    budget = statistics.median(iv)  # the display's frame interval as observed (≈16.7 ms at 60 Hz)
    return {
        'frames': len(ts), 'seconds': round(dur, 2), 'fps': round(len(iv) / dur, 1) if dur else None,
        'frameMs': {'p50': pct(iv, .5), 'p95': pct(iv, .95), 'p99': pct(iv, .99), 'max': round(max(iv), 1)},
        'stdevMs': round(statistics.pstdev(iv), 2),
        # A frame "drops" when an interval exceeds 1.5 x the median vsync interval.
        'droppedPct': round(100 * sum(1 for x in iv if x > budget * 1.5) / len(iv), 2),
        'droppedFrames': int(sum(max(0, round(x / budget) - 1) for x in iv if x > budget * 1.5)),
        'over50ms': sum(1 for x in iv if x > 50),
    }

async def seed_cart(page, base):
    await page.goto(base + '/shop/almond-croissant', wait_until='load')
    await page.wait_for_timeout(800)
    await page.locator('.full-btn').first.click()
    await page.wait_for_url('**/cart', timeout=10000)

async def run_once(browser, base, key, width, args, trace=False):
    mobile = width <= 430
    vp = {'width': width, 'height': 844 if mobile else (900 if width >= 1280 else 768)}
    ctx = await browser.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, device_scale_factor=3 if mobile else 1,
                                    reduced_motion='reduce' if args.reduced_motion else 'no-preference')
    await ctx.add_init_script(DEMO_INIT)
    await ctx.add_init_script(INIT)
    if args.no_lenis: await ctx.add_init_script(NO_LENIS)
    page = await ctx.new_page()
    cdp = await ctx.new_cdp_session(page)
    if key in ('cart', 'checkout'): await seed_cart(page, base)
    await page.goto(base + PAGES[key], wait_until='load', timeout=60000)
    await page.wait_for_timeout(2500)
    await cdp.send('Performance.enable')
    await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4 if mobile else args.desktop_throttle})
    await cdp.send('HeapProfiler.collectGarbage')
    before = {m['name']: m['value'] for m in (await cdp.send('Performance.getMetrics'))['metrics']}
    height = await page.evaluate('document.documentElement.scrollHeight - innerHeight')
    dist = min(height, SCROLL_CAP)
    lenis_on = await page.evaluate("document.documentElement.classList.contains('lenis')")
    if trace: await browser.start_tracing(page=page, categories=TRACE_CATS.split(','))
    await page.evaluate('window.__perf.rec = true')
    t0 = time.time()
    if args.idle:
        # Idle: nobody touches the page for 4 s (after a short scroll into the middle,
        # so mid-page scenes are on screen). Measures what runs when nothing should.
        await page.evaluate('window.__perf.rec = false')
        await page.evaluate(f'window.scrollTo(0, {min(dist, 2400)})'); await page.wait_for_timeout(1500)
        await cdp.send('HeapProfiler.collectGarbage')
        before = {m['name']: m['value'] for m in (await cdp.send('Performance.getMetrics'))['metrics']}
        await page.evaluate('window.__perf.frames = []; window.__perf.rec = true')
        await page.wait_for_timeout(4000)
    elif dist > 50:
        await cdp.send('Input.synthesizeScrollGesture', {
            'x': vp['width'] // 2, 'y': vp['height'] // 2, 'yDistance': -dist, 'speed': 1400 if not mobile else 1800,
            'gestureSourceType': 'default' if mobile else 'mouse', 'preventFling': True, 'repeatDelayMs': 0})
    else:
        await page.wait_for_timeout(3000)  # short page: measure idle frames
    if not args.idle: await page.wait_for_timeout(1200)  # let inertia / Lenis settle
    interactions = None
    if key == 'customize' and args.interact and not args.idle:
        await page.evaluate('window.scrollTo(0, 0)'); await page.wait_for_timeout(600)
        radios = page.locator('.studio-panel button[role=radio]:not([aria-checked=true]):not([disabled])')
        cnt = await radios.count()
        for i in range(min(8, cnt)):
            try: await radios.nth((i * 3) % max(1, await radios.count())).click(timeout=2000)
            except Exception: pass
            await page.wait_for_timeout(250)
    scrolled = await page.evaluate('scrollY')
    await page.evaluate('window.__perf.rec = false')
    wall = time.time() - t0
    trace_out = None
    if trace:
        raw = await browser.stop_tracing()
        trace_out = summarize_trace(json.loads(raw))
    after = {m['name']: m['value'] for m in (await cdp.send('Performance.getMetrics'))['metrics']}
    s = await page.evaluate("""() => {
      const p = window.__perf, dpr = devicePixelRatio;
      const imgs = [...document.images].filter((i) => i.complete && i.naturalWidth && i.getBoundingClientRect().width);
      const over = imgs.map((i) => { const r = i.getBoundingClientRect(); return (i.naturalWidth * i.naturalHeight) / Math.max(1, (r.width * dpr) * (r.height * dpr)); });
      const res = performance.getEntriesByType('resource');
      const kb = (f) => Math.round(res.filter(f).reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), 0) / 1024);
      const vids = [...document.querySelectorAll('video')];
      return { frames: p.frames, commits: p.commits, loaf: p.loaf, longTasks: p.longTasks, cls: p.cls, events: p.events, maxAnims: p.maxAnims,
        anims: document.getAnimations().filter((a) => a.playState === 'running').length,
        videos: { total: vids.length, playing: vids.filter((v) => !v.paused).length, preload: vids.map((v) => v.preload),
          decoded: vids.reduce((a, v) => a + ((v.getVideoPlaybackQuality && v.getVideoPlaybackQuality().totalVideoFrames) || 0), 0) },
        images: { count: imgs.length, overDecodeMedian: over.length ? over.sort((a, b) => a - b)[over.length >> 1] : null, over4x: over.filter((x) => x > 4).length,
          imageKB: kb((r) => r.initiatorType === 'img' || /\\.(avif|webp|jpe?g|png)/.test(r.name)), videoKB: kb((r) => /\\.(mp4|webm)/.test(r.name)), totalKB: kb(() => true) },
        domNodes: document.getElementsByTagName('*').length };
    }""")
    await ctx.close()
    ms = lambda k: round((after.get(k, 0) - before.get(k, 0)) * 1000, 1)
    loaf = s['loaf']
    scripts = {}
    for f in loaf:
        for sc in f['scripts']:
            k = f"{sc['type']}:{sc['inv']}"[:90]
            scripts[k] = scripts.get(k, 0) + sc['d']
    return {
        'scrollPx': dist, 'scrolledTo': scrolled, 'wallS': round(wall, 2), 'lenis': lenis_on, **frame_stats(s['frames']),
        'reactCommits': s['commits'], 'commitsPerSecond': round(s['commits'] / max(0.1, wall), 1),
        'loaf': {'count': len(loaf), 'totalMs': round(sum(f['d'] for f in loaf)), 'blockingMs': round(sum(f['b'] for f in loaf)), 'renderMs': round(sum(f['render'] for f in loaf)),
                 'topScripts': sorted(([k, round(v)] for k, v in scripts.items()), key=lambda x: -x[1])[:6]},
        'longTasks': {'count': len(s['longTasks']), 'totalMs': round(sum(s['longTasks']))},
        'cdp': {'scriptMs': ms('ScriptDuration'), 'layoutMs': ms('LayoutDuration'), 'styleMs': ms('RecalcStyleDuration'), 'taskMs': ms('TaskDuration'),
                'layouts': int(after.get('LayoutCount', 0) - before.get('LayoutCount', 0)), 'styleRecalcs': int(after.get('RecalcStyleCount', 0) - before.get('RecalcStyleCount', 0)),
                'heapMB': round(after.get('JSHeapUsedSize', 0) / 1048576, 1), 'heapGrowthMB': round((after.get('JSHeapUsedSize', 0) - before.get('JSHeapUsedSize', 0)) / 1048576, 2)},
        'cls': round(s['cls'], 4), 'runningAnimations': s['anims'], 'maxRunningAnimations': s['maxAnims'], 'videos': s['videos'], 'images': s['images'], 'domNodes': s['domNodes'],
        'slowEvents': sorted(s['events'], key=lambda e: -e['d'])[:5],
        'trace': trace_out,
    }

def summarize_trace(t):
    ev = t['traceEvents'] if isinstance(t, dict) else t
    out = {k: 0.0 for k in TRACE_BUCKETS}
    for e in ev:
        if e.get('ph') != 'X' or 'dur' not in e: continue
        for k, names in TRACE_BUCKETS.items():
            if e['name'] in names: out[k] += e['dur'] / 1000
    return {k: round(v, 1) for k, v in out.items()}

def median_run(runs):
    """Pick the median run by p95 frame time, so every number in it comes from one real run."""
    runs = [r for r in runs if r.get('frames')]
    if not runs: return None
    runs.sort(key=lambda r: (r['frameMs']['p95'], r['droppedPct']))
    return runs[len(runs) // 2]

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--label', required=True); ap.add_argument('--base', default='http://localhost:3004')
    ap.add_argument('--pages', default=','.join(PAGES)); ap.add_argument('--viewports', default='1440,1280,1024,430,390')
    ap.add_argument('--reps', type=int, default=2); ap.add_argument('--no-lenis', action='store_true'); ap.add_argument('--no-trace', action='store_true')
    ap.add_argument('--reduced-motion', action='store_true'); ap.add_argument('--interact', action='store_true', default=True)
    ap.add_argument('--headed', action='store_true'); ap.add_argument('--desktop-throttle', type=float, default=2); ap.add_argument('--idle', action='store_true')
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    out_path = os.path.join(OUT, f'{args.label}.json')
    result = json.load(open(out_path, encoding='utf-8')) if os.path.exists(out_path) else {}
    result.update({'label': args.label, 'base': args.base, 'measuredAt': time.strftime('%Y-%m-%dT%H:%M:%S'), 'lenisForcedOff': args.no_lenis, 'idle': args.idle,
                   'reducedMotion': args.reduced_motion, 'reps': args.reps,
                   'method': 'Chrome (headless) via Playwright + CDP; synthesized scroll gesture; phones 4x CPU throttle, DPR 3; desktop 2x throttle, DPR 1; median run of reps by p95 frame time; one extra traced run for thread breakdown.'})
    result.setdefault('results', {})
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='chrome', headless=not args.headed, args=['--enable-gpu-rasterization', '--ignore-gpu-blocklist'])
        for key in args.pages.split(','):
            for w in [int(x) for x in args.viewports.split(',')]:
                runs = []
                for i in range(args.reps):
                    try: runs.append(await run_once(browser, args.base, key, w, args))
                    except Exception as e: print('  run failed', key, w, repr(e)[:160])
                m = median_run(runs)
                if m and not args.no_trace:
                    try: m['trace'] = (await run_once(browser, args.base, key, w, args, trace=True))['trace']
                    except Exception as e: print('  trace failed', key, w, repr(e)[:160])
                if m:
                    m['repsP95'] = [r['frameMs']['p95'] for r in runs]; m['repsDropped'] = [r['droppedPct'] for r in runs]
                result['results'][f'{key}@{w}'] = m
                if m:
                    print(f"{args.label} {key:13} {w:5} lenis={str(m['lenis'])[0]} fps={m['fps']} p95={m['frameMs']['p95']} drop={m['droppedPct']}% commits={m['reactCommits']} "
                          f"loaf={m['loaf']['totalMs']}ms script={m['cdp']['scriptMs']} layout={m['cdp']['layoutMs']} style={m['cdp']['styleMs']} anims={m['maxRunningAnimations']} "
                          f"trace={m.get('trace')}", flush=True)
                json.dump(result, open(out_path, 'w', encoding='utf-8'), indent=1)
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
