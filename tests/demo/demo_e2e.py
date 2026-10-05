"""Demo deployment checks: the one-time warning, the mock admin sign-in, robots rules, and a
regression pass over the shop, Cake Playground, cart, tracking and the admin.

  python tests/demo/demo_e2e.py --base http://localhost:3004

Run against a production build (headers such as admin no-store differ in development).
Writes .tresor/test-results/demo-e2e.json. Exit code 1 if any check fails.
"""
import argparse, asyncio, json, os, re, sys, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', '.tresor', 'test-results')
CHECKS = []
SEEN = "try{localStorage.setItem('tresor-demo-warning-seen','1')}catch(e){}"
AUTH_KEY = 'tresor-demo-admin-auth'


def check(name, ok, detail=''):
    CHECKS.append({'name': name, 'ok': bool(ok), 'detail': str(detail)[:300]})
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail and not ok else ''), flush=True)


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'tresor-demo-test'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status, dict((k.lower(), v) for k, v in r.headers.items()), r.read().decode('utf-8', 'replace')


async def go(page, base, path, wait=800):
    await page.goto(base + path, wait_until='domcontentloaded')
    try: await page.wait_for_load_state('networkidle', timeout=8000)
    except Exception: pass
    await page.wait_for_timeout(wait)


async def login(page, base, email='test@omni.com', password='testpass'):
    await page.fill('input[name=email]', email)
    await page.fill('input[name=password]', password)
    await page.click('button[type=submit]')


