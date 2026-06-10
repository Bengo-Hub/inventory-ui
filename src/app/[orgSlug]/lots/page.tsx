'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { ItemSearchInput } from '@/components/inventory/ItemSearchInput';
import { useLots, useCreateLot, useUpdateLot, useDeleteLot } from '@/hooks/useLots';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useSuppliers } from '@/hooks/useSuppliers';
import type { Lot, CreateLotInput } from '@/lib/api/lots';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AlertTriangle, ChevronDown, Layers, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 20;
const EXPIRY_WARNING_DAYS = 30;

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

function isExpiringSoon(expiryDate?: string): boolean {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + EXPIRY_WARNING_DAYS);
    return expiry <= threshold && expiry > new Date();
}

function isExpired(expiryDate?: string): boolean {
    if (!expiryDate) return false;
    return new Date(expiryDate) <= new Date();
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
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Lot | null>(null);
    const [pendingDelete, setPendingDelete] = useState<Lot | null>(null);

    const [formItemId, setFormItemId] = useState('');
    const [formItemName, setFormItemName] = useState('');
    const [formWarehouseId, setFormWarehouseId] = useState('');
    const [formLotNumber, setFormLotNumber] = useState('');
    const [formQuantity, setFormQuantity] = useState('');
    const [formExpiryDate, setFormExpiryDate] = useState('');
    const [formMfgDate, setFormMfgDate] = useState('');
    const [formCostPerUnit, setFormCostPerUnit] = useState('');
    const [formSupplierRef, setFormSupplierRef] = useState('');
    const [formNotes, setFormNotes] = useState('');

    const { data: lots, isLoading, isError, refetch } = useLots(orgSlug);
    const { data: warehouses } = useWarehouses(orgSlug);
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

    useMemo(() => { setPage(1); }, [search]);

    function openCreate() {
        setEditing(null);
        setFormItemId('');
        setFormItemName('');
        setFormWarehouseId('');
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
        setFormWarehouseId(lot.warehouse_id);
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
            onError: () => { toast.error('Failed to delete lot'); setPendingDelete(null); },
        });
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formLotNumber.trim() || !formQuantity || !formWarehouseId) {
            toast.error('Lot number, warehouse, and quantity are required');
            return;
        }

        if (editing) {
            updateLot.mutate({
                id: editing.id,
                data: {
                    quantity: Number(formQuantity),
                    expiry_date: formExpiryDate || undefined,
                    manufacture_date: formMfgDate || undefined,
                    cost_per_unit: formCostPerUnit ? Number(formCostPerUnit) : undefined,
                    supplier_reference: formSupplierRef.trim() || undefined,
                    notes: formNotes.trim() || undefined,
                },
            }, {
                onSuccess: () => { toast.success('Lot updated'); closeDialog(); },
                onError: () => toast.error('Failed to update lot'),
            });
        } else {
            if (!formItemId) { toast.error('Select an item'); return; }
            const data: CreateLotInput = {
                item_id: formItemId,
                warehouse_id: formWarehouseId,
                lot_number: formLotNumber.trim(),
                quantity: Number(formQuantity),
                expiry_date: formExpiryDate || undefined,
                manufacture_date: formMfgDate || undefined,
                cost_per_unit: formCostPerUnit ? Number(formCostPerUnit) : undefined,
                supplier_reference: formSupplierRef.trim() || undefined,
                notes: formNotes.trim() || undefined,
            };
            createLot.mutate(data, {
                onSuccess: () => { toast.success('Lot created'); closeDialog(); },
                onError: () => toast.error('Failed to create lot'),
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
                <Button onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Lot
                </Button>
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
                <CardHeader>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by lot number, item, or SKU..."
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
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Lot Number</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Item</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Warehouse</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Expiry Date</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Quantity</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                                            Loading lots...
                                        </td>
                                    </tr>
                                ) : isError ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <AlertTriangle className="h-10 w-10 mx-auto text-destructive/60 mb-3" />
                                            <p className="text-muted-foreground">Couldn&apos;t load lots</p>
                                            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
                                        </td>
                                    </tr>
                                ) : (filtered?.length ?? 0) === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <Layers className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No lots found</p>
                                            <p className="text-xs text-muted-foreground/70 mt-1">Lots are created on PO receive or manually here</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map((lot) => {
                                        const expiring = isExpiringSoon(lot.expiry_date);
                                        const expired = isExpired(lot.expiry_date);
                                        const statusVariant: 'success' | 'warning' | 'error' | 'default' = expired ? 'error' : expiring ? 'warning' : 'success';
                                        const statusLabel = expired ? 'Expired' : expiring ? 'Expiring Soon' : 'Active';
                                        return (
                                            <tr
                                                key={lot.id}
                                                className={`hover:bg-accent/30 transition-colors ${
                                                    expiring ? 'bg-yellow-500/5' : expired ? 'bg-red-500/5' : ''
                                                }`}
                                            >
                                                <td className="px-6 py-4 font-mono text-xs font-medium">{lot.lot_number}</td>
                                                <td className="px-6 py-4">
                                                    <div>{lot.item_name ?? '—'}</div>
                                                    {lot.item_sku && <div className="text-xs text-muted-foreground font-mono">{lot.item_sku}</div>}
                                                </td>
                                                <td className="px-6 py-4 text-muted-foreground hidden md:table-cell">{lot.warehouse_name ?? '—'}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        {lot.expiry_date ? (
                                                            <>
                                                                <span className={expired ? 'text-red-500 font-medium' : expiring ? 'text-yellow-500 font-medium' : ''}>
                                                                    {new Date(lot.expiry_date).toLocaleDateString()}
                                                                </span>
                                                                {(expiring || expired) && (
                                                                    <AlertTriangle className={`h-3.5 w-3.5 ${expired ? 'text-red-500' : 'text-yellow-500'}`} />
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="text-muted-foreground">N/A</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right font-semibold tabular-nums hidden sm:table-cell">
                                                    {lot.quantity.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant={statusVariant}>{statusLabel}</Badge>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button variant="ghost" size="sm" onClick={() => openEdit(lot)}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-destructive hover:text-destructive"
                                                            onClick={() => handleDelete(lot)}
                                                            disabled={deleteLot.isPending}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!isLoading && (filtered?.length ?? 0) > 0 && (
                        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                    )}
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
                                            <label className="text-sm font-medium">Warehouse *</label>
                                            <select
                                                value={formWarehouseId}
                                                onChange={(e) => setFormWarehouseId(e.target.value)}
                                                disabled={!!editing}
                                                required
                                                className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none disabled:opacity-60"
                                            >
                                                <option value="">Select warehouse...</option>
                                                {warehouses?.map((wh) => (
                                                    <option key={wh.id} value={wh.id}>{wh.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Quantity *</label>
                                            <Input
                                                type="number"
                                                min="0"
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
                                                step="0.01"
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
