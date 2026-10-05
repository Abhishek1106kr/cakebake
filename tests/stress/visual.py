"""Visual regression captures for key states at 1440 / 768 / 390, with automatic
overflow checks. Screenshots go to .tresor/test-results/screenshots/visual/
(git-ignored: they can contain local reference imagery).
  python tests/stress/visual.py --base http://localhost:3004"""
import argparse, asyncio, json, os
from playwright.async_api import async_playwright

# Demo deployment: skip the one-time warning and sign in to the mock admin before every page
# (the warning and the sign-in have their own tests in tests/demo/demo_e2e.py).
DEMO_INIT = "try{localStorage.setItem('tresor-demo-warning-seen','1');localStorage.setItem('tresor-demo-admin-auth',JSON.stringify({v:1,email:'test@omni.com',signedInAt:new Date().toISOString()}))}catch(e){}"


HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', '.tresor', 'test-results')
SHOTS = os.path.join(OUT, 'screenshots', 'visual')
FIX = os.path.join(HERE, 'fixtures')
WIDTHS = [('desktop', 1440, 900), ('tablet', 768, 1024), ('mobile', 390, 844)]

async def overflow(page):
    return await page.evaluate("""() => {
      const w = window.innerWidth; const bad = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width && r.right > w + 2 && getComputedStyle(el).position !== 'fixed' && !el.closest('.discovery-track, .menu-tabs, .step-tabs, .wall-canvas, .story-love, .opening-stage, .years-numeral-wrap, .finale-mark-wrap, svg')) bad.push((el.className && el.className.toString().slice(0, 40)) || el.tagName);
      }
      return { pageScrollsSideways: document.documentElement.scrollWidth > w + 1, offenders: [...new Set(bad)].slice(0, 6) };
    }""")

async def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--base', default='http://localhost:3004'); args = ap.parse_args()
    os.makedirs(SHOTS, exist_ok=True)
    results = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for kind, w, h in WIDTHS:
            ctx = await b.new_context(viewport={'width': w, 'height': h}, is_mobile=kind == 'mobile', has_touch=kind != 'desktop')
            await ctx.add_init_script(DEMO_INIT)
            page = await ctx.new_page()
            async def shot(name, path=None, prep=None):
                if path:
                    await page.goto(args.base + path, wait_until='load')
                    await page.wait_for_timeout(1800)
                if prep:
                    await prep()
                    await page.wait_for_timeout(900)
                file = os.path.join(SHOTS, f'{name}-{w}.jpg')
                await page.screenshot(path=file, type='jpeg', quality=60)
                results.setdefault(name, {})[str(w)] = await overflow(page)
            await shot('01-home', '/')
            await shot('02-menu', '/shop')
            await shot('03-product', '/shop/almond-croissant')
            await page.locator('.full-btn').click(); await page.wait_for_url('**/cart')
            await shot('04-cart', '/cart')
            await shot('05-checkout', '/checkout')
            await shot('06-custom-cake', '/customize')
            async def photo():
                await page.locator('.step-tabs button:has-text("Build")').evaluate('e => e.click()')
                await page.locator('#opt-size button:has-text("8 inch")').evaluate('e => e.click()')
                await page.locator('.step-tabs button:has-text("Personalise")').evaluate('e => e.click()')
                await page.wait_for_timeout(400)
                await page.set_input_files('.print-editor input[type=file]', os.path.join(FIX, 'landscape.jpg'))
                await page.wait_for_selector('.print-tools', timeout=20000)
                await page.fill('#cake-message', 'Happy Birthday Aanya')
                await page.evaluate('window.scrollTo(0, 0)')
            await shot('07-photo-editor', prep=photo)
            async def review():
                await page.locator('.step-tabs button:has-text("Review")').evaluate('e => e.click()')
            await shot('08-custom-cake-review', prep=review)
            async def order():
                await page.locator('.studio-bar .btn-brand').click()
                await page.wait_for_selector('.added-card', timeout=15000)
                await page.goto(args.base + '/checkout', wait_until='load'); await page.wait_for_timeout(1200)
                await page.fill('#f-name', 'Visual Test'); await page.fill('#f-phone', '9845012345'); await page.fill('#f-address', '12 Test Road, Indiranagar')
                await page.locator('button.full-btn:has-text("Place order")').click()
                await page.wait_for_url('**/order-confirmed**', timeout=15000)
            await shot('09-order-confirmation', prep=order)
            await shot('10-admin-active-orders', '/admin')
            async def detail():
                if await page.locator('.cc-item').count():
                    await page.locator('.cc-item').first.click()
            await shot('11-admin-custom-cake-detail', '/admin/custom-cakes', detail)
            await ctx.close()
        await b.close()
    json.dump(results, open(os.path.join(OUT, 'visual-checks.json'), 'w'), indent=1)
    for name, by in results.items():
        bad = {k: v for k, v in by.items() if v['pageScrollsSideways']}
        print(name, 'OK' if not bad else f'SIDEWAYS SCROLL at {list(bad)} {[v["offenders"] for v in bad.values()]}')

asyncio.run(main())
