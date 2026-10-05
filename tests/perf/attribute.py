"""Where does scroll-time main-thread work go? CPU-profiles one scroll and groups
self time by library/module, and lists every running animation afterwards.

  python tests/perf/attribute.py --page /about --width 1440 [--no-lenis]
"""
import argparse, asyncio, collections, json, os
from playwright.async_api import async_playwright

# Demo deployment: skip the one-time warning and sign in to the mock admin before every page
# (the warning and the sign-in have their own tests in tests/demo/demo_e2e.py).
DEMO_INIT = "try{localStorage.setItem('tresor-demo-warning-seen','1');localStorage.setItem('tresor-demo-admin-auth',JSON.stringify({v:1,email:'test@omni.com',signedInAt:new Date().toISOString()}))}catch(e){}"


HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', '.tresor', 'perf')
NO_LENIS = open(os.path.join(HERE, 'profile.py'), encoding='utf-8').read().split('NO_LENIS = r"""')[1].split('"""')[0]

def owner(frame):
    url, fn = frame.get('url', ''), frame.get('functionName', '') or '(anonymous)'
    if not url: return fn if fn.startswith('(') else '(native) ' + fn
    return url.split('/')[-1].split('?')[0] + ' :: ' + fn

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='http://localhost:3004'); ap.add_argument('--page', default='/about')
    ap.add_argument('--width', type=int, default=1440); ap.add_argument('--no-lenis', action='store_true'); ap.add_argument('--label', default=''); ap.add_argument('--paint', action='store_true'); ap.add_argument('--css', default='', help='experiment: extra CSS injected before load')
    a = ap.parse_args()
    mobile = a.width <= 430
    async with async_playwright() as p:
        b = await p.chromium.launch(channel='chrome')
        ctx = await b.new_context(viewport={'width': a.width, 'height': 844 if mobile else 900}, is_mobile=mobile, has_touch=mobile, device_scale_factor=3 if mobile else 1)
        await ctx.add_init_script(DEMO_INIT)
        if a.no_lenis: await ctx.add_init_script(NO_LENIS)
        if a.css: await ctx.add_init_script('document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = ' + json.dumps(a.css) + '; document.head.appendChild(s); });')
        page = await ctx.new_page(); cdp = await ctx.new_cdp_session(page)
        await page.goto(a.base + a.page, wait_until='load'); await page.wait_for_timeout(2500)
        await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4 if mobile else 2})
        await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', {'interval': 200})
        await cdp.send('Profiler.start')
        if a.paint: await b.start_tracing(page=page, categories=['devtools.timeline', 'disabled-by-default-devtools.timeline'])
        h = await page.evaluate('document.documentElement.scrollHeight - innerHeight')
        await cdp.send('Input.synthesizeScrollGesture', {'x': a.width // 2, 'y': 400, 'yDistance': -min(h, 12000), 'speed': 1800 if mobile else 1400,
                                                         'gestureSourceType': 'default' if mobile else 'mouse', 'preventFling': True})
        await page.wait_for_timeout(1200)
        prof = (await cdp.send('Profiler.stop'))['profile']
        paint = None
        if a.paint:
            ev = json.loads(await b.stop_tracing())['traceEvents']
            by = collections.Counter(); cnt = collections.Counter()
            for e in ev:
                if e.get('name') == 'Paint' and e.get('ph') == 'X':
                    nid = (e.get('args', {}).get('data', {}) or {}).get('nodeId')
                    by[nid] += e.get('dur', 0) / 1000; cnt[nid] += 1
            await cdp.send('DOM.getDocument', {'depth': 0})
            paint = []
            for nid, ms in by.most_common(10):
                label = str(nid)
                try:
                    n = (await cdp.send('DOM.describeNode', {'backendNodeId': nid}))['node']
                    at = dict(zip(n.get('attributes', [])[::2], n.get('attributes', [])[1::2]))
                    label = f"{n['nodeName'].lower()}.{at.get('class', '').replace(' ', '.')[:60]}"
                except Exception: pass
                paint.append([label, round(ms, 1), cnt[nid]])
        anims = await page.evaluate("""() => document.getAnimations().filter(x => x.playState === 'running').map(x => {
            const t = x.effect && x.effect.target; const r = t && t.getBoundingClientRect ? t.getBoundingClientRect() : null;
            return { name: x.animationName || x.constructor.name, target: t ? (t.className && t.className.baseVal !== undefined ? t.className.baseVal : t.className) || t.tagName : null,
                     onScreen: r ? (r.bottom > 0 && r.top < innerHeight) : null }; })""")
        await b.close()
    nodes = {n['id']: n for n in prof['nodes']}
    dt = collections.Counter()
    for sid, d in zip(prof['samples'], prof['timeDeltas']):
        dt[sid] += d / 1000
    self_by = collections.Counter(); lib_by = collections.Counter()
    for nid, ms in dt.items():
        f = nodes[nid]['callFrame']; o = owner(f)
        if o.startswith('(idle)') or o.startswith('(program)'): continue
        self_by[o] += ms
        url = f.get('url', '')
        lib_by[url.split('/')[-1].split('?')[0] or o.split(' ')[0]] += ms
    total = sum(self_by.values())
    res = {'page': a.page, 'width': a.width, 'lenisForcedOff': a.no_lenis, 'busyMs': round(total),
           'paintByNode': paint, 'byChunk': [[k, round(v)] for k, v in lib_by.most_common(12)], 'topFunctions': [[k, round(v, 1)] for k, v in self_by.most_common(25)],
           'runningAnimations': collections.Counter(f"{x['name']} @ {str(x['target'])[:50]} {'on' if x['onScreen'] else 'off'}-screen" for x in anims).most_common()}
    os.makedirs(OUT, exist_ok=True)
    name = f"attr{('-' + a.label) if a.label else ''}-{a.page.strip('/').replace('/', '_') or 'home'}-{a.width}{'-nolenis' if a.no_lenis else ''}.json"
    json.dump(res, open(os.path.join(OUT, name), 'w', encoding='utf-8'), indent=1)
    print(json.dumps(res, indent=1, ensure_ascii=False))

if __name__ == '__main__':
    asyncio.run(main())
