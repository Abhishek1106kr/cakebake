"""Measures real performance numbers against a running build (no invented values).
  python tests/stress/perf.py --base http://localhost:3004
Writes .tresor/test-results/performance.json."""
import argparse, asyncio, json, os, time
from playwright.async_api import async_playwright

# Demo deployment: skip the one-time warning and sign in to the mock admin before every page
# (the warning and the sign-in have their own tests in tests/demo/demo_e2e.py).
DEMO_INIT = "try{localStorage.setItem('tresor-demo-warning-seen','1');localStorage.setItem('tresor-demo-admin-auth',JSON.stringify({v:1,email:'test@omni.com',signedInAt:new Date().toISOString()}))}catch(e){}"


HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', '.tresor', 'test-results')
FIX = os.path.join(HERE, 'fixtures')
ROUTES = ['/', '/shop', '/shop/almond-croissant', '/customize', '/cart', '/checkout', '/about', '/admin', '/admin/custom-cakes']
OBSERVERS = """
window.__perf = { lcp: 0, cls: 0, longTasks: 0, longTaskMs: 0 };
try {
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__perf.longTasks += 1; window.__perf.longTaskMs += e.duration; } }).observe({ type: 'longtask', buffered: true });
} catch (e) {}
"""

async def page_metrics(page):
    return await page.evaluate("""() => {
      const n = performance.getEntriesByType('navigation')[0];
      const res = performance.getEntriesByType('resource');
      return {
        ttfbMs: Math.round(n.responseStart), domContentLoadedMs: Math.round(n.domContentLoadedEventEnd), loadMs: Math.round(n.loadEventEnd),
        lcpMs: Math.round(window.__perf.lcp), cls: Math.round(window.__perf.cls * 1000) / 1000,
        longTasks: window.__perf.longTasks, longTaskMs: Math.round(window.__perf.longTaskMs),
        requests: res.length, transferKB: Math.round(res.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024),
        jsHeapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576 * 10) / 10 : null,
      };
    }""")

async def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--base', default='http://localhost:3004'); args = ap.parse_args()
    out = {'base': args.base, 'measuredAt': time.strftime('%Y-%m-%dT%H:%M:%S'), 'note': 'Headless Chromium on the developer machine against a production build. Numbers are real but machine-dependent; no network throttling.', 'pages': {}, 'interactions': {}}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for label, vp in (('desktop', {'width': 1440, 'height': 900}), ('mobile', {'width': 390, 'height': 844})):
            for route in ROUTES:
                ctx = await b.new_context(viewport=vp, is_mobile=label == 'mobile', has_touch=label == 'mobile')
                await ctx.add_init_script(DEMO_INIT)
                await ctx.add_init_script(OBSERVERS)
                page = await ctx.new_page()
                await page.goto(args.base + route, wait_until='load')
                await page.wait_for_timeout(2500)
                out['pages'].setdefault(route, {})[label] = await page_metrics(page)
                await ctx.close()
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900})
        await ctx.add_init_script(DEMO_INIT)
        await ctx.add_init_script(OBSERVERS)
        page = await ctx.new_page()
        cdp = await ctx.new_cdp_session(page)
        # Client-side route transition: home → menu via the header link.
        await page.goto(args.base + '/', wait_until='load'); await page.wait_for_timeout(1500)
        t = await page.evaluate("""() => new Promise((res) => { const t0 = performance.now(); document.querySelector('a[href="/shop"]').click();
          const check = () => document.querySelector('.menu-hero') ? res(Math.round(performance.now() - t0)) : requestAnimationFrame(check); check(); })""")
        out['interactions']['routeTransitionHomeToMenuMs'] = t
        # Customizer: click → price text updated (median of 15).
        await page.goto(args.base + '/customize', wait_until='load'); await page.wait_for_selector('.studio-stage'); await page.wait_for_timeout(1200)
        samples = []
        for i in range(15):
            ms = await page.evaluate("""(i) => new Promise((res) => {
              const tiles = [...document.querySelectorAll('#opt-sponge button[role=radio]:not([disabled])')];
              const target = tiles[i % tiles.length]; const before = document.querySelector('.cake-preview').innerHTML.length;
              const t0 = performance.now(); target.click();
              const check = () => (document.querySelector('.cake-preview') && target.getAttribute('aria-checked') === 'true') ? requestAnimationFrame(() => res(Math.round((performance.now() - t0) * 10) / 10)) : requestAnimationFrame(check); check(); })""", i)
            samples.append(ms)
            await page.wait_for_timeout(150)
        samples.sort()
        out['interactions']['customizerOptionToPreviewMs'] = {'median': samples[len(samples) // 2], 'max': samples[-1], 'samples': len(samples)}
        # Memory growth over 200 option changes.
        await cdp.send('HeapProfiler.collectGarbage')
        before = await page.evaluate('performance.memory.usedJSHeapSize')
        await page.evaluate("""async () => { for (let i = 0; i < 200; i++) { const t = [...document.querySelectorAll('#opt-size button[role=radio]:not([disabled]), #opt-sponge button[role=radio]:not([disabled])')]; t[i % t.length].click(); await new Promise((r) => setTimeout(r, 15)); } }""")
        await page.wait_for_timeout(1500)
        await cdp.send('HeapProfiler.collectGarbage')
        after = await page.evaluate('performance.memory.usedJSHeapSize')
        out['interactions']['customizerHeapGrowthAfter200ChangesMB'] = round((after - before) / 1048576, 2)
        perf = await page.evaluate('window.__perf')
        out['interactions']['customizerLongTasksDuringSession'] = {'count': perf['longTasks'], 'totalMs': round(perf['longTaskMs'])}
        # Image upload: file → print tools shown.
        await page.click('.step-tabs button:has-text("Build")'); await page.click('#opt-size button:has-text("8 inch")')
        await page.click('.step-tabs button:has-text("Personalise")'); await page.wait_for_timeout(400)
        for name in ('square.jpg', 'highres.jpg'):
            if await page.locator('button[aria-label="Remove photo"]').count():
                await page.click('button[aria-label="Remove photo"]')
            t0 = time.time()
            await page.set_input_files('.print-editor input[type=file]', os.path.join(FIX, name))
            await page.wait_for_selector('.print-tools', timeout=30000)
            out['interactions'][f'uploadToPreviewMs_{name}'] = round((time.time() - t0) * 1000)
        # Admin rendering with 120 orders.
        await page.goto(args.base + '/cart', wait_until='load')
        await page.evaluate("""() => {
          const base = JSON.parse(localStorage.getItem('tresor-orders') || '[]');
          const tpl = base[0]; const many = [];
          for (let i = 0; i < 120; i++) many.push({ ...tpl, id: 'TRS-' + (5000 + i), createdAt: new Date(Date.now() - i * 60000).toISOString(), status: ['CONFIRMED','PREPARING','READY'][i % 3] });
          localStorage.setItem('tresor-orders', JSON.stringify(many));
        }""")
        t0 = time.time()
        await page.goto(args.base + '/admin/orders', wait_until='load')
        await page.wait_for_selector('text=TRS-5119', timeout=20000)
        out['interactions']['adminOrdersRender120Ms'] = round((time.time() - t0) * 1000)
        await b.close()
    json.dump(out, open(os.path.join(OUT, 'performance.json'), 'w'), indent=1)
    print(json.dumps(out['interactions'], indent=1))

asyncio.run(main())
