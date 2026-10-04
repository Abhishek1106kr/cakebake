"""Admin at volume: ~300 orders accumulated in ONE browser (the stress harness gives
each client a fresh context, so orders never pile up there). Real orders are placed
through the shop first, then cloned into consistent records (ids, dates, statuses
with matching history, repeat customers, cancellations, custom cakes).

Checks that filters, search, dashboard metrics, custom cakes, customers and analytics
still match the records, that lists stay paginated, and how long pages take.

  python tests/admin/scale.py --base http://localhost:3004 --orders 300
"""
import argparse, asyncio, json, os, re, sys, time
from datetime import datetime, timedelta
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', '.tresor', 'test-results')
CHECKS = []


def check(name, ok, detail=''):
    CHECKS.append({'name': name, 'ok': bool(ok), 'detail': str(detail)[:300]})
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail else ''), flush=True)


async def ls(page, key, default=None):
    v = await page.evaluate(f"localStorage.getItem({json.dumps(key)})")
    return json.loads(v) if v else default


async def go(page, base, path, wait=700):
    t = time.time()
    await page.goto(base + path, wait_until='domcontentloaded')
    await page.locator('h1').first.wait_for(timeout=15000)
    ms = round((time.time() - t) * 1000)
    await page.wait_for_timeout(wait)
    return ms


async def checkout(page, base, method='UPI'):
    await page.goto(base + '/checkout', wait_until='domcontentloaded'); await page.wait_for_timeout(900)
    await page.fill('#f-name', 'Seed Customer'); await page.fill('#f-phone', '9845099999'); await page.fill('#f-address', '1 Seed Road, Indiranagar')
    await page.locator(f'button:has-text("{method}")').first.click()
    await page.locator('button.full-btn:has-text("Place order")').click()
    await page.wait_for_url('**/order-confirmed**', timeout=20000)
    await page.wait_for_timeout(500)


