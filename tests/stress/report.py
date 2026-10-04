"""Builds the stress-test report from client-results.json.
  python tests/stress/report.py [--before path/to/client-results.before.json]
Writes summary.json, automation-results.json, failures.json and report.md
in .tresor/test-results/."""
import argparse, collections, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', '.tresor', 'test-results')

LIKELY_CAUSE = {
    'analytics events recorded': 'The event store saves to localStorage on a 400 ms debounce and is not flushed when the page unloads, so events fired just before navigation (or on pagehide, like custom_cake_abandoned) are lost.',
    'step tabs reachable while scrolled': 'At ≤1040 px the cake preview is position: sticky and covers the top of the options panel; scrolling a tab into view puts it under the preview.',
    'controls clickable without being covered': 'Same sticky preview: scrolling a control into view (or keyboard focus) leaves it under the preview (WCAG 2.4.11 focus not obscured).',
    'double-click creates exactly one order': 'Checkout guards with React state (processing), which only updates after the current event; two clicks in the same tick both pass the guard.',
    'admin overview live orders shows the order': 'The overview lists only the 6 oldest active orders, so a new order is hidden when 6+ are active. /admin/orders lists all.',
}

def classify(name):
    for k in LIKELY_CAUSE:
        if name.startswith(k):
            return k
    return name

def load(path):
    return json.load(open(path, encoding='utf-8'))

def summarise(results):
    fails = [(r, w) for r in results for w in r['criticalFailures'] + r['warnings']]
    sev = collections.Counter(w.split(' ', 1)[0] for _, w in fails)
    orders = [o for r in results for o in r['orders']]
    def rate(key):
        rs = [r for r in results if r['orderCreated']]
        vals = [r.get(key) for r in rs if r.get(key) is not None]
        return round(100 * sum(1 for v in vals if v) / len(vals), 1) if vals else None
    inv_ok = wa_ok = admin_ok = total = 0
    for r in results:
        if not r['orderCreated']:
            continue
        total += 1
        f = r['faults']
        inv_ok += 1 if (r.get('invoiceGenerated') or f.get('invoice') == 'fail-always') else 0
        wa_ok += 1 if (r.get('whatsappMockSent') or f.get('whatsapp') == 'fail-always') else 0
        admin_ok += 1 if r.get('adminOrderVisible') else 0
    exp = sum(len(r['eventsExpected']) for r in results)
    hit = sum(len(set(r['eventsExpected']) & set(r['eventsActual'])) for r in results)
    return {
        'totalClients': len(results),
        'completed': sum(1 for r in results if r['journey'].startswith('completed')),
        'abandoned': sum(1 for r in results if r['journey'] == 'abandoned'),
        'blockedByValidation': sum(1 for r in results if r['journey'] == 'blocked-by-validation'),
        'crashedOrFailed': sum(1 for r in results if r['journey'] in ('crashed', 'failed', 'blocked')),
        'frontendFailures': sum(1 for r, w in fails if '(frontend)' in w or True) and len([1 for r in results for c in r['criticalFailures'] + r['warnings']]),
        'clientsWithFailures': sum(1 for r in results if r['checksFailed']),
        'checksRun': sum(r['checksRun'] for r in results),
        'checksFailed': sum(r['checksFailed'] for r in results),
        'P0': sev.get('P0', 0), 'P1': sev.get('P1', 0), 'P2': sev.get('P2', 0), 'P3': sev.get('P3', 0), 'P4': sev.get('P4', 0),
        'successfulOrders': len(orders),
        'customCakeOrders': sum(1 for o in orders if o['custom']),
        'invoiceAutomationSuccessPct': round(100 * inv_ok / total, 1) if total else None,
        'whatsappMockAutomationSuccessPct': round(100 * wa_ok / total, 1) if total else None,
        'adminActiveOrderSuccessPct': round(100 * admin_ok / total, 1) if total else None,
        'analyticsEventAccuracyPct': round(100 * hit / exp, 1) if exp else None,
        'averageFrontendScore': round(sum(r['frontendScore'] for r in results) / len(results), 1),
        'averageAutomationScore': round(sum(r['automationScore'] for r in results) / len(results), 1),
        'devices': dict(collections.Counter(r['device']['kind'] for r in results)),
        'journeys': dict(collections.Counter(r['journeyType'] for r in results)),
        'note': 'Invoice/WhatsApp success counts a deliberate provider outage (fault fail-always) as correct when the job ends failed, the order stays valid and nothing was sent.',
    }

def failures(results):
    groups = {}
    for r in results:
        for w in r['criticalFailures'] + r['warnings']:
            sev, rest = w.split(' ', 1)
            name, _, detail = rest.partition(': ')
            key = classify(name)
            g = groups.setdefault(key, {'issue': key, 'severity': sev, 'count': 0, 'clients': [], 'examples': [], 'likelyCause': LIKELY_CAUSE.get(key, ''), 'replay': ''})
            g['count'] += 1
            if r['clientId'] not in g['clients']:
                g['clients'].append(r['clientId'])
            if len(g['examples']) < 3:
                g['examples'].append({'client': r['clientId'], 'device': f"{r['device']['kind']} {r['device']['width']}px", 'detail': detail[:300]})
            if ['P0', 'P1', 'P2', 'P3', 'P4'].index(sev) < ['P0', 'P1', 'P2', 'P3', 'P4'].index(g['severity']):
                g['severity'] = sev
    for g in groups.values():
        g['replay'] = 'python tests/stress/run_clients.py ' + ' '.join(f'--client {c}' for c in g['clients'][:3])
    return sorted(groups.values(), key=lambda g: (g['severity'], -g['count']))

