"""Admin smoke test: every admin route renders without console errors or sideways
scroll, at a desktop and a phone width. Screenshots go to the git-ignored
.tresor/test-results/screenshots/admin/.

  python tests/admin/smoke.py --base http://localhost:3004 [--routes /admin,/admin/orders] [--widths 1440,390]
"""
import argparse, asyncio, json, os
from playwright.async_api import async_playwright

# Demo deployment: skip the one-time warning and sign in to the mock admin before every page
# (the warning and the sign-in have their own tests in tests/demo/demo_e2e.py).
DEMO_INIT = "try{localStorage.setItem('tresor-demo-warning-seen','1');localStorage.setItem('tresor-demo-admin-auth',JSON.stringify({v:1,email:'test@omni.com',signedInAt:new Date().toISOString()}))}catch(e){}"


HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
SHOTS = os.path.join(ROOT, '.tresor', 'test-results', 'screenshots', 'admin')
ROUTES = ['/admin', '/admin/orders', '/admin/kitchen', '/admin/custom-cakes', '/admin/issues', '/admin/payments', '/admin/products', '/admin/cake-builder', '/admin/inventory',
          '/admin/customers', '/admin/campaigns', '/admin/content', '/admin/media', '/admin/analytics', '/admin/intelligence',
          '/admin/automations', '/admin/invoices', '/admin/staff', '/admin/audit', '/admin/settings']


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='http://localhost:3004')
    ap.add_argument('--routes', default=','.join(ROUTES))
    ap.add_argument('--widths', default='1440,390')
    ap.add_argument('--no-shots', action='store_true')
    a = ap.parse_args()
    os.makedirs(SHOTS, exist_ok=True)
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='chrome')
        for w in [int(x) for x in a.widths.split(',')]:
            ctx = await browser.new_context(viewport={'width': w, 'height': 900 if w > 800 else 844}, device_scale_factor=1)
            await ctx.add_init_script(DEMO_INIT)
            page = await ctx.new_page()
            errors = []
            page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
            page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            for route in a.routes.split(','):
                errors.clear()
                resp = await page.goto(a.base + route, wait_until='load')
                await page.wait_for_timeout(900)
                status = resp.status if resp else None
                overflow = await page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
                heading = await page.text_content('h1') if await page.locator('h1').count() else None
                if not a.no_shots:
                    await page.screenshot(path=os.path.join(SHOTS, f"{route.strip('/').replace('/', '-') or 'root'}-{w}.jpg"), type='jpeg', quality=55, full_page=False)
                r = {'route': route, 'width': w, 'status': status, 'overflowPx': overflow, 'h1': (heading or '').strip()[:60], 'errors': [e[:200] for e in errors if 'favicon' not in e]}
                results.append(r)
                flag = 'OK ' if status == 200 and overflow <= 1 and not r['errors'] else 'BAD'
                print(f"{flag} {w:5} {route:24} status={status} overflow={overflow} h1={r['h1']!r} errors={len(r['errors'])}", flush=True)
                for e in r['errors'][:3]:
                    print('      ', e)
            await ctx.close()
        await browser.close()
    out = os.path.join(ROOT, '.tresor', 'test-results', 'admin-smoke.json')
    json.dump(results, open(out, 'w', encoding='utf-8'), indent=1)


if __name__ == '__main__':
    asyncio.run(main())
