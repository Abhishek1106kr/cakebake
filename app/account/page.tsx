'use client';
import Link from 'next/link';
import { ArrowRight, Heart, MapPin, ReceiptText, UserRound } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { STATUS_LABEL, isActive } from '@/lib/orders';

export default function AccountPage(){
  const { myOrders, mounted } = useStore();
  return <main className="page"><section className="section account-head"><div className="container"><div className="eyebrow">Your Tresor</div><h1 className="display h2">Account, without the clutter.</h1><p className="muted">This mock keeps only useful customer shortcuts. It is intentionally nothing like a grocery-app dropdown.</p></div></section><div className="container account-grid"><div className="account-profile panel"><div className="account-avatar"><UserRound size={22}/></div><div><strong>Guest customer</strong><span>Sign-in can be wired to the production auth layer later.</span></div><Link className="btn btn-secondary" href="/checkout">Checkout as guest <ArrowRight size={15}/></Link></div><div className="account-shortcuts"><Link href="/track-order" className="account-shortcut"><ReceiptText size={19}/><div><strong>My orders</strong><span>Track recent deliveries</span></div><ArrowRight size={15}/></Link><Link href="/contact" className="account-shortcut"><MapPin size={19}/><div><strong>Saved addresses</strong><span>Manage delivery details</span></div><ArrowRight size={15}/></Link><Link href="/shop" className="account-shortcut"><Heart size={19}/><div><strong>Favourites</strong><span>Quickly reorder the things you love</span></div><ArrowRight size={15}/></Link></div>
    <section className="panel account-orders">
      <div className="eyebrow">Your orders</div>
      {!mounted ? <div className="page-loader" /> : myOrders.length === 0 ? <p className="muted">No orders on this device yet.</p> : (
        <ul className="order-list">
          {myOrders.map((order) => (
            <li key={order.id}><Link href={`/track-order?id=${order.id}`} className="order-row"><div><strong>#{order.id}</strong><span className="small muted">{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {order.items.length} {order.items.length === 1 ? 'item' : 'items'} · ₹{order.total}</span></div><span className={`status-badge ${isActive(order) ? 'status-orange' : order.status === 'CANCELLED' ? 'status-red' : 'status-green'}`}>{STATUS_LABEL[order.status]}</span></Link></li>
          ))}
        </ul>
      )}
    </section>
  </div></main>;
}
