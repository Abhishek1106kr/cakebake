"""End-to-end admin flows on a production build: the shop and the admin in two tabs of
one browser (same records), exercising every management path the admin brief lists.

  python tests/admin/admin_e2e.py --base http://localhost:3004

Writes .tresor/test-results/admin-e2e.json. Exit code 1 if any check fails.
"""
import argparse, asyncio, json, os, re, sys, time
from playwright.async_api import async_playwright

# Demo deployment: skip the one-time warning and sign in to the mock admin before every page
# (the warning and the sign-in have their own tests in tests/demo/demo_e2e.py).
DEMO_INIT = "try{localStorage.setItem('tresor-demo-warning-seen','1');localStorage.setItem('tresor-demo-admin-auth',JSON.stringify({v:1,email:'test@omni.com',signedInAt:new Date().toISOString()}))}catch(e){}"


HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', '.tresor', 'test-results')
CHECKS = []


def check(name, ok, detail=''):
    CHECKS.append({'name': name, 'ok': bool(ok), 'detail': str(detail)[:300]})
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail and not ok else ''), flush=True)


async def ls(page, key, default=None):
    v = await page.evaluate(f"localStorage.getItem({json.dumps(key)})")
    return json.loads(v) if v else default


async def go(page, base, path, wait=900):
    await page.goto(base + path, wait_until='domcontentloaded')
    try:
        await page.wait_for_load_state('networkidle', timeout=8000)
    except Exception:
        pass
    await page.wait_for_timeout(wait)


async def confirm(page, reason='E2E test'):
    modal = page.locator('.ad-modal')
    await modal.wait_for(timeout=5000)
    if await modal.locator('textarea').count():
        await modal.locator('textarea').fill(reason)
    await modal.locator('[data-confirm]').click()
    await page.wait_for_timeout(400)


def field(scope, label):
    return scope.locator(f'label.ad-field:has(> span:text-is("{label}"))').locator('input, select, textarea').first


async def order_of(page, oid):
    return next((o for o in (await ls(page, 'tresor-orders', []) or []) if o['id'] == oid), None)


async def stock(page, ing):
    inv = await ls(page, 'tresor-inventory', []) or []
    return next((i for i in inv if i['id'] == ing), None)


async def buy(page, base, product='almond-croissant', method='UPI'):
    """Customer journey: product page → bag → checkout → confirmation. Returns the order id."""
    await go(page, base, f'/shop/{product}', 700)
    await page.locator('.full-btn').first.click()
    if not await page.locator('.cake-campaign').count():
        await page.wait_for_url('**/cart', timeout=8000)
    return await checkout(page, base, method)


