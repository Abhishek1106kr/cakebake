'use client';

import { products } from '@/lib/data';
import { useStore } from '@/components/store-provider';
import { useNow } from '@/components/admin/admin-utils';
import { unitsSoldToday } from '@/lib/orders';
import { availableUnits } from '@/lib/inventory';

export default function ProductsAdmin() {
  const { inventory, orders, mounted } = useStore();
  const now = useNow();
  const sold = unitsSoldToday(orders, now);
  if (!mounted) return <div className="page-loader" />;
  return (
    <div>
      <div className="admin-top">
        <div><div className="eyebrow">Catalogue</div><h1 className="display admin-title">Products</h1><div className="muted">Availability is worked out from ingredient stock.</div></div>
        <button className="btn btn-primary" disabled title="Catalogue editing arrives with the backend">Add product</button>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Can make</th><th>Sold today</th><th>Tag</th></tr></thead>
            <tbody>
              {products.map((p) => {
                const left = availableUnits(inventory, [], p.id, 'Regular');
                return (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong><div className="small muted">{p.id}</div></td>
                    <td>{p.category}</td>
                    <td>₹{p.price}</td>
                    <td><span className={`status-badge ${left === 0 ? 'status-red' : left <= 5 ? 'status-orange' : 'status-green'}`}>{left === 0 ? 'Sold out' : left <= 5 ? `Only ${left}` : left >= 99 ? 'Plenty' : `${left}`}</span></td>
                    <td>{sold[p.id] ?? 0}</td>
                    <td>{p.tag ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
