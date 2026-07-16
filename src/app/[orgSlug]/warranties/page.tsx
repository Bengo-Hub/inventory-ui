'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ItemSearchInput } from '@/components/inventory/ItemSearchInput';
import { DetailDrawer } from '@/components/inventory/DetailDrawer';
import { RowActions } from '@/components/inventory/RowActions';
import { SubscriptionGate } from '@/components/subscription/subscription-gate';
import { useWarranties, useCreateWarranty, useUpdateWarranty, useClaimWarranty, useVoidWarranty, useDeleteWarranty } from '@/hooks/useWarranties';
import { type Warranty, type WarrantyStatus, type WarrantyWriteInput } from '@/lib/api/warranties';
import { AlertTriangle, Plus, Search, ShieldCheck, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions, P } from '@/hooks/usePermissions';
import { apiErrorMessage } from '@/lib/api/error-message';

const ITEMS_PER_PAGE = 20;
const textareaClass = 'w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none resize-none';

// active=green, claimed=blue (primary tint), voided=gray, expired=amber
const STATUS_VARIANT: Record<WarrantyStatus, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
    active: 'success', claimed: 'default', voided: 'outline', expired: 'warning',
};

type Tab = '' | WarrantyStatus;
const TABS: { key: Tab; label: string }[] = [
    { key: '', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'claimed', label: 'Claimed' },
    { key: 'expired', label: 'Expired' },
    { key: 'voided', label: 'Voided' },
];

const toDateInput = (s?: string) => (s ? s.slice(0, 10) : '');
const toISO = (d: string) => (d ? new Date(d).toISOString() : undefined);
const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString() : '—');

