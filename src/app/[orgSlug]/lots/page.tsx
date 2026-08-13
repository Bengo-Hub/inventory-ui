'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { ItemSearchInput } from '@/components/inventory/ItemSearchInput';
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker';
import { useLots, useCreateLot, useUpdateLot, useDeleteLot } from '@/hooks/useLots';
import { useActiveWarehouse } from '@/hooks/useActiveWarehouse';
import { ActiveWarehousePicker } from '@/components/inventory/ActiveWarehousePicker';
import { useSuppliers } from '@/hooks/useSuppliers';
import type { Lot, CreateLotInput } from '@/lib/api/lots';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildLotColumns, isExpired, isExpiringSoon } from './lot-columns';
import { AlertTriangle, ChevronDown, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';
import { DECIMAL_STEP, parseDecimal } from '@/lib/utils';

const ITEMS_PER_PAGE = 20;
const EXPIRY_WARNING_DAYS = 30;
// isExpiringSoon / isExpired live in ./lot-columns (shared with column render logic).

function SupplierRefCombobox({
    orgSlug,
    value,
    onChange,
}: {
    orgSlug: string;
    value: string;
    onChange: (v: string) => void;
}) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const { data: suppliersPage } = useSuppliers(orgSlug);
    const suppliers = suppliersPage?.data ?? [];

    const filtered = useMemo(() => {
        if (query.length < 2) return [];
        const q = query.toLowerCase();
        return suppliers.filter((s) =>
            s.name.toLowerCase().includes(q) ||
            (s.email ?? '').toLowerCase().includes(q) ||
            (s.phone ?? '').toLowerCase().includes(q)
        ).slice(0, 8);
    }, [suppliers, query]);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div className="relative" ref={ref}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    value={query || value}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        onChange(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    placeholder="Search supplier or type PO / invoice number..."
                    className="pl-10 pr-8"
                />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
            {open && filtered.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/30 border-b border-border">
                        Suppliers
                    </div>
                    {filtered.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-colors"
                            onMouseDown={() => {
                                onChange(s.name);
                                setQuery('');
                                setOpen(false);
                            }}
                        >
                            <span className="font-medium">{s.name}</span>
                            {s.phone && <span className="ml-2 text-xs text-muted-foreground">{s.phone}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function generateLotNumber(): string {
    const d = new Date();
    const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `LOT-${dateStr}-${rand}`;
}

export default function LotsPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [search, setSearch] = useState('');
    const [range, setRange] = useState<DateRange>({ from: '', to: '' });
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Lot | null>(null);
    const [pendingDelete, setPendingDelete] = useState<Lot | null>(null);

    const [formItemId, setFormItemId] = useState('');
    const [formItemName, setFormItemName] = useState('');
    const formWarehouse = useActiveWarehouse(orgSlug);
    const [formLotNumber, setFormLotNumber] = useState('');
    const [formQuantity, setFormQuantity] = useState('');
    const [formExpiryDate, setFormExpiryDate] = useState('');
    const [formMfgDate, setFormMfgDate] = useState('');
    const [formCostPerUnit, setFormCostPerUnit] = useState('');
    const [formSupplierRef, setFormSupplierRef] = useState('');
    const [formNotes, setFormNotes] = useState('');

    const { data: lots, isLoading, isError, refetch, isFetching } = useLots(orgSlug, {
        from: range.from || undefined,
        to: range.to || undefined,
    });
    useSuppliers(orgSlug); // preload suppliers for combobox
    const createLot = useCreateLot(orgSlug);
    const updateLot = useUpdateLot(orgSlug);
    const deleteLot = useDeleteLot(orgSlug);

    const filtered = search
        ? lots?.filter((l) =>
            (l.lot_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
            (l.item_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
            (l.item_sku ?? '').toLowerCase().includes(search.toLowerCase())
          )
        : lots;

    const totalPages = Math.max(1, Math.ceil((filtered?.length ?? 0) / ITEMS_PER_PAGE));
    const paginatedItems = filtered?.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE) ?? [];
    const expiringSoonCount = lots?.filter((l) => isExpiringSoon(l.expiry_date)).length ?? 0;

    useMemo(() => { setPage(1); }, [search, range]);

    const columns = useMemo(
        () => buildLotColumns({ isDeleting: deleteLot.isPending, onEdit: openEdit, onDelete: handleDelete }),
        [deleteLot.isPending],
    );

    function openCreate() {
        setEditing(null);
        setFormItemId('');
        setFormItemName('');
        formWarehouse.reset();
        setFormLotNumber(generateLotNumber());
        setFormQuantity('');
        setFormExpiryDate('');
        setFormMfgDate('');
        setFormCostPerUnit('');
        setFormSupplierRef('');
        setFormNotes('');
        setDialogOpen(true);
    }

    function openEdit(lot: Lot) {
        setEditing(lot);
        setFormItemId(lot.item_id);
        setFormItemName(lot.item_name ?? '');
        setFormLotNumber(lot.lot_number);
        setFormQuantity(String(lot.quantity));
        setFormExpiryDate(lot.expiry_date ? lot.expiry_date.split('T')[0] : '');
        setFormMfgDate(lot.manufacture_date ? lot.manufacture_date.split('T')[0] : '');
        setFormCostPerUnit(String(lot.cost_per_unit ?? ''));
        setFormSupplierRef(lot.supplier_reference ?? '');
        setFormNotes(lot.notes ?? '');
        setDialogOpen(true);
    }

    function closeDialog() {
        setDialogOpen(false);
        setEditing(null);
    }

    function handleDelete(lot: Lot) {
        setPendingDelete(lot);
    }

    function executeDelete() {
        if (!pendingDelete) return;
        deleteLot.mutate(pendingDelete.id, {
            onSuccess: () => { toast.success('Lot deleted'); setPendingDelete(null); },
            onError: async (e) => { toast.error(await apiErrorMessage(e, 'Failed to delete lot')); setPendingDelete(null); },
        });
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formLotNumber.trim() || !formQuantity || (!editing && !formWarehouse.warehouseId)) {
            toast.error('Lot number, warehouse, and quantity are required');
            return;
        }

        if (editing) {
            updateLot.mutate({
                id: editing.id,
                data: {
                    quantity: parseDecimal(formQuantity),
                    expiry_date: formExpiryDate || undefined,
                    manufacture_date: formMfgDate || undefined,
                    cost_per_unit: formCostPerUnit ? parseDecimal(formCostPerUnit) : undefined,
                    supplier_reference: formSupplierRef.trim() || undefined,
                    notes: formNotes.trim() || undefined,
                },
            }, {
                onSuccess: () => { toast.success('Lot updated'); closeDialog(); },
                onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to update lot')),
            });
        } else {
            if (!formItemId) { toast.error('Select an item'); return; }
            const data: CreateLotInput = {
                item_id: formItemId,
                warehouse_id: formWarehouse.warehouseId,
                lot_number: formLotNumber.trim(),
                quantity: parseDecimal(formQuantity),
                expiry_date: formExpiryDate || undefined,
                manufacture_date: formMfgDate || undefined,
                cost_per_unit: formCostPerUnit ? parseDecimal(formCostPerUnit) : undefined,
                supplier_reference: formSupplierRef.trim() || undefined,
                notes: formNotes.trim() || undefined,
            };
            createLot.mutate(data, {
                onSuccess: () => { toast.success('Lot created'); closeDialog(); },
                onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to create lot')),
            });
        }
    }

    const isPending = createLot.isPending || updateLot.isPending;

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Lots & Batches</h1>
                    <p className="text-muted-foreground mt-1">Track lot numbers, batches, and expiry dates</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isFetching}
                        onClick={() => refetch()}
                        title="Refresh — pulls in lots received/consumed elsewhere"
                    >
                        <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button onClick={openCreate}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Lot
                    </Button>
                </div>
            </div>

            {expiringSoonCount > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <p className="text-sm font-medium">
                        {expiringSoonCount} lot{expiringSoonCount > 1 ? 's' : ''} expiring within {EXPIRY_WARNING_DAYS} days
                    </p>
                </div>
            )}

            <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by lot number, item, or SKU..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <DateRangePicker value={range} onChange={setRange} className="w-56" />
                </CardHeader>
                <CardContent className="p-0">
                    <div className="px-2 pb-2">
                        <DataTable<Lot>
                            columns={columns}
                            rows={paginatedItems}
                            rowKey={(l) => l.id}
                            loading={isLoading}
                            error={isError}
                            onRetry={() => refetch()}
                            emptyText="No lots found — lots are created on PO receive or manually here"
                            storageKey="lots-col-prefs"
                            rowClassName={(lot) => (isExpired(lot.expiry_date) ? 'bg-red-500/5' : isExpiringSoon(lot.expiry_date) ? 'bg-yellow-500/5' : undefined)}
                            page={page}
                            totalPages={totalPages}
                            onPageChange={setPage}
                            total={filtered?.length}
                            pageSize={ITEMS_PER_PAGE}
                        />
                    </div>
                </CardContent>
            </Card>

            <ConfirmDialog
                open={!!pendingDelete}
                title="Delete Lot"
                description={`Delete lot "${pendingDelete?.lot_number}"? This action cannot be undone.`}
                variant="danger"
                confirmLabel="Delete"
                onConfirm={executeDelete}
                onCancel={() => setPendingDelete(null)}
            />

            {dialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeDialog} />
                    <div className="relative z-50 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold">{editing ? 'Edit Lot' : 'New Lot'}</h2>
                                    <button onClick={closeDialog} className="p-1 rounded-lg hover:bg-accent transition-colors">
                                        <X className="h-5 w-5 text-muted-foreground" />
                                    </button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {!editing && (
                                        <ItemSearchInput
                                            orgSlug={orgSlug}
                                            value={formItemName}
                                            label="Item *"
                                            placeholder="Search for item..."
                                            onSelect={(item) => {
                                                setFormItemId(item.id);
                                                setFormItemName(item.name);
                                            }}
                                        />
                                    )}
                                    {editing && (
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium text-muted-foreground">Item</label>
                                            <p className="text-sm font-medium">{editing.item_name ?? editing.item_id}</p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Lot Number *</label>
                                            <Input
                                                value={formLotNumber}
                                                onChange={(e) => setFormLotNumber(e.target.value)}
                                                required
                                                readOnly={!!editing}
                                            />
                                            {!editing && (
                                                <p className="text-xs text-muted-foreground">Auto-generated. Edit only if you have a supplier-assigned batch number.</p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            {editing ? (
                                                <>
                                                    <label className="text-sm font-medium text-muted-foreground">Warehouse</label>
                                                    <p className="text-sm font-medium">
                                                        {formWarehouse.allWarehouses.find((w) => w.id === editing.warehouse_id)?.name ?? editing.warehouse_id}
                                                    </p>
                                                </>
                                            ) : (
                                                <ActiveWarehousePicker active={formWarehouse} label="Warehouse" required />
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Quantity *</label>
                                            <Input
                                                type="number"
                                                min="0"
                                                step={DECIMAL_STEP}
                                                value={formQuantity}
                                                onChange={(e) => setFormQuantity(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Cost Per Unit</label>
                                            <Input
                                                type="number"
                                                min="0"
                                                step={DECIMAL_STEP}
                                                placeholder="0.00"
                                                value={formCostPerUnit}
                                                onChange={(e) => setFormCostPerUnit(e.target.value)}
                                            />
                                            <p className="text-xs text-muted-foreground">Used for COGS tracking. Leave 0 if unknown.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Expiry Date</label>
                                            <Input
                                                type="date"
                                                value={formExpiryDate}
                                                onChange={(e) => setFormExpiryDate(e.target.value)}
                                            />
                                            <p className="text-xs text-muted-foreground">Leave blank for non-perishable items.</p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Manufacture Date</label>
                                            <Input
                                                type="date"
                                                value={formMfgDate}
                                                onChange={(e) => setFormMfgDate(e.target.value)}
                                            />
                                            <p className="text-xs text-muted-foreground">Optional. Used for traceability reporting.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Supplier / Reference</label>
                                        <SupplierRefCombobox
                                            orgSlug={orgSlug}
                                            value={formSupplierRef}
                                            onChange={setFormSupplierRef}
                                        />
                                        <p className="text-xs text-muted-foreground">Search a supplier or type a PO number / invoice reference manually.</p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Notes</label>
                                        <textarea
                                            placeholder="Optional notes..."
                                            value={formNotes}
                                            onChange={(e) => setFormNotes(e.target.value)}
                                            rows={2}
                                            className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none resize-none"
                                        />
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <Button type="button" variant="outline" className="flex-1" onClick={closeDialog}>
                                            Cancel
                                        </Button>
                                        <Button type="submit" className="flex-1" disabled={isPending}>
                                            {isPending ? 'Saving...' : editing ? 'Update Lot' : 'Create Lot'}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
