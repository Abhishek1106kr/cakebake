import type { Metadata } from 'next';
import { TrackingView } from '@/components/tracking/tracking-view';

export const metadata: Metadata = { title: 'Track your order', robots: { index: false } };

export default async function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TrackingView id={decodeURIComponent(id).slice(0, 20)} />;
}
