import type { Metadata } from 'next';
import { ConfirmationView } from '@/components/order/confirmation-view';

export const metadata: Metadata = { title: 'Order confirmed', robots: { index: false } };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConfirmationView id={decodeURIComponent(id).slice(0, 20)} />;
}
