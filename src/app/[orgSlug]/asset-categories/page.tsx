'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import {
    useAssetCategories, useCreateAssetCategory, useUpdateAssetCategory, useDeleteAssetCategory,
} from '@/hooks/useAssets';
import { type AssetCategory, type CreateCategoryInput } from '@/lib/api/assets';
import { AlertTriangle, ArrowLeft, FolderTree, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { usePermissions, P } from '@/hooks/usePermissions';

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
            depreciation_rate: depRate ? Number(depRate) : undefined,
            useful_life_years: life ? Number(life) : undefined,
        };
        const done = () => { toast.success(editing ? 'Category updated' : 'Category created'); setOpen(false); };
        if (editing) {
            updateCat.mutate({ id: editing.id, data }, { onSuccess: done, onError: () => toast.error('Failed to update') });
        } else {
            createCat.mutate(data, { onSuccess: done, onError: () => toast.error('Failed to create') });
        }
    }

    function handleDelete(c: AssetCategory) {
        if (!window.confirm(`Delete category "${c.name}"?`)) return;
        deleteCat.mutate(c.id, { onSuccess: () => toast.success('Category deleted'), onError: () => toast.error('Failed to delete') });
    }

    const nameOf = (id?: string | null) => categories?.find((c) => c.id === id)?.name ?? '—';
    const isPending = createCat.isPending || updateCat.isPending;

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
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Name</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Parent</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Dep. rate %</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Useful life (yrs)</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading && <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Loading…</td></tr>}
                                {!isLoading && isError && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <AlertTriangle className="h-10 w-10 mx-auto text-destructive/60 mb-3" />
                                            <p className="text-muted-foreground">Couldn&apos;t load categories</p>
                                            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
                                        </td>
                                    </tr>
                                )}
                                {!isLoading && !isError && (categories?.length ?? 0) === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <FolderTree className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No categories yet</p>
                                        </td>
                                    </tr>
                                )}
                                {!isError && categories?.map((c) => (
                                    <tr key={c.id} className="border-b border-border hover:bg-muted/20">
                                        <td className="px-6 py-3 font-medium">{c.name}</td>
                                        <td className="px-6 py-3 hidden md:table-cell text-muted-foreground">{c.parent_id ? nameOf(c.parent_id) : '—'}</td>
                                        <td className="px-6 py-3 text-right tabular-nums">{c.depreciation_rate ?? 0}</td>
                                        <td className="px-6 py-3 text-right tabular-nums hidden sm:table-cell">{c.useful_life_years ?? 0}</td>
                                        <td className="px-6 py-3">
                                            <div className="flex gap-2 justify-end">
                                                {canChange && <Button variant="outline" size="sm" onClick={() => openEdit(c)}>Edit</Button>}
                                                {canDelete && <Button variant="outline" size="sm" onClick={() => handleDelete(c)}>Delete</Button>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
                                            <Input type="number" min="0" step="0.01" value={depRate} onChange={(e) => setDepRate(e.target.value)} placeholder="e.g. 20" />
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
        </div>
    );
}
