'use client';

// The one content slot wired to the storefront so far: an announcement the bakery
// publishes from admin → Content. Renders nothing unless one is live, so the
// designed site is unchanged by default.

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';
import { liveAnnouncement, type Announcement } from '@/lib/admin/marketing';

const KEY = 'tresor-announcements';
const read = (): Announcement[] => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

export function AnnouncementBar() {
  const [item, setItem] = useState<Announcement | null>(null);
  useEffect(() => {
    const load = () => setItem(liveAnnouncement(read(), new Date()));
    load();
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) load(); };
    window.addEventListener('storage', onStorage);
    const t = setInterval(load, 60000); // start and end times pass while the page is open
    return () => { window.removeEventListener('storage', onStorage); clearInterval(t); };
  }, []);
  if (!item) return null;
  return (
    <div className="announce-bar" role="region" aria-label="Announcement">
      {item.href ? <Link href={item.href as Route}>{item.text} <span aria-hidden>→</span></Link> : <span>{item.text}</span>}
    </div>
  );
}