CLONE_JS = """(n) => {
  const orders = JSON.parse(localStorage.getItem('tresor-orders'));
  const real = orders.filter(o => o.source === 'online');
  const FLOW = ['NEW','CONFIRMED','PREPARING','READY','OUT_FOR_DELIVERY','DELIVERED'];
  const first = ['Asha','Ravi','Meera','Kabir','Ananya','Vikram','Zoya','Rohan','Ishita','Dev','Tara','Neel'];
  const last = ['Rao','Iyer','Nair','Das','Khan','Mehta','Shetty','Menon'];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const now = Date.now(); const out = [];
  for (let i = 0; i < n; i++) {
    const base = real[i % real.length];
    const c = Math.floor(rnd() * 60);
    const created = new Date(now - Math.floor(rnd() * 9 * 86400000) - (i % 7 === 0 ? 0 : 0));
    const isToday = rnd() < 0.3; if (isToday) created.setTime(now - Math.floor(rnd() * 6 * 3600000));
    const roll = rnd();
    const status = roll < 0.08 ? 'CANCELLED' : created.getTime() < now - 86400000 ? 'DELIVERED' : FLOW[1 + Math.floor(rnd() * 5)];
    const steps = status === 'CANCELLED' ? ['NEW', 'CONFIRMED', 'CANCELLED'] : FLOW.slice(0, FLOW.indexOf(status) + 1);
    const history = steps.map((s, k) => ({ status: s, at: new Date(created.getTime() + k * 7 * 60000).toISOString() }));
    const custom = base.items.some(l => l.custom);
    const d = new Date(created.getTime() + (custom ? 2 : 0) * 86400000);
    const slot = custom ? d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · 14:00–16:00' : ['10:00–12:00','14:00–16:00','18:00–20:00'][i % 3];
    const pay = base.paymentMethod;
    out.push({ ...base, id: 'TRS-' + (3000 + i), createdAt: created.toISOString(), history, status, slot,
      customer: { name: first[c % first.length] + ' ' + last[c % last.length], phone: '98450' + String(10000 + c).slice(-5), email: c % 3 ? '' : 'c' + c + '@example.com' },
      paymentStatus: status === 'CANCELLED' ? (pay === 'COD' ? 'VOID' : 'REFUND_PENDING') : pay === 'COD' && status !== 'DELIVERED' ? 'DUE' : 'PAID' });
  }
  localStorage.setItem('tresor-orders', JSON.stringify([...out, ...orders]));
  return out.length;
}"""


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='http://localhost:3004')
    ap.add_argument('--orders', type=int, default=300)
    a = ap.parse_args()
    base = a.base
    timings = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='chrome')
        ctx = await browser.new_context(viewport={'width': 1440, 'height': 900})
        page = await ctx.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(base + '/'); await page.evaluate('localStorage.clear()')
        # Real shapes: a menu order (UPI), a cash order, a custom cake.
        for product, method in [('almond-croissant', 'UPI'), ('chocolate-brownie', 'Pay at door')]:
            await page.goto(base + f'/shop/{product}'); await page.wait_for_timeout(800)
            await page.locator('.full-btn').first.click(); await page.wait_for_url('**/cart', timeout=8000)
            await checkout(page, base, method)
        await page.goto(base + '/customize'); await page.wait_for_timeout(1500)
        await page.locator('.studio-bar .btn-brand').click(); await page.wait_for_selector('.added-card', timeout=15000)
        await checkout(page, base, 'Card')
        n = await page.evaluate(CLONE_JS, a.orders)
        orders = await ls(page, 'tresor-orders', [])
        check('accumulated orders in one browser', len(orders) >= a.orders, len(orders))

        # ---- Orders: chip counts, pagination, search ----
        timings['orders'] = await go(page, base, '/admin/orders?filter=ALL', 1200)
        chips = {}
        for t in await page.locator('.ad-chip').all_text_contents():
            m = re.match(r'(.+?)\s*(\d+)$', t.strip())
            if m: chips[m.group(1).strip()] = int(m.group(2))
        active = [o for o in orders if o['status'] not in ('DELIVERED', 'CANCELLED')]
        exp = {'All': len(orders), 'Active': len(active), 'Preparing': sum(o['status'] == 'PREPARING' for o in orders), 'Delivered': sum(o['status'] == 'DELIVERED' for o in orders),
               'Cancelled': sum(o['status'] == 'CANCELLED' for o in orders), 'Refund pending': sum(o['paymentStatus'] == 'REFUND_PENDING' for o in orders), 'Ready': sum(o['status'] == 'READY' for o in orders)}
        check('order filter counts match the records', all(chips.get(k) == v for k, v in exp.items()), {k: (chips.get(k), v) for k, v in exp.items()})
        rows = await page.locator('table.ad-orders tbody tr').count()
        check('orders table stays paginated (25 rows, not all)', rows == 25, rows)
        pager = await page.text_content('.ad-pager') or ''
        check('pager shows the full total', f'{len(orders)} orders' in pager, pager)
        dom = await page.evaluate('document.getElementsByTagName("*").length')
        check('orders page DOM stays small', dom < 4000, dom)
        name = 'Meera Nair'
        await page.locator('input[aria-label="Search orders"]').fill(name)
        await page.wait_for_timeout(500)
        pager = await page.text_content('.ad-pager') or ''
        want = sum(o['customer']['name'] == name for o in orders)
        check('search by customer finds every order', f'{want} orders' in pager, (pager, want))
        await page.locator('input[aria-label="Search orders"]').fill('TRS-3123')
        await page.wait_for_timeout(400)
        check('search by order number finds exactly one', await page.locator('table.ad-orders tbody tr').count() == 1)
        # Interaction latency at volume.
        await go(page, base, '/admin/orders?filter=CONFIRMED', 900)
        row = page.locator('table.ad-orders tbody tr').first
        oid = (await row.locator('.ad-rowlink').text_content()).strip()
        t = time.time()
        await row.locator('button.btn-sm').first.click()
        await page.wait_for_function(f"!document.querySelector('table.ad-orders') || ![...document.querySelectorAll('table.ad-orders tbody tr')].some(r => r.textContent.includes('{oid}') && r.textContent.includes('Confirmed'))", timeout=5000)
        timings['statusChangeMs'] = round((time.time() - t) * 1000)
        check('status change at volume responds quickly (< 1 s)', timings['statusChangeMs'] < 1000, timings['statusChangeMs'])

        # ---- Overview metrics ----
        orders = await ls(page, 'tresor-orders', [])
        timings['overview'] = await go(page, base, '/admin', 1200)
        today = [o for o in orders if o['status'] != 'CANCELLED' and datetime.fromisoformat(o['createdAt'].replace('Z', '+00:00')).astimezone().date() == datetime.now().date()]
        kpi = lambda label: page.locator(f'.ad-kpi:has(.ad-kpi-label:text-is("{label}")) .ad-kpi-value').text_content()
        rev = int(re.sub(r'\D', '', await kpi('Revenue today')))
        cnt = int(await kpi('Orders today'))
        check('dashboard revenue and orders today match the records', rev == sum(o['total'] for o in today) and cnt == len(today), (rev, sum(o['total'] for o in today), cnt, len(today)))
        act = int(await kpi('Active'))
        check('dashboard active count matches', act == len([o for o in orders if o['status'] not in ('DELIVERED', 'CANCELLED')]), act)
        check('live orders table capped (8 newest)', await page.locator('#live tbody tr').count() <= 8)

        # ---- Custom cakes, customers, analytics, automations, search ----
        timings['customCakes'] = await go(page, base, '/admin/custom-cakes', 1500)
        cakes = sum(1 for o in orders for l in o['items'] if l.get('custom'))
        check('custom cake list shows every custom job', await page.locator('.cc-item').count() == cakes, (await page.locator('.cc-item').count(), cakes))
        check('custom cake list scrolls in its own panel', await page.evaluate("getComputedStyle(document.querySelector('.cc-list')).overflowY") == 'auto')
        timings['customers'] = await go(page, base, '/admin/customers', 1000)
        phones = {re.sub(r'\D', '', o['customer']['phone'])[-10:] for o in orders}
        pager = await page.text_content('.ad-pager') or ''
        check('one customer per phone number', f'{len(phones)} customers' in pager, (pager, len(phones)))
        timings['analytics'] = await go(page, base, '/admin/analytics', 1500)
        week = datetime.now().astimezone() - timedelta(days=7)
        exp7 = len([o for o in orders if o['status'] != 'CANCELLED' and datetime.fromisoformat(o['createdAt'].replace('Z', '+00:00')) >= week])
        got = int(await kpi('Orders'))
        check('analytics 7-day orders match the records', got == exp7, (got, exp7))
        timings['automations'] = await go(page, base, '/admin/automations', 800)
        check('automations page renders at volume', await page.locator('h1').text_content() == 'Automations')
        timings['kitchen'] = await go(page, base, '/admin/kitchen', 800)
        check('kitchen board renders at volume', await page.locator('.ad-ticket').count() >= 1)
        await page.keyboard.press('Control+k')
        await page.locator('.ad-palette input').fill('TRS-3050')
        t = time.time(); await page.wait_for_selector('.ad-palette-list li', timeout=3000)
        timings['searchMs'] = round((time.time() - t) * 1000)
        check('global search returns at volume', timings['searchMs'] < 1500, timings['searchMs'])
        check('no uncaught page errors', not errors, errors[:3])
        await browser.close()
    ok = all(c['ok'] for c in CHECKS)
    os.makedirs(OUT, exist_ok=True)
    json.dump({'orders': a.orders, 'timingsMs': timings, 'passed': sum(c['ok'] for c in CHECKS), 'total': len(CHECKS), 'checks': CHECKS}, open(os.path.join(OUT, 'admin-scale.json'), 'w', encoding='utf-8'), indent=1)
    print(f"\n{sum(c['ok'] for c in CHECKS)}/{len(CHECKS)} passed · timings (ms, includes navigation) {timings}")
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    asyncio.run(main())
