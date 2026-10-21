'use client';

// New return form shared by both destinations: goods going back to the supplier (credited) and
// goods sent to a repair provider, service or care centre (expected back). Extracted from the
// Returns page so the page stays a thin shell.

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { ItemSearchInput } from '@/components/inventory/ItemSearchInput';
import { ActiveWarehousePicker } from '@/components/inventory/ActiveWarehousePicker';
import { SupplierBalanceNote } from '@/components/inventory/SupplierBalanceNote';
import { useCreatePurchaseReturn } from '@/hooks/usePurchaseReturns';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useActiveWarehouse } from '@/hooks/useActiveWarehouse';
import type { ReturnDestination } from '@/lib/api/purchase-returns';
import { apiErrorMessage } from '@/lib/api/error-message';
import { supplierBalanceLabel } from '@/lib/supplier-balance';
import { DECIMAL_STEP, localDateInput, parseDecimal } from '@/lib/utils';
import { Minus, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const selectClass = 'w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none';

interface Line { itemId: string; itemName: string; sku: string; quantity: string; unitCost: string; subTotal: string }
const emptyLine = (): Line => ({ itemId: '', itemName: '', sku: '', quantity: '1', unitCost: '', subTotal: '' });

const DESTINATIONS: { value: ReturnDestination; label: string; hint: string }[] = [
  { value: 'supplier', label: 'Return to supplier', hint: 'Goods go back to the supplier and the supplier credits you.' },
  { value: 'service', label: 'Send for repair', hint: 'Goods go to a technician, service or care centre and come back once repaired. Nothing is credited.' },
];

interface Props {
  org: string;
  open: boolean;
  onClose: () => void;
  /** Known provider names, offered as suggestions while typing. */
  providerSuggestions?: string[];
}

export function ReturnFormDialog({ org, open, onClose, providerSuggestions = [] }: Props) {
  const create = useCreatePurchaseReturn(org);
  const { data: suppliersPage } = useSuppliers(org);
  const suppliers = suppliersPage?.data ?? [];
  // Where the goods leave from: defaults to the active outlet's warehouse (same shared resolver
  // as Adjustments, Purchase Orders and Transfers), required when "All Outlets" is selected.
  const activeWarehouse = useActiveWarehouse(org);

  const [destination, setDestination] = useState<ReturnDestination>('supplier');
  const [supplierId, setSupplierId] = useState('');
  const [reason, setReason] = useState('');
  // Local calendar day (the UTC day lags a day until 03:00 in Kenya), re-seeded every time the
  // form opens so a tab left open overnight never defaults to yesterday.
  const [dateReturned, setDateReturned] = useState(() => localDateInput());
  const [provider, setProvider] = useState('');
  const [contact, setContact] = useState('');
  const [fault, setFault] = useState('');
  const [expectedBack, setExpectedBack] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  const isService = destination === 'service';

  useEffect(() => {
    if (!open) return;
    setDestination('supplier');
    setSupplierId('');
    setReason('');
    setDateReturned(localDateInput());
    setProvider('');
    setContact('');
    setFault('');
    setExpectedBack('');
    setLines([emptyLine()]);
    activeWarehouse.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  // Sub-total follows qty x unit cost while the user hasn't overridden it directly.
  const setLineRecalc = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => {
    if (idx !== i) return l;
    const next = { ...l, ...patch };
    const qty = parseDecimal(next.quantity, 1);
    const cost = parseDecimal(next.unitCost);
    if (cost > 0) next.subTotal = String(Math.round(qty * cost * 100) / 100);
    return next;
  }));
  const formTotal = lines.reduce((sum, l) => sum + (l.itemId ? parseDecimal(l.subTotal) : 0), 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const picked = lines.filter((l) => l.itemId);
    if (picked.length === 0) { toast.error('Add at least one item'); return; }
    if (picked.some((l) => parseDecimal(l.quantity) <= 0)) { toast.error('Every item needs a quantity above zero'); return; }
    if (activeWarehouse.unresolved) { toast.error('Select the location the goods are leaving from'); return; }
    if (isService && !provider.trim()) { toast.error('Enter who the items are being sent to'); return; }
    create.mutate({
      destination,
      supplier_id: !isService ? supplierId || undefined : undefined,
      warehouse_id: activeWarehouse.warehouseId || undefined,
      reason: reason.trim() || undefined,
      date_returned: dateReturned || undefined,
      service_provider: isService ? provider.trim() : undefined,
      service_contact: isService ? contact.trim() || undefined : undefined,
      fault: isService ? fault.trim() || undefined : undefined,
      expected_back_date: isService ? expectedBack || undefined : undefined,
      lines: picked.map((l) => ({ item_id: l.itemId, quantity: parseDecimal(l.quantity, 1), sub_total: parseDecimal(l.subTotal) })),
    }, {
      onSuccess: (created) => {
        toast.success(isService ? `Repair order ${created.return_number} created` : `Return ${created.return_number} created`);
        onClose();
      },
      onError: async (err) => toast.error(await apiErrorMessage(err, 'Failed to create the return')),
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{isService ? 'New Repair Order' : 'New Purchase Return'}</h2>
              <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg hover:bg-accent transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Where are the goods going">
                  {DESTINATIONS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      role="radio"
                      aria-checked={destination === d.value}
                      onClick={() => setDestination(d.value)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${destination === d.value ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{DESTINATIONS.find((d) => d.value === destination)?.hint}</p>
              </div>

              {isService ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="svc-provider">Sent to *</label>
                    <Input id="svc-provider" list="svc-provider-list" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Technician, service or care centre" maxLength={200} />
                    <datalist id="svc-provider-list">{providerSuggestions.map((p) => <option key={p} value={p} />)}</datalist>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="svc-contact">Contact</label>
                    <Input id="svc-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone or email" maxLength={120} />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Supplier</label>
                  <select className={selectClass} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                    <option value="">— Select supplier —</option>
                    {suppliers.map((s) => {
                      const bal = supplierBalanceLabel(s);
                      return <option key={s.id} value={s.id}>{bal ? `${s.name} — ${bal}` : s.name}</option>;
                    })}
                  </select>
                  <SupplierBalanceNote orgSlug={org} supplierId={supplierId} />
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <ActiveWarehousePicker active={activeWarehouse} label={isService ? 'Sending from (location)' : 'Returning from (location)'} required />
                <div className="space-y-2">
                  <label className="text-sm font-medium">{isService ? 'Date sent' : 'Date Returned'}</label>
                  <Input type="date" value={dateReturned} max={localDateInput()} onChange={(e) => setDateReturned(e.target.value)} />
                </div>
              </div>

              {isService ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="svc-fault">What is wrong</label>
                    <Input id="svc-fault" value={fault} onChange={(e) => setFault(e.target.value)} placeholder="e.g. Swollen battery" maxLength={1000} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="svc-expected">Expected back</label>
                    <Input id="svc-expected" type="date" value={expectedBack} min={dateReturned} onChange={(e) => setExpectedBack(e.target.value)} />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reason</label>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged on arrival" />
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{isService ? 'Items sent *' : 'Returned Items *'}</label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setLines((ls) => [...ls, emptyLine()])}><Plus className="h-3 w-3 mr-1" /> Add item</Button>
                </div>
                <div className="hidden sm:grid grid-cols-12 gap-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="col-span-3">Quantity</span>
                  <span className="col-span-4">Unit cost</span>
                  <span className="col-span-4">{isService ? 'Cost value' : 'Sub-total'}</span>
                </div>
                {lines.map((l, i) => (
                  <div key={i} className="space-y-2 p-3 rounded-lg border border-border">
                    {/* Selecting an item prefills its unit cost (cost_price, then purchase_price) and the value. */}
                    <ItemSearchInput
                      orgSlug={org}
                      value={l.itemName}
                      onSelect={(item) => setLineRecalc(i, {
                        itemId: item.id,
                        itemName: item.name,
                        sku: item.sku ?? '',
                        unitCost: String(item.cost_price ?? item.purchase_price ?? ''),
                      })}
                      placeholder="Search item…"
                    />
                    {l.itemId && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{l.itemName}</span>{l.sku ? ` · ${l.sku}` : ''}
                      </p>
                    )}
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <Input className="col-span-3" type="number" min="0" step={DECIMAL_STEP} placeholder="Qty" aria-label="Quantity" value={l.quantity} onChange={(e) => setLineRecalc(i, { quantity: e.target.value })} />
                      <Input className="col-span-4" type="number" min="0" step={DECIMAL_STEP} placeholder="Unit cost" aria-label="Unit cost" value={l.unitCost} onChange={(e) => setLineRecalc(i, { unitCost: e.target.value })} />
                      <Input className="col-span-4" type="number" min="0" step={DECIMAL_STEP} placeholder={isService ? 'Cost value' : 'Sub-total'} aria-label={isService ? 'Cost value' : 'Sub-total'} value={l.subTotal} onChange={(e) => setLine(i, { subTotal: e.target.value })} />
                      {lines.length > 1 && <button type="button" aria-label="Remove item" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} className="col-span-1 text-muted-foreground hover:text-red-500"><Minus className="h-4 w-4" /></button>}
                    </div>
                  </div>
                ))}
                <div className="flex justify-end text-sm">
                  <span className="text-muted-foreground mr-2">{isService ? 'Total cost value' : 'Return total'}</span>
                  <span className="font-semibold tabular-nums">{formTotal.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={create.isPending}>{create.isPending ? 'Creating…' : isService ? 'Create Repair Order' : 'Create Return'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
