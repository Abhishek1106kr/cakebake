// Browser helper: record an event on the shared bus with this tab's session id.
// Tracking must never break the page, so failures are swallowed (and the bus
// keeps invalid events out on its own).

import { sessionId } from '../context/context';
import { eventBus } from './bus';
import type { Actor, EventType } from './schema';

export function track(type: EventType, payload: Record<string, unknown>, actor?: Actor) {
  if (typeof window === 'undefined') return;
  try {
    eventBus().emit(type, payload, { sessionId: sessionId(), source: 'web', actor });
  } catch {
    // ignore
  }
}
