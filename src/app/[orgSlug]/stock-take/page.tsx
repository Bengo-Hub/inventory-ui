'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { InfoHint } from '@/components/ui/info-hint';
import { SubscriptionGate } from '@/components/subscription/subscription-gate';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useActiveWarehouse } from '@/hooks/useActiveWarehouse';
import { CreatableSelect } from '@/components/inventory/CreatableSelect';
import { useCreateFromQuery } from '@/hooks/useCreateFromQuery';
import {
    useCreateStockCount,
    useCreateStockCountTemplate,
    useDeleteStockCountTemplate,
    useStockCounts,
    useStockCountTemplates,
    useUpdateStockCountTemplate,
} from '@/hooks/useStockCounts';
import { usePermissions, P } from '@/hooks/usePermissions';
import { apiClient } from '@/lib/api/client';
import { searchItems } from '@/lib/api/items';
import { useOutletStore } from '@/store/outlet';
import type { StockCount, StockCountTemplate } from '@/lib/api/stock-counts';
import type { Item } from '@/lib/api/items';
import { apiErrorMessage } from '@/lib/api/error-message';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { SearchAddTable, type SearchAddOption } from '@bengo-hub/shared-ui-lib/search-add-table';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';
import { downloadBlob } from '@/components/inventory/ExportDialogs';
import type { DocFormat } from '@/components/inventory/DocFormatMenu';

