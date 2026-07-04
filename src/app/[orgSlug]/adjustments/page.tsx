'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { InfoHint } from '@/components/ui/info-hint';
import { ItemSearchInput } from '@/components/inventory/ItemSearchInput';
import { CreatableSelect } from '@/components/inventory/CreatableSelect';
import { WarehouseQuickCreateDialog } from '@/components/inventory/WarehouseQuickCreateDialog';
import { UnitQuickCreateDialog } from '@/components/inventory/UnitQuickCreateDialog';
import { ActiveWarehousePicker } from '@/components/inventory/ActiveWarehousePicker';
import { useCreateAdjustment, useAdjustments } from '@/hooks/useStock';
import { useCreateFromQuery } from '@/hooks/useCreateFromQuery';
import { useActiveWarehouse } from '@/hooks/useActiveWarehouse';
import { useUnits } from '@/hooks/useUnits';
import { FeatureLockBanner } from '@/components/subscription/feature-lock-banner';
import { AlertTriangle, ClipboardList, Minus, Plus, Search, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions, P } from '@/hooks/usePermissions';
import { apiErrorMessage } from '@/lib/api/error-message';
import { approvalGateFromError } from '@/lib/api/approvals';

/**
 * When a large adjustment is routed through the approval workflow the API returns a 422
 * with { approval_required: true }. Surface that as an informational message (not an error)
 * and report handled so callers skip the generic failure toast. Returns true if it was an
 * approval gate.
 */
function handleApprovalGate(e: unknown): boolean {
    const gate = approvalGateFromError(e);
    if (!gate) return false;
    toast.info(
        gate.state === 'pending' || gate.state === 'not_submitted'
            ? 'This adjustment is awaiting manager approval before it can post.'
            : gate.state === 'rejected'
                ? 'This adjustment was rejected by an approver and cannot post.'
                : 'This adjustment exceeds the approval threshold — a request has been sent for manager sign-off. It will post once approved.',
        { duration: 6000 },
    );
    return true;
}

const REASON_OPTIONS = [
    { value: 'correction', label: 'Count Correction' },
    { value: 'damaged', label: 'Damaged Goods' },
    { value: 'expired', label: 'Expired / Spoiled' },
    { value: 'shrinkage', label: 'Theft / Unexplained Loss' },
    { value: 'found', label: 'Found / Surplus Discovered' },
    { value: 'initial_count', label: 'Initial Stock Count' },
    { value: 'return', label: 'Customer Return' },
    { value: 'other', label: 'Other' },
];

interface AdjustmentModalProps {
    orgSlug: string;
    onClose: () => void;
    prefillSku?: string;
    prefillName?: string;
}

