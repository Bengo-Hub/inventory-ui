'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input, Table } from '@/components/ui/base';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Pagination } from '@/components/ui/pagination';
import { ItemSearchInput } from '@/components/inventory/ItemSearchInput';
import {
    useBundles,
    useCreateBundle,
    useDeleteBundle,
    useUpdateBundle,
} from '@/hooks/useBundles';
import { useItems } from '@/hooks/useItems';
import { type Bundle, type CreateBundleInput, type PackageType, type PriceBasis, type ComponentKind, type MealPeriod, PACKAGE_TYPES, MEAL_PERIODS } from '@/lib/api/bundles';
import type { Item } from '@/lib/api/items';

const PRICE_BASES: { value: PriceBasis; label: string }[] = [
    { value: 'flat', label: 'Flat' },
    { value: 'per_delegate_per_day', label: 'Per Delegate / Day' },
    { value: 'per_person_sharing', label: 'Per Person Sharing' },
    { value: 'per_session', label: 'Per Session' },
];
const bundleSelectCls = 'w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none appearance-none';
import { Minus, Package, Plus, Trash2, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 20;

// ─── Bundle Form Modal ────────────────────────────────────────────────────────

interface ComponentRow {
    component_item_id: string;
    item_name: string;
    quantity: number;
    component_kind?: ComponentKind;
    meal_period?: MealPeriod | '';
    is_metered?: boolean;
    unit?: string;
}

interface BundleModalProps {
    orgSlug: string;
    editing: Bundle | null;
    onClose: () => void;
    onCreate: (data: CreateBundleInput) => void;
    onUpdate: (id: string, data: Partial<CreateBundleInput>) => void;
    isPending: boolean;
    allItems: Item[];
}

function BundleModal({ orgSlug, editing, onClose, onCreate, onUpdate, isPending, allItems }: BundleModalProps) {
    const [name, setName] = useState(editing?.name ?? '');
    const [itemId, setItemId] = useState(editing?.item_id ?? '');
    const [itemName, setItemName] = useState(() => {
        if (editing) {
            const found = allItems.find(i => i.id === editing.item_id);
            return found ? `${found.name} (${found.sku})` : '';
        }
        return '';
    });
    const [isActive, setIsActive] = useState(editing?.is_active ?? true);
    const [packageType, setPackageType] = useState<PackageType>(editing?.package_type ?? 'RETAIL_KIT');
    const [priceBasis, setPriceBasis] = useState<PriceBasis>(editing?.price_basis ?? 'flat');
    const [minDelegates, setMinDelegates] = useState(editing?.min_delegates != null ? String(editing.min_delegates) : '');
    const [accommodationIncluded, setAccommodationIncluded] = useState(editing?.accommodation_included ?? false);
    const [sessionsTotal, setSessionsTotal] = useState(editing?.sessions_total != null ? String(editing.sessions_total) : '');
    const [validityDays, setValidityDays] = useState(editing?.validity_days != null ? String(editing.validity_days) : '');
    const [components, setComponents] = useState<ComponentRow[]>(
        editing?.components.map(c => ({
            component_item_id: c.component_item_id,
            item_name: c.item_name ?? c.component_item_id,
            quantity: c.quantity,
            component_kind: c.component_kind,
            meal_period: c.meal_period ?? '',
        })) ?? []
    );
    const [addQty, setAddQty] = useState(1);

    // Conference/event packages expose meal-period tagging on components.
    const isPackage = packageType !== 'RETAIL_KIT';

    useEffect(() => {
        if (editing) {
            setName(editing.name);
            setItemId(editing.item_id);
            const found = allItems.find(i => i.id === editing.item_id);
            setItemName(found ? `${found.name} (${found.sku})` : '');
            setIsActive(editing.is_active);
            setPackageType(editing.package_type ?? 'RETAIL_KIT');
            setPriceBasis(editing.price_basis ?? 'flat');
            setMinDelegates(editing.min_delegates != null ? String(editing.min_delegates) : '');
            setAccommodationIncluded(editing.accommodation_included ?? false);
            setSessionsTotal(editing.sessions_total != null ? String(editing.sessions_total) : '');
            setValidityDays(editing.validity_days != null ? String(editing.validity_days) : '');
            setComponents(editing.components.map(c => ({
                component_item_id: c.component_item_id,
                item_name: c.item_name ?? c.component_item_id,
                quantity: c.quantity,
                component_kind: c.component_kind,
                meal_period: c.meal_period ?? '',
            })));
        }
    }, [editing, allItems]);

    function updateComponentMeal(id: string, meal: MealPeriod | '') {
        setComponents(prev => prev.map(c => c.component_item_id === id
            ? { ...c, meal_period: meal, component_kind: meal ? 'MEAL_PERIOD' : 'ITEM' }
            : c));
    }

    function updateComponentField(id: string, patch: Partial<ComponentRow>) {
        setComponents(prev => prev.map(c => c.component_item_id === id ? { ...c, ...patch } : c));
    }

    function addComponent(item: { id: string; name: string; sku: string }) {
        if (components.some(c => c.component_item_id === item.id)) {
            toast.error('Item already added to this bundle');
            return;
        }
        setComponents(prev => [...prev, { component_item_id: item.id, item_name: item.name, quantity: addQty }]);
        setAddQty(1);
    }

    function removeComponent(id: string) {
        setComponents(prev => prev.filter(c => c.component_item_id !== id));
    }

    function updateQty(id: string, qty: number) {
        setComponents(prev => prev.map(c => c.component_item_id === id ? { ...c, quantity: Math.max(1, qty) } : c));
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) { toast.error('Bundle name is required'); return; }
        if (!itemId) { toast.error('Bundle item is required'); return; }
        if (components.length === 0) { toast.error('Add at least one component'); return; }

        const payload: CreateBundleInput = {
            name: name.trim(),
            item_id: itemId,
            is_active: isActive,
            package_type: packageType,
            price_basis: priceBasis,
            min_delegates: minDelegates ? parseInt(minDelegates, 10) : undefined,
            accommodation_included: accommodationIncluded,
            sessions_total: sessionsTotal ? parseInt(sessionsTotal, 10) : undefined,
            validity_days: validityDays ? parseInt(validityDays, 10) : undefined,
            components: components.map(c => ({
                component_item_id: c.component_item_id,
                quantity: c.quantity,
                component_kind: c.component_kind,
                meal_period: c.meal_period || undefined,
                is_metered: c.is_metered,
                unit: c.unit || undefined,
            })),
        };

        if (editing) {
            onUpdate(editing.id, payload);
        } else {
            onCreate(payload);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-50 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h2 className="text-lg font-semibold">{editing ? 'Edit Bundle' : 'Create Bundle'}</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bundle Name *</label>
                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Back to School Kit" required />
                        </div>
                        <div className="space-y-1">
                            <ItemSearchInput
                                orgSlug={orgSlug}
                                value={itemName}
                                label="Bundle Item (SKU) *"
                                placeholder="Search bundle item…"
                                fixedDropdown
                                onSelect={(item) => {
                                    setItemId(item.id);
                                    setItemName(`${item.name} (${item.sku})`);
                                }}
                            />
                            {!itemId && <p className="text-xs text-destructive">Required</p>}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="is_active"
                            checked={isActive}
                            onChange={e => setIsActive(e.target.checked)}
                            className="rounded"
                        />
                        <label htmlFor="is_active" className="text-sm">Active</label>
                    </div>

                    {/* Package type — conference / room rate plans / service sessions */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Package Type</label>
                            <select value={packageType} onChange={e => setPackageType(e.target.value as PackageType)} className={bundleSelectCls}>
                                {PACKAGE_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Price Basis</label>
                            <select value={priceBasis} onChange={e => setPriceBasis(e.target.value as PriceBasis)} className={bundleSelectCls}>
                                {PRICE_BASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                            </select>
                        </div>
                    </div>
                    {isPackage && (
                        <div className="grid grid-cols-2 gap-4 items-end">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Min Delegates</label>
                                <Input type="number" min={0} value={minDelegates} onChange={e => setMinDelegates(e.target.value)} placeholder="e.g. 10" />
                            </div>
                            <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
                                <input type="checkbox" checked={accommodationIncluded} onChange={e => setAccommodationIncluded(e.target.checked)} className="rounded" />
                                Accommodation included (residential)
                            </label>
                        </div>
                    )}
                    {packageType === 'SERVICE_SESSIONS' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sessions Total</label>
                                <Input type="number" min={0} value={sessionsTotal} onChange={e => setSessionsTotal(e.target.value)} placeholder="e.g. 10" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Validity (days)</label>
                                <Input type="number" min={0} value={validityDays} onChange={e => setValidityDays(e.target.value)} placeholder="e.g. 365" />
                            </div>
                        </div>
                    )}

                    {/* Components */}
                    <div className="space-y-3">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Components</label>

                        {components.length > 0 && (
                            <div className="rounded-lg border border-border divide-y divide-border">
                                {components.map(c => (
                                    <div key={c.component_item_id} className="flex items-center gap-3 px-4 py-2">
                                        <span className="flex-1 text-sm">{c.item_name}</span>
                                        {isPackage && (
                                            <select
                                                value={c.meal_period ?? ''}
                                                onChange={e => updateComponentMeal(c.component_item_id, e.target.value as MealPeriod | '')}
                                                className="rounded-lg border border-input bg-transparent px-2 py-1 text-xs focus:ring-1 focus:ring-ring focus:outline-none"
                                                title="Tag as a meal period (drives delegate meal-card generation)"
                                            >
                                                <option value="">— item —</option>
                                                {MEAL_PERIODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                            </select>
                                        )}
                                        {isPackage && (
                                            <>
                                                <input
                                                    value={c.unit ?? ''}
                                                    onChange={e => updateComponentField(c.component_item_id, { unit: e.target.value })}
                                                    placeholder="unit"
                                                    className="w-20 rounded-lg border border-input bg-transparent px-2 py-1 text-xs focus:ring-1 focus:ring-ring focus:outline-none"
                                                    title="Human-readable unit, e.g. 2x500ml water"
                                                />
                                                <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer" title="Charged on actuals rather than included flat">
                                                    <input type="checkbox" checked={!!c.is_metered} onChange={e => updateComponentField(c.component_item_id, { is_metered: e.target.checked })} className="rounded" />
                                                    metered
                                                </label>
                                            </>
                                        )}
                                        <div className="flex items-center gap-1">
                                            <button type="button" onClick={() => updateQty(c.component_item_id, c.quantity - 1)}
                                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                                                <Minus className="h-3 w-3" />
                                            </button>
                                            <span className="w-8 text-center text-sm font-medium">{c.quantity}</span>
                                            <button type="button" onClick={() => updateQty(c.component_item_id, c.quantity + 1)}
                                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                                                <Plus className="h-3 w-3" />
                                            </button>
                                        </div>
                                        <button type="button" onClick={() => removeComponent(c.component_item_id)}
                                            className="p-1 text-muted-foreground hover:text-destructive">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add component row */}
                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <ItemSearchInput
                                    orgSlug={orgSlug}
                                    value=""
                                    placeholder="Search item to add…"
                                    fixedDropdown
                                    onSelect={(item) => addComponent(item)}
                                />
                            </div>
                            <div className="flex items-center gap-1">
                                <input
                                    type="number"
                                    min={1}
                                    value={addQty}
                                    onChange={e => setAddQty(Number(e.target.value))}
                                    className="w-16 rounded-lg border border-input bg-transparent px-2 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none text-center"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                        <Button type="submit" variant="primary" className="flex-1" disabled={isPending}>
                            {isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create Bundle'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BundlesPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;

    const [page, setPage] = useState(1);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Bundle | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Bundle | null>(null);

    const { data, isLoading } = useBundles(orgSlug, { page, limit: ITEMS_PER_PAGE });
    const { data: itemsData } = useItems(orgSlug, { limit: 200 });
    const createBundle = useCreateBundle(orgSlug);
    const updateBundle = useUpdateBundle(orgSlug);
    const deleteBundle = useDeleteBundle(orgSlug);

    const bundles = data?.data ?? [];
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / ITEMS_PER_PAGE));
    const allItems = itemsData?.data ?? [];
    const isPending = createBundle.isPending || updateBundle.isPending;

    function openCreate() {
        setEditing(null);
        setModalOpen(true);
    }

    function openEdit(bundle: Bundle) {
        setEditing(bundle);
        setModalOpen(true);
    }

    function closeModal() {
        setModalOpen(false);
        setEditing(null);
    }

    function handleCreate(data: CreateBundleInput) {
        createBundle.mutate(data, {
            onSuccess: () => { toast.success('Bundle created'); closeModal(); },
            onError: () => toast.error('Failed to create bundle'),
        });
    }

    function handleUpdate(id: string, data: Partial<CreateBundleInput>) {
        updateBundle.mutate({ id, data }, {
            onSuccess: () => { toast.success('Bundle updated'); closeModal(); },
            onError: () => toast.error('Failed to update bundle'),
        });
    }

    function confirmDelete() {
        if (!deleteTarget) return;
        deleteBundle.mutate(deleteTarget.id, {
            onSuccess: () => { toast.success('Bundle deleted'); setDeleteTarget(null); },
            onError: () => toast.error('Failed to delete bundle'),
        });
    }

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Bundles</h1>
                    <p className="text-sm text-muted-foreground mt-1">Product kits sold as a single unit</p>
                </div>
                <Button variant="primary" onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Bundle
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <span className="text-sm text-muted-foreground">
                        {data?.total ?? 0} bundle{(data?.total ?? 0) !== 1 ? 's' : ''}
                    </span>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16 text-muted-foreground">Loading…</div>
                    ) : bundles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                            <Package className="h-10 w-10 opacity-30" />
                            <p className="text-sm">No bundles yet. Create your first product kit.</p>
                            <Button variant="outline" size="sm" onClick={openCreate}>Create Bundle</Button>
                        </div>
                    ) : (
                        <Table>
                            <thead>
                                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    <th className="px-6 py-3">Name</th>
                                    <th className="px-6 py-3">Bundle Item</th>
                                    <th className="px-6 py-3">Components</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {bundles.map(bundle => (
                                    <tr key={bundle.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="font-medium">{bundle.name}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground">
                                            {bundle.item_name ?? bundle.item_id}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground">
                                            {bundle.components.length} item{bundle.components.length !== 1 ? 's' : ''}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant={bundle.is_active ? 'success' : 'outline'}>
                                                {bundle.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => openEdit(bundle)}>
                                                    Edit
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => setDeleteTarget(bundle)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {totalPages > 1 && (
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            )}

            {modalOpen && (
                <BundleModal
                    orgSlug={orgSlug}
                    editing={editing}
                    onClose={closeModal}
                    onCreate={handleCreate}
                    onUpdate={handleUpdate}
                    isPending={isPending}
                    allItems={allItems}
                />
            )}

            <ConfirmDialog
                open={!!deleteTarget}
                title="Delete Bundle"
                description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
                variant="danger"
                confirmLabel="Delete"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
