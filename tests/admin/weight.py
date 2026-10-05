"""Is the admin lighter than the customer homepage? Measured, not assumed.

For each page (fresh context, Chrome, CPU throttled 4x at 390 px and 2x at 1440 px):
script and layout time during load, idle main-thread time over 4 s, running
animations, JS transferred, DOM nodes. Median of 3 runs.

  python tests/admin/weight.py --base http://localhost:3004
"""
import argparse, asyncio, json, os, statistics
from playwright.async_api import async_playwright

# Demo deployment: skip the one-time warning and sign in to the mock admin before every page
# (the warning and the sign-in have their own tests in tests/demo/demo_e2e.py).
DEMO_INIT = "try{localStorage.setItem('tresor-demo-warning-seen','1');localStorage.setItem('tresor-demo-admin-auth',JSON.stringify({v:1,email:'test@omni.com',signedInAt:new Date().toISOString()}))}catch(e){}"


HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', '.tresor', 'test-results')
PAGES = ['/', '/admin', '/admin/orders', '/admin/kitchen', '/admin/analytics']


async def run(browser, base, path, width):
    ctx = await browser.new_context(viewport={'width': width, 'height': 900 if width > 800 else 844}, device_scale_factor=1)
    await ctx.add_init_script(DEMO_INIT)
    page = await ctx.new_page()
    cdp = await ctx.new_cdp_session(page)
    await cdp.send('Performance.enable')
    await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4 if width < 800 else 2})
    await page.goto(base + path, wait_until='load')
    await page.wait_for_timeout(1500)
    m0 = {x['name']: x['value'] for x in (await cdp.send('Performance.getMetrics'))['metrics']}
    await page.wait_for_timeout(4000)
    m1 = {x['name']: x['value'] for x in (await cdp.send('Performance.getMetrics'))['metrics']}
    anims = await page.evaluate('document.getAnimations().filter(a => a.playState === "running").length')
    dom = await page.evaluate('document.getElementsByTagName("*").length')
    # Resource Timing, not content-length: the server streams chunked responses.
    # jsLoadKB is what arrives before the load event; jsKB adds idle-time route prefetches.
    js, js_load = await page.evaluate("""() => {
      const e = performance.getEntriesByType('resource').filter(x => x.initiatorType === 'script' || x.name.endsWith('.js'));
      const load = performance.getEntriesByType('navigation')[0].loadEventEnd;
      const sum = (xs) => xs.reduce((n, x) => n + (x.encodedBodySize || 0), 0);
      return [sum(e), sum(e.filter(x => x.startTime <= load))];
    }""")
    await ctx.close()
    return {
        'loadScriptMs': round(m0['ScriptDuration'] * 1000), 'loadLayoutMs': round(m0['LayoutDuration'] * 1000),
        'idleTaskMs': round((m1['TaskDuration'] - m0['TaskDuration']) * 1000), 'idleScriptMs': round((m1['ScriptDuration'] - m0['ScriptDuration']) * 1000),
        'runningAnimations': anims, 'jsLoadKB': round(js_load / 1024), 'jsKB': round(js / 1024), 'domNodes': dom, 'heapMB': round(m1['JSHeapUsedSize'] / 1048576, 1),
    }


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='http://localhost:3004')
    a = ap.parse_args()
    out = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='chrome')
        for width in (1440, 390):
            for path in PAGES:
                runs = [await run(browser, a.base, path, width) for _ in range(3)]
                med = {k: statistics.median([r[k] for r in runs]) for k in runs[0]}
                out[f'{path}@{width}'] = med
                print(f'{path:18} {width:5} ' + '  '.join(f'{k}={v}' for k, v in med.items()), flush=True)
        await browser.close()
    os.makedirs(OUT, exist_ok=True)
    json.dump(out, open(os.path.join(OUT, 'admin-weight.json'), 'w', encoding='utf-8'), indent=1)


if __name__ == '__main__':
    asyncio.run(main())