export default function WarrantiesPage() {
    const params = useParams();
    const org = params?.orgSlug as string;
    const [tab, setTab] = useState<Tab>('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Warranty | null>(null);
    const [viewing, setViewing] = useState<Warranty | null>(null);
    const [confirming, setConfirming] = useState<{ action: 'claim' | 'void' | 'delete'; w: Warranty } | null>(null);

    // Form state
    const [itemId, setItemId] = useState('');
    const [itemLabel, setItemLabel] = useState('');
    const [serial, setSerial] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [purchaseDate, setPurchaseDate] = useState('');
    const [warrantyStart, setWarrantyStart] = useState('');
    const [warrantyEnd, setWarrantyEnd] = useState('');
    const [coverageMonths, setCoverageMonths] = useState('');
    const [notes, setNotes] = useState('');

    // Search goes to the server; status is filtered client-side because the API computes
    // "expired" from the coverage window (an active row past warranty_end reads as expired),
    // so a server-side status=active/expired filter wouldn't match what users see.
    const { data, isLoading, isError, refetch } = useWarranties(org, { search: search.trim() || undefined });
    const create = useCreateWarranty(org);
    const update = useUpdateWarranty(org);
    const claim = useClaimWarranty(org);
    const voidW = useVoidWarranty(org);
    const remove = useDeleteWarranty(org);

    const { canAny } = usePermissions();
    const canAdd = canAny([P.CATALOG_ADD, P.CATALOG_MANAGE]);
    const canChange = canAny([P.CATALOG_CHANGE, P.CATALOG_MANAGE]);
    const canDelete = canAny([P.CATALOG_DELETE, P.CATALOG_MANAGE]);

    const all = useMemo(() => data ?? [], [data]);
    const filtered = useMemo(() => (tab ? all.filter((w) => w.status === tab) : all), [all, tab]);
    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const rows = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
    useEffect(() => { setPage(1); }, [tab, search]);

    const isPending = create.isPending || update.isPending;
    const mutErr = async (e: unknown, msg: string) => toast.error(await apiErrorMessage(e, msg));

    function openNew() {
        setEditing(null); setItemId(''); setItemLabel(''); setSerial(''); setCustomerId('');
        setPurchaseDate(''); setWarrantyStart(''); setWarrantyEnd(''); setCoverageMonths(''); setNotes('');
        setOpen(true);
    }
    function openEdit(w: Warranty) {
        setEditing(w); setItemId(w.item_id); setItemLabel(`${w.item_name} (${w.item_sku})`);
        setSerial(w.serial_number); setCustomerId(w.customer_id ?? '');
        setPurchaseDate(toDateInput(w.purchase_date)); setWarrantyStart(toDateInput(w.warranty_start));
        setWarrantyEnd(toDateInput(w.warranty_end)); setCoverageMonths(''); setNotes(w.notes ?? '');
        setOpen(true);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!editing && !itemId) { toast.error('Select an item'); return; }
        if (!serial.trim()) { toast.error('Serial number is required'); return; }
        const body: WarrantyWriteInput = {
            item_id: editing ? undefined : itemId,
            serial_number: serial.trim(),
            customer_id: customerId.trim() || undefined,
            purchase_date: toISO(purchaseDate),
            warranty_start: toISO(warrantyStart),
            warranty_end: toISO(warrantyEnd),
            coverage_months: !warrantyEnd && coverageMonths ? parseInt(coverageMonths, 10) : undefined,
            notes: notes.trim() || undefined,
        };
        const done = () => { toast.success(editing ? 'Warranty updated' : 'Warranty registered'); setOpen(false); };
        if (editing) update.mutate({ id: editing.id, data: body }, { onSuccess: done, onError: (e) => mutErr(e, 'Failed to update warranty') });
        else create.mutate(body, { onSuccess: done, onError: (e) => mutErr(e, 'Failed to register warranty') });
    }

    function runConfirmed() {
        if (!confirming) return;
        const { action, w } = confirming;
        const opts = (msg: string) => ({
            onSuccess: () => { toast.success(msg); setConfirming(null); setViewing(null); },
            onError: async (e: unknown) => { await mutErr(e, 'Action failed'); setConfirming(null); },
        });
        if (action === 'claim') claim.mutate({ id: w.id }, opts('Warranty marked as claimed'));
        else if (action === 'void') voidW.mutate({ id: w.id }, opts('Warranty voided'));
        else remove.mutate(w.id, opts('Warranty deleted'));
    }

    const rowExtra = (w: Warranty) => canChange && (
        <>
            {w.status === 'active' && (
                <Button variant="outline" size="sm" onClick={() => setConfirming({ action: 'claim', w })}>Claim</Button>
            )}
            {w.status !== 'voided' && (
                <Button variant="outline" size="sm" onClick={() => setConfirming({ action: 'void', w })}>Void</Button>
            )}
        </>
    );

    return (
        <SubscriptionGate feature="warranties">
            <div className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><ShieldCheck className="h-6 w-6" /> Warranties</h1>
                        <p className="text-muted-foreground mt-1">Warranty coverage for serialized items</p>
                    </div>
                    {canAdd && <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Register Warranty</Button>}
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
                                {TABS.map(({ key, label }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setTab(key)}
                                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <div className="relative sm:ml-auto sm:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input className="pl-10" placeholder="Search serial, item or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30">
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground">Serial</th>
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground">Item</th>
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Purchased</th>
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden lg:table-cell">Coverage</th>
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                                        <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading && <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">Loading…</td></tr>}
                                    {!isLoading && isError && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center">
                                                <AlertTriangle className="h-10 w-10 mx-auto text-destructive/60 mb-3" />
                                                <p className="text-muted-foreground">Couldn&apos;t load warranties</p>
                                                <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
                                            </td>
                                        </tr>
                                    )}
                                    {!isLoading && !isError && rows.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center">
                                                <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                                <p className="text-muted-foreground">{search || tab ? 'No warranties match your filters' : 'No warranties yet'}</p>
                                            </td>
                                        </tr>
                                    )}
                                    {!isError && rows.map((w) => (
                                        <tr key={w.id} className="border-b border-border hover:bg-muted/20 cursor-pointer" onClick={() => setViewing(w)}>
                                            <td className="px-6 py-3 font-mono font-medium">{w.serial_number}</td>
                                            <td className="px-6 py-3">
                                                <div className="font-medium">{w.item_name || '—'}</div>
                                                <div className="text-xs text-muted-foreground font-mono">{w.item_sku}</div>
                                            </td>
                                            <td className="px-6 py-3 hidden md:table-cell text-muted-foreground">{fmtDate(w.purchase_date)}</td>
                                            <td className="px-6 py-3 hidden lg:table-cell text-muted-foreground">{fmtDate(w.warranty_start)} – {fmtDate(w.warranty_end)}</td>
                                            <td className="px-6 py-3"><Badge variant={STATUS_VARIANT[w.status]}>{w.status}</Badge></td>
                                            <td className="px-6 py-3">
                                                <RowActions
                                                    onView={() => setViewing(w)}
                                                    onEdit={() => openEdit(w)}
                                                    canEdit={canChange}
                                                    onDelete={() => setConfirming({ action: 'delete', w })}
                                                    canDelete={canDelete}
                                                    extra={rowExtra(w)}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {totalPages > 1 && <div className="p-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>}
                    </CardContent>
                </Card>

                {open && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
                        <div className="relative z-50 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-lg font-semibold">{editing ? 'Edit Warranty' : 'Register Warranty'}</h2>
                                        <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-accent transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={submit} className="space-y-4">
                                        {editing ? (
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Item</label>
                                                <Input value={itemLabel} disabled />
                                            </div>
                                        ) : (
                                            <ItemSearchInput
                                                orgSlug={org}
                                                label="Item *"
                                                value={itemLabel}
                                                onSelect={(i) => { setItemId(i.id); setItemLabel(`${i.name} (${i.sku})`); }}
                                                placeholder="Search items…"
                                                fixedDropdown
                                            />
                                        )}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Serial number *</label>
                                                <Input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="e.g. SN-12345678" required />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Customer ID (optional)</label>
                                                <Input value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="Customer UUID" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Purchase date</label>
                                                <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Warranty start</label>
                                                <Input type="date" value={warrantyStart} onChange={(e) => setWarrantyStart(e.target.value)} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Warranty end</label>
                                                <Input type="date" value={warrantyEnd} onChange={(e) => setWarrantyEnd(e.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">or Coverage (months)</label>
                                                <Input type="number" min="1" step="1" value={coverageMonths} onChange={(e) => setCoverageMonths(e.target.value)} placeholder="12" disabled={!!warrantyEnd} />
                                            </div>
                                        </div>
                                        {!editing && <p className="text-xs text-muted-foreground">Leave both empty for 12 months of coverage from the start date.</p>}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Notes</label>
                                            <textarea className={textareaClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Coverage terms / notes" />
                                        </div>
                                        <div className="flex gap-3 pt-2">
                                            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
                                            <Button type="submit" className="flex-1" disabled={isPending}>{isPending ? 'Saving…' : editing ? 'Update' : 'Register'}</Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                <ConfirmDialog
                    open={!!confirming}
                    title={confirming?.action === 'claim' ? 'Mark warranty as claimed?' : confirming?.action === 'void' ? 'Void this warranty?' : 'Delete this warranty?'}
                    description={
                        confirming?.action === 'claim'
                            ? `Record a claim against serial ${confirming?.w.serial_number}. This marks the warranty as used.`
                            : confirming?.action === 'void'
                                ? `Void coverage for serial ${confirming?.w.serial_number}. A voided warranty can no longer be claimed.`
                                : `Permanently delete the warranty record for serial ${confirming?.w.serial_number}. This cannot be undone.`
                    }
                    variant={confirming?.action === 'delete' ? 'danger' : confirming?.action === 'void' ? 'warning' : 'info'}
                    confirmLabel={confirming?.action === 'claim' ? 'Mark claimed' : confirming?.action === 'void' ? 'Void warranty' : 'Delete'}
                    onConfirm={runConfirmed}
                    onCancel={() => setConfirming(null)}
                />

                <DetailDrawer
                    open={!!viewing}
                    onClose={() => setViewing(null)}
                    title={viewing?.serial_number ?? 'Warranty'}
                    subtitle={viewing ? `${viewing.item_name}${viewing.item_sku ? ` (${viewing.item_sku})` : ''}` : undefined}
                    badges={viewing && <Badge variant={STATUS_VARIANT[viewing.status]}>{viewing.status}</Badge>}
                    fields={viewing ? [
                        { label: 'Item', value: viewing.item_name || '—' },
                        { label: 'SKU', value: viewing.item_sku || '—' },
                        { label: 'Purchase date', value: fmtDate(viewing.purchase_date) },
                        { label: 'Coverage', value: `${fmtDate(viewing.warranty_start)} – ${fmtDate(viewing.warranty_end)}` },
                        { label: 'Customer', value: viewing.customer_id ?? '—' },
                        { label: 'Registered', value: fmtDate(viewing.created_at) },
                        { label: 'Notes', value: viewing.notes, full: true, hideIfEmpty: true },
                    ] : []}
                    actions={viewing && (
                        <>
                            {canChange && <Button variant="outline" size="sm" onClick={() => { openEdit(viewing); setViewing(null); }}>Edit</Button>}
                            {canChange && viewing.status === 'active' && (
                                <Button variant="outline" size="sm" onClick={() => setConfirming({ action: 'claim', w: viewing })}>Claim</Button>
                            )}
                            {canChange && viewing.status !== 'voided' && (
                                <Button variant="outline" size="sm" onClick={() => setConfirming({ action: 'void', w: viewing })}>Void</Button>
                            )}
                        </>
                    )}
                />
            </div>
        </SubscriptionGate>
    );
}
