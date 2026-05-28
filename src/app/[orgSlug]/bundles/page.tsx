'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input, Table } from '@/components/ui/base';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Pagination } from '@/components/ui/pagination';
import {
    useBundles,
    useCreateBundle,
    useDeleteBundle,
    useUpdateBundle,
} from '@/hooks/useBundles';
import { useItems } from '@/hooks/useItems';
import { type Bundle, type CreateBundleInput } from '@/lib/api/bundles';
import type { Item } from '@/lib/api/items';
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
    const [isActive, setIsActive] = useState(editing?.is_active ?? true);
    const [components, setComponents] = useState<ComponentRow[]>(
        editing?.components.map(c => ({
            component_item_id: c.component_item_id,
            item_name: c.item_name ?? c.component_item_id,
            quantity: c.quantity,
        })) ?? []
    );
    const [addSearch, setAddSearch] = useState('');
    const [addItemId, setAddItemId] = useState('');
    const [addQty, setAddQty] = useState(1);

    useEffect(() => {
        if (editing) {
            setName(editing.name);
            setItemId(editing.item_id);
            setIsActive(editing.is_active);
            setComponents(editing.components.map(c => ({
                component_item_id: c.component_item_id,
                item_name: c.item_name ?? c.component_item_id,
                quantity: c.quantity,
            })));
        }
    }, [editing]);

    const filteredItems = allItems.filter(i =>
        !addSearch || i.name.toLowerCase().includes(addSearch.toLowerCase()) || i.sku.toLowerCase().includes(addSearch.toLowerCase())
    );

    function addComponent() {
        if (!addItemId) return;
        const item = allItems.find(i => i.id === addItemId);
        if (!item) return;
        if (components.some(c => c.component_item_id === addItemId)) {
            toast.error('Item already added to this bundle');
            return;
        }
        setComponents(prev => [...prev, { component_item_id: addItemId, item_name: item.name, quantity: addQty }]);
        setAddItemId('');
        setAddSearch('');
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
            components: components.map(c => ({ component_item_id: c.component_item_id, quantity: c.quantity })),
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
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bundle Item (SKU) *</label>
                            <select
                                value={itemId}
                                onChange={e => setItemId(e.target.value)}
                                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                required
                            >
                                <option value="">Select bundle item…</option>
                                {allItems.map(i => (
                                    <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>
                                ))}
                            </select>
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

                    {/* Components */}
                    <div className="space-y-3">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Components</label>

                        {components.length > 0 && (
                            <div className="rounded-lg border border-border divide-y divide-border">
                                {components.map(c => (
                                    <div key={c.component_item_id} className="flex items-center gap-3 px-4 py-2">
                                        <span className="flex-1 text-sm">{c.item_name}</span>
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
                        <div className="flex gap-2">
                            <div className="flex-1 space-y-1">
                                <Input
                                    value={addSearch}
                                    onChange={e => setAddSearch(e.target.value)}
                                    placeholder="Search item to add…"
                                />
                                {addSearch && filteredItems.length > 0 && !addItemId && (
                                    <div className="rounded-lg border border-border bg-card shadow-md max-h-40 overflow-y-auto">
                                        {filteredItems.slice(0, 8).map(i => (
                                            <button
                                                key={i.id}
                                                type="button"
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                                                onClick={() => { setAddItemId(i.id); setAddSearch(i.name); }}
                                            >
                                                {i.name} <span className="text-muted-foreground text-xs">({i.sku})</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <input
                                type="number"
                                min={1}
                                value={addQty}
                                onChange={e => setAddQty(Number(e.target.value))}
                                className="w-16 rounded-lg border border-input bg-transparent px-2 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none text-center"
                            />
                            <Button type="button" variant="outline" size="sm" onClick={addComponent} disabled={!addItemId}>
                                <Plus className="h-4 w-4" />
                            </Button>
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