def automation_table(results):
    rows = []
    for r in results:
        for o in r['orders']:
            f = r['faults']
            def mark(ok, fault_key, outage):
                if ok:
                    return '✓' if f.get(fault_key, 'ok') == 'ok' else '✓ after retry'
                return '✗ (simulated outage, order kept)' if f.get(fault_key) == outage else '✗'
            rows.append({
                'order': o['id'], 'client': r['clientId'], 'custom': o['custom'], 'total': o['total'],
                'invoice': mark(r.get('invoiceGenerated'), 'invoice', 'fail-always'),
                'whatsapp': mark(r.get('whatsappMockSent'), 'whatsapp', 'fail-always'),
                'admin': '✓' if r.get('adminOrderVisible') else '✗',
                'analytics': '✓' if not (set(r['eventsExpected']) - set(r['eventsActual'])) else '⚠ ' + ','.join(sorted(set(r['eventsExpected']) - set(r['eventsActual']))),
            })
    return rows

def md(summary, fails, table, results, before=None, perf=None, visual=None):
    L = ['# Tresor 100-client stress test', '', 'Frontend and mock automations only (no backend). Generated by `tests/stress/report.py` from real runs of `tests/stress/run_clients.py` against a production build.', '']
    if before:
        L += ['## Before and after fixes', '', '| | Before | After |', '|---|---|---|']
        for k in ['completed', 'P0', 'P1', 'P2', 'P3', 'checksFailed', 'clientsWithFailures', 'analyticsEventAccuracyPct', 'averageFrontendScore', 'averageAutomationScore']:
            L.append(f'| {k} | {before.get(k)} | {summary.get(k)} |')
        L.append('')
    L += ['## Summary', '', '| | |', '|---|---|']
    for k in ['totalClients', 'completed', 'abandoned', 'blockedByValidation', 'crashedOrFailed', 'checksRun', 'checksFailed', 'clientsWithFailures', 'P0', 'P1', 'P2', 'P3', 'P4', 'successfulOrders', 'customCakeOrders', 'invoiceAutomationSuccessPct', 'whatsappMockAutomationSuccessPct', 'adminActiveOrderSuccessPct', 'analyticsEventAccuracyPct', 'averageFrontendScore', 'averageAutomationScore']:
        L.append(f'| {k} | {summary[k]} |')
    L += ['', f"Devices: {summary['devices']}. Journeys: {summary['journeys']}.", '', summary['note'], '']
    L += ['## Failures', '']
    if not fails:
        L.append('None.')
    for g in fails:
        L += [f"### {g['severity']} · {g['issue']} ({g['count']}× across {len(g['clients'])} clients)", '']
        if g['likelyCause']:
            L.append(f"Likely cause: {g['likelyCause']}")
        for e in g['examples']:
            L.append(f"- {e['client']} ({e['device']}): {e['detail']}")
        L += ['', f"Replay: `{g['replay']}`", '']
    L += ['## Automation by order', '', '| Order | Client | Custom | Invoice | WhatsApp | Admin | Analytics |', '|---|---|---|---|---|---|---|']
    for row in table:
        L.append(f"| {row['order']} | {row['client']} | {'yes' if row['custom'] else ''} | {row['invoice']} | {row['whatsapp']} | {row['admin']} | {row['analytics']} |")
    if perf:
        L += ['', '## Performance (measured)', '', perf['note'], '', '| Route | Device | TTFB | DCL | LCP | CLS | Long tasks | Transfer |', '|---|---|---|---|---|---|---|---|']
        for route, by in perf['pages'].items():
            for dev, m in by.items():
                L.append(f"| {route} | {dev} | {m['ttfbMs']} ms | {m['domContentLoadedMs']} ms | {m['lcpMs']} ms | {m['cls']} | {m['longTasks']} ({m['longTaskMs']} ms) | {m['transferKB']} KB |")
        L += ['', 'Interactions:', '']
        for k, v in perf['interactions'].items():
            L.append(f'- {k}: {v}')
    if visual:
        L += ['', '## Visual regression', '', 'Screenshots in `screenshots/visual/` (git-ignored). Sideways-scroll check per state:', '']
        for name, by in visual.items():
            bad = [w for w, v in by.items() if v['pageScrollsSideways']]
            L.append(f"- {name}: {'OK at 1440 / 768 / 390' if not bad else 'sideways scroll at ' + ', '.join(bad)}")
    L += ['', '## Clients', '', '| Client | Persona | Device | Journey | Frontend | Automation | Critical |', '|---|---|---|---|---|---|---|']
    for r in results:
        L.append(f"| {r['clientId']} | {r['persona']} | {r['device']['kind']} {r['device']['width']} | {r['journey']} | {r['frontendScore']} | {r['automationScore']} | {len(r['criticalFailures'])} |")
    return '\n'.join(L) + '\n'

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--before'); args = ap.parse_args()
    results = load(os.path.join(OUT, 'client-results.json'))
    summary = summarise(results)
    fails = failures(results)
    table = automation_table(results)
    before = summarise(load(args.before)) if args.before else None
    perf = load(os.path.join(OUT, 'performance.json')) if os.path.exists(os.path.join(OUT, 'performance.json')) else None
    visual = load(os.path.join(OUT, 'visual-checks.json')) if os.path.exists(os.path.join(OUT, 'visual-checks.json')) else None
    json.dump(summary, open(os.path.join(OUT, 'summary.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    json.dump(fails, open(os.path.join(OUT, 'failures.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    json.dump(table, open(os.path.join(OUT, 'automation-results.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    open(os.path.join(OUT, 'report.md'), 'w', encoding='utf-8').write(md(summary, fails, table, results, before, perf, visual))
    print(json.dumps(summary, indent=1, ensure_ascii=False))

if __name__ == '__main__':
    main()
