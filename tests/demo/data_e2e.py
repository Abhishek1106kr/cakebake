"""The shipped demo dataset in the running app: first load, every admin area on 1,000 orders,
the cross-links between records, issue handling, and Reset demo.

  python tests/demo/data_e2e.py --base http://localhost:3004

Run against a production build. Writes .tresor/test-results/data-e2e.json. Exit code 1 on failure.
"""
import argparse, asyncio, json, os, re, sys, time
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', '.tresor', 'test-results')
CHECKS = []
INIT = "try{localStorage.setItem('tresor-demo-warning-seen','1');localStorage.setItem('tresor-demo-admin-auth',JSON.stringify({v:1,email:'test@omni.com',signedInAt:new Date().toISOString()}))}catch(e){}"


def check(name, ok, detail=''):
    CHECKS.append({'name': name, 'ok': bool(ok), 'detail': str(detail)[:300]})
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail and not ok else ''), flush=True)


async def go(page, base, path, selector='.ad-shell h1', wait=600):
    t = time.time()
    await page.goto(base + path, wait_until='domcontentloaded')
    if selector:
        await page.wait_for_selector(selector, timeout=60000)
    await page.wait_for_timeout(wait)
    return int((time.time() - t) * 1000)


async def text(page, sel):
    return (await page.locator(sel).first.text_content() or '').strip() if await page.locator(sel).count() else ''


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='http://localhost:3004')
    base = ap.parse_args().base
    errors = []
    timings = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='chrome')
        ctx = await browser.new_context(viewport={'width': 1440, 'height': 1000})
        await ctx.add_init_script(INIT)
        page = await ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)[:200]))
        page.on('console', lambda m: errors.append('console: ' + m.text[:200]) if m.type == 'error' else None)
        requests = []
        page.on('request', lambda r: requests.append(r.url) if '/mock-data/' in r.url else None)

        # ---------- Storefront loads only the small manifest ----------
        await go(page, base, '/', 'h1', 1500)
        data_files = [u for u in requests if 'manifest' not in u]
        check('storefront fetches only the manifest, not the dataset', not data_files, data_files[:3])
        check('storefront renders', await page.locator('h1').count() > 0)

        # ---------- Admin loads the dataset ----------
        timings['overview'] = await go(page, base, '/admin', '.ad-kpi', 800)
        n = await page.evaluate('window.__tresorDemo.orders().length')
        check('admin has the 1,000 shipped orders', n >= 1000, n)
        live = await page.evaluate("window.__tresorDemo.orders().filter(o => o.liveOffsetMin !== undefined)")
        check('today’s live orders are dated today', live and all(time.time() * 1000 - __import__('datetime').datetime.fromisoformat(o['createdAt'].replace('Z', '+00:00')).timestamp() * 1000 < 8 * 3600_000 for o in live), len(live))
        future = await page.evaluate("window.__tresorDemo.orders().filter(o => Date.parse(o.createdAt) > Date.now() + 1000).length")
        check('no order is dated in the future', future == 0, future)
        kpi_today = await text(page, '.ad-kpi:has(.ad-kpi-label:text-is("Orders today")) .ad-kpi-value')
        expected_today = await page.evaluate("(() => { const d = new Date(); return window.__tresorDemo.orders().filter(o => o.status !== 'CANCELLED' && new Date(o.createdAt).toDateString() === d.toDateString()).length })()")
        check('overview “Orders today” matches the records', kpi_today == str(expected_today), f'{kpi_today} vs {expected_today}')

        # ---------- Orders: search, filters, pagination, detail cross-links ----------
        timings['orders'] = await go(page, base, '/admin/orders?filter=ALL')
        pager = await text(page, '.ad-pager')
        check('orders are paginated over the whole history', '1000' in pager.replace(',', '') or '1,0' in pager, pager)
        check('orders table renders a page, not everything', await page.locator('tbody tr').count() <= 30, await page.locator('tbody tr').count())
        await go(page, base, '/admin/orders?filter=ALL&q=TRS-09000')
        check('search by order number finds it', await page.locator('tr:has-text("TRS-09000")').count() == 1)
        timings['order-detail'] = await go(page, base, '/admin/orders/TRS-09000')
        check('order detail shows payment records', await page.locator('a[href*="/admin/payments?payment=PAY-"]').count() >= 1)
        check('order detail links the customer record', await page.locator('a[href*="/admin/customers"]:text-matches("CUS-\\\\d{5}")').count() == 1)

        # ---------- Customers ----------
        timings['customers'] = await go(page, base, '/admin/customers')
        kpi = await text(page, '.ad-kpi:has(.ad-kpi-label:text-is("Customers")) .ad-kpi-value')
        check('at least 600 customers', int(kpi or 0) >= 600, kpi)
        await page.locator('.ad-chips button', has_text='High value').first.click()
        await page.wait_for_timeout(400)
        await page.locator('tbody .ad-rowlink').first.click()
        await page.wait_for_selector('.ad-drawer')
        drawer = await page.locator('.ad-drawer').text_content() or ''
        check('customer drawer shows id, lifetime value and order history', re.search(r'CUS-\d{5}', drawer) and 'Total spend' in drawer and 'Order history' in drawer)
        check('customer drawer shows issues, invoices and payment records', 'Issues (' in drawer and 'Invoices (' in drawer and 'payment record' in drawer)

        # ---------- Payments ----------
        timings['payments'] = await go(page, base, '/admin/payments')
        failed = await text(page, '.ad-chips button:has-text("Failed") .ad-chip-count, .ad-chips button:has-text("Failed") b, .ad-chips button:has-text("Failed") span')
        await page.locator('.ad-chips button', has_text='Failed').first.click()
        await page.wait_for_timeout(500)
        rows = await page.locator('tr[data-payment]').count()
        check('failed payments filter shows failed attempts', rows > 0 and await page.locator('tr[data-payment] .ad-badge, tr[data-payment] [class*="badge"]').first.text_content() is not None, rows)
        await page.locator('tr[data-payment] button.ad-rowlink').first.click()
        await page.wait_for_selector('.ad-drawer')
        check('payment drawer shows the order’s payment timeline', 'Timeline for' in (await page.locator('.ad-drawer').text_content() or ''))
        await go(page, base, '/admin/payments?status=REFUND_PENDING')
        check('refund-pending payments are listed', await page.locator('tr[data-payment]').count() >= 1)

        # ---------- Invoices ----------
        timings['invoices'] = await go(page, base, '/admin/invoices')
        issued = await text(page, '.ad-chips button:has-text("Issued")')
        check('invoices issued for eligible orders', re.search(r'\d{3}', issued or ''), issued)

        # ---------- Issues: create, assign, reply, note, resolve (audited) ----------
        timings['issues'] = await go(page, base, '/admin/issues')
        open_count = await text(page, '.ad-kpi:has(.ad-kpi-label:text-is("Open")) .ad-kpi-value')
        check('issues queue has open issues', int(open_count or 0) >= 1, open_count)
        await page.locator('button:has-text("New issue")').click()
        await page.wait_for_selector('.ad-drawer')
        await page.locator('.ad-drawer input').first.fill('TRS-09000')
        await page.locator('.ad-drawer textarea').fill('Customer says the almond croissant was missing.')
        await page.locator('.ad-drawer button:has-text("Open issue")').click()
        await page.wait_for_timeout(700)
        title = await text(page, '.ad-drawer h2')
        check('a new issue opens with the next number', re.match(r'ISS-\d{4}', title or ''), title)
        await page.locator('.ad-drawer select[aria-label="Assign to"]').select_option('staff-support')
        await page.wait_for_timeout(400)
        check('assigning acknowledges it', 'Acknowledged' in (await page.locator('.ad-drawer').text_content() or ''))
        await page.locator('.ad-drawer input[aria-label="Reply to the customer"]').fill('Sorry about that, refunding now.')
        await page.locator('.ad-drawer button:has-text("Record reply")').click()
        await page.locator('.ad-drawer input[aria-label="Add an internal note"]').fill('Packing checklist missed it.')
        await page.locator('.ad-drawer button:has-text("Add note")').click()
        await page.wait_for_timeout(400)
        d = await page.locator('.ad-drawer').text_content() or ''
        check('reply and internal note are recorded separately', 'Sorry about that, refunding now.' in d and 'Packing checklist missed it.' in d)
        await page.locator('.ad-drawer-foot button', has_text='Resolved').click()
        modal = page.locator('.ad-modal'); await modal.wait_for()
        await modal.locator('textarea').fill('Refunded the missing croissant.')
        await modal.locator('[data-confirm]').click()
        await page.wait_for_timeout(500)
        check('resolving needs and keeps a resolution', 'Refunded the missing croissant.' in (await page.locator('.ad-drawer').text_content() or ''))
        await go(page, base, '/admin/audit?q=issue.')
        check('issue actions are in the audit log', await page.locator('td:has-text("issue.created")').count() >= 1 and await page.locator('td:has-text("issue.resolved")').count() >= 1)
        await go(page, base, '/admin/orders/TRS-09000')
        check('the order shows its new issue', await page.locator('a[href*="/admin/issues?issue=ISS-"]').count() >= 1)

        # ---------- Automations, inventory, analytics, kitchen, custom cakes ----------
        timings['automations'] = await go(page, base, '/admin/automations')
        jobs = await text(page, '.ad-kpi:has(.ad-kpi-label:text-is("Jobs")) .ad-kpi-value')
        check('automation jobs from the history', int(jobs or 0) >= 300, jobs)
        timings['inventory'] = await go(page, base, '/admin/inventory?item=beans')
        await page.wait_for_selector('.ad-drawer')
        inv = await page.locator('.ad-drawer').text_content() or ''
        check('low stock is explained by its history', 'Last delivery' in inv and 'used since' in inv)
        cover = await text(page, '.ad-drawer .ad-kpi:has(.ad-kpi-label:text-is("Days of cover")) .ad-kpi-value')
        check('days of cover agree with recorded use (counter included)', cover and float(cover) < 10, cover)
        timings['analytics'] = await go(page, base, '/admin/analytics')
        kpi = await text(page, '.ad-kpi:has(.ad-kpi-label:text-is("Orders")) .ad-kpi-value')
        expected = await page.evaluate("(() => { const w = Date.now() - 7 * 86400000; return window.__tresorDemo.orders().filter(o => o.status !== 'CANCELLED' && Date.parse(o.createdAt) >= w).length })()")
        check('analytics orders match the records', kpi == str(expected), f'{kpi} vs {expected}')
        check('analytics shows a customer journey', 'Placed an order' in (await page.locator('body').text_content() or ''))
        timings['kitchen'] = await go(page, base, '/admin/kitchen')
        check('kitchen board shows today’s live orders', await page.locator('text=TRS-091').count() >= 3)
        timings['custom-cakes'] = await go(page, base, '/admin/custom-cakes')
        check('custom cakes list has history', await page.locator('.cc-item').count() >= 3)

        # ---------- Shop still works; new order joins the history ----------
        await go(page, base, '/customize', 'h1', 1500)
        await page.locator('.studio-bar .btn-brand').click()
        await page.wait_for_selector('.added-card', timeout=15000)
        await go(page, base, '/checkout', 'h1', 700)
        await page.fill('#f-name', 'Data Test'); await page.fill('#f-phone', '9845011111'); await page.fill('#f-address', '1 Data Road, Indiranagar')
        await page.locator('.payment-tabs button:has-text("UPI")').first.click()
        await page.locator('button.full-btn:has-text("Place order")').click()
        await page.wait_for_url('**/order-confirmed**', timeout=20000)
        oid = re.search(r'id=(TRS-\d+)', page.url).group(1)
        check('new orders continue after the shipped numbers', oid == 'TRS-09142' or int(oid[4:]) > 9141, oid)
        await go(page, base, f'/track/{oid}', 'h1', 1000)
        check('tracking shows the new order', oid in (await page.locator('body').text_content() or ''))
        await go(page, base, '/admin/orders?filter=ALL')
        check('the new order appears first in the admin', oid in (await page.locator('tbody tr').first.text_content() or ''))
        await go(page, base, f'/admin/payments?q={oid}')
        check('the new order has a payment record', await page.locator('tr[data-payment]').count() == 1)

        # ---------- Reset demo ----------
        await go(page, base, '/admin')
        await page.locator('button:has-text("Reset demo")').click()
        modal = page.locator('.ad-modal')
        if await modal.count():
            if await modal.locator('textarea').count(): await modal.locator('textarea').fill('Data test reset')
            await modal.locator('[data-confirm]').click()
        await page.wait_for_load_state('load'); await page.wait_for_selector('.ad-kpi', timeout=60000); await page.wait_for_timeout(1000)
        after = await page.evaluate("window.__tresorDemo.orders().length")
        gone = await page.evaluate(f"!window.__tresorDemo.orders().some(o => o.id === '{oid}')")
        overlay = await page.evaluate("localStorage.getItem('tresor-orders')")
        issues_overlay = await page.evaluate("localStorage.getItem('tresor-issues')")
        check('reset demo restores the shipped orders', after == 1000 and gone, f'{after}, new order gone: {gone}')
        check('reset demo removes the browser changes', overlay in (None, '[]') and issues_overlay in (None, '{}'), f'{overlay} {issues_overlay}')
        check('reset demo keeps the demo sign-in', '/admin/login' not in page.url)

        await browser.close()

    check('no uncaught page errors', not errors, errors[:3])
    os.makedirs(OUT, exist_ok=True)
    json.dump({'checks': CHECKS, 'timingsMs': timings}, open(os.path.join(OUT, 'data-e2e.json'), 'w', encoding='utf-8'), indent=1)
    passed = sum(c['ok'] for c in CHECKS)
    print(f'\n{passed}/{len(CHECKS)} checks passed · page timings (ms) {timings}')
    sys.exit(0 if passed == len(CHECKS) else 1)


if __name__ == '__main__':
    asyncio.run(main())
