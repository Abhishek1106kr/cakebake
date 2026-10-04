"""
Tresor 100-client stress test (frontend + mock automations). No backend.

Each client is a fresh browser context (a separate customer with its own
storage), with a seed, persona, device and journey. Every check records a
severity; nothing is retried silently or marked as passed when it failed.

  python tests/stress/run_clients.py                  # all 100 clients
  python tests/stress/run_clients.py --client CLIENT-074 [--client ...]
  python tests/stress/run_clients.py --base http://localhost:3004

Requires Python Playwright with Chromium. Run tests/stress/make_fixtures.py and
`node tests/stress/export-catalogue.mjs` first.
"""
import argparse, asyncio, base64, datetime as dt, json, os, random, re, time, traceback
from playwright.async_api import async_playwright, Page, BrowserContext

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
FIX = os.path.join(HERE, 'fixtures')
OUT = os.path.join(ROOT, '.tresor', 'test-results')
SHOTS = os.path.join(OUT, 'screenshots')
CAT = json.load(open(os.path.join(HERE, 'catalogue.json'), encoding='utf-8'))
MASTER_SEED = 20261004

SEV_PENALTY = {'P0': 50, 'P1': 25, 'P2': 10, 'P3': 4, 'P4': 1}

PRODUCTS = ['almond-croissant', 'pain-au-chocolat', 'tresor-latte', 'cold-brew', 'basque-cheesecake', 'pistachio-tart', 'chocolate-brownie',
            'citrus-tea', 'mushroom-toast', 'truffle-fries', 'berry-parfait', 'matcha-cloud', 'rose-chocolate-truffle', 'chocolate-truffle',
            'pistachio-cake', 'black-forest-cherry', 'hazelnut-crunch', 'strawberry-cream', 'vanilla-berry', 'mango-passion', 'salted-caramel']
DRINKS = {'tresor-latte', 'cold-brew', 'citrus-tea', 'matcha-cloud'}
QUERIES = ['something chocolatey', 'a cold coffee', 'nutty pastry', 'pistachoi', 'light and refreshing', 'birthday cake for 8', 'eggless', 'something warm']
MESSAGES = {
    'empty': '', 'short': 'Yay!', 'medium': 'Happy Birthday Aanya', 'long': 'Happy Birthday to our dearest Aanya',
    'very-long': 'Happy Birthday to the most wonderful, kind and brilliant Aanya ever',
    'special': 'Congrats! #1 & 100% <3', 'numbers': 'Happy 30th 1996-2026', 'emoji': 'Happy Birthday 🎂✨',
    'multiline': 'Happy Birthday\nAanya', 'spaces': '   Happy Anniversary   ', 'hindi': 'जन्मदिन मुबारक', 'tamil': 'பிறந்தநாள் வாழ்த்துக்கள்',
}

# ---------- client plan ----------

GROUPS = ([('standard', 20), ('custom', 20), ('print', 10), ('saved', 10), ('share', 10), ('abandon', 10),
           ('payment-failure', 5), ('invalid-custom', 5), ('invalid-upload', 5), ('edit-reset', 5)])
DEVICES = [('desktop', 1440, 900), ('desktop', 1280, 800), ('desktop', 1024, 768), ('tablet', 768, 1024), ('mobile', 430, 932), ('mobile', 390, 844), ('mobile', 375, 812)]

def plan():
    r = random.Random(MASTER_SEED)
    journeys = [g for g, n in GROUPS for _ in range(n)]
    r.shuffle(journeys)
    devices = (['desktop'] * 40) + (['tablet'] * 20) + (['mobile'] * 40)
    r.shuffle(devices)
    clients = []
    for i, (journey, kind) in enumerate(zip(journeys, devices)):
        seed = MASTER_SEED + i * 7919
        cr = random.Random(seed)
        dev = cr.choice([d for d in DEVICES if d[0] == kind])
        faults = {}
        chaos = []
        if journey in ('standard', 'custom', 'print'):
            roll = cr.random()
            if roll < 0.12: faults['invoice'] = 'fail-once'
            elif roll < 0.18: faults['invoice'] = 'fail-always'
            roll = cr.random()
            if roll < 0.12: faults['whatsapp'] = 'timeout-once'
            elif roll < 0.18: faults['whatsapp'] = 'fail-always'
            chaos = [c for c in ['double-click', 'refresh-checkout', 'refresh-confirmation', 'back-button', 'slow-payment', 'resize', 'admin-realtime', 'status-flow', 'two-cakes', 'duplicate-trigger'] if cr.random() < 0.18]
        if journey == 'payment-failure':
            faults['payment'] = ['decline', 'timeout', 'cancel', 'fail-once', 'decline'][i % 5]
        persona = {
            'standard': cr.choice(['first-time', 'returning', 'coffee-pastry', 'cake-only', 'high-value', 'price-sensitive', 'impatient', 'exploratory']),
            'custom': cr.choice(['custom-cake', 'celebration', 'surprise-me', 'edits-repeatedly', 'long-message', 'unavailable-option']),
            'print': 'uploads-image', 'saved': 'saves-design', 'share': 'share-link', 'abandon': cr.choice(['abandons-cart', 'abandons-customizer', 'abandons-search']),
            'payment-failure': 'payment-failure', 'invalid-custom': 'invalid-combination', 'invalid-upload': 'invalid-upload', 'edit-reset': 'resets-repeatedly',
        }[journey]
        clients.append({'clientId': f'CLIENT-{i + 1:03d}', 'seed': seed, 'journey': journey, 'persona': persona, 'device': {'kind': dev[0], 'width': dev[1], 'height': dev[2]}, 'faults': faults, 'chaos': chaos})
    return clients

# ---------- independent expectations (from the catalogue data, not the app engine) ----------

def opt(group, oid):
    return next((o for o in CAT[group] if o['id'] == oid), None)

def expected_price(c):
    total = opt('sizes', c['size'])['price'] + opt('shapes', c['shape'])['price']
    for g, key in [('sponges', 'sponge'), ('fillings', 'filling'), ('frostings', 'frosting'), ('finishes', 'finish'), ('colors', 'color'), ('packaging', 'packaging')]:
        total += opt(g, c[key])['price']
    for t in c['toppings']:
        o = opt('toppings', t['id']); total += o['perUnit'] * t['qty'] + o['price']
    for d in c['decorations']:
        total += opt('decorations', d)['price']
    total += opt('toppers', c['topper']['id'])['price'] + opt('candles', c['candles']['id'])['price']
    if c['print']['enabled']:
        total += CAT['printRules']['price']
    return total

def expected_hours(c):
    h = CAT['BASE_PRODUCTION_HOURS']
    for g, key in [('sizes', 'size'), ('shapes', 'shape'), ('sponges', 'sponge'), ('fillings', 'filling'), ('frostings', 'frosting'), ('finishes', 'finish')]:
        h += opt(g, c[key]).get('productionHours') or 0
    h += opt('toppers', c['topper']['id']).get('productionHours') or 0
    if c['print']['enabled']:
        h += CAT['printRules']['productionHours']
    return h

def first_slot_label(now, hours):
    earliest = now + dt.timedelta(hours=hours)
    day = earliest.replace(hour=0, minute=0, second=0, microsecond=0)
    for d in range(14):
        for a, b in [(10, 12), (14, 16), (18, 20)]:
            start = day + dt.timedelta(days=d, hours=a)
            if start >= earliest:
                return f"{start.strftime('%a')}, {start.day} {start.strftime('%b')} · {a:02d}:00–{b}:00"

def inr(n):
    """Indian digit grouping, like toLocaleString('en-IN')."""
    s = str(int(n))
    if len(s) <= 3:
        return s
    head, tail = s[:-3], s[-3:]
    parts = []
    while len(head) > 2:
        parts.insert(0, head[-2:]); head = head[:-2]
    if head:
        parts.insert(0, head)
    return ','.join(parts) + ',' + tail


# ---------- per-client recorder ----------

