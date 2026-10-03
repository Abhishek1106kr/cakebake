'use client';

import { useState } from 'react';
import { useStore } from '@/components/store-provider';
import { StockBadge, clock } from '@/components/admin/admin-utils';
import { MovementReason, formatQty, stockState } from '@/lib/inventory';

export default function InventoryAdmin() {
  const { inventory, movements, recordMovement, mounted } = useStore();
  const [ingredientId, setIngredientId] = useState(inventory[0]?.id ?? '');
  const [reason, setReason] = useState<MovementReason>('Restock');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const selected = inventory.find((i) => i.id === ingredientId);

  if (!mounted) return <div className="page-loader" />;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (!selected || !Number.isFinite(value) || value <= 0) { setError('Enter a quantity above zero.'); return; }
    const delta = reason === 'Restock' ? value : reason === 'Wastage' ? -value : value - selected.onHand;
    if (reason === 'Wastage' && value > selected.onHand) { setError(`Only ${formatQty(selected.onHand, selected.unit)} on hand.`); return; }
    recordMovement(selected.id, delta, reason);
    setAmount('');
    setError('');
  };

  return (
    <div>
      <div className="admin-top"><div><div className="eyebrow">Operations</div><h1 className="display admin-title">Inventory</h1><div className="muted">Stock goes down when orders are placed, and back up if they’re cancelled before baking starts.</div></div></div>

      <form className="panel admin-form" onSubmit={submit}>
        <label>Ingredient<select value={ingredientId} onChange={(e) => setIngredientId(e.target.value)}>{inventory.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
        <label>Movement<select value={reason} onChange={(e) => setReason(e.target.value as MovementReason)}><option value="Restock">Restock (add)</option><option value="Wastage">Wastage (remove)</option><option value="Correction">Stock count (set to)</option></select></label>
        <label>Quantity{selected ? ` (${selected.unit})` : ''}<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></label>
        <button className="btn btn-primary" type="submit">Record movement</button>
        {error && <p className="field-error" role="alert">{error}</p>}
      </form>

      <div className="admin-grid">
        <div className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Item</th><th>Area</th><th>On hand</th><th>Reorder point</th><th>State</th></tr></thead>
              <tbody>
                {inventory.map((item) => (
                  <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.area}</td><td>{formatQty(item.onHand, item.unit)}</td><td>{formatQty(item.reorderPoint, item.unit)}</td><td><StockBadge state={stockState(item)} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <aside className="panel">
          <div className="panel-head"><h2>Recent movements</h2></div>
          {movements.length === 0 ? <p className="muted small">No manual movements yet.</p> : movements.slice(0, 12).map((m) => {
            const item = inventory.find((i) => i.id === m.ingredientId);
            return (
              <div key={m.id} className="summary-row">
                <div><strong>{item?.name ?? m.ingredientId}</strong><div className="small muted">{m.reason} · {clock(m.at)}</div></div>
                <span className={m.delta >= 0 ? 'delta-up' : 'delta-down'}>{m.delta >= 0 ? '+' : '−'}{item ? formatQty(Math.abs(m.delta), item.unit) : Math.abs(m.delta)}</span>
              </div>
            );
          })}
        </aside>
      </div>
    </div>
  );
}
