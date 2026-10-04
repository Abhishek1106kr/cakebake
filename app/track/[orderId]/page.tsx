'use client';

import { useParams } from 'next/navigation';
import { OrderTrackingProvider } from '@/components/tracking/provider';
import { TrackingExperience } from '@/components/tracking/experience';
import { track, useTrackOnce } from '@/components/intelligence';

export default function TrackPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const id = decodeURIComponent(orderId ?? '').toUpperCase();
  useTrackOnce(Boolean(id), id, () => track('tracking_viewed', { orderId: id }));
  return (
    <OrderTrackingProvider orderId={id}>
      <TrackingExperience />
    </OrderTrackingProvider>
  );
}
