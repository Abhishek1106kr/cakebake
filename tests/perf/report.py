"""Builds the comparison tables of the performance report from measured JSON only.

  python tests/perf/report.py > .tresor/perf/tables.md
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(HERE, '..', '..', '.tresor', 'perf')

def load(name):
    f = os.path.join(P, f'{name}.json')
    return json.load(open(f, encoding='utf-8'))['results'] if os.path.exists(f) else {}

STAGES = [('A', 'A-current'), ('B', 'B-no-lenis'), ('C', 'C-scroll-source'), ('D', 'D-paint-media'), ('E', 'E-final')]
IDLE = [('A', 'A-idle'), ('C', 'C-idle'), ('D', 'D-idle'), ('E', 'E-idle')]
RM = [('A', 'A-reduced-motion'), ('E', 'E-reduced-motion')]

def cell(r, k):
    if not r: return '–'
    if k == 'drop': return f"{r['droppedPct']}%"
    if k == 'p95': return f"{r['frameMs']['p95']}"
    if k == 'script': return f"{r['cdp']['scriptMs']:.0f}"
    if k == 'style': return f"{r['cdp']['styleMs']:.0f}"
    if k == 'layout': return f"{r['cdp']['layoutMs']:.0f}"
    if k == 'commits': return str(r['reactCommits'])
    if k == 'loaf': return f"{r['loaf']['totalMs']}"
    if k == 'anims': return str(r['maxRunningAnimations'])
    if k == 'paint': return f"{r['trace']['paint']:.0f}" if r.get('trace') else '–'
    if k == 'layerize': return f"{r['trace']['layerize']:.0f}" if r.get('trace') else '–'
    if k == 'cls': return f"{r['cls']}"
    return '?'

def table(title, keys, combos, stages):
    data = {s: load(n) for s, n in stages}
    out = [f'### {title}', '', '| page @ width | ' + ' | '.join(f'{s} {k}' for k in keys for s, _ in stages if data[s]) + ' |']
    cols = [(s, k) for k in keys for s, _ in stages if data[s]]
    out.append('|' + '---|' * (len(cols) + 1))
    for c in combos:
        if not any(data[s].get(c) for s, _ in stages): continue
        out.append(f'| {c} | ' + ' | '.join(cell(data[s].get(c), k) for s, k in cols) + ' |')
    return '\n'.join(out) + '\n'

if __name__ == '__main__':
    pages = ['home', 'story', 'product-cake', 'menu', 'customize', 'product', 'cart', 'checkout', 'admin']
    widths = [1440, 1280, 1024, 430, 390]
    combos = [f'{p}@{w}' for p in pages for w in widths]
    pf = os.path.join(P, 'paired.json')
    if os.path.exists(pf):
        pr = json.load(open(pf, encoding='utf-8'))['results']
        print('### Headline: baseline vs final, measured interleaved (same machine conditions)\n')
        print('| page @ width | fps | p95 frame ms | dropped | script ms | style ms | layout ms | React commits | long-anim-frame ms | max running anims |')
        print('|---|---|---|---|---|---|---|---|---|---|')
        for k, r in pr.items():
            b0, f0 = r.get('before'), r.get('after')
            if not (b0 and f0): continue
            print(f"| {k} | {b0['fps']} → {f0['fps']} | {b0['frameMs']['p95']} → {f0['frameMs']['p95']} | {b0['droppedPct']}% → {f0['droppedPct']}% | "
                  f"{b0['cdp']['scriptMs']:.0f} → {f0['cdp']['scriptMs']:.0f} | {b0['cdp']['styleMs']:.0f} → {f0['cdp']['styleMs']:.0f} | {b0['cdp']['layoutMs']:.0f} → {f0['cdp']['layoutMs']:.0f} | "
                  f"{b0['reactCommits']} → {f0['reactCommits']} | {b0['loaf']['totalMs']} → {f0['loaf']['totalMs']} | {b0['maxRunningAnimations']} → {f0['maxRunningAnimations']} |")
        print()
    print(table('Scroll: main-thread script ms (CDP ScriptDuration) during one scripted scroll', ['script'], combos, STAGES))
    print(table('Scroll: style recalc ms / layout ms', ['style', 'layout'], combos, STAGES))
    print(table('Scroll: dropped frames (interval > 1.5x vsync) and p95 frame interval ms', ['drop', 'p95'], combos, STAGES))
    print(table('Scroll: React commits / long-animation-frame ms / max running animations', ['commits', 'loaf', 'anims'], combos, STAGES))
    print(table('Scroll (traced run): paint ms / layerize ms / CLS', ['paint', 'layerize', 'cls'], combos, STAGES))
    print(table('Idle 4 s mid-page: script ms / style ms / running animations', ['script', 'style', 'anims'], combos, IDLE))
    print(table('Reduced motion, scroll: script ms / style ms / dropped frames / React commits', ['script', 'style', 'drop', 'commits'], combos, RM))
    vd = os.path.join(P, 'visual-diff.json')
    if os.path.exists(vd):
        v = json.load(open(vd, encoding='utf-8'))
        print('### Visual regression (baseline build vs final build)\n')
        print(f"{v['summary']}\n")
        print('| page @ width | stops | identical | max changed % | frames over 0.3% |\n|---|---|---|---|---|')
        groups = {}
        for f in v['frames']: groups.setdefault(f"{f['page']}@{f['width']}", []).append(f)
        for k, fs in groups.items():
            over = [f"{f['stop']:.2f} ({f['changedPct']}%)" for f in fs if f['changedPct'] > 0.3]
            print(f"| {k} | {len(fs)} | {sum(1 for f in fs if f['changedPct'] == 0)} | {max(f['changedPct'] for f in fs)} | {', '.join(over) or '–'} |")