class Rec:
    def __init__(self, client):
        self.c = client
        self.checks = []
        self.notes = []
        self.orders = []
        self.journey_state = 'started'
        self.metrics = {}
        self.events_expected = set()

    def check(self, name, ok, sev='P2', area='frontend', detail='', where=''):
        self.checks.append({'name': name, 'ok': bool(ok), 'severity': sev, 'area': area, 'detail': detail, 'where': where})
        return ok

    def note(self, msg):
        self.notes.append(msg)

    def result(self):
        fails = [c for c in self.checks if not c['ok']]
        score = lambda area: max(0, 100 - sum(SEV_PENALTY[c['severity']] for c in fails if c['area'] == area))
        crit = [c for c in fails if c['severity'] in ('P0', 'P1')]
        return {
            'clientId': self.c['clientId'], 'seed': self.c['seed'], 'persona': self.c['persona'], 'journeyType': self.c['journey'],
            'device': self.c['device'], 'faults': self.c['faults'], 'chaos': self.c['chaos'], 'journey': self.journey_state,
            'orderCreated': bool(self.orders), 'orders': self.orders,
            'invoiceGenerated': self.metrics.get('invoiceGenerated'), 'whatsappMockSent': self.metrics.get('whatsappSent'),
            'adminOrderVisible': self.metrics.get('adminVisible'),
            'frontendScore': score('frontend'), 'automationScore': score('automation'),
            'criticalFailures': [f"{c['severity']} {c['name']}: {c['detail']}" for c in crit],
            'warnings': [f"{c['severity']} {c['name']}: {c['detail']}" for c in fails if c not in crit],
            'checksRun': len(self.checks), 'checksFailed': len(fails), 'failedChecks': [{k: c[k] for k in ('name', 'severity', 'area', 'where', 'detail')} for c in fails], 'notes': self.notes, 'metrics': self.metrics,
            'eventsExpected': sorted(self.events_expected), 'eventsActual': self.metrics.get('eventsActual', []),
        }

# ---------- browser helpers ----------

async def ls(page, key, default=None):
    v = await page.evaluate(f"localStorage.getItem({json.dumps(key)})")
    return json.loads(v) if v else default

async def settle(page, ms=350):
    await page.wait_for_timeout(ms)

async def go(page, base, path):
    await page.goto(base + path, wait_until='domcontentloaded')
    try:
        await page.wait_for_load_state('networkidle', timeout=8000)
    except Exception:
        pass

async def price_on_studio(page):
    await page.wait_for_timeout(1300)  # the total animates
    t = await page.text_content('.price-toggle strong')
    return int(re.sub(r'[^\d]', '', t or '0') or 0)

async def online_orders(page):
    return [o for o in (await ls(page, 'tresor-orders', []) or []) if o.get('source') == 'online']

async def click_random_radio(page, section, r, exclude_disabled=True):
    btns = page.locator(f'#opt-{section} button[role=radio]' + (':not([disabled])' if exclude_disabled else ''))
    n = await btns.count()
    if n == 0:
        return None
    b = btns.nth(r.randrange(n))
    label = (await b.locator('.option-name').text_content()) if await b.locator('.option-name').count() else await b.get_attribute('aria-label')
    await sclick(b)
    return label

CURRENT = {'rec': None}

async def step(page, label):
    """Click a studio step like a person would. If something covers the tab, record it and carry on."""
    tab = page.locator(f'.step-tabs button:has-text("{label}")')
    try:
        await tab.click(timeout=4000)
    except Exception:
        rec = CURRENT['rec']
        if rec and not any(c['name'] == 'step tabs reachable while scrolled' for c in rec.checks):
            w = page.viewport_size['width']
            rec.check('step tabs reachable while scrolled', False, 'P2', where=f'/customize at {w}px', detail='the sticky preview covers the step tabs; the customer must scroll back up to change step')
        await tab.evaluate('el => el.click()', timeout=5000)
    await settle(page, 380)

async def sclick(target, page=None):
    """Click a studio control. If the sticky preview covers it, record that once and click it the way a keyboard user would."""
    loc = target if page is None else page.locator(target).first
    try:
        await loc.click(timeout=4000)
    except Exception:
        rec = CURRENT['rec']
        pg = page or loc.page
        url = pg.url.split('?')[0].replace('http://localhost:3004', '')
        name = f'controls clickable without being covered ({url})'
        if rec and not any(c['name'] == name for c in rec.checks):
            vp = pg.viewport_size
            covered = 'customize' in url
            rec.check(name, False, 'P2', where=f"{url} at {vp['width']}px", detail='scrolling a control into view (or focusing it by keyboard) leaves it under the sticky cake preview' if covered else f'normal click failed on {target if isinstance(target, str) else "a control"}')
        await loc.evaluate('el => el.click()', timeout=5000)

async def set_range(locator, value):
    """Move a slider the way a browser does (native setter + input event), so React sees it."""
    await locator.evaluate("""(el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }""", value)

async def build_random_cake(page, r, rec, message_case=None):
    """Random valid cake through the real UI. Returns the configuration the app holds."""
    await step(page, 'Build')
    for s in ['size', 'shape', 'sponge', 'filling']:
        await click_random_radio(page, s, r)
    await step(page, 'Decorate')
    for s in ['frosting', 'finish']:
        await click_random_radio(page, s, r)
    sw = page.locator('#opt-color button[role=radio]:not([disabled])')
    if await sw.count():
        await sclick(sw.nth(r.randrange(await sw.count())))
    plus = page.locator('#opt-toppings .stepper button[aria-label^="More"]:not([disabled])')
    for _ in range(r.randrange(0, 4)):
        n = await plus.count()
        if n:
            await sclick(plus.nth(r.randrange(n)))
    decos = page.locator('#opt-decorations button[role=checkbox]:not([disabled])')
    for _ in range(r.randrange(0, 3)):
        n = await decos.count()
        if n:
            await sclick(decos.nth(r.randrange(n)))
    await step(page, 'Personalise')
    case = message_case or r.choice(list(MESSAGES))
    if MESSAGES[case]:
        await page.fill('#cake-message', MESSAGES[case])
        if r.random() < 0.5:
            await sclick(f'.font-chips button >> nth={r.randrange(3)}', page)
    topper = await click_random_radio(page, 'topper', r)
    if await page.locator('#opt-topper .text-field input').count():
        await page.fill('#opt-topper .text-field input', '7' if 'Number' in (topper or '') else 'Aanya')
    cand = await click_random_radio(page, 'candles', r)
    if await page.locator('#opt-candles .text-field input').count():
        await page.fill('#opt-candles .text-field input', str(r.randrange(1, 99)))
    await step(page, 'Review')
    await click_random_radio(page, 'packaging', r)
    await settle(page, 600)
    return case

async def draft(page):
    d = await ls(page, 'tresor-cake-draft', {})
    return (d or {}).get('config')

async def verify_price_and_lead(page, rec, where):
    await page.wait_for_timeout(600)  # the draft autosave is debounced 400 ms
    cfg = await draft(page)
    if not cfg:
        rec.check('draft configuration saved', False, 'P2', detail='no autosaved configuration', where=where)
        return None
    shown = await price_on_studio(page)
    exp = expected_price(cfg)
    rec.check('displayed price equals independently computed price', shown == exp, 'P1', detail=f'shown ₹{shown}, expected ₹{exp}', where=where)
    ready = (await page.text_content('.bar-ready') or '').replace('Ready from ', '').strip()
    now = dt.datetime.now()
    exp_label = first_slot_label(now, expected_hours(cfg))
    alt = first_slot_label(now - dt.timedelta(minutes=2), expected_hours(cfg))
    rec.check('earliest ready slot respects lead time', ready in (exp_label, alt), 'P1', detail=f'shown "{ready}", expected "{exp_label}" ({expected_hours(cfg)} h)', where=where)
    rec.metrics.setdefault('cakes', []).append({'config': {k: cfg[k] for k in ('size', 'shape', 'sponge', 'filling', 'frosting', 'finish', 'color', 'packaging')}, 'toppings': cfg['toppings'], 'decorations': cfg['decorations'], 'print': cfg['print']['enabled'], 'expected': exp, 'shown': shown, 'hours': expected_hours(cfg)})
    return cfg

async def add_custom_to_bag(page, rec, where):
    await sclick('.studio-bar .btn-brand', page)
    try:
        await page.wait_for_selector('.added-card', timeout=12000)
        return True
    except Exception:
        issues = await page.eval_on_selector_all('.issue-list li', 'els => els.map(e => e.textContent)')
        rec.note(f'add blocked at {where}: {issues}')
        return False

