'use client';

import { useEffect, useState } from 'react';
import { AUTOMATION_KEYS, readInvoices, readJobs, readLog, readOutbox } from '@/lib/automation/runner';

type State = { jobs: ReturnType<typeof readJobs>; log: ReturnType<typeof readLog>; invoices: ReturnType<typeof readInvoices>; outbox: ReturnType<typeof readOutbox> };

/** Live view of the mock automations: updates in this tab and from other tabs. */
export function useAutomation(): State {
  const [state, setState] = useState<State>({ jobs: [], log: [], invoices: {}, outbox: [] });
  useEffect(() => {
    const load = () => setState({ jobs: readJobs(), log: readLog(), invoices: readInvoices(), outbox: readOutbox() });
    load();
    const keys = Object.values(AUTOMATION_KEYS);
    const onStorage = (e: StorageEvent) => { if (e.key && keys.includes(e.key)) load(); };
    window.addEventListener('tresor-automation', load);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('tresor-automation', load); window.removeEventListener('storage', onStorage); };
  }, []);
  return state;
}
