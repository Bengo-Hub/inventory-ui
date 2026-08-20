'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
    useAssetCategories, useCreateAssetCategory, useUpdateAssetCategory, useDeleteAssetCategory,
} from '@/hooks/useAssets';
import { type AssetCategory, type CreateCategoryInput } from '@/lib/api/assets';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildAssetCategoryColumns } from './asset-category-columns';
import { ArrowLeft, FolderTree, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions, P } from '@/hooks/usePermissions';
import { apiErrorMessage } from '@/lib/api/error-message';
import { DECIMAL_STEP, parseDecimal } from '@/lib/utils';

const selectClass = 'w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none';

export default function AssetCategoriesPage() {
    const params = useParams();
    const org = params?.orgSlug as string;
    const { data: categories, isLoading, isError, refetch } = useAssetCategories(org);
    const createCat = useCreateAssetCategory(org);
    const updateCat = useUpdateAssetCategory(org);
    const deleteCat = useDeleteAssetCategory(org);

    const { canAny } = usePermissions();
    const canAdd = canAny([P.CATALOG_ADD, P.CATALOG_MANAGE]);
    const canChange = canAny([P.CATALOG_CHANGE, P.CATALOG_MANAGE]);
    const canDelete = canAny([P.CATALOG_DELETE, P.CATALOG_MANAGE]);

    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<AssetCategory | null>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [parentId, setParentId] = useState('');
    const [depRate, setDepRate] = useState('');
    const [life, setLife] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<AssetCategory | null>(null);

    function openNew() {
        setEditing(null); setName(''); setDescription(''); setParentId(''); setDepRate(''); setLife('');
        setOpen(true);
    }
    function openEdit(c: AssetCategory) {
        setEditing(c); setName(c.name); setDescription(c.description ?? ''); setParentId(c.parent_id ?? '');
        setDepRate(String(c.depreciation_rate ?? '')); setLife(String(c.useful_life_years ?? ''));
        setOpen(true);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) { toast.error('Name is required'); return; }
        const data: CreateCategoryInput = {
            name: name.trim(),
            description: description.trim() || undefined,
            parent_id: parentId || undefined,
            depreciation_rate: depRate ? parseDecimal(depRate) : undefined,
            useful_life_years: life ? Number(life) : undefined,
        };
        const done = () => { toast.success(editing ? 'Category updated' : 'Category created'); setOpen(false); };
        if (editing) {
            updateCat.mutate({ id: editing.id, data }, { onSuccess: done, onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to update')) });
        } else {
            createCat.mutate(data, { onSuccess: done, onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to create')) });
        }
    }

    function handleDelete(c: AssetCategory) {
        setDeleteTarget(c);
    }

    function confirmDelete() {
        if (!deleteTarget) return;
        deleteCat.mutate(deleteTarget.id, {
            onSuccess: () => { toast.success('Category deleted'); setDeleteTarget(null); },
            onError: async (e) => { toast.error(await apiErrorMessage(e, 'Failed to delete')); setDeleteTarget(null); },
        });
    }

    const nameOf = (id?: string | null) => categories?.find((c) => c.id === id)?.name ?? '—';
    const isPending = createCat.isPending || updateCat.isPending;

    const columns = useMemo(
        () => buildAssetCategoryColumns({ canChange, canDelete, nameOf, onEdit: openEdit, onDelete: handleDelete }),
        [canChange, canDelete, categories],
    );

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center gap-4">
                <Link href={`/${org}/assets`}><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Assets</Button></Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><FolderTree className="h-6 w-6" /> Asset Categories</h1>
                    <p className="text-muted-foreground mt-1">Classification, default depreciation rate &amp; useful life</p>
                </div>
                {canAdd && <Button className="ml-auto" onClick={openNew}><Plus className="h-4 w-4 mr-2" /> New Category</Button>}
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="px-2 pb-2">
                        <DataTable<AssetCategory>
                            columns={columns}
                            rows={categories ?? []}
                            rowKey={(c) => c.id}
                            loading={isLoading}
                            loadingRows={8}
                            error={isError}
                            onRetry={() => refetch()}
                            emptyState={
                                <>
                                    <FolderTree className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                    <p className="text-muted-foreground">No categories yet</p>
                                </>
                            }
                            storageKey="asset-categories-col-prefs"
                        />
                    </div>
                </CardContent>
            </Card>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
                    <div className="relative z-50 w-full max-w-lg mx-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold">{editing ? 'Edit Category' : 'New Category'}</h2>
                                    <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-accent transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={submit} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Name *</label>
                                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. IT Equipment" required />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Description</label>
                                        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Parent Category</label>
                                        <select className={selectClass} value={parentId} onChange={(e) => setParentId(e.target.value)}>
                                            <option value="">— None (top level) —</option>
                                            {categories?.filter((c) => c.id !== editing?.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Depreciation rate %</label>
                                            <Input type="number" min="0" step={DECIMAL_STEP} value={depRate} onChange={(e) => setDepRate(e.target.value)} placeholder="e.g. 20" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Useful life (years)</label>
                                            <Input type="number" min="0" value={life} onChange={(e) => setLife(e.target.value)} placeholder="e.g. 5" />
                                        </div>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
                                        <Button type="submit" className="flex-1" disabled={isPending}>{isPending ? 'Saving…' : editing ? 'Update' : 'Create'}</Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={!!deleteTarget}
                title={`Delete category "${deleteTarget?.name ?? ''}"?`}
                description="This cannot be undone."
                variant="danger"
                confirmLabel="Delete"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
