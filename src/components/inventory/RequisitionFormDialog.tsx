'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { ItemSearchInput } from '@/components/inventory/ItemSearchInput';
import { CreatableSelect } from '@/components/inventory/CreatableSelect';
import { SupplierFormDialog } from '@/components/inventory/SupplierFormDialog';
import { WarehouseQuickCreateDialog } from '@/components/inventory/WarehouseQuickCreateDialog';
import { apiErrorMessage } from '@/lib/api/error-message';
import { useSuppliers, useCreateSupplier } from '@/hooks/useSuppliers';
import { useWarehouses } from '@/hooks/useWarehouses';
import { type CreateRequisitionInput, type Priority, type RequestType, type RequisitionLine } from '@/lib/api/requisitions';
import { Plus, Trash2, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

interface Props {
    isPending: boolean;
    onSubmit: (data: CreateRequisitionInput) => void;
    onClose: () => void;
}

// The three request types drive what the rest of the form looks like — this is the
// gating the legacy ERP form had and that the migrated stub had dropped.
const REQUEST_TYPES: { value: RequestType; label: string; hint: string }[] = [
    { value: 'inventory', label: 'Inventory Item', hint: 'Replenish stock items already in the catalog.' },
    { value: 'external_item', label: 'External Item', hint: 'Buy non-catalog goods from a supplier.' },
    { value: 'service', label: 'Service', hint: 'Engage a service / consultancy — no stock lines.' },
];
const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'critical'];

type InvLine = { itemId: string; itemName: string; quantity: string; urgent: boolean };
type ExtLine = { description: string; specifications: string; quantity: string; estimatedPrice: string; supplierId: string; urgent: boolean };

const emptyInv = (): InvLine => ({ itemId: '', itemName: '', quantity: '1', urgent: false });
const emptyExt = (): ExtLine => ({ description: '', specifications: '', quantity: '1', estimatedPrice: '', supplierId: '', urgent: false });

const selectClass = 'w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none';
const textareaClass = `${selectClass} resize-none`;

