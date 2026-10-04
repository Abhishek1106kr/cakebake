# 100-client stress test

Simulates 100 different customers against a running build. It exercises the frontend and the mock automations (invoice, WhatsApp, payment). There is no backend; nothing external is contacted.

```bash
node tests/stress/export-catalogue.mjs        # cake catalogue → JSON (for independent price checks)
python tests/stress/make_fixtures.py          # synthetic upload files (git-ignored)
NEXT_DIST_DIR=.next-test npx next build && NEXT_DIST_DIR=.next-test npx next start -p 3004
python tests/stress/run_clients.py            # all 100 clients
python tests/stress/run_clients.py --client CLIENT-074   # replay one client by its seed
python tests/stress/perf.py && python tests/stress/visual.py && python tests/stress/report.py
```

- Each client has a fixed seed, persona, device and journey (`clients-plan.json`).
- Each client gets a fresh browser context, so it's a separate customer with its own storage.
- Faults (`localStorage['tresor-mock-faults']`) make the mock invoice, WhatsApp and payment providers fail on purpose.
- Every check has a severity (P0–P4). Failures are recorded, never retried silently.
- Results go to `.tresor/test-results/`. Screenshots are git-ignored because they can contain local reference imagery.

Requires Python 3 with `playwright` and Pillow, plus Chromium (`playwright install chromium`).