async def fill_checkout(page, r, rec):
    name = r.choice(['Asha Rao', 'Vikram Iyer', 'Meera N', 'Kabir', 'Ananya Das', 'Rohan Mehta', 'Zoya Khan'])
    phone = r.choice(['98450{:05d}', '+91 98450 {:05d}', '0984501{:04d}']).format(r.randrange(1000, 9999))
    await page.fill('#f-name', name)
    await page.fill('#f-phone', phone)
    await page.fill('#f-address', f'{r.randrange(1, 300)} Test Road, Indiranagar')
    method = r.choice(['UPI', 'Card', 'Pay at door'])
    await page.locator(f'button:has-text("{method}")').first.click()
    return {'name': name, 'phone': phone, 'method': method}

async def place_order(page, rec, double=False):
    before = len(await online_orders(page))
    btn = page.locator('button.full-btn:has-text("Place order")')
    if double:
        await btn.dblclick()
        await page.evaluate("(() => { const b = [...document.querySelectorAll('button.full-btn')].find(x => x.textContent.includes('Place order') || x.textContent.includes('Processing')); if (b) { b.click(); b.click(); } })()")
    else:
        await btn.click()
    try:
        await page.wait_for_url('**/order-confirmed**', timeout=15000)
    except Exception:
        err = await page.eval_on_selector_all('.form-alert', 'els => els.map(e => e.textContent)')
        rec.note(f'order not confirmed: {err}')
        return None, before
    await settle(page, 900)
    m = re.search(r'id=(TRS-\d+)', page.url)
    return (m.group(1) if m else None), before

async def verify_order_automation(page, base, rec, order_id, faults, custom=False, expect_print=False):
    rec.events_expected |= {'checkout_started', 'order_created'}
    orders = await online_orders(page)
    order = next((o for o in orders if o['id'] == order_id), None)
    rec.check('order stored', order is not None, 'P0', detail=order_id, where='order-confirmed')
    if not order:
        return
    rec.orders.append({'id': order_id, 'total': order['total'], 'items': len(order['items']), 'custom': any(l.get('custom') for l in order['items']), 'payment': order['paymentStatus']})
    ids = [o['id'] for o in orders]
    rec.check('order ids unique', len(ids) == len(set(ids)), 'P1', detail=str(ids), where='storage')
    # Wait for the mock automations to settle (retries included).
    deadline = time.time() + 9
    jobs = []
    while time.time() < deadline:
        jobs = [j for j in (await ls(page, 'tresor-automation-jobs', []) or []) if j['orderId'] == order_id]
        conf = [j for j in jobs if j['topic'] == 'confirmation']
        if len(conf) == 2 and all(j['status'] in ('succeeded', 'failed') for j in conf):
            break
        await page.wait_for_timeout(400)
    inv_job = next((j for j in jobs if j['kind'] == 'invoice' and j['topic'] == 'confirmation'), None)
    wa_job = next((j for j in jobs if j['kind'] == 'whatsapp' and j['topic'] == 'confirmation'), None)
    inv_fault = faults.get('invoice', 'ok'); wa_fault = faults.get('whatsapp', 'ok')
    rec.check('invoice job created', inv_job is not None, 'P1', 'automation', where='automation')
    rec.check('whatsapp job created', wa_job is not None, 'P1', 'automation', where='automation')
    if inv_job:
        want = 'failed' if inv_fault == 'fail-always' else 'succeeded'
        rec.check(f'invoice ends {want} (fault {inv_fault})', inv_job['status'] == want, 'P1', 'automation', detail=f"{inv_job['status']} after {inv_job['attempts']} tries", where='automation')
        if inv_fault == 'fail-once':
            rec.check('invoice retried after a failure', inv_job['attempts'] == 2, 'P2', 'automation', detail=f"{inv_job['attempts']} tries")
    if wa_job:
        want = 'failed' if wa_fault == 'fail-always' else 'succeeded'
        rec.check(f'whatsapp ends {want} (fault {wa_fault})', wa_job['status'] == want, 'P1', 'automation', detail=f"{wa_job['status']} after {wa_job['attempts']} tries", where='automation')
    invoices = await ls(page, 'tresor-invoices', {}) or {}
    inv = invoices.get(order_id)
    rec.metrics['invoiceGenerated'] = inv is not None
    if inv_fault != 'fail-always':
        rec.check('invoice exists', inv is not None, 'P1', 'automation', where='automation')
    if inv:
        rec.check('invoice total matches order', inv['total'] == order['total'] and sum(l['amount'] for l in inv['lines']) == order['subtotal'], 'P1', 'automation', detail=f"invoice ₹{inv['total']} vs order ₹{order['total']}")
        rec.check('invoice lists every item', len(inv['lines']) == len(order['items']), 'P1', 'automation')
        if custom:
            rec.check('invoice carries custom cake details', any('Design TC-' in ' '.join(l['detail']) for l in inv['lines']), 'P1', 'automation')
    outbox = [m for m in (await ls(page, 'tresor-whatsapp-outbox', []) or []) if m['orderId'] == order_id and m['jobId'].endswith(':confirmation')]
    rec.metrics['whatsappSent'] = len(outbox) == 1
    if wa_fault != 'fail-always':
        rec.check('exactly one whatsapp confirmation', len(outbox) == 1, 'P1', 'automation', detail=f'{len(outbox)} messages')
    else:
        rec.check('no whatsapp message when provider is down', len(outbox) == 0, 'P1', 'automation', detail=f'{len(outbox)} messages')
        rec.check('order still valid when whatsapp fails', order['status'] in ('CONFIRMED', 'NEW'), 'P1', 'automation')
    if outbox:
        t = outbox[0]['text']
        has = f"#{order_id}" in t and f"₹{inr(order['total'])}" in t and order['slot'] in t and f"/track/{order_id}" in t
        rec.check('whatsapp has order number, total, slot and link', has, 'P1', 'automation', detail=t[:160].replace(chr(10), ' | '))
        rec.check('whatsapp sent to the customer phone', outbox[0]['to'] == order['customer']['phone'], 'P1', 'automation')
        if custom:
            rec.check('whatsapp includes custom cake summary', 'Custom' in t, 'P2', 'automation')
    # Customer confirmation page shows automation state.
    status = await page.text_content('[data-testid=automation-status]') if await page.locator('[data-testid=automation-status]').count() else ''
    rec.check('confirmation shows invoice/whatsapp state', bool(status), 'P3', where='order-confirmed', detail=status or '')
    # Admin views in the same browser.
    await go(page, base, '/admin/orders')
    await settle(page, 700)
    vis = await page.locator(f'text={order_id}').count() > 0
    rec.metrics['adminVisible'] = vis
    rec.check('admin orders lists the order', vis, 'P1', 'automation', where='/admin/orders')
    await go(page, base, '/admin')
    await settle(page, 700)
    rec.check('admin overview live orders shows the order', await page.locator(f'.table >> text={order_id}').count() > 0, 'P2', 'automation', where='/admin overview', detail='live list is capped at 6 oldest active orders')
    await go(page, base, '/admin/automations')
    await settle(page, 700)
    rec.check('automations page lists the order', await page.locator(f'tr[data-order="{order_id}"]').count() > 0, 'P1', 'automation', where='/admin/automations')
    if custom:
        await go(page, base, '/admin/custom-cakes')
        await settle(page, 900)
        rec.check('admin custom cakes shows the order', await page.locator(f'.cc-item:has-text("{order_id}")').count() > 0, 'P1', 'automation', where='/admin/custom-cakes')
        await sclick(f'.cc-item:has-text("{order_id}")', page)
        await settle(page, 600)
        rows = await page.locator('.spec-row').count()
        rec.check('custom cake spec rows present', rows >= 10, 'P1', 'automation', detail=f'{rows} rows')
        if expect_print:
            # An order can hold several cakes (two-cakes chaos); only the photo-print one has artwork.
            found = False
            items = page.locator(f'.cc-item:has-text("{order_id}")')
            for i in range(await items.count()):
                await items.nth(i).click(); await settle(page, 400)
                try:
                    await page.wait_for_selector('.cc-artwork img', timeout=4000)  # read back from IndexedDB
                    found = True; break
                except Exception:
                    continue
            rec.check('print artwork available to the bakery', found, 'P1', 'automation', where='/admin/custom-cakes')
    await go(page, base, f'/track-order?id={order_id}')
    await settle(page, 700)
    rec.check('tracking page shows the order', await page.locator(f'text={order_id}').count() > 0, 'P2', where='/track-order')