function AdjustmentModal({ orgSlug, onClose, prefillSku = '', prefillName = '' }: AdjustmentModalProps) {
    const [type, setType] = useState<'add' | 'remove'>('add');
    const [itemSku, setItemSku] = useState(prefillSku);
    const [itemName, setItemName] = useState(prefillName);
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');
    const [unitId, setUnitId] = useState('');

    // Branch resolution: default to the active outlet's warehouse; require an explicit pick
    // when "All Outlets" is selected (block submit while unresolved).
    const activeWarehouse = useActiveWarehouse(orgSlug);
    const { data: units } = useUnits(orgSlug);
    const mutation = useCreateAdjustment(orgSlug);

    const [addWarehouseOpen, setAddWarehouseOpen] = useState(false);
    const [addUnitOpen, setAddUnitOpen] = useState(false);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const qty = parseFloat(quantity);
        if (!itemSku || isNaN(qty) || qty <= 0 || !reason) {
            toast.error('Please fill in all required fields');
            return;
        }
        if (activeWarehouse.unresolved) {
            toast.error('Select a warehouse for this adjustment before submitting');
            return;
        }

        // Send the enum VALUE (e.g. "correction"), not the human label — the API validates
        // reason against the stockadjustment enum and silently collapses unknown values to
        // "other". The human note travels in `notes`.
        mutation.mutate({
            sku: itemSku,
            adjustment: type === 'add' ? qty : -qty,
            reason,
            notes: notes.trim() || undefined,
            warehouse_id: activeWarehouse.warehouseId || undefined,
            unit_id: unitId || undefined,
        }, {
            onSuccess: () => {
                toast.success('Stock adjustment recorded');
                onClose();
            },
            onError: async (e) => {
                if (handleApprovalGate(e)) { onClose(); return; }
                toast.error(await apiErrorMessage(e, 'Failed to record adjustment'));
            },
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-50 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">New Stock Adjustment</h2>
                            <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent transition-colors">
                                <X className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="flex gap-3">
                                <Button
                                    type="button"
                                    variant={type === 'add' ? 'primary' : 'outline'}
                                    onClick={() => setType('add')}
                                    className="flex-1"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Stock
                                </Button>
                                <Button
                                    type="button"
                                    variant={type === 'remove' ? 'destructive' : 'outline'}
                                    onClick={() => setType('remove')}
                                    className="flex-1"
                                >
                                    <Minus className="h-4 w-4 mr-2" />
                                    Remove Stock
                                </Button>
                            </div>

                            <ItemSearchInput
                                orgSlug={orgSlug}
                                value={itemName}
                                label="Item *"
                                placeholder="Search by name or SKU..."
                                onSelect={(item) => {
                                    setItemSku(item.sku);
                                    setItemName(item.name);
                                    // Preselect the chosen item's unit of measure.
                                    setUnitId(item.unit_id ?? '');
                                }}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Quantity *</label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        min="0"
                                        step="any"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Unit</label>
                                    <CreatableSelect
                                        value={unitId}
                                        onChange={setUnitId}
                                        options={(units ?? []).map((u) => ({ id: u.id, name: `${u.name}${u.abbreviation ? ` (${u.abbreviation})` : ''}` }))}
                                        placeholder="Base unit"
                                        onAddClick={() => setAddUnitOpen(true)}
                                        addLabel="Add unit"
                                    />
                                </div>
                            </div>

                            <ActiveWarehousePicker
                                active={activeWarehouse}
                                required
                                onAddNew={() => setAddWarehouseOpen(true)}
                            />

                            <div className="space-y-2">
                                <label className="text-sm font-medium inline-flex items-center gap-1">Reason *
                                    <InfoHint title="Why the count is changing">
                                        Sets the audit trail and reporting bucket. Use <strong>Initial Stock Count</strong> to load
                                        opening stock for a brand-new item, <strong>Count Correction</strong> after a stock take,
                                        and <strong>Damaged / Expired / Theft</strong> for write-offs (these may need manager approval
                                        above a configured amount).
                                    </InfoHint>
                                </label>
                                <select
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                >
                                    <option value="">Select reason...</option>
                                    {REASON_OPTIONS.map((r) => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                            </div>

                            {reason === 'other' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Notes *</label>
                                    <textarea
                                        placeholder="Describe the reason for this adjustment..."
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        required
                                        rows={3}
                                        className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none resize-none"
                                    />
                                </div>
                            )}

                            <div className="flex gap-3 pt-1">
                                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                                    Cancel
                                </Button>
                                <Button type="submit" className="flex-1" disabled={mutation.isPending || activeWarehouse.unresolved}>
                                    {mutation.isPending ? 'Recording...' : `Record ${type === 'add' ? 'Addition' : 'Removal'}`}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>

            {addWarehouseOpen && (
                <WarehouseQuickCreateDialog
                    orgSlug={orgSlug}
                    onClose={() => setAddWarehouseOpen(false)}
                    onCreated={(wh) => { activeWarehouse.setWarehouseId(wh.id); setAddWarehouseOpen(false); }}
                />
            )}
            {addUnitOpen && (
                <UnitQuickCreateDialog
                    orgSlug={orgSlug}
                    onClose={() => setAddUnitOpen(false)}
                    onCreated={(u) => { setUnitId(u.id); setAddUnitOpen(false); }}
                />
            )}
        </div>
    );
}

export default function AdjustmentsPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [search, setSearch] = useState('');
    const [page] = useState(1);
    const [showModal, setShowModal] = useState(false);
    useCreateFromQuery(() => setShowModal(true)); // mobile quick-add → open New Adjustment
    const [prefillSku, setPrefillSku] = useState('');
    const [prefillName, setPrefillName] = useState('');

    const { canAny } = usePermissions();
    const canAdjust = canAny([P.ADJUSTMENTS_ADD, P.ADJUSTMENTS_MANAGE]);

    const { data: adjustments, isLoading, isError, refetch } = useAdjustments(orgSlug);

    const filtered = useMemo(() => {
        if (!search) return adjustments;
        const q = search.toLowerCase();
        return adjustments?.filter((a) =>
            (a.item_name ?? '').toLowerCase().includes(q) ||
            (a.reason ?? '').toLowerCase().includes(q) ||
            (a.warehouse_name ?? '').toLowerCase().includes(q)
        );
    }, [adjustments, search]);

    const ITEMS_PER_PAGE = 25;
    const totalPages = Math.max(1, Math.ceil((filtered?.length ?? 0) / ITEMS_PER_PAGE));
    const paginated = filtered?.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE) ?? [];

    function openModal(sku = '', name = '') {
        setPrefillSku(sku);
        setPrefillName(name);
        setShowModal(true);
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Stock Adjustments</h1>
                    <p className="text-muted-foreground mt-1">Add or remove stock manually</p>
                </div>
                {canAdjust && (
                    <Button onClick={() => openModal()}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Adjustment
                    </Button>
                )}
            </div>

            {/* Non-hiding upgrade blocker: keeps the page + button visible, explains the lock. */}
            <FeatureLockBanner feature="stock_tracking" />

            <Card>
                <CardHeader>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by item, reason, or warehouse..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Date</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Item</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Warehouse</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Qty Change</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Reason</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                            Loading history...
                                        </td>
                                    </tr>
                                ) : isError ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <AlertTriangle className="h-10 w-10 mx-auto text-destructive/60 mb-3" />
                                            <p className="text-muted-foreground">Couldn&apos;t load adjustments</p>
                                            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
                                        </td>
                                    </tr>
                                ) : (paginated?.length ?? 0) === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No adjustments recorded yet</p>
                                            <p className="text-xs text-muted-foreground/70 mt-1">Click "New Adjustment" to record your first stock change</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginated.map((adj) => (
                                        <tr key={adj.id} className="hover:bg-accent/30 transition-colors">
                                            <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                                                {new Date(adj.adjusted_at ?? adj.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium">{adj.item_name || '—'}</div>
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground hidden md:table-cell">
                                                {adj.warehouse_name || '—'}
                                            </td>
                                            <td className={`px-6 py-4 text-right tabular-nums font-semibold ${adj.quantity_change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                                                {adj.quantity_change > 0 ? '+' : ''}{adj.quantity_change}
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground hidden sm:table-cell capitalize">
                                                {adj.reason}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!isLoading && totalPages > 1 && (
                        <div className="px-6 py-3 text-xs text-muted-foreground border-t border-border">
                            {filtered?.length ?? 0} adjustments
                        </div>
                    )}
                </CardContent>
            </Card>

            {showModal && (
                <AdjustmentModal
                    orgSlug={orgSlug}
                    onClose={() => setShowModal(false)}
                    prefillSku={prefillSku}
                    prefillName={prefillName}
                />
            )}
        </div>
    );
}
