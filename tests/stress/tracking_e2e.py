"""End-to-end test for live order tracking (needs the dev server: dev controls exist only there).
  python tests/stress/tracking_e2e.py --base http://localhost:3002
Screenshots → .tresor/test-results/screenshots/tracking/ ; results → tracking-results.json"""
import argparse, asyncio, json, os, time
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', '.tresor', 'test-results')
SHOTS = os.path.join(OUT, 'screenshots', 'tracking')
WIDTHS = [(1440, 900), (1024, 768), (768, 1024), (430, 932), (390, 844), (375, 812)]
STATES = ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED']
HEAD = {'NEW': 'We’ve got your order.', 'CONFIRMED': 'confirmed', 'PREPARING': 'baking', 'READY': 'is ready', 'OUT_FOR_DELIVERY': 'on the way', 'DELIVERED': 'It’s here.'}
checks = []

def check(name, ok, detail=''):
    checks.append({'name': name, 'ok': bool(ok), 'detail': detail})
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail and not ok else ''), flush=True)

async def place_order(page, base, custom=False):
    if custom:
        await page.goto(base + '/customize', wait_until='load'); await page.wait_for_selector('.studio-stage')
        await page.locator('.step-tabs button:has-text("Personalise")').evaluate('e => e.click()')
        await page.fill('#cake-message', 'Happy Birthday')
        await page.locator('.studio-bar .btn-brand').click(); await page.wait_for_selector('.added-card', timeout=15000)
    else:
        await page.goto(base + '/shop/tresor-latte', wait_until='load'); await page.wait_for_timeout(800)
        await page.locator('.full-btn').click(); await page.wait_for_url('**/cart')
    await page.goto(base + '/checkout', wait_until='load'); await page.wait_for_timeout(900)
    await page.fill('#f-name', 'Tracking Test'); await page.fill('#f-phone', '9845012345'); await page.fill('#f-address', '12 Test Road, Indiranagar')
    await page.locator('button.full-btn:has-text("Place order")').click()
    await page.wait_for_url('**/order-confirmed**', timeout=20000)
    return page.url.split('id=')[1].split('&')[0]

async def headline(page):
    return (await page.text_content('.track-headline') or '').strip()

async def wait_headline(page, needle, timeout=6):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if needle.lower() in (await headline(page)).lower():
            return round((time.time() - t0) * 1000)
        await page.wait_for_timeout(100)
    return None