async def checkout(page, base, method='UPI'):
    await go(page, base, '/checkout', 700)
    await page.fill('#f-name', 'Asha Rao')
    await page.fill('#f-phone', '9845012345')
    await page.fill('#f-address', '12 Test Road, Indiranagar')
    await page.locator(f'button:has-text("{method}")').first.click()
    await page.locator('button.full-btn:has-text("Place order")').click()
    await page.wait_for_url('**/order-confirmed**', timeout=20000)
    m = re.search(r'id=(TRS-\d+)', page.url)
    await page.wait_for_timeout(600)
    return m.group(1) if m else None


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='http://localhost:3004')
    a = ap.parse_args()
    base = a.base
    t0 = time.time()
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='chrome')
        ctx = await browser.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
        await ctx.add_init_script(DEMO_INIT)
        shop = await ctx.new_page()
        admin = await ctx.new_page()
        errors = []
        admin.on('pageerror', lambda e: errors.append(str(e)))
        shop.on('pageerror', lambda e: errors.append(str(e)))

        await go(shop, base, '/')
        await shop.evaluate('localStorage.clear()')
        await go(shop, base, '/')

        # ---------- 1. Order: shop → admin live → status → tracking → automations ----------
        await go(admin, base, '/admin', 1200)
        flour0 = (await stock(shop, 'flour'))['onHand']
        oid = await buy(shop, base, 'almond-croissant')
        check('order placed in the shop', oid, oid)
        try:
            await admin.locator(f'.table >> text={oid}').first.wait_for(timeout=6000)
            check('new order appears in the admin without refresh', True)
        except Exception:
            check('new order appears in the admin without refresh', False)
        check('new order is announced (toast)', await admin.locator('.ad-toast', has_text=oid).count() > 0)
        check('live region announces the new order', oid in (await admin.text_content('.ad-sr[role=status]') or ''))
        flour1 = (await stock(shop, 'flour'))['onHand']
        check('placing the order consumed stock', flour1 < flour0, f'{flour0} -> {flour1}')
        o = await order_of(shop, oid)
        check('order carries the simulated payment reference', (o or {}).get('paymentReference', '').startswith('SIM-'), (o or {}).get('paymentReference'))

        await go(admin, base, '/admin/orders')
        await go(shop, base, f'/track/{oid}', 1000)
        for target, words in [('PREPARING', 'baking'), ('READY', 'ready'), ('OUT_FOR_DELIVERY', 'on the way'), ('DELIVERED', 'here')]:
            await admin.locator(f'tr:has-text("{oid}") button.btn-sm').first.click()
            await admin.wait_for_timeout(500)
            st = (await order_of(admin, oid))['status']
            check(f'admin moves the order to {target}', st == target, st)
            try:
                await shop.wait_for_function(f"document.body.innerText.toLowerCase().includes({json.dumps(words)})", timeout=6000)
                check(f'customer tracking shows {target} without refresh', True)
            except Exception:
                check(f'customer tracking shows {target} without refresh', False, (await shop.text_content('h1') or '')[:80])
        await admin.wait_for_timeout(2500)
        jobs = [j for j in (await ls(admin, 'tresor-automation-jobs', []) or []) if j['orderId'] == oid]
        check('automations ran for the order (invoice + confirmation + 4 updates)', len(jobs) >= 6 and all(j['status'] == 'succeeded' for j in jobs), [(j['topic'], j['status']) for j in jobs])
        await go(admin, base, '/admin/automations')
        check('automations monitor lists the order', await admin.locator(f'tr[data-order="{oid}"]').count() >= 6)
        await go(admin, base, f'/admin/orders/{oid}')
        tl = await admin.text_content('.ad-timeline') or ''
        check('order timeline shows created, payment, invoice, WhatsApp, every status', all(w in tl for w in ['Order created', 'Paid by UPI', 'Invoice generated', 'WhatsApp sent', 'Preparing', 'Ready', 'Out for delivery', 'Delivered']), tl[:200])

        # ---------- 2. Cancel before production restores stock; refund flow ----------
        butter0 = (await stock(shop, 'butter'))['onHand']
        oid2 = await buy(shop, base, 'pain-au-chocolat')
        butter1 = (await stock(shop, 'butter'))['onHand']
        check('second order consumed butter', butter1 < butter0, f'{butter0} -> {butter1}')
        await go(admin, base, '/admin/orders')
        await admin.locator(f'tr:has-text("{oid2}") button:has-text("Cancel")').click()
        modal_text = await admin.text_content('.ad-modal') or ''
        check('cancel confirmation shows the stock impact', 'Stock goes back' in modal_text and 'refund pending' in modal_text, modal_text[:160])
        await admin.locator('.ad-modal [data-confirm]').click()  # no reason yet
        check('cancel requires a reason', await admin.locator('.ad-modal .ad-error').count() > 0)
        await confirm(admin, 'Customer called to cancel')
        o2 = await order_of(admin, oid2)
        check('order cancelled, payment refund pending', o2['status'] == 'CANCELLED' and o2['paymentStatus'] == 'REFUND_PENDING', (o2['status'], o2['paymentStatus']))
        check('cancel before production restored the stock', abs((await stock(admin, 'butter'))['onHand'] - butter0) < 1e-6)
        await go(admin, base, f'/admin/orders/{oid2}')
        await admin.locator('button:has-text("Mark refund completed")').click()
        await confirm(admin, 'Refunded via UPI')
        check('refund recorded', (await order_of(admin, oid2))['paymentStatus'] == 'REFUNDED')

        # ---------- 3. Manual restock → inventory + audit ----------
        await go(admin, base, '/admin/inventory?item=flour')
        before = (await stock(admin, 'flour'))['onHand']
        await field(admin.locator('.ad-drawer'), 'Amount (kg)').fill('2')
        await admin.locator('.ad-drawer button:has-text("Record restock")').click()
        await admin.wait_for_timeout(500)
        after = (await stock(admin, 'flour'))['onHand']
        check('manual restock adds to stock', abs(after - before - 2) < 1e-6, f'{before} -> {after}')
        await admin.locator('.ad-chip:has-text("Wastage")').click()
        await field(admin.locator('.ad-drawer'), 'Amount (kg)').fill('0.5')
        await admin.locator('.ad-drawer button:has-text("Record wastage")').click()
        check('wastage without a reason is refused', await admin.locator('.ad-drawer .ad-error').count() > 0)
        await admin.locator('.ad-chip:has-text("Reserve")').click()
        await field(admin.locator('.ad-drawer'), 'Amount (kg)').fill('1')
        await field(admin.locator('.ad-drawer'), 'Reason').fill('Saturday wedding order')
        await admin.locator('.ad-drawer button:has-text("Record reserve")').click()
        await admin.wait_for_timeout(400)
        check('reserve sets stock aside', abs((await stock(admin, 'flour')).get('reserved', 0) - 1) < 1e-6)
        audit = await ls(admin, 'tresor-audit', [])
        check('inventory movements are audited', {'inventory.restock', 'inventory.reserve'} <= {r['action'] for r in audit})

        # ---------- 4. Custom cake → production sheet → internal note → status ----------
        await go(shop, base, '/customize', 1500)
        await shop.locator('.studio-bar .btn-brand').click()
        await shop.wait_for_selector('.added-card', timeout=15000)
        oid3 = await checkout(shop, base, 'Card')
        check('custom cake ordered', oid3, oid3)
        await go(admin, base, f'/admin/custom-cakes?order={oid3}', 1300)
        check('custom cake appears in production', await admin.locator(f'.cc-item:has-text("{oid3}")').count() > 0)
        check('production sheet has the full spec', await admin.locator('.spec-row').count() >= 15, await admin.locator('.spec-row').count())
        note = 'Use the 6-inch gold ring E2E'
        await admin.locator('input[aria-label="Add a production note"]').fill(note)
        await admin.locator('button:has-text("Add note")').click()
        await admin.wait_for_timeout(500)
        check('internal note saved and shown to staff', await admin.locator('.ad-internal', has_text=note).count() > 0)
        await admin.wait_for_timeout(1500)
        inv = (await ls(admin, 'tresor-invoices', {}) or {}).get(oid3)
        check('internal note never reaches the invoice', inv is not None and note not in json.dumps(inv))
        check('internal note never reaches the order record', note not in json.dumps(await order_of(admin, oid3)))
        await go(shop, base, f'/track/{oid3}', 900)
        check('internal note never reaches the tracking page', note not in (await shop.text_content('body') or ''))
        await admin.locator('button:has-text("Start production")').click()
        await admin.wait_for_timeout(500)
        await admin.locator('button:has-text("Mark ready")').click()
        await admin.wait_for_timeout(500)
        check('custom cake moved to production and ready', (await order_of(admin, oid3))['status'] == 'READY')
        await go(admin, base, '/admin/kitchen')
        check('kitchen board shows the custom ticket distinctly', await admin.locator(f'.ad-ticket.is-custom:has-text("{oid3}")').count() > 0)

        # ---------- 5. Product price + archive → shop; history unchanged ----------
        await go(admin, base, '/admin/products?p=almond-croissant')
        await field(admin.locator('.ad-drawer'), 'Price (₹)').fill('210')
        await admin.locator('.ad-drawer button:has-text("Save changes")').click()
        modal_text = await admin.text_content('.ad-modal') or ''
        check('price change confirmation explains past orders keep their price', 'keep the price' in modal_text, modal_text[:120])
        await confirm(admin, 'New butter prices')
        await go(shop, base, '/shop/almond-croissant', 900)
        check('shop shows the new price', '₹210' in (await shop.text_content('.price-lg') or ''), await shop.text_content('.price-lg'))
        o = await order_of(shop, oid)
        check('existing order keeps the price it was sold at', o['items'][0]['unitPrice'] == 190, o['items'][0]['unitPrice'])
        await go(admin, base, '/admin/products?p=pistachio-tart')
        await admin.locator('.ad-drawer button:has-text("Archive")').click()
        await confirm(admin, 'Out of season')
        await go(shop, base, '/shop/pistachio-tart', 900)
        check('archived product leaves the shop', 'No longer on the menu' in (await shop.text_content('body') or ''))
        await go(admin, base, '/admin/products?status=ARCHIVED&p=pistachio-tart')
        await admin.locator('.ad-drawer button:has-text("Restore")').click()
        await admin.wait_for_timeout(400)
        cat = await ls(admin, 'tresor-catalog', {})
        check('restore brings it back (disabled until activated)', cat.get('pistachio-tart', {}).get('status') == 'INACTIVE')
        await go(admin, base, '/admin/products')
        await admin.locator('button:has-text("New product")').click()
        await admin.locator('.ad-drawer button:has-text("Create product")').click()
        check('product validation shows errors', await admin.locator('.ad-drawer .ad-error').count() >= 2)
        await admin.keyboard.press('Escape')

        # ---------- 6. Cake Builder price → playground ----------
        await go(shop, base, '/customize', 1200)
        await shop.wait_for_timeout(1300)
        p0 = int(re.sub(r'[^\d]', '', await shop.text_content('.price-toggle strong') or '0') or 0)
        await go(admin, base, '/admin/cake-builder?section=sponge')
        await admin.locator('tr:has-text("Vanilla bean") button:has-text("Edit")').click()
        await field(admin.locator('.ad-drawer'), 'Price (₹)').fill('100')
        await admin.locator('.ad-drawer button:has-text("Save")').click()
        await confirm(admin, 'Vanilla bean costs rose')
        await go(shop, base, '/customize', 1200)
        await shop.wait_for_timeout(1300)
        p1 = int(re.sub(r'[^\d]', '', await shop.text_content('.price-toggle strong') or '0') or 0)
        check('Cake Builder price change reaches the playground', p1 - p0 == 100, f'{p0} -> {p1}')
        o3 = await order_of(admin, oid3)
        check('placed custom cake keeps its price', o3['items'][0]['unitPrice'] == p0, (o3['items'][0]['unitPrice'], p0))

        # ---------- 7. Settings: delivery fee → cart ----------
        await go(admin, base, '/admin/settings?section=delivery')
        await field(admin.locator('.ad-panel'), 'Delivery fee (₹)').fill('90')
        await admin.locator('.ad-panel-actions button:has-text("Save")').click()
        await confirm(admin, 'Rider costs')
        await go(shop, base, '/shop/chocolate-brownie', 700)
        await shop.locator('.full-btn').first.click()
        await shop.wait_for_url('**/cart', timeout=8000)
        await shop.wait_for_timeout(700)
        check('cart uses the new delivery fee', '₹90' in (await shop.text_content('.summary-panel') or ''))
        await go(admin, base, '/admin/settings?section=delivery')
        await field(admin.locator('.ad-panel'), 'Delivery fee (₹)').fill('70')
        await admin.locator('.ad-panel-actions button:has-text("Save")').click()
        await confirm(admin, 'Back to 70')

        # ---------- 8. Permissions ----------
        await go(admin, base, '/admin')
        await admin.locator('select[aria-label="Demo staff role"]').select_option('staff-kitchen')
        await go(admin, base, '/admin/products')
        check('kitchen staff cannot open products', await admin.locator('.ad-noaccess').count() > 0)
        check('kitchen staff do not see restricted nav', await admin.locator('.ad-nav a:has-text("Products")').count() == 0 and await admin.locator('.ad-nav a:has-text("Kitchen")').count() == 1)
        await go(admin, base, f'/admin/orders/{oid}')
        check('kitchen staff see masked customer contact', '9845012345' not in (await admin.text_content('.ad-detail') or ''))
        await admin.locator('select[aria-label="Demo staff role"]').select_option('staff-owner')
        await admin.wait_for_timeout(400)

        # ---------- 9. Global search ----------
        await go(admin, base, '/admin')
        await admin.keyboard.press('Control+k')
        await admin.locator('.ad-palette input').fill(oid)
        await admin.wait_for_timeout(400)
        types = await admin.locator('.ad-palette-type').all_text_contents()
        check('search by order number finds order, customer and invoice', {'Order', 'Customer', 'Invoice'} <= set(types), types)
        await admin.keyboard.press('Escape')

        # ---------- 10. Bulk confirm with auto-confirm off ----------
        await go(admin, base, '/admin/settings?section=ordering')
        await admin.locator('label.ad-toggle:has-text("Auto-confirm new orders") input').uncheck()
        await admin.locator('.ad-panel-actions button:has-text("Save")').click()
        await confirm(admin, 'Staff confirm orders today')
        n1 = await buy(shop, base, 'chocolate-brownie')
        n2 = await buy(shop, base, 'tresor-latte')
        check('with auto-confirm off, orders arrive NEW', (await order_of(shop, n1))['status'] == 'NEW' and (await order_of(shop, n2))['status'] == 'NEW')
        await go(admin, base, '/admin/orders?filter=NEW')
        for x in (n1, n2):
            await admin.locator(f'input[aria-label="Select {x}"]').check()
        await admin.locator('.ad-bulkbar button:has-text("Confirm")').click()
        await confirm(admin)
        await admin.wait_for_timeout(500)
        check('bulk confirm moved both orders', (await order_of(admin, n1))['status'] == 'CONFIRMED' and (await order_of(admin, n2))['status'] == 'CONFIRMED')
        await go(admin, base, '/admin/settings?section=ordering')
        await admin.locator('label.ad-toggle:has-text("Auto-confirm new orders") input').check()
        await admin.locator('.ad-panel-actions button:has-text("Save")').click()
        await confirm(admin, 'Back to auto-confirm')

        # ---------- 11. Export reflects the filter ----------
        await go(admin, base, '/admin/orders?filter=CANCELLED')
        async with admin.expect_download() as dl:
            await admin.locator('button:has-text("Export view")').click()
        path = await (await dl.value).path()
        rows = open(path, encoding='utf-8').read().strip().split('\n')
        cancelled = len([o for o in await ls(admin, 'tresor-orders', []) if o['status'] == 'CANCELLED'])
        check('CSV export contains exactly the filtered orders', len(rows) - 1 == cancelled, f'{len(rows) - 1} vs {cancelled}')

        # ---------- 12. Failure → attention → retry ----------
        await shop.evaluate("localStorage.setItem('tresor-mock-faults', JSON.stringify({whatsapp: 'fail-always'}))")
        f_oid = await buy(shop, base, 'cold-brew')
        await shop.wait_for_timeout(4500)
        job = next((j for j in await ls(shop, 'tresor-automation-jobs', []) if j['id'] == f'whatsapp:{f_oid}:confirmation'), None)
        check('WhatsApp failure leaves the job failed, order safe', job and job['status'] == 'failed' and (await order_of(shop, f_oid))['status'] == 'CONFIRMED', job and job['status'])
        await go(admin, base, '/admin', 1000)
        check('failure appears in needs-attention', await admin.locator('.ad-attn', has_text=f'WhatsApp failed for {f_oid}').count() > 0)
        await shop.evaluate("localStorage.removeItem('tresor-mock-faults')")
        await go(admin, base, '/admin/automations?filter=FAILED')
        await admin.locator(f'tr[data-order="{f_oid}"] button.job-retry').click()
        await admin.wait_for_timeout(2500)
        job = next((j for j in await ls(admin, 'tresor-automation-jobs', []) if j['id'] == f'whatsapp:{f_oid}:confirmation'), None)
        check('retry succeeds once the provider recovers', job and job['status'] == 'succeeded', job and job['status'])

        # ---------- 13. Invoice regenerate keeps the number ----------
        await go(admin, base, f'/admin/invoices?q={oid}')
        inv0 = (await ls(admin, 'tresor-invoices', {}))[oid]
        await admin.locator(f'tr[data-order="{oid}"] button:has-text("Regenerate")').click()
        await confirm(admin, 'Customer asked for a copy')
        inv1 = (await ls(admin, 'tresor-invoices', {}))[oid]
        check('regenerated invoice keeps its number and adds a revision', inv1['invoiceNumber'] == inv0['invoiceNumber'] and inv1.get('revision') == 2, (inv1['invoiceNumber'], inv1.get('revision')))
        check('regenerated invoice still matches the order (snapshot, not new prices)', inv1['total'] == (await order_of(admin, oid))['total'])

        # ---------- 14. Campaign publish, announcement live ----------
        await go(admin, base, '/admin/campaigns')
        await admin.locator('button:has-text("New campaign")').first.click()
        await field(admin.locator('.ad-drawer'), 'Name').fill('Diwali cakes E2E')
        await admin.locator('.ad-drawer button:has-text("Save draft")').click()
        await admin.wait_for_timeout(500)
        await admin.locator('.ad-drawer button:has-text("Publish")').click()
        await confirm(admin, 'Approved for the festival')
        camp = next((c for c in await ls(admin, 'tresor-campaigns', []) if c['name'] == 'Diwali cakes E2E'), None)
        check('campaign published after approval', camp and camp['status'] == 'SCHEDULED', camp and camp['status'])
        await admin.keyboard.press('Escape')
        await go(admin, base, '/admin/content')
        await admin.locator('button:has-text("New announcement")').click()
        await admin.locator('label.ad-field:has(> span:text-matches("^Text")) input').fill('Closed on 1 November E2E')
        await admin.locator('label.ad-toggle:has-text("Show on the shop") input').check()
        await admin.locator('button:has-text("Publish")').click()
        await confirm(admin, 'Festival closure')
        await go(shop, base, '/', 1200)
        check('announcement shows on the shop', 'Closed on 1 November E2E' in (await shop.text_content('.announce-bar') or '') if await shop.locator('.announce-bar').count() else False)

        # ---------- 15. Analytics traceable; audit complete ----------
        await go(admin, base, '/admin/analytics')
        kpi = await admin.locator('.ad-kpi:has(.ad-kpi-label:text-is("Orders")) .ad-kpi-value').text_content()
        week = time.time() * 1000 - 7 * 86400000
        all_orders = await ls(admin, 'tresor-orders', [])
        expected = len([o for o in all_orders if o['status'] != 'CANCELLED' and time.mktime(time.strptime(o['createdAt'][:19], '%Y-%m-%dT%H:%M:%S')) * 1000 - time.timezone * 1000 >= week])
        check('analytics order count matches the records', int(kpi) == expected, f'{kpi} vs {expected}')
        actions = {r['action'] for r in await ls(admin, 'tresor-audit', [])}
        want = {'order.status.changed', 'order.cancelled', 'order.refunded', 'inventory.restock', 'customCake.note.added', 'product.price.changed', 'product.archived', 'cake.option.price.changed', 'settings.changed', 'session.switched', 'automation.retried', 'invoice.regenerated', 'campaign.published', 'content.announcement.published'}
        check('every management action is in the audit log', want <= actions, sorted(want - actions))
        await go(admin, base, '/admin/audit')
        check('audit log page lists the records', await admin.locator('.table tbody tr').count() >= 10)
        check('no uncaught page errors during the run', not errors, errors[:3])

        await browser.close()
    ok = all(c['ok'] for c in CHECKS)
    os.makedirs(OUT, exist_ok=True)
    json.dump({'base': base, 'seconds': round(time.time() - t0), 'passed': sum(c['ok'] for c in CHECKS), 'total': len(CHECKS), 'checks': CHECKS}, open(os.path.join(OUT, 'admin-e2e.json'), 'w', encoding='utf-8'), indent=1)
    print(f"\n{sum(c['ok'] for c in CHECKS)}/{len(CHECKS)} checks passed in {round(time.time() - t0)} s")
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    asyncio.run(main())