// Search-add row shape for the "Specific items" box below — carries the full Item so the
// caller can pull whatever fields it needs (currently just id/name/sku).
interface ItemSearchOption extends SearchAddOption {
    item: Item;
}
import { buildStockTakeColumns } from './stock-take-columns';
import { ClipboardCheck, LayoutTemplate, Play, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Category { id: string; name: string }

// ── Create dialog ───────────────────────────────────────────────────────────────

function CreateCountDialog({ orgSlug, templates, onClose, onCreated }: {
    orgSlug: string;
    templates: StockCountTemplate[];
    onClose: () => void;
    onCreated: (id: string) => void;
}) {
    // Options scoped to the caller's own outlet (via useActiveWarehouse), not every warehouse
    // tenant-wide — the raw useWarehouses list let a scoped (non-admin) user pick a warehouse
    // outside their assignment.
    const { options: warehouseOptions } = useActiveWarehouse(orgSlug);
    const create = useCreateStockCount(orgSlug);
    const [templateId, setTemplateId] = useState('');
    const [warehouseId, setWarehouseId] = useState('');
    const [reference, setReference] = useState('');
    const [snapshot, setSnapshot] = useState(true);

    const tpl = templates.find((t) => t.id === templateId);

    function submit(e: React.FormEvent) {
        e.preventDefault();
        const whEff = warehouseId || tpl?.warehouse_id || '';
        if (!whEff) { toast.error('Pick a warehouse to count'); return; }
        create.mutate(
            {
                warehouse_id: whEff,
                reference: reference.trim() || undefined,
                snapshot: templateId ? false : snapshot,
                template_id: templateId || undefined,
            },
            {
                onSuccess: (c) => { toast.success('Stock take started'); onCreated(c.id); },
                onError: async (err) => toast.error(await apiErrorMessage(err, 'Failed to start stock take')),
            },
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-50 w-full max-w-md mx-4">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">New Stock Take</h2>
                            <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent"><X className="h-5 w-5 text-muted-foreground" /></button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={submit} className="space-y-4">
                            {templates.length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Count sheet <span className="text-muted-foreground font-normal">(optional)</span></label>
                                    <select
                                        value={templateId}
                                        onChange={(e) => setTemplateId(e.target.value)}
                                        className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                    >
                                        <option value="">Full count (all stocked items)</option>
                                        {templates.filter((t) => t.is_active).map((t) => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-muted-foreground">
                                        A sheet pre-loads only its department&apos;s items (e.g. the kitchen daily sheet) at their
                                        current expected stock.
                                    </p>
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Warehouse / Outlet {tpl?.warehouse_id ? <span className="text-muted-foreground font-normal">(from sheet)</span> : '*'}</label>
                                <CreatableSelect
                                    value={warehouseId}
                                    onChange={setWarehouseId}
                                    options={warehouseOptions.map((w) => ({ id: w.id, name: w.name }))}
                                    placeholder={tpl?.warehouse_id ? 'Use the sheet’s location' : 'Select location…'}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Reference <span className="text-muted-foreground font-normal">(optional)</span></label>
                                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={tpl ? `${tpl.name} · today` : 'e.g. July month-end count'} />
                            </div>
                            {!templateId && (
                                <label className="flex items-start gap-2 text-sm">
                                    <input type="checkbox" checked={snapshot} onChange={(e) => setSnapshot(e.target.checked)} className="mt-0.5" />
                                    <span>
                                        Pre-load every item at its current system quantity
                                        <InfoHint title="Snapshot">
                                            Fills the count sheet with each item and the quantity the system thinks you have right now.
                                            Your team then types what they physically counted; the difference becomes the variance. Turn
                                            off to start from a blank sheet and add items as you go.
                                        </InfoHint>
                                    </span>
                                </label>
                            )}
                            <div className="flex gap-3 pt-1">
                                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                                <Button type="submit" className="flex-1" disabled={create.isPending}>
                                    {create.isPending ? 'Starting…' : 'Start Count'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ── Count-sheet (template) editor dialog ────────────────────────────────────────

function TemplateDialog({ orgSlug, editing, onClose }: {
    orgSlug: string;
    editing: StockCountTemplate | null;
    onClose: () => void;
}) {
    const { options: warehouseOptions } = useActiveWarehouse(orgSlug);
    const createTpl = useCreateStockCountTemplate(orgSlug);
    const updateTpl = useUpdateStockCountTemplate(orgSlug);

    const [name, setName] = useState(editing?.name ?? '');
    const [description, setDescription] = useState(editing?.description ?? '');
    const [warehouseId, setWarehouseId] = useState(editing?.warehouse_id ?? '');
    const [categoryIds, setCategoryIds] = useState<string[]>(editing?.category_ids ?? []);
    const [items, setItems] = useState<{ id: string; name: string; sku: string }[]>([]);
    const [itemIdsFromEdit] = useState<string[]>(editing?.item_ids ?? []);

    // Scoped to the outlet's use_case so a kitchen sheet builder never wades
    // through another vertical's categories.
    const outletUseCase = useOutletStore((s) => s.outlet?.use_case);
    const { data: categories } = useQuery<Category[]>({
        queryKey: ['categories', orgSlug, outletUseCase ?? 'all'],
        queryFn: async () => {
            const res = await apiClient.get<{ data: Category[] } | Category[]>(
                `/api/v1/${orgSlug}/inventory/categories`,
                outletUseCase ? { use_case: outletUseCase } : undefined,
            );
            return Array.isArray(res) ? res : (res as { data: Category[] }).data ?? [];
        },
        placeholderData: [],
    });

    // Resolve names for pre-existing explicit items when editing (best effort — the
    // sheet still works even if a name lookup fails; ids are what the API stores).
    useQuery({
        queryKey: ['tpl-item-names', orgSlug, itemIdsFromEdit],
        queryFn: async () => {
            const resolved: { id: string; name: string; sku: string }[] = [];
            for (const id of itemIdsFromEdit) {
                try {
                    const res = await apiClient.get<{ data: { id: string; name: string; sku: string }[] }>(
                        `/api/v1/${orgSlug}/inventory/items`, { id },
                    );
                    const it = (res.data ?? [])[0];
                    if (it) resolved.push({ id: it.id, name: it.name, sku: it.sku });
                } catch { /* keep going */ }
            }
            setItems((prev) => {
                const have = new Set(prev.map((p) => p.id));
                return [...prev, ...resolved.filter((r) => !have.has(r.id))];
            });
            return resolved;
        },
        enabled: itemIdsFromEdit.length > 0,
        staleTime: Infinity,
    });

    function toggleCategory(id: string) {
        setCategoryIds((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) { toast.error('Name the count sheet'); return; }
        const itemIds = items.map((i) => i.id);
        if (itemIds.length === 0 && categoryIds.length === 0) {
            toast.error('Pick at least one item or category for the sheet');
            return;
        }
        const payload = {
            name: name.trim(),
            description: description.trim() || undefined,
            warehouse_id: warehouseId || null,
            item_ids: itemIds,
            category_ids: categoryIds,
        };
        const opts = {
            onSuccess: () => { toast.success(editing ? 'Count sheet updated' : 'Count sheet created'); onClose(); },
            onError: async (err: Error) => toast.error(await apiErrorMessage(err, 'Failed to save count sheet')),
        };
        if (editing) updateTpl.mutate({ id: editing.id, data: payload }, opts);
        else createTpl.mutate(payload, opts);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-50 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">{editing ? 'Edit Count Sheet' : 'New Count Sheet'}</h2>
                            <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent"><X className="h-5 w-5 text-muted-foreground" /></button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={submit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Sheet name *</label>
                                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kitchen Daily Stock Sheet" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
                                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Filled by chefs at shift open/close" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Default location <span className="text-muted-foreground font-normal">(optional)</span></label>
                                <CreatableSelect
                                    value={warehouseId ?? ''}
                                    onChange={setWarehouseId}
                                    options={warehouseOptions.map((w) => ({ id: w.id, name: w.name }))}
                                    placeholder="Chosen when starting the count"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Whole categories</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {(categories ?? []).map((c) => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => toggleCategory(c.id)}
                                            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${categoryIds.includes(c.id)
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : 'border-border text-muted-foreground hover:bg-accent'}`}
                                        >
                                            {c.name}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground">Every active item in a selected category joins the sheet automatically.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Specific items</label>
                                <SearchAddTable<ItemSearchOption>
                                    onSearch={async (q) => (await searchItems(orgSlug, q, { type: 'GOODS,INGREDIENT,EQUIPMENT' }))
                                        .map((it) => ({ id: it.id, label: it.name, hint: it.sku, item: it }))}
                                    onAdd={(opt) => setItems((prev) => prev.some((p) => p.id === opt.item.id) ? prev : [...prev, { id: opt.item.id, name: opt.item.name, sku: opt.item.sku }])}
                                    excludeIds={items.map((it) => it.id)}
                                    placeholder="Add an item to the sheet…"
                                    fixedDropdown
                                />
                                {items.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {items.map((it) => (
                                            <span key={it.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent text-xs">
                                                {it.name}
                                                <button type="button" onClick={() => setItems((prev) => prev.filter((p) => p.id !== it.id))} className="text-muted-foreground hover:text-destructive">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-1">
                                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                                <Button type="submit" className="flex-1" disabled={createTpl.isPending || updateTpl.isPending}>
                                    {createTpl.isPending || updateTpl.isPending ? 'Saving…' : editing ? 'Update Sheet' : 'Create Sheet'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────────

export default function StockTakePage() {
    const params = useParams();
    const router = useRouter();
    const orgSlug = params?.orgSlug as string;
    const { data: counts, isLoading, refetch, isFetching } = useStockCounts(orgSlug);
    const { data: warehouses } = useWarehouses(orgSlug);
    const { data: templates } = useStockCountTemplates(orgSlug);
    const create = useCreateStockCount(orgSlug);
    const deleteTpl = useDeleteStockCountTemplate(orgSlug);
    const { canAny } = usePermissions();

    const canAdd = canAny([P.STOCK_COUNT_ADD, P.STOCK_MANAGE]);
    const canChange = canAny([P.STOCK_COUNT_CHANGE, P.STOCK_MANAGE]);

    const [createOpen, setCreateOpen] = useState(false);
    useCreateFromQuery(() => setCreateOpen(true)); // mobile quick-add → open New Stock Take
    const [tplDialog, setTplDialog] = useState<{ open: boolean; editing: StockCountTemplate | null }>({ open: false, editing: null });

    const whName = useMemo(() => {
        const map = new Map((warehouses ?? []).map((w) => [w.id, w.name]));
        return (id?: string | null) => (id ? map.get(id) ?? '—' : '—');
    }, [warehouses]);

    // Document preview (Print/Export) — streams inventory-api's GET /stock-counts/{id}/pdf.
    // Mode is left to the server's own status-based default (blank pre-count vs variance
    // post-count) rather than forced from here.
    const { openPreview, previewProps } = useDocumentPreview({ onError: (m: string) => toast.error(m) });
    function previewCount(c: StockCount, format: DocFormat = 'pdf') {
        const url = `/api/v1/${orgSlug}/inventory/stock-counts/${c.id}/pdf`;
        const filenameBase = c.reference || c.id.slice(0, 8);
        if (format === 'pdf') {
            openPreview(() => apiClient.getBlob(url, { format }), { fileName: `${filenameBase}.pdf`, title: c.reference || 'Stock Count' });
            return;
        }
        apiClient.getBlob(url, { format })
            .then((blob) => downloadBlob(blob, `${filenameBase}.${format}`))
            .catch(() => toast.error('Could not export stock count. Please try again.'));
    }

    const columns = useMemo(() => buildStockTakeColumns({ whName, onPrint: (c, format) => previewCount(c, format) }), [whName]);

    function openCount(id: string) {
        router.push(`/${orgSlug}/stock-take/${id}`);
    }

    function startFromSheet(tpl: StockCountTemplate) {
        create.mutate(
            { template_id: tpl.id, warehouse_id: tpl.warehouse_id ?? undefined },
            {
                onSuccess: (c) => { toast.success(`${tpl.name} started`); openCount(c.id); },
                onError: async (err) => toast.error(await apiErrorMessage(err, 'Failed to start count — the sheet may need a location')),
            },
        );
    }

    return (
        <SubscriptionGate feature="stock_tracking">
            <div className="p-4 sm:p-6 space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="mr-auto">
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <ClipboardCheck className="h-6 w-6" /> Stock Take
                            <InfoHint title="Stock take (physical count)" side="bottom">
                                Count physical stock against the system, then post the differences in one approved batch —
                                cleaner than editing items one by one. Use Adjustments for quick one-off corrections; use a
                                Stock Take for periodic full or cycle counts, or department shift sheets.
                            </InfoHint>
                        </h1>
                        <p className="text-muted-foreground mt-1">Physical counts with variance classification, review and supervisor sign-off</p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isFetching}
                        onClick={() => refetch()}
                        title="Refresh — pulls in counts submitted elsewhere"
                    >
                        <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                    </Button>
                    {canAdd && (
                        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Stock Take</Button>
                    )}
                </div>

                {/* Department count sheets */}
                <Card>
                    <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h2 className="text-sm font-semibold flex items-center gap-1.5">
                                    <LayoutTemplate className="h-4 w-4" /> Count Sheets
                                    <InfoHint title="Department count sheets">
                                        Reusable per-department sheets — e.g. the kitchen daily stock sheet chefs fill at shift
                                        open/close, or the barista counter list. Starting a count from a sheet pre-loads exactly
                                        its items with the system&apos;s expected stock; staff record the physical count and the
                                        variance is classified (wastage, pilferage…) and approved.
                                    </InfoHint>
                                </h2>
                                <p className="text-xs text-muted-foreground mt-0.5">One-tap shift counts for kitchen, bar, and other sections</p>
                            </div>
                            {canChange && (
                                <Button variant="outline" size="sm" onClick={() => setTplDialog({ open: true, editing: null })}>
                                    <Plus className="h-3.5 w-3.5 mr-1" /> New Sheet
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {(templates ?? []).length === 0 ? (
                            <p className="text-sm text-muted-foreground">No count sheets yet — create one per department (kitchen, bar, stores) to make shift counts one tap.</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {(templates ?? []).map((tpl) => (
                                    <div key={tpl.id} className="rounded-lg border border-border p-3 flex flex-col gap-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm truncate">{tpl.name}</p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {tpl.warehouse_id ? whName(tpl.warehouse_id) : 'Location chosen at start'}
                                                    {' · '}
                                                    {(tpl.item_ids?.length ?? 0) > 0 ? `${tpl.item_ids?.length} item(s)` : ''}
                                                    {(tpl.item_ids?.length ?? 0) > 0 && (tpl.category_ids?.length ?? 0) > 0 ? ' + ' : ''}
                                                    {(tpl.category_ids?.length ?? 0) > 0 ? `${tpl.category_ids?.length} categor${(tpl.category_ids?.length ?? 0) === 1 ? 'y' : 'ies'}` : ''}
                                                </p>
                                            </div>
                                            {canChange && (
                                                <button
                                                    onClick={() => deleteTpl.mutate(tpl.id, {
                                                        onSuccess: () => toast.success('Count sheet deleted'),
                                                        onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to delete sheet')),
                                                    })}
                                                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
                                                    title="Delete sheet"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex gap-2 mt-auto">
                                            {canAdd && (
                                                <Button size="sm" className="flex-1" onClick={() => startFromSheet(tpl)} disabled={create.isPending}>
                                                    <Play className="h-3.5 w-3.5 mr-1" /> Start count
                                                </Button>
                                            )}
                                            {canChange && (
                                                <Button size="sm" variant="outline" onClick={() => setTplDialog({ open: true, editing: tpl })}>Edit</Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-0">
                        <div className="px-2 pb-2">
                            <DataTable<StockCount>
                                columns={columns}
                                rows={counts ?? []}
                                rowKey={(c) => c.id}
                                loading={isLoading}
                                loadingRows={8}
                                onRowClick={(c) => openCount(c.id)}
                                emptyText="No stock takes yet. Start one to count physical stock and post variances."
                                storageKey="stock-take-col-prefs"
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {createOpen && (
                <CreateCountDialog
                    orgSlug={orgSlug}
                    templates={templates ?? []}
                    onClose={() => setCreateOpen(false)}
                    onCreated={(id) => { setCreateOpen(false); openCount(id); }}
                />
            )}
            {tplDialog.open && (
                <TemplateDialog
                    orgSlug={orgSlug}
                    editing={tplDialog.editing}
                    onClose={() => setTplDialog({ open: false, editing: null })}
                />
            )}

            <PdfPreview {...previewProps} />
        </SubscriptionGate>
    );
}