async def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--base', default='http://localhost:3002'); args = ap.parse_args()
    base = args.base
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900})
        page = await ctx.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)[:200]))
        oid = await place_order(page, base)
        await page.locator('a:has-text("Track my order")').click()
        await page.wait_for_url(f'**/track/{oid}', timeout=10000)
        await page.wait_for_selector('.track-headline')
        check('opens /track/:orderId from the confirmation', True)
        check('initial state is confirmed', 'confirmed' in (await headline(page)).lower(), await headline(page))
        check('order number shown', await page.locator(f'text=#{oid}').count() > 0)
        check('ETA shown', await page.locator('.track-eta strong').count() > 0, await page.text_content('.track-eta') or '')

        # Admin in another tab drives the order; the tracking tab must follow without a refresh.
        admin = await ctx.new_page()
        await admin.goto(base + '/admin/orders', wait_until='load'); await admin.wait_for_timeout(900)
        for target in ['PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED']:
            btn = admin.locator(f'tr:has-text("{oid}") button.btn-sm').first
            await btn.click()
            ms = await wait_headline(page, HEAD[target])
            check(f'admin → {target} reaches the customer without refresh', ms is not None, await headline(page))
            await page.wait_for_timeout(900)
            await page.screenshot(path=os.path.join(SHOTS, f'admin-sync-{target.lower()}.jpg'), type='jpeg', quality=60)
        cur = await page.locator('.tl-step[aria-current=step] strong').first.text_content()
        check('timeline marks the current step', cur.strip() == 'Delivered', cur)
        times = await page.eval_on_selector_all('.tl-step time', 'els => els.map(e => e.textContent)')
        check('timeline shows a time for each completed step', len(times) >= 5, str(times))
        await page.wait_for_timeout(2500)
        outbox = [m for m in json.loads(await page.evaluate("localStorage.getItem('tresor-whatsapp-outbox') || '[]'")) if m['orderId'] == oid]
        topics = sorted(':'.join(m['jobId'].split(':')[2:]) for m in outbox)
        check('one WhatsApp per status change, from the same events', topics == sorted(['confirmation', 'status:PREPARING', 'status:READY', 'status:OUT_FOR_DELIVERY', 'status:DELIVERED']), str(topics))
        prep = next((m['text'] for m in outbox if m['jobId'].endswith('status:PREPARING')), '')
        check('WhatsApp uses the tracking copy', 'STATUS: PREPARING' in prep and 'We’re preparing your Tresor order.' in prep, prep.replace('\n', ' | '))
        events = [e for e in json.loads(await page.evaluate("localStorage.getItem('tresor-order-events') || '[]'")) if e['orderId'] == oid]
        check('status events carry previous/current/source', all({'previousStatus', 'currentStatus', 'source', 'eventId', 'timestamp'} <= set(e) for e in events) and [e['currentStatus'] for e in events][-4:] == ['PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'], str([(e['previousStatus'], e['currentStatus'], e['source']) for e in events]))

        # Invalid transition pushed into the stream: rejected.
        await page.evaluate("""(id) => window.dispatchEvent(new CustomEvent('tresor-order-status', { detail: { eventId: 'bogus', orderId: id, previousStatus: 'DELIVERED', currentStatus: 'PREPARING', timestamp: new Date().toISOString(), estimatedReadyAt: null, estimatedDeliveryAt: null, source: 'admin' } }))""", oid)
        await page.wait_for_timeout(800)
        check('invalid DELIVERED → PREPARING is rejected', 'here' in (await headline(page)).lower(), await headline(page))

        # Each state through the dev controls, at six widths.
        for s in STATES:
            await page.locator(f'.track-dev button[data-status="{s}"]').click()
            ms = await wait_headline(page, HEAD[s])
            check(f'dev control → {s}', ms is not None, await headline(page))
            await page.wait_for_timeout(1300)
            scene = await page.get_attribute('.track-scene', 'class')
            check(f'{s} has its own scene', f'scene-{s.lower()}' in (scene or ''), scene or '')
            for w, h in WIDTHS:
                await page.set_viewport_size({'width': w, 'height': h}); await page.wait_for_timeout(350)
                if w == 1440:
                    pass
                await page.screenshot(path=os.path.join(SHOTS, f'{s.lower()}-{w}.jpg'), type='jpeg', quality=60)
                over = await page.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1')
                if over:
                    check(f'{s} at {w}px has no sideways scroll', False)
            await page.set_viewport_size({'width': 1440, 'height': 900})

        # Reconnect: drop, change twice meanwhile, reconnect → one reconciled state, no replay.
        await page.locator('.track-dev button[data-status="PREPARING"]').click(); await wait_headline(page, 'baking')
        await page.locator('.track-dev button:has-text("Drop connection")').click()
        await page.wait_for_timeout(300)
        check('shows a gentle updating message while disconnected', await page.locator('.track-whisper:has-text("Updating your order")').count() > 0)
        await admin.reload(); await admin.wait_for_timeout(900)
        await admin.locator(f'tr:has-text("{oid}") button.btn-sm').first.click(); await admin.wait_for_timeout(300)
        await admin.locator(f'tr:has-text("{oid}") button.btn-sm').first.click(); await admin.wait_for_timeout(300)
        check('missed events are not shown during the gap', 'baking' in (await headline(page)).lower(), await headline(page))
        seen = set()
        t0 = time.time()
        while time.time() - t0 < 7:
            seen.add((await headline(page)).strip())
            await page.wait_for_timeout(120)
        check('after reconnect, jumps straight to the latest state', 'on the way' in (await headline(page)).lower(), await headline(page))
        check('missed steps are not replayed', not any('ready' in s.lower() for s in seen), str(seen))

        # Refresh keeps the state.
        await page.reload(); await page.wait_for_selector('.track-headline')
        check('refresh keeps the current state', 'on the way' in (await headline(page)).lower())

        # Play the whole journey through the admin path.
        await page.locator('.track-dev button:has-text("Play order journey")').click()
        ms = await wait_headline(page, 'It’s here.', timeout=20)
        check('"Play order journey" runs NEW → DELIVERED', ms is not None, await headline(page))

        # Unknown order.
        await page.goto(base + '/track/TRS-99999', wait_until='load'); await page.wait_for_timeout(1200)
        check('unknown order explains itself with Try again', await page.locator('text=We couldn’t find #TRS-99999').count() > 0 and await page.locator('button:has-text("Try again")').count() > 0)
        # Old address redirects.
        await page.goto(base + f'/track-order?id={oid}', wait_until='load'); await page.wait_for_timeout(1500)
        check('/track-order?id= redirects to /track/:id', page.url.endswith(f'/track/{oid}'), page.url)

        # Custom cake order.
        cid = await place_order(page, base, custom=True)
        await page.goto(base + f'/track/{cid}', wait_until='load'); await page.wait_for_selector('.track-headline')
        check('custom cake headline', 'your cake is confirmed' in (await headline(page)).lower(), await headline(page))
        eta = await page.text_content('.track-eta') or ''
        check('custom cake ETA is production-aware', 'Earliest ready' in eta and 'needs about' in eta, eta)
        await page.locator('.track-cake summary').click(); await page.wait_for_timeout(500)
        check('custom cake details with its preview', await page.locator('.track-cake .cake-preview').count() > 0 and await page.locator('.track-cake >> text=Happy Birthday').count() > 0)
        await page.locator('.track-dev button[data-status="PREPARING"]').click(); await wait_headline(page, 'being made')
        await page.wait_for_timeout(1200)
        await page.screenshot(path=os.path.join(SHOTS, 'custom-cake-preparing-1440.jpg'), type='jpeg', quality=60, full_page=True)
        await page.locator('.track-dev button[data-status="DELIVERED"]').click(); await wait_headline(page, 'here')
        await page.wait_for_timeout(1800)
        await page.screenshot(path=os.path.join(SHOTS, 'custom-cake-delivered-1440.jpg'), type='jpeg', quality=60)
        check('no page errors', not errors, '; '.join(errors[:3]))
        await ctx.close()

        # Reduced motion: same information, no continuous loops.
        rm = await b.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
        rp = await rm.new_page()
        await rp.goto(base + '/shop/tresor-latte', wait_until='load')
        rid = await place_order(rp, base)
        await rp.goto(base + f'/track/{rid}', wait_until='load'); await rp.wait_for_selector('.track-headline')
        await rp.locator('.track-dev button[data-status="PREPARING"]').click(); await rp.wait_for_timeout(1500)
        anim = await rp.evaluate("getComputedStyle(document.querySelector('.tl-pulse')).animationName")
        check('reduced motion: status, timeline and ETA still present', await rp.locator('.track-timeline .tl-step').count() == 6 and await rp.locator('.track-eta').count() == 1)
        check('reduced motion: continuous loops off', anim == 'none', anim)
        await rp.screenshot(path=os.path.join(SHOTS, 'reduced-motion-390.jpg'), type='jpeg', quality=60, full_page=True)
        await rm.close()
        await b.close()
    json.dump(checks, open(os.path.join(OUT, 'tracking-results.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(f"\n{sum(c['ok'] for c in checks)}/{len(checks)} passed")

asyncio.run(main())