async def collect_events(page, rec):
    evs = [e['type'] for e in (await ls(page, 'tresor-events', []) or [])]
    rec.metrics['eventsActual'] = sorted(set(evs))
    missing = sorted(rec.events_expected - set(evs))
    rec.metrics['eventsMissing'] = missing
    rec.check('analytics events recorded', not missing, 'P2', 'automation', detail=f'missing {missing}')
    for t in ['order_created', 'custom_cake_added_to_cart']:
        rec.metrics.setdefault('eventCounts', {})[t] = evs.count(t)
    if 'order_created' in rec.events_expected:
        rec.check('no duplicate order_created events', evs.count('order_created') == len(rec.orders), 'P2', 'automation', detail=f"{evs.count('order_created')} events for {len(rec.orders)} orders")

# ---------- journeys ----------

async def j_standard(page, base, rec, r, c):
    rec.events_expected |= {'page_view', 'product_view', 'product_added'}
    await go(page, base, '/')
    await go(page, base, '/shop')
    if r.random() < 0.6:
        q = r.choice(QUERIES)
        await page.fill('.menu-search input', q)
        await settle(page, 1300)
        rec.events_expected.add('search_completed')
        rec.check('search shows results or an honest message', await page.locator('.product-grid .product-card').count() > 0, 'P2', detail=q)
    persona = c['persona']
    pool = [p for p in PRODUCTS if not p.startswith(('rose', 'mango'))]
    if persona == 'cake-only': pool = [p for p in pool if 'cake' in p or 'truffle' in p or 'tart' in p or 'cheesecake' in p]
    if persona == 'coffee-pastry': pool = ['tresor-latte', 'cold-brew', 'almond-croissant', 'pain-au-chocolat']
    picks = r.sample(pool, 3 if persona in ('high-value', 'exploratory') else r.choice([1, 2]))
    for pid in picks:
        await go(page, base, f'/shop/{pid}')
        await settle(page, 600)
        if pid in DRINKS and r.random() < 0.5:
            await sclick('.option-row .option:has-text("Large")', page)
        if r.random() < 0.4 and await page.locator('button[aria-label="Increase quantity"]').count():
            await sclick('button[aria-label="Increase quantity"]', page)
        btn = page.locator('.full-btn')
        if await btn.count():
            if await btn.is_disabled():
                rec.note(f'{pid} sold out'); continue
            await btn.click()
            if await page.locator('.cake-campaign').count():
                # Whole cakes stay on the page and confirm in place.
                await settle(page, 600)
                rec.check(f'{pid}: add confirmed on the page', await page.locator('.cake-campaign').get_by_text('is in your bag').count() > 0, 'P2', where=f'/shop/{pid}')
            else:
                await page.wait_for_url('**/cart', timeout=8000)
        else:
            # Whole cakes use the campaign layout with its own add button.
            add = page.locator('button:has-text("Add to bag")').first
            if await add.count():
                await add.click(); await settle(page, 600)
            else:
                rec.check(f'{pid}: add-to-bag control present', False, 'P1', where=f'/shop/{pid}')
    await go(page, base, '/cart')
    await settle(page, 700)
    lines = await page.locator('.cart-item').count()
    rec.check('cart has the added products', lines >= 1, 'P0', detail=f'{lines} lines', where='/cart')
    if lines == 0:
        rec.journey_state = 'blocked'; return
    if r.random() < 0.5:
        await page.locator('button[aria-label="Increase"]').first.click()
    if lines > 1 and r.random() < 0.3:
        await page.locator('button[aria-label="Decrease"]').first.click()
    cart = await ls(page, 'tresor-cart', [])
    subtotal = sum(l['unitPrice'] * l['qty'] for l in cart)
    await go(page, base, '/checkout')
    await settle(page, 700)
    if 'refresh-checkout' in c['chaos']:
        await page.fill('#f-name', 'Half Typed')
        await page.reload(); await settle(page, 900)
        rec.check('cart survives a refresh at checkout', len(await ls(page, 'tresor-cart', [])) == len(cart), 'P1', where='/checkout refresh')
        rec.note('checkout form fields are not persisted across refresh (by design)')
    if 'back-button' in c['chaos']:
        await page.go_back(); await settle(page, 600); await page.go_forward(); await settle(page, 600)
    if 'resize' in c['chaos']:
        await page.set_viewport_size({'width': 390, 'height': 844}); await settle(page, 500)
        rec.check('checkout fits after resizing to mobile', not await page.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1'), 'P3', where='/checkout resize')
    await fill_checkout(page, r, rec)
    if 'slow-payment' in c['chaos']:
        await page.evaluate("localStorage.setItem('tresor-mock-faults', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('tresor-mock-faults')||'{}'), {payment:'slow'})))")
    oid, before = await place_order(page, rec, double='double-click' in c['chaos'])
    rec.check('order confirmed', oid is not None, 'P0', where='/checkout')
    after = await online_orders(page)
    if 'double-click' in c['chaos']:
        rec.check('double-click creates exactly one order', len(after) - before == 1, 'P1', detail=f'{len(after) - before} orders created', where='/checkout double-click')
    if not oid:
        rec.journey_state = 'failed'; return
    rec.journey_state = 'completed'
    rec.events_expected |= {'payment_success'} if not any(o.get('paymentMethod') == 'COD' for o in after[-1:]) else set()
    if 'refresh-confirmation' in c['chaos']:
        await page.reload(); await settle(page, 900)
        rec.check('confirmation survives refresh', await page.locator(f'text={oid}').count() > 0, 'P2', where='/order-confirmed refresh')
    await verify_order_automation(page, base, rec, oid, c['faults'])
    if 'duplicate-trigger' in c['chaos']:
        await duplicate_trigger(page, base, rec, oid)
    if 'status-flow' in c['chaos']:
        await status_flow(page, base, rec, oid)

async def duplicate_trigger(page, base, rec, oid):
    """Reload and open a second tab at once: both resume automations. Nothing may be sent twice."""
    other = await page.context.new_page()
    await asyncio.gather(page.reload(), other.goto(base + '/admin/automations'))
    await page.wait_for_timeout(2500)
    msgs = [m for m in (await ls(page, 'tresor-whatsapp-outbox', []) or []) if m['orderId'] == oid]
    ids = [m['jobId'] for m in msgs]
    rec.check('no duplicate whatsapp after reload + second tab', len(ids) == len(set(ids)), 'P1', 'automation', detail=str(ids))
    invs = await ls(page, 'tresor-invoices', {}) or {}
    rec.check('still one invoice per order', list(invs).count(oid) <= 1, 'P1', 'automation')
    await other.close()

async def status_flow(page, base, rec, oid):
    await go(page, base, '/admin/orders'); await settle(page, 600)
    seen = []
    for _ in range(5):
        row = page.locator(f'tr:has-text("{oid}") button.btn-sm, tr:has-text("{oid}") button:has-text("Start"), tr:has-text("{oid}") button:has-text("Mark")').first
        if not await row.count():
            break
        await row.click(); await settle(page, 500)
        o = next(o for o in await online_orders(page) if o['id'] == oid)
        seen.append(o['status'])
    rec.note(f'status flow {seen}')
    o = next(o for o in await online_orders(page) if o['id'] == oid)
    hist = [h['status'] for h in o['history']]
    order = ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED']
    rec.check('status history only moves forward', hist == order[:len(hist)], 'P1', detail=str(hist))
    await page.wait_for_timeout(2500)
    jobs = [j for j in (await ls(page, 'tresor-automation-jobs', []) or []) if j['orderId'] == oid and j['topic'].startswith('status:')]
    # Mirrors NOTIFY_STATUSES in lib/automation/automation.ts (PREPARING joined with live tracking).
    expected = {f'status:{s}' for s in hist if s in ('PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED')}
    rec.check('status updates trigger one whatsapp each', {j['topic'] for j in jobs} == expected and len(jobs) == len(expected), 'P2', 'automation', detail=f"{sorted(j['topic'] for j in jobs)} vs {sorted(expected)}")
    await go(page, base, f'/track/{oid}')
    try: await page.wait_for_selector('.track-timeline li[aria-current="step"]', timeout=8000)
    except Exception: pass
    steps = page.locator('.track-timeline li.tl-step')
    cur = order.index(o['status']) if o['status'] in order else -1
    shown = await steps.nth(cur).get_attribute('aria-current') if cur >= 0 and await steps.count() > cur else None
    rec.check('tracking reflects the latest status', shown == 'step', 'P2', where=f'/track/{oid}', detail=f"latest {o['status']}, current step marked: {shown}")

async def j_custom(page, base, rec, r, c, with_print=False, upload=None):
    rec.events_expected |= {'customizer_opened', 'cake_started', 'option_selected', 'custom_cake_added_to_cart'}
    await go(page, base, '/customize')
    await page.wait_for_selector('.studio-stage', timeout=15000)
    if c['persona'] == 'surprise-me':
        await sclick('.surprise-btn', page)
        await page.fill('.surprise-panel input', r.choice(['something elegant under ₹3000', 'birthday cake without nuts', 'chocolate lover', 'luxury anniversary']))
        await sclick('.surprise-actions .btn-brand', page); await settle(page, 700)
        if r.random() < 0.5:
            await sclick('.surprise-actions .btn-brand', page); await settle(page, 600)
        rec.check('surprise me produced a design', bool(await page.text_content('.surprise-panel .studio-note') or ''), 'P2')
        await step(page, 'Personalise')
        await page.fill('#cake-message', 'Happy Birthday')
    else:
        case = await build_random_cake(page, r, rec, 'very-long' if c['persona'] == 'long-message' else None)
        rec.metrics['message'] = case
        if MESSAGES[case].strip():
            rec.events_expected.add('message_added')
        if case in ('very-long', 'long'):
            fit_txt = await page.text_content('.message-meta') if await page.locator('.message-meta').count() else ''
            rec.note(f'message "{case}": {fit_txt}')
    if c['persona'] == 'edits-repeatedly':
        for _ in range(3):
            await step(page, 'Build'); await click_random_radio(page, 'sponge', r); await click_random_radio(page, 'size', r)
    if with_print:
        await step(page, 'Personalise')
        blocked = await page.locator('#opt-print .studio-note').first.text_content() if await page.locator('#opt-print .print-editor').count() == 0 else None
        if blocked:
            await step(page, 'Build'); await sclick('#opt-size button[role=radio]:has-text("8 inch")', page)
            await step(page, 'Decorate')
            if await page.locator('#opt-finish button[role=radio][aria-checked=true]:has-text("Semi-naked")').count():
                await sclick('#opt-finish button[role=radio]:has-text("Smooth")', page)
            await step(page, 'Personalise')
        t0 = time.time()
        await page.set_input_files('.print-editor input[type=file]', os.path.join(FIX, upload))
        try:
            await page.wait_for_selector('.print-tools', timeout=20000)
            rec.metrics['uploadMs'] = round((time.time() - t0) * 1000)
            rec.events_expected.add('image_uploaded')
        except Exception:
            err = await page.text_content('.print-editor [role=alert]') if await page.locator('.print-editor [role=alert]').count() else 'no message'
            rec.check(f'valid upload accepted ({upload})', False, 'P1', detail=err, where='/customize print'); return
        await sclick('.stage-view button:has-text("Top view")', page); await settle(page, 500)
        img = page.locator('.cake-preview image').first
        if await img.count():
            box = await img.bounding_box()
            if box:
                await page.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
                await page.mouse.down(); await page.mouse.move(box['x'] + box['width'] / 2 + 60, box['y'] + box['height'] / 2 + 30, steps=6); await page.mouse.up()
        await set_range(page.locator('.print-editor input[type=range]').first, 1.55); await settle(page, 300)
        warned = await page.locator('.print-editor .studio-warning').count() > 0
        rec.check('overflow warning when photo is zoomed past the area', warned, 'P2', where='/customize print')
        await sclick('.print-tools button:has-text("Fit")', page); await settle(page, 300)
        rec.check('Fit brings the photo fully inside', await page.locator('.print-editor .studio-warning:has-text("outside")').count() == 0, 'P2', where='/customize print')
        await sclick('button[aria-label="Rotate right"]', page); await sclick('button[aria-label="Centre"]', page); await settle(page, 300)
        if upload == 'lowres-ok.jpg':
            await set_range(page.locator('.print-editor input[type=range]').first, 1.0); await settle(page, 300)
            rec.check('blur warning for a low-resolution photo', await page.locator('.print-editor .studio-warning:has-text("soft")').count() > 0, 'P2')
            await sclick('.print-tools button:has-text("Fit")', page)
    cfg = await verify_price_and_lead(page, rec, '/customize')
    ok = await add_custom_to_bag(page, rec, '/customize')
    if not ok:
        # Like a customer: read the message, fix what it asks, try again once.
        issues = await page.eval_on_selector_all('.issue-list li.is-error', 'els => els.map(e => e.textContent)')
        rec.note(f'validation asked: {issues}')
        fixed = False
        if any('message' in i.lower() or 'line' in i.lower() for i in issues):
            await step(page, 'Personalise'); await page.fill('#cake-message', 'Yay!'); fixed = True
        if any('topper' in i.lower() for i in issues):
            await step(page, 'Personalise'); await page.fill('#opt-topper .text-field input', '5'); fixed = True
        if any('candles' in i.lower() for i in issues):
            await step(page, 'Personalise'); await page.fill('#opt-candles .text-field input', '5'); fixed = True
        if fixed:
            await settle(page, 600)
            cfg = await verify_price_and_lead(page, rec, '/customize after fix')
            ok = await add_custom_to_bag(page, rec, '/customize retry')
    if not ok:
        rec.events_expected.discard('custom_cake_added_to_cart')
        issues = await page.eval_on_selector_all('.issue-list li.is-error', 'els => els.map(e => e.textContent)')
        # A blocked add is correct only when the design really has an error.
        rec.check('add to bag blocked only for a real error', bool(issues), 'P1', detail=str(issues), where='/customize add')
        rec.journey_state = 'blocked-by-validation'
        return
    await sclick('.added-actions a:has-text("View bag")', page)
    await page.wait_for_url('**/cart'); await settle(page, 900)
    cart = await ls(page, 'tresor-cart', [])
    custom_lines = [l for l in cart if l.get('custom')]
    rec.check('custom cake in bag', len(custom_lines) >= 1, 'P0', where='/cart')
    if custom_lines and cfg:
        line = custom_lines[-1]
        rec.check('bag price equals computed price', line['unitPrice'] == expected_price(line['custom']['config']), 'P1', detail=f"₹{line['unitPrice']} vs ₹{expected_price(line['custom']['config'])}")
        rec.check('bag keeps the full configuration', line['custom']['config']['sponge'] == cfg['sponge'] and line['custom']['config']['message']['text'] == cfg['message']['text'], 'P1')
    if 'two-cakes' in c['chaos']:
        await two_cakes(page, base, rec, r)
    await go(page, base, '/checkout'); await settle(page, 800)
    slots = await page.eval_on_selector_all('select option', 'els => els.map(e => e.textContent)')
    lead = max(l['custom']['productionHours'] for l in (await ls(page, 'tresor-cart', [])) if l.get('custom'))
    rec.check('checkout offers no slot before the cake is ready', bool(slots) and slots[0] in (first_slot_label(dt.datetime.now(), lead), first_slot_label(dt.datetime.now() - dt.timedelta(minutes=2), lead)), 'P1', detail=f'first slot "{slots[0] if slots else None}", lead {lead} h', where='/checkout')
    await fill_checkout(page, r, rec)
    oid, before = await place_order(page, rec, double='double-click' in c['chaos'])
    rec.check('custom cake order confirmed', oid is not None, 'P0', where='/checkout')
    if 'double-click' in c['chaos']:
        rec.check('double-click creates exactly one order', len(await online_orders(page)) - before == 1, 'P1', detail=f'{len(await online_orders(page)) - before} orders', where='/checkout double-click')
    if not oid:
        rec.journey_state = 'failed'; return
    rec.journey_state = 'completed'
    rec.events_expected.add('custom_cake_ordered')
    await verify_order_automation(page, base, rec, oid, c['faults'], custom=True, expect_print=with_print)
    if 'status-flow' in c['chaos']:
        await status_flow(page, base, rec, oid)

async def two_cakes(page, base, rec, r):
    """Second, different cake; edit the first; the second must not change."""
    await go(page, base, '/customize'); await page.wait_for_selector('.studio-stage')
    if await page.locator('.studio-banner button:has-text("Start fresh")').count():
        await sclick('.studio-banner button:has-text("Start fresh")', page)
    await step(page, 'Build'); await sclick('#opt-size button[role=radio]:has-text("10 inch")', page); await sclick('#opt-sponge button[role=radio]:has-text("Pistachio")', page)
    await step(page, 'Personalise'); await page.fill('#cake-message', 'Happy Anniversary')
    await add_custom_to_bag(page, rec, 'second cake')
    await go(page, base, '/cart'); await settle(page, 800)
    cart = await ls(page, 'tresor-cart', [])
    customs = [l for l in cart if l.get('custom')]
    rec.check('two different custom cakes coexist', len(customs) >= 2, 'P1', detail=f'{len(customs)} custom lines')
    if len(customs) < 2:
        return
    b_before = json.dumps(customs[-1]['custom']['config'], sort_keys=True)
    a_id = customs[0]['lineId']
    await go(page, base, f'/customize?line={a_id}'); await page.wait_for_selector('.studio-stage')
    await step(page, 'Build')
    sizes = page.locator('#opt-size button[role=radio]:not([disabled])[aria-checked=false]')
    if await sizes.count():
        await sclick(sizes.first)
    await sclick('.studio-bar .btn-brand', page)
    await page.wait_for_selector('.added-card', timeout=10000)
    cart2 = await ls(page, 'tresor-cart', [])
    customs2 = [l for l in cart2 if l.get('custom')]
    b_after = next((json.dumps(l['custom']['config'], sort_keys=True) for l in customs2 if json.dumps(l['custom']['config'], sort_keys=True) == b_before), None)
    rec.check('editing cake A never modifies cake B', b_after is not None, 'P1', detail='cake B configuration changed')
    rec.check('editing replaces cake A instead of adding a third', len(customs2) == len(customs), 'P1', detail=f'{len(customs)} → {len(customs2)} custom lines')
    rec.check('edited cake re-priced', all(l['unitPrice'] == expected_price(l['custom']['config']) for l in customs2), 'P1')

async def j_saved(page, base, rec, r, c):
    rec.events_expected |= {'customizer_opened', 'design_saved', 'design_reopened'}
    await go(page, base, '/customize'); await page.wait_for_selector('.studio-stage')
    await build_random_cake(page, r, rec, 'medium')
    first = await draft(page)
    await sclick('button:has-text("Save design")', page); await settle(page, 500)
    await step(page, 'Build'); await click_random_radio(page, 'sponge', r); await click_random_radio(page, 'size', r)
    await sclick('button:has-text("Save design")', page); await settle(page, 500)
    second = await draft(page)
    designs = await ls(page, 'tresor-cake-designs', [])
    distinct = first != second
    rec.check('two saved designs kept separately', len(designs) == (2 if distinct else 1), 'P1', detail=f'{len(designs)} saved')
    await sclick('button[aria-label="Start again"]', page); await settle(page, 500)
    rec.check('reset returns to the default price', await price_on_studio(page) == expected_price(await draft(page)), 'P1')
    await sclick('.saved-designs summary', page); await settle(page, 300)
    # Open the older design (second in the newest-first list).
    target = page.locator('.saved-designs li > button:first-child').nth(1 if distinct else 0)
    await target.click(); await settle(page, 600)
    reopened = await draft(page)
    rec.check('reopened design is identical to what was saved', json.dumps(reopened, sort_keys=True) == json.dumps(first, sort_keys=True), 'P1', detail='configuration differs after reopen')
    rec.check('reopened design price recalculated', await price_on_studio(page) == expected_price(reopened), 'P1')
    if r.random() < 0.5:
        await page.locator('.saved-designs li .note-x').first.click(); await settle(page, 300)
        rec.check('delete removes one design only', len(await ls(page, 'tresor-cake-designs', [])) == len(designs) - 1, 'P2')
    rec.journey_state = 'completed'

async def j_share(page, base, rec, r, c, browser):
    rec.events_expected |= {'customizer_opened', 'design_shared'}
    await go(page, base, '/customize'); await page.wait_for_selector('.studio-stage')
    await build_random_cake(page, r, rec, r.choice(['medium', 'emoji', 'hindi', 'multiline']))
    with_photo = r.random() < 0.5
    if with_photo:
        await step(page, 'Build'); await sclick('#opt-size button[role=radio]:has-text("8 inch")', page)
        await step(page, 'Decorate')
        if await page.locator('#opt-finish button[role=radio]:has-text("Smooth"):not([disabled])').count():
            await sclick('#opt-finish button[role=radio]:has-text("Smooth")', page)
        await step(page, 'Personalise')
        if await page.locator('.print-editor input[type=file]').count():
            await page.set_input_files('.print-editor input[type=file]', os.path.join(FIX, 'square.jpg'))
            await page.wait_for_selector('.print-tools', timeout=20000)
    cfg = await draft(page)
    await sclick('button:has-text("Share")', page); await settle(page, 600)
    link = await page.input_value('.studio-banner input')
    code = link.rsplit('/', 1)[-1]
    decoded = json.loads(base64.urlsafe_b64decode(code + '=' * (-len(code) % 4)).decode('utf-8'))
    rec.check('share link never carries the private photo', decoded['print']['assetId'] is None and decoded['print']['enabled'] is False, 'P1', detail=json.dumps(decoded['print']))
    fresh = await browser.new_context(viewport={'width': 390, 'height': 844})
    p2 = await fresh.new_page()
    await p2.goto(link, wait_until='domcontentloaded'); await p2.wait_for_timeout(1500)
    title = await p2.text_content('.shared-title') if await p2.locator('.shared-title').count() else None
    rec.check('share link opens in a fresh session', bool(title), 'P1', where='/customize/share')
    shown = int(re.sub(r'[^\d]', '', (await p2.text_content('.shared-price') or '').split('·')[0]) or 0) if title else 0
    exp_cfg = dict(cfg); exp_cfg['print'] = dict(cfg['print'], enabled=False)
    rec.check('shared price recalculated for the shared design', shown == expected_price(exp_cfg), 'P1', detail=f'₹{shown} vs ₹{expected_price(exp_cfg)}')
    rec.check('shared preview has no photo', await p2.locator('.cake-preview image').count() == 0, 'P1')
    await sclick('a:has-text("Customize this cake")', p2); await p2.wait_for_selector('.studio-stage', timeout=15000); await p2.wait_for_timeout(800)
    d2 = json.loads(await p2.evaluate("localStorage.getItem('tresor-cake-draft')") or '{}').get('config') or {}
    same = all(d2.get(k) == cfg.get(k) for k in ('size', 'shape', 'sponge', 'filling', 'frosting', 'finish', 'color')) and d2.get('message', {}).get('text') == cfg['message']['text']
    rec.check('"Customize this cake" loads the shared design', same, 'P1')
    await fresh.close()
    rec.journey_state = 'completed'

async def j_abandon(page, base, rec, r, c):
    persona = c['persona']
    if persona == 'abandons-cart':
        await go(page, base, f"/shop/{r.choice(['almond-croissant', 'tresor-latte', 'chocolate-brownie'])}"); await settle(page, 600)
        await sclick('.full-btn', page); await page.wait_for_url('**/cart', timeout=8000)
        await go(page, base, '/checkout'); await settle(page, 600)
        await page.fill('#f-name', 'Leaving Soon')
        await page.goto('about:blank'); await go(page, base, '/cart'); await settle(page, 700)
        rec.check('abandoned cart is still there on return', await page.locator('.cart-item').count() >= 1, 'P2', where='/cart return')
        rec.events_expected |= {'product_added', 'checkout_started'}
    elif persona == 'abandons-customizer':
        await go(page, base, '/customize'); await page.wait_for_selector('.studio-stage')
        await step(page, 'Build'); await click_random_radio(page, 'sponge', r); await click_random_radio(page, 'size', r)
        await settle(page, 700)
        await go(page, base, '/shop'); await settle(page, 1200)   # leave inside the app
        rec.events_expected |= {'customizer_opened', 'cake_started', 'custom_cake_abandoned'}
        await go(page, base, '/customize'); await settle(page, 900)
        rec.check('"Continue your cake?" offered on return', await page.locator('.studio-banner:has-text("Continue your cake")').count() > 0, 'P2', where='/customize return')
        await sclick('.studio-banner button:has-text("Continue")', page); await settle(page, 400)
    else:
        await go(page, base, '/shop')
        await page.fill('.menu-search input', r.choice(QUERIES)); await settle(page, 1300)
        await page.goto('about:blank'); await go(page, base, '/'); await settle(page, 600)
        rec.events_expected |= {'search_completed'}
    rec.check('no order created by an abandoned journey', len(await online_orders(page)) == 0, 'P1')
    rec.journey_state = 'abandoned'

async def j_payment_failure(page, base, rec, r, c):
    fault = c['faults']['payment']
    await go(page, base, '/shop/pain-au-chocolat'); await settle(page, 600)
    await sclick('.full-btn', page); await page.wait_for_url('**/cart', timeout=8000)
    await go(page, base, '/checkout'); await settle(page, 700)
    await fill_checkout(page, r, rec)
    await page.locator('button:has-text("UPI")').first.click()  # cash on delivery has no payment step
    await sclick('button.full-btn:has-text("Place order")', page)
    await page.wait_for_timeout(3200 if fault == 'timeout' else 1600)
    err = await page.text_content('.form-alert') if await page.locator('.form-alert').count() else ''
    rec.check(f'payment {fault} shows a clear message', bool(err) and ('No money' in err or 'cancelled' in err.lower()), 'P1', detail=err, where='/checkout payment')
    rec.check(f'payment {fault} creates no order', len(await online_orders(page)) == 0, 'P0', where='/checkout payment')
    rec.check('bag kept after failed payment', len(await ls(page, 'tresor-cart', [])) >= 1, 'P1')
    rec.check('button usable again after failure', not await page.locator('button.full-btn:has-text("Place order")').is_disabled(), 'P1')
    rec.events_expected |= {'payment_started', 'payment_failure'}
    # Retry: fail-once succeeds on its own; others after the "provider" recovers.
    if fault != 'fail-once':
        await page.evaluate("localStorage.setItem('tresor-mock-faults', JSON.stringify({payment:'ok'}))")
    oid, before = await place_order(page, rec)
    rec.check('retry after a failed payment succeeds once', oid is not None and len(await online_orders(page)) == 1, 'P0', where='/checkout retry')
    if oid:
        rec.journey_state = 'completed-after-retry'
        await verify_order_automation(page, base, rec, oid, {})
    else:
        rec.journey_state = 'failed'

async def j_invalid_custom(page, base, rec, r, c):
    rec.events_expected |= {'customizer_opened'}
    await go(page, base, '/customize'); await page.wait_for_selector('.studio-stage')
    attempts = [
        ('size', '4 inch', 'shape', 'Heart', 'Heart tins'),
        ('frosting', 'Whipped cream', 'finish', 'Ruffled', 'too soft'),
        ('size', '4 inch', 'topper', 'Number', 'too small'),
        ('frosting', 'Chocolate ganache', 'decorations', 'Ganache drip', 'already has'),
        ('finish', 'Semi-naked', 'decorations', 'Satin ribbon', 'frosted side'),
    ]
    a = attempts[int(c['clientId'][-3:]) % len(attempts)]
    first_step = {'size': 'Build', 'frosting': 'Decorate', 'finish': 'Decorate'}[a[0]]
    second_step = {'shape': 'Build', 'finish': 'Decorate', 'topper': 'Personalise', 'decorations': 'Decorate'}[a[2]]
    await step(page, first_step); await sclick(f'#opt-{a[0]} button:has-text("{a[1]}")', page)
    await step(page, second_step)
    target = page.locator(f'#opt-{a[2]} button:has-text("{a[3]}")')
    disabled = await target.is_disabled()
    reason = await target.locator('.option-meta').text_content()
    rec.check(f'{a[3]} disabled after {a[1]}', disabled, 'P1', detail=reason, where='/customize')
    rec.check('reason is visible', a[4].lower() in (reason or '').lower(), 'P2', detail=reason)
    before = await draft(page)
    await target.click(force=True); await settle(page, 300)
    rec.check('forced click on a disabled option changes nothing', await draft(page) == before, 'P1')
    # Mango is out of season in October; check it's disabled with the reason.
    await step(page, 'Build')
    mango = page.locator('#opt-filling button:has-text("Alphonso mango")')
    month = dt.datetime.now().month
    if month not in (3, 4, 5, 6):
        rec.check('seasonal option disabled out of season', await mango.is_disabled(), 'P2', detail=await mango.locator('.option-meta').text_content())
    # Tampering: inject an invalid configuration and a fake cart price, then reload.
    await page.evaluate("""() => {
      const d = JSON.parse(localStorage.getItem('tresor-cake-draft'));
      d.config.size = '4in'; d.config.shape = 'heart'; d.config.toppings = [{id:'berries', qty: 999}, {id:'unicorn', qty:1}];
      localStorage.setItem('tresor-cake-draft', JSON.stringify(d));
    }""")
    await page.reload(); await page.wait_for_selector('.studio-stage'); await settle(page, 600)
    if await page.locator('.studio-banner button:has-text("Continue")').count():
        await sclick('.studio-banner button:has-text("Continue")', page); await settle(page, 500)
    d = await draft(page)
    rec.check('injected toppings sanitised', all(t['id'] != 'unicorn' and t['qty'] <= 12 for t in d['toppings']), 'P1', detail=json.dumps(d['toppings']))
    ok = await add_custom_to_bag(page, rec, 'tampered config')
    cart = await ls(page, 'tresor-cart', [])
    rec.check('invalid configuration never reaches the bag', not ok and not any(l.get('custom') for l in cart), 'P0', detail='a 4-inch heart was accepted' if ok else '')
    # Fake price in a valid cart line must be re-priced on load.
    await step(page, 'Build'); await sclick('#opt-size button:has-text("6 inch")', page); await sclick('#opt-shape button:has-text("Round")', page)
    if await add_custom_to_bag(page, rec, 'valid after fix'):
        await page.evaluate("""() => { const c = JSON.parse(localStorage.getItem('tresor-cart')); c.forEach(l => { if (l.custom) { l.unitPrice = 1; l.product.price = 1; } }); localStorage.setItem('tresor-cart', JSON.stringify(c)); }""")
        await go(page, base, '/cart'); await settle(page, 800)
        cart = await ls(page, 'tresor-cart', [])
        line = next((l for l in cart if l.get('custom')), None)
        rec.check('tampered stored price does not survive a reload', line and line['unitPrice'] == expected_price(line['custom']['config']), 'P1', detail=f"₹{line['unitPrice'] if line else None}")
    rec.journey_state = 'completed'

async def j_invalid_upload(page, base, rec, r, c):
    rec.events_expected |= {'customizer_opened'}
    await go(page, base, '/customize'); await page.wait_for_selector('.studio-stage')
    await step(page, 'Build'); await sclick('#opt-size button:has-text("8 inch")', page)
    await step(page, 'Personalise')
    bad = ['too-small.jpg', 'oversized.jpg', 'wrong-type.gif', 'not-an-image.jpg', 'corrupt.jpg'][int(c['clientId'][-3:]) % 5]
    expect = {'too-small.jpg': 'small', 'oversized.jpg': 'MB', 'wrong-type.gif': 'JPG, PNG or WebP', 'not-an-image.jpg': 'couldn', 'corrupt.jpg': 'couldn'}[bad]
    await page.set_input_files('.print-editor input[type=file]', os.path.join(FIX, bad))
    await page.wait_for_timeout(2500)
    err = await page.text_content('.print-editor [role=alert]') if await page.locator('.print-editor [role=alert]').count() else ''
    rec.check(f'{bad} rejected with a helpful message', expect.lower() in err.lower(), 'P1', detail=err or 'no message', where='/customize print')
    d = await draft(page)
    rec.check(f'{bad} leaves no photo in the design', not d['print']['assetId'], 'P1')
    rec.check('page still responsive after a bad upload', await page.locator('.studio-stage').is_visible(), 'P0')
    # A good upload still works afterwards.
    await page.set_input_files('.print-editor input[type=file]', os.path.join(FIX, r.choice(['landscape.jpg', 'portrait.jpg', 'transparent.png', 'webp.webp'])))
    try:
        await page.wait_for_selector('.print-tools', timeout=15000)
        rec.check('valid upload works after a rejected one', True)
    except Exception:
        rec.check('valid upload works after a rejected one', False, 'P1')
    rec.journey_state = 'completed'

async def j_edit_reset(page, base, rec, r, c, browser_ctx):
    rec.events_expected |= {'customizer_opened', 'cake_started', 'option_selected'}
    await go(page, base, '/customize'); await page.wait_for_selector('.studio-stage')
    default_price = await price_on_studio(page)
    # Rapid option changes.
    await step(page, 'Build')
    for _ in range(25):
        await page.locator('#opt-sponge button[role=radio]:not([disabled])').nth(r.randrange(4)).click(no_wait_after=True)
        await page.locator('#opt-size button[role=radio]:not([disabled])').nth(r.randrange(3)).click(no_wait_after=True)
    await settle(page, 600)
    d = await draft(page)
    rec.check('price correct after rapid changes', await price_on_studio(page) == expected_price(d), 'P1')
    for _ in range(4):
        await sclick('button[aria-label="Undo"]', page)
    await sclick('button[aria-label="Redo"]', page)
    rec.check('price correct after undo/redo', await price_on_studio(page) == expected_price(await draft(page)), 'P1')
    for _ in range(3):
        await sclick('button[aria-label="Start again"]', page); await settle(page, 200)
    rec.check('reset restores the default price', await price_on_studio(page) == default_price, 'P1', detail=f'default ₹{default_price}')
    # Refresh mid-design: draft offered back.
    await step(page, 'Build'); await sclick('#opt-sponge button:has-text("Coffee")', page); await settle(page, 700)
    before = await draft(page)
    await page.reload(); await page.wait_for_selector('.studio-stage'); await settle(page, 800)
    banner = await page.locator('.studio-banner:has-text("Continue your cake")').count() > 0
    rec.check('refresh during design offers "Continue your cake?"', banner, 'P2')
    if banner:
        await sclick('.studio-banner button:has-text("Continue")', page); await settle(page, 400)
        rec.check('continued design is unchanged', await draft(page) == before, 'P1')
    # Mobile resize mid-design.
    await page.set_viewport_size({'width': 375, 'height': 812}); await settle(page, 600)
    overflow = await page.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1')
    rec.check('no horizontal overflow after resizing to mobile', not overflow, 'P3')
    # Two tabs editing the same design.
    t2 = await browser_ctx.new_page()
    await t2.goto(base + '/customize', wait_until='domcontentloaded'); await t2.wait_for_selector('.studio-stage'); await t2.wait_for_timeout(800)
    banner2 = await t2.locator('.studio-banner button:has-text("Continue")').count()
    if banner2:
        await sclick('.studio-banner button:has-text("Continue")', t2)
    await step(page, 'Build'); await sclick('#opt-size button:has-text("10 inch")', page); await settle(page, 600)
    await step(t2, 'Build'); await sclick('#opt-sponge button:has-text("Red velvet")', t2); await t2.wait_for_timeout(700)
    final = await draft(page)
    rec.note(f"two tabs: saved draft is size={final['size']} sponge={final['sponge']} (last writer wins; tabs do not merge)")
    rec.check('two tabs: last edit is the one autosaved (predictable)', final['sponge'] == 'red-velvet', 'P3', detail=f"size {final['size']}, sponge {final['sponge']}")
    await t2.close()
    rec.journey_state = 'completed'

# ---------- runner ----------

async def run_client(browser, base, c):
    rec = Rec(c)
    CURRENT['rec'] = rec
    r = random.Random(c['seed'])
    dev = c['device']
    ctx = await browser.new_context(viewport={'width': dev['width'], 'height': dev['height']}, is_mobile=dev['kind'] == 'mobile', has_touch=dev['kind'] != 'desktop', device_scale_factor=1)
    await ctx.add_init_script(f"""
      if (!localStorage.getItem('tresor-harness-init')) {{
        localStorage.setItem('tresor-client-id', JSON.stringify({json.dumps(c['clientId'])}));
        localStorage.setItem('tresor-mock-faults', JSON.stringify({json.dumps(c['faults'])}));
        localStorage.setItem('tresor-harness-init', '1');
      }}
    """)
    page = await ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)[:200]))
    page.on('console', lambda m: errors.append(m.text[:200]) if m.type == 'error' else None)
    t0 = time.time()
    try:
        if c['journey'] == 'standard':
            if 'admin-realtime' in c['chaos']:
                admin = await ctx.new_page(); await admin.goto(base + '/admin/automations', wait_until='domcontentloaded'); await admin.wait_for_timeout(800)
            await j_standard(page, base, rec, r, c)
            if 'admin-realtime' in c['chaos'] and rec.orders:
                await admin.wait_for_timeout(1500)
                rec.check('admin tab updates without refresh', await admin.locator(f'tr[data-order="{rec.orders[0]["id"]}"]').count() > 0, 'P2', 'automation', where='second tab /admin/automations')
        elif c['journey'] == 'custom':
            await j_custom(page, base, rec, r, c)
        elif c['journey'] == 'print':
            await j_custom(page, base, rec, r, c, with_print=True, upload=r.choice(['landscape.jpg', 'portrait.jpg', 'square.jpg', 'highres.jpg', 'transparent.png', 'webp.webp', 'lowres-ok.jpg']))
        elif c['journey'] == 'saved':
            await j_saved(page, base, rec, r, c)
        elif c['journey'] == 'share':
            await j_share(page, base, rec, r, c, browser)
        elif c['journey'] == 'abandon':
            await j_abandon(page, base, rec, r, c)
        elif c['journey'] == 'payment-failure':
            await j_payment_failure(page, base, rec, r, c)
        elif c['journey'] == 'invalid-custom':
            await j_invalid_custom(page, base, rec, r, c)
        elif c['journey'] == 'invalid-upload':
            await j_invalid_upload(page, base, rec, r, c)
        elif c['journey'] == 'edit-reset':
            await j_edit_reset(page, base, rec, r, c, ctx)
        await collect_events(page, rec)
    except Exception as e:
        rec.check('journey ran without a harness or app crash', False, 'P1', detail=f'{type(e).__name__}: {str(e)[:300]}', where=page.url)
        rec.note(traceback.format_exc()[-800:])
        try:
            await page.screenshot(path=os.path.join(SHOTS, f"fail-{c['clientId']}.jpg"), type='jpeg', quality=60)
        except Exception:
            pass
        if rec.journey_state == 'started':
            rec.journey_state = 'crashed'
    app_errors = [e for e in errors if 'favicon' not in e]
    rec.check('no uncaught page errors', not any('Error' in e or 'error' in e for e in app_errors), 'P2', detail='; '.join(app_errors[:3]))
    rec.metrics['durationSec'] = round(time.time() - t0, 1)
    await ctx.close()
    return rec.result()

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='http://localhost:3004')
    ap.add_argument('--client', action='append')
    ap.add_argument('--out', default=OUT)
    args = ap.parse_args()
    os.makedirs(SHOTS, exist_ok=True)
    clients = plan()
    if args.client:
        clients = [c for c in clients if c['clientId'] in args.client]
    json.dump(plan(), open(os.path.join(args.out, 'clients-plan.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    results = []
    prior = {}
    path = os.path.join(args.out, 'client-results.json')
    if args.client and os.path.exists(path):
        prior = {x['clientId']: x for x in json.load(open(path, encoding='utf-8'))}
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for c in clients:
            res = await run_client(browser, args.base, c)
            results.append(res)
            print(f"{res['clientId']} {res['journeyType']:15s} {res['device']['kind']:7s} {res['journey']:22s} fe {res['frontendScore']:3d} auto {res['automationScore']:3d} fails {res['checksFailed']} {'; '.join(res['criticalFailures'])[:160]}", flush=True)
        await browser.close()
    if prior:
        prior.update({r['clientId']: r for r in results})
        results = [prior[k] for k in sorted(prior)]
    json.dump(results, open(path, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)

if __name__ == '__main__':
    asyncio.run(main())