export function RequisitionFormDialog({ isPending, onSubmit, onClose }: Props) {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;

    const [requestType, setRequestType] = useState<RequestType>('inventory');
    const [purpose, setPurpose] = useState('');
    const [priority, setPriority] = useState<Priority>('medium');
    const [requiredBy, setRequiredBy] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');

    // Inventory type: destination branch + catalog item lines.
    const [branchId, setBranchId] = useState('');
    const [invLines, setInvLines] = useState<InvLine[]>([emptyInv()]);
    // External type: free-text item lines with specs, estimated price and preferred supplier.
    const [extLines, setExtLines] = useState<ExtLine[]>([emptyExt()]);
    // Service type: no line items, a single service description block instead.
    const [serviceDescription, setServiceDescription] = useState('');
    const [expectedDeliverables, setExpectedDeliverables] = useState('');
    const [duration, setDuration] = useState('');

    const { data: warehouses } = useWarehouses(orgSlug);
    const { data: suppliersPage } = useSuppliers(orgSlug);
    const suppliers = suppliersPage?.data ?? [];
    const createSupplier = useCreateSupplier(orgSlug);

    // Inline create-and-link: track which (per-line) supplier picker requested a quick-create,
    // and whether the branch warehouse picker did.
    const [addSupplierForLine, setAddSupplierForLine] = useState<number | null>(null);
    const [addWarehouseOpen, setAddWarehouseOpen] = useState(false);

    const isInventory = requestType === 'inventory';
    const isExternal = requestType === 'external_item';
    const isService = requestType === 'service';
    const activeHint = REQUEST_TYPES.find((t) => t.value === requestType)?.hint ?? '';

    function setInv(i: number, patch: Partial<InvLine>) { setInvLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l))); }
    function setExt(i: number, patch: Partial<ExtLine>) { setExtLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l))); }

    // Build the typed line payload the API expects, gated by the selected request type.
    function buildLines(): RequisitionLine[] | null {
        if (isService) {
            if (!serviceDescription.trim()) { setError('Service description is required.'); return null; }
            return [{
                item_type: 'service',
                quantity: 1,
                service_description: serviceDescription.trim(),
                expected_deliverables: expectedDeliverables.trim() || undefined,
                duration: duration.trim() || undefined,
            }];
        }
        if (isInventory) {
            const lines = invLines
                .filter((l) => l.itemId)
                .map<RequisitionLine>((l) => ({ item_type: 'inventory', item_id: l.itemId, quantity: Number(l.quantity) || 1, urgent: l.urgent }));
            if (lines.length === 0) { setError('Add at least one inventory item.'); return null; }
            return lines;
        }
        const lines = extLines
            .filter((l) => l.description.trim())
            .map<RequisitionLine>((l) => ({
                item_type: 'external',
                description: l.description.trim(),
                specifications: l.specifications.trim() || undefined,
                quantity: Number(l.quantity) || 1,
                estimated_price: l.estimatedPrice ? Number(l.estimatedPrice) : undefined,
                supplier_id: l.supplierId || undefined,
                urgent: l.urgent,
            }));
        if (lines.length === 0) { setError('Add at least one external item with a description.'); return null; }
        return lines;
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        if (!purpose.trim()) { setError('Purpose is required.'); return; }
        const lines = buildLines();
        if (!lines) return;
        onSubmit({
            request_type: requestType,
            purpose: purpose.trim(),
            priority,
            required_by_date: requiredBy ? new Date(requiredBy).toISOString() : undefined,
            outlet_id: isInventory && branchId ? branchId : undefined,
            notes: notes.trim() || undefined,
            lines,
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-50 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">New Requisition</h2>
                            <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent transition-colors">
                                <X className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Request type — drives the rest of the form */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Request Type</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {REQUEST_TYPES.map((t) => (
                                        <button
                                            key={t.value}
                                            type="button"
                                            onClick={() => { setRequestType(t.value); setError(''); }}
                                            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                                                requestType === t.value
                                                    ? 'border-primary bg-primary/10 text-primary'
                                                    : 'border-input text-muted-foreground hover:bg-accent'
                                            }`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground">{activeHint}</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Priority</label>
                                    <select className={selectClass} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                                        {PRIORITIES.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Required By</label>
                                    <Input type="date" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Purpose *</label>
                                <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Why is this needed?" required />
                            </div>

                            {/* ── Inventory branch (inventory type only) ── */}
                            {isInventory && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Destination Branch / Warehouse</label>
                                    <CreatableSelect
                                        value={branchId}
                                        onChange={setBranchId}
                                        options={(warehouses ?? []).map((wh) => ({ id: wh.id, name: wh.name }))}
                                        placeholder="— Select (optional) —"
                                        onAddClick={() => setAddWarehouseOpen(true)}
                                        addLabel="Add warehouse"
                                    />
                                </div>
                            )}

                            {/* ── Inventory line items ── */}
                            {isInventory && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium">Inventory Items *</label>
                                        <Button type="button" variant="ghost" size="sm" onClick={() => setInvLines((ls) => [...ls, emptyInv()])}>
                                            <Plus className="h-3 w-3 mr-1" /> Add
                                        </Button>
                                    </div>
                                    {invLines.map((l, i) => (
                                        <div key={i} className="space-y-2 p-3 rounded-lg border border-border">
                                            <ItemSearchInput
                                                orgSlug={orgSlug}
                                                value={l.itemName}
                                                onSelect={(item) => setInv(i, { itemId: item.id, itemName: item.name })}
                                                placeholder="Search catalog item…"
                                            />
                                            <div className="grid grid-cols-12 gap-2 items-center">
                                                <Input className="col-span-4" type="number" min="1" placeholder="Qty" value={l.quantity} onChange={(e) => setInv(i, { quantity: e.target.value })} />
                                                <label className="col-span-6 flex items-center gap-2 text-xs text-muted-foreground">
                                                    <input type="checkbox" checked={l.urgent} onChange={(e) => setInv(i, { urgent: e.target.checked })} className="rounded" /> Urgent
                                                </label>
                                                {invLines.length > 1 && (
                                                    <button type="button" onClick={() => setInvLines((ls) => ls.filter((_, idx) => idx !== i))} className="col-span-2 text-muted-foreground hover:text-red-500">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* ── External item lines ── */}
                            {isExternal && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium">External Items *</label>
                                        <Button type="button" variant="ghost" size="sm" onClick={() => setExtLines((ls) => [...ls, emptyExt()])}>
                                            <Plus className="h-3 w-3 mr-1" /> Add
                                        </Button>
                                    </div>
                                    {extLines.map((l, i) => (
                                        <div key={i} className="space-y-2 p-3 rounded-lg border border-border">
                                            <Input placeholder="Item description *" value={l.description} onChange={(e) => setExt(i, { description: e.target.value })} />
                                            <Input placeholder="Specifications (brand, model, spec…)" value={l.specifications} onChange={(e) => setExt(i, { specifications: e.target.value })} />
                                            <div className="grid grid-cols-2 gap-2">
                                                <Input type="number" min="1" placeholder="Qty" value={l.quantity} onChange={(e) => setExt(i, { quantity: e.target.value })} />
                                                <Input type="number" min="0" step="0.01" placeholder="Est. price" value={l.estimatedPrice} onChange={(e) => setExt(i, { estimatedPrice: e.target.value })} />
                                            </div>
                                            <CreatableSelect
                                                value={l.supplierId}
                                                onChange={(id) => setExt(i, { supplierId: id })}
                                                options={suppliers.map((s) => ({ id: s.id, name: s.name }))}
                                                placeholder="Preferred supplier (optional)"
                                                onAddClick={() => setAddSupplierForLine(i)}
                                                addLabel="Add supplier"
                                            />
                                            <div className="flex items-center justify-between">
                                                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <input type="checkbox" checked={l.urgent} onChange={(e) => setExt(i, { urgent: e.target.checked })} className="rounded" /> Urgent
                                                </label>
                                                {extLines.length > 1 && (
                                                    <button type="button" onClick={() => setExtLines((ls) => ls.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-red-500">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* ── Service block (no line items) ── */}
                            {isService && (
                                <div className="space-y-4 p-3 rounded-lg border border-border">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Service Description *</label>
                                        <textarea className={textareaClass} rows={3} value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} placeholder="Describe the service / scope of work…" />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Expected Deliverables</label>
                                            <textarea className={textareaClass} rows={2} value={expectedDeliverables} onChange={(e) => setExpectedDeliverables(e.target.value)} placeholder="What should be delivered?" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Duration</label>
                                            <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 3 weeks" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Notes</label>
                                <textarea className={textareaClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
                            </div>

                            {error && <p className="text-sm text-red-500">{error}</p>}

                            <div className="flex gap-3 pt-2">
                                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                                <Button type="submit" className="flex-1" disabled={isPending}>{isPending ? 'Creating…' : 'Create Requisition'}</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>

            {addSupplierForLine !== null && (
                <SupplierFormDialog
                    editing={null}
                    isPending={createSupplier.isPending}
                    onClose={() => setAddSupplierForLine(null)}
                    onSubmit={(data) => createSupplier.mutate(data, {
                        onSuccess: (s) => {
                            toast.success('Supplier created');
                            setExt(addSupplierForLine, { supplierId: s.id });
                            setAddSupplierForLine(null);
                        },
                        onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to create supplier')),
                    })}
                />
            )}

            {addWarehouseOpen && (
                <WarehouseQuickCreateDialog
                    orgSlug={orgSlug}
                    onClose={() => setAddWarehouseOpen(false)}
                    onCreated={(wh) => { setBranchId(wh.id); setAddWarehouseOpen(false); }}
                />
            )}
        </div>
    );
}
