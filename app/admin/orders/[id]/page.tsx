'use client';

import Link from 'next/link';
import { use } from 'react';
import { useStore } from '@/components/store-provider';
import { OrderDetail } from '@/components/admin/order-detail';
import { Empty, Guard, PageHeader, Panel, rupees } from '@/components/admin/ui';

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Guard permission="orders.view"><Order id={decodeURIComponent(id)} /></Guard>;
}

function Order({ id }: { id: string }) {
  const { findOrder } = useStore();
  const order = findOrder(id);
  if (!order) return <Panel><Empty action={<Link className="ad-btn" href="/admin/orders">Back to orders</Link>}>No order {id} in this browser.</Empty></Panel>;
  return (
    <div>
      <PageHeader eyebrow="Order" title={order.id} description={`${order.customer.name} · ${rupees(order.total)} · ${order.items.length} line${order.items.length === 1 ? '' : 's'}`} actions={<Link className="ad-btn" href="/admin/orders">All orders</Link>} />
      <Panel><OrderDetail order={order} /></Panel>
    </div>
  );
}