async def checkout(page, base, method='COD'):
    await go(page, base, '/checkout', 700)
    await page.fill('#f-name', 'Demo Tester')
    await page.fill('#f-phone', '9845000000')
    await page.fill('#f-address', '1 Demo Street, Indiranagar')
    await page.locator(f'.payment-tabs button:has-text("{"Pay at door" if method == "COD" else method}")').first.click()
    await page.locator('button.full-btn:has-text("Place order")').click()
    await page.wait_for_url('**/order-confirmed**', timeout=20000)
    m = re.search(r'id=(TRS-\d+)', page.url)
    await page.wait_for_timeout(500)
    return m.group(1) if m else None


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='http://localhost:3004')
    a = ap.parse_args()
    base = a.base
    errors = []

    # ---------- Robots and headers (plain HTTP) ----------
    st, h, body = fetch(base + '/robots.txt')
    check('robots.txt disallows everything', st == 200 and re.search(r'User-Agent:\s*\*', body, re.I) and re.search(r'Disallow:\s*/\s*$', body, re.I | re.M), body.strip())
    for path in ['/', '/shop', '/admin/login']:
        st, h, body = fetch(base + path)
        check(f'X-Robots-Tag on {path}', 'noindex' in h.get('x-robots-tag', '') and 'nofollow' in h.get('x-robots-tag', '') and 'noarchive' in h.get('x-robots-tag', '') and 'nosnippet' in h.get('x-robots-tag', ''), h.get('x-robots-tag'))
        meta = re.search(r'<meta name="robots" content="([^"]+)"', body)
        check(f'robots meta noindex on {path}', meta and all(w in meta.group(1) for w in ['noindex', 'nofollow', 'noarchive', 'nosnippet']), meta.group(1) if meta else 'missing')
    st, h, _ = fetch(base + '/admin')
    check('admin pages are not cached (no-store)', 'no-store' in h.get('cache-control', ''), h.get('cache-control'))

    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='chrome')

        def watch(page):
            page.on('pageerror', lambda e: errors.append(f'{page.url}: {e}'))

        # ---------- One-time warning ----------
        ctx = await browser.new_context(viewport={'width': 1280, 'height': 860})
        page = await ctx.new_page(); watch(page)
        await go(page, base, '/', 1500)
        dlg = page.locator('.demo-warning[role=dialog][aria-modal=true]')
        check('first visit shows the demo warning', await dlg.count() == 1)
        text = await dlg.text_content() if await dlg.count() else ''
        check('warning says it is a demonstration and not to enter real data', 'demonstration' in text.lower() and 'do not enter real' in text.lower() and 'scraping' in text.lower())
        check('warning is labelled for assistive tech', await page.locator('.demo-warning[aria-labelledby][aria-describedby]').count() == 1)
        check('focus starts on "I understand"', (await page.evaluate('document.activeElement && document.activeElement.textContent')) == 'I understand')
        await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab')
        check('focus stays inside the warning', (await page.evaluate('document.activeElement && document.activeElement.textContent')) == 'I understand')
        await page.keyboard.press('Escape'); await page.wait_for_timeout(200)
        check('Escape does not dismiss without acknowledgement', await dlg.count() == 1)
        check('the page behind is inert while it shows', await page.evaluate("[...document.body.children].filter(e => !e.classList.contains('demo-warning-layer') && e.tagName !== 'SCRIPT').every(e => e.hasAttribute('inert'))"))
        await page.keyboard.press('Enter'); await page.wait_for_timeout(300)
        check('Enter on the button acknowledges', await dlg.count() == 0)
        check('acknowledgement is stored', await page.evaluate("localStorage.getItem('tresor-demo-warning-seen')") is not None)
        check('page is usable again (inert removed)', await page.evaluate("[...document.body.children].every(e => !e.hasAttribute('inert'))"))
        await go(page, base, '/', 1200)
        check('reload does not show the warning again', await dlg.count() == 0)
        await go(page, base, '/shop', 1000)
        check('other pages do not show it again', await dlg.count() == 0)
        await ctx.close()

        # Storage blocked: the warning still shows and dismisses, and the site works.
        ctx = await browser.new_context(viewport={'width': 1280, 'height': 860})
        await ctx.add_init_script("Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked'); } })")
        page = await ctx.new_page(); blocked_errors = []
        page.on('pageerror', lambda e: blocked_errors.append(str(e)))
        await go(page, base, '/', 1500)
        check('storage blocked: warning still shows', await page.locator('.demo-warning').count() == 1)
        await page.get_by_role('button', name='I understand').click(); await page.wait_for_timeout(300)
        check('storage blocked: warning dismisses for this view', await page.locator('.demo-warning').count() == 0)
        check('storage blocked: no crash from the warning', not any('storage blocked' in e and 'mock-site-warning' in e for e in blocked_errors), blocked_errors[:2])
        await ctx.close()

        # ---------- Admin protection ----------
        ctx = await browser.new_context(viewport={'width': 1440, 'height': 900})
        await ctx.add_init_script(SEEN)
        page = await ctx.new_page(); watch(page)
        for path in ['/admin', '/admin/orders', '/admin/settings', '/admin/inventory', '/admin/custom-cakes', '/admin/analytics', '/admin/orders/abc']:
            await page.goto(base + path, wait_until='domcontentloaded')
            try:
                await page.wait_for_url('**/admin/login**', timeout=15000)
                url = page.url.replace(base, '')
                expected = '/admin/login' if path == '/admin' else '/admin/login?next=' + path.replace('/', '%2F')
                check(f'unauthenticated {path} redirects to login', url == expected, url)
            except Exception as e:
                check(f'unauthenticated {path} redirects to login', False, page.url)
            check(f'no admin data rendered for {path} while signed out', await page.locator('.ad-shell').count() == 0)

        # Login: wrong, then right; returns to the requested page.
        await go(page, base, '/admin/login?next=%2Fadmin%2Forders%2Fabc', 600)
        login_text = await page.text_content('body') or ''
        check('login page shows demo labelling and credentials', all(t in login_text for t in ['Demo environment', 'Sign in to continue.', 'test@omni.com', 'testpass', 'not real security']))
        await login(page, base, password='wrong-pass'); await page.wait_for_timeout(300)
        check('incorrect credentials fail with a message', await page.locator('.ad-login-error[role=alert]').count() == 1 and '/admin/login' in page.url)
        check('failed login stores nothing', await page.evaluate(f"localStorage.getItem('{AUTH_KEY}')") is None)
        await login(page, base, email='other@omni.com'); await page.wait_for_timeout(300)
        check('wrong email fails too', await page.locator('.ad-login-error').count() == 1)
        await login(page, base)
        await page.wait_for_url('**/admin/orders/abc', timeout=15000); await page.wait_for_selector('.ad-shell', timeout=15000)
        check('correct credentials succeed and return to the requested page', page.url.endswith('/admin/orders/abc'), page.url)
        stored = await page.evaluate(f"localStorage.getItem('{AUTH_KEY}')")
        check('stored sign-in holds no password', stored and 'testpass' not in stored, stored)

        await go(page, base, '/admin', 1200)
        check('admin works after login (Command Centre)', await page.locator('.ad-shell h1').count() > 0 and await page.locator('.ad-kpi, .ad-stat, .ad-card').count() > 0)
        check('admin header is labelled demo', 'Demo · Command centre' in (await page.text_content('.ad-brand') or ''))
        check('role switcher is labelled as a demo role', await page.locator('.ad-staff-label:text-is("Demo role")').count() == 1 and await page.locator('select[aria-label="Demo staff role"]').count() == 1)
        check('signed in as Owner by default', 'Owner' in (await page.locator('select[aria-label="Demo staff role"] option:checked').text_content() or ''))
        await page.reload(); await page.wait_for_selector('.ad-shell', timeout=15000)
        check('refresh keeps the demo sign-in', '/admin/login' not in page.url)

        # Demo staff switching still demonstrates RBAC.
        sel = page.locator('select[aria-label="Demo staff role"]')
        await sel.select_option(label=next(o for o in await sel.locator('option').all_text_contents() if 'Kitchen' in o)); await page.wait_for_timeout(500)
        nav = await page.text_content('.ad-side nav') or ''
        check('switching to Kitchen hides Staff and Settings', 'Staff' not in nav and 'Settings' not in nav, nav[:200])
        await sel.select_option(label=next(o for o in await sel.locator('option').all_text_contents() if 'Owner' in o)); await page.wait_for_timeout(400)
        check('switching back to Owner restores them', 'Settings' in (await page.text_content('.ad-side nav') or ''))

        # Open redirects are refused.
        for bad in ['https%3A%2F%2Fevil.example', '%2F%2Fevil.example', '%2Fshop']:
            await page.evaluate(f"localStorage.removeItem('{AUTH_KEY}')")
            await go(page, base, f'/admin/login?next={bad}', 500)
            await login(page, base)
            await page.wait_for_url('**/admin', timeout=15000)
            check(f'next={bad} is ignored (stays in the admin)', page.url.rstrip('/') == base + '/admin', page.url)

        # Logout keeps demo data, clears the sign-in and the chosen demo role.
        await sel.select_option(label=next(o for o in await sel.locator('option').all_text_contents() if 'Manager' in o)); await page.wait_for_timeout(300)
        orders_before = await page.evaluate("localStorage.getItem('tresor-orders')")
        await page.locator('button.ad-logout').click()
        await page.wait_for_url('**/admin/login', timeout=15000)
        check('logout goes to the login page', page.url.endswith('/admin/login'))
        check('logout clears the demo sign-in', await page.evaluate(f"localStorage.getItem('{AUTH_KEY}')") is None)
        check('logout keeps demo orders', await page.evaluate("localStorage.getItem('tresor-orders')") == orders_before)
        await go(page, base, '/admin/orders', 300)
        await page.wait_for_url('**/admin/login**', timeout=15000)
        check('after logout the admin is protected again', '/admin/login' in page.url)
        await login(page, base); await page.wait_for_url('**/admin/orders', timeout=15000); await page.wait_for_selector('.ad-shell')
        check('signing in again starts as Owner', 'Owner' in (await page.locator('select[aria-label="Demo staff role"] option:checked').text_content() or ''))

        # Clearing auth elsewhere (another tab or by hand) signs this tab out.
        other = await ctx.new_page()
        await go(other, base, '/admin', 800)
        await other.locator('button.ad-logout').click(); await other.wait_for_url('**/admin/login')
        await page.wait_for_url('**/admin/login**', timeout=10000)
        check('logging out in another tab signs this tab out too', '/admin/login' in page.url)
        await other.close()
        await ctx.close()

        # ---------- Regression: shop, Cake Playground, cart, tracking, admin sees the order ----------
        ctx = await browser.new_context(viewport={'width': 1440, 'height': 900})
        await ctx.add_init_script(SEEN)
        page = await ctx.new_page(); watch(page)
        await go(page, base, '/', 1500)
        check('storefront home renders', await page.locator('h1').count() > 0 and await page.locator('.demo-warning').count() == 0)
        check('public header shows the demo indicator', 'Demo environment' in (await page.text_content('.demo-chip') or ''))
        await go(page, base, '/shop/almond-croissant', 800)
        await page.locator('.full-btn').first.click(); await page.wait_for_timeout(800)
        cart = json.loads(await page.evaluate("localStorage.getItem('tresor-cart')") or '[]')
        check('cart works (product added)', any(l.get('product', {}).get('id') == 'almond-croissant' for l in cart), len(cart))
        await go(page, base, '/customize', 1500)
        await page.locator('.studio-bar .btn-brand').click()
        try:
            await page.wait_for_selector('.added-card', timeout=15000); ok = True
        except Exception:
            ok = False
        check('Cake Playground still adds a custom cake', ok)
        oid = await checkout(page, base, 'COD')
        check('checkout places the order', bool(oid), oid)
        await go(page, base, f'/track/{oid}', 1200)
        check('order tracking shows the order', oid and oid in (await page.text_content('body') or ''))
        await go(page, base, '/admin/orders', 300)
        await page.wait_for_url('**/admin/login**', timeout=15000)
        await login(page, base); await page.wait_for_url('**/admin/orders', timeout=15000); await page.wait_for_selector('.ad-shell')
        await page.wait_for_timeout(800)
        check('admin (after login) sees the new order', await page.locator(f'tr:has-text("{oid}")').count() > 0)
        await ctx.close()

        # ---------- Phone width ----------
        ctx = await browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        await ctx.add_init_script(SEEN)
        page = await ctx.new_page(); watch(page)
        await go(page, base, '/admin/login', 600)
        check('login fits a phone (no sideways scroll)', await page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'))
        await login(page, base); await page.wait_for_url('**/admin', timeout=15000); await page.wait_for_selector('.ad-shell')
        check('admin header fits a phone', await page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'))
        check('logout is reachable on a phone', await page.locator('button.ad-logout').is_visible())
        await go(page, base, '/', 800)
        check('public demo chip shows on a phone', await page.locator('.demo-chip').is_visible())
        await ctx.close()

        await browser.close()

    check('no uncaught page errors', not errors, errors[:3])
    os.makedirs(OUT, exist_ok=True)
    json.dump(CHECKS, open(os.path.join(OUT, 'demo-e2e.json'), 'w', encoding='utf-8'), indent=1)
    passed = sum(c['ok'] for c in CHECKS)
    print(f'\n{passed}/{len(CHECKS)} checks passed')
    sys.exit(0 if passed == len(CHECKS) else 1)


if __name__ == '__main__':
    asyncio.run(main())
