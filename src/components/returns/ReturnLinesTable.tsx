'use client';

// Item table of the return detail drawer. A supplier return shows the credit value per line; a
// repair order shows how many units are still out, back and written off.

import type { PurchaseReturn } from '@/lib/api/purchase-returns';

export function ReturnLinesTable({ order }: { order: PurchaseReturn }) {
  const isService = order.destination === 'service';
  return (
    <div className="mt-4 space-y-2">
      <h3 className="text-sm font-semibold">{isService ? 'Items sent' : 'Returned items'} ({order.item_count})</h3>
      {order.lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items recorded on this {isService ? 'order' : 'return'}.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-right">Qty</th>
                {isService && <th className="px-3 py-2 text-right">Back</th>}
                {isService && <th className="px-3 py-2 text-right">Written off</th>}
                {isService && <th className="px-3 py-2 text-right">Still out</th>}
                {!isService && <th className="px-3 py-2 text-right">Unit cost</th>}
                {!isService && <th className="px-3 py-2 text-right">Sub-total</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {order.lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium">{l.item_name}</p>
                    {l.sku && <p className="text-[11px] text-muted-foreground font-mono">{l.sku}</p>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.quantity.toLocaleString()}</td>
                  {isService && <td className="px-3 py-2 text-right tabular-nums">{l.received_back_qty.toLocaleString()}</td>}
                  {isService && <td className="px-3 py-2 text-right tabular-nums">{l.written_off_qty.toLocaleString()}</td>}
                  {isService && <td className="px-3 py-2 text-right tabular-nums font-medium">{l.outstanding_qty.toLocaleString()}</td>}
                  {!isService && <td className="px-3 py-2 text-right tabular-nums">{l.unit_cost.toLocaleString()}</td>}
                  {!isService && <td className="px-3 py-2 text-right tabular-nums">{l.sub_total.toLocaleString()}</td>}
                </tr>
              ))}
            </tbody>
            {!isService && (
              <tfoot>
                <tr className="font-semibold">
                  <td className="px-3 py-2" colSpan={3}>Total</td>
                  <td className="px-3 py-2 text-right tabular-nums">{order.return_amount.toLocaleString()}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
