'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { AssetFormDialog } from '@/components/inventory/AssetFormDialog';
import { DetailDrawer } from '@/components/inventory/DetailDrawer';
import { RowActions } from '@/components/inventory/RowActions';
import {
    useAssets, useCreateAsset, useUpdateAsset, useDeleteAsset, useRunDepreciation,
} from '@/hooks/useAssets';
import { type Asset, type AssetStatus, type CreateAssetInput } from '@/lib/api/assets';
import { AlertTriangle, BarChart3, Boxes, FolderTree, Plus } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions, P } from '@/hooks/usePermissions';

const ITEMS_PER_PAGE = 20;

const STATUS_VARIANT: Record<AssetStatus, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
    active: 'success', inactive: 'outline', maintenance: 'warning',
    disposed: 'error', lost: 'error', damaged: 'error', retired: 'outline',
};

const STATUSES: AssetStatus[] = ['active', 'inactive', 'maintenance', 'disposed', 'lost', 'damaged', 'retired'];

function money(v?: number | null) {
    if (v == null) return '—';
    return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AssetsPage() {
    const params = useParams();
    const router = useRouter();
    const orgSlug = params?.orgSlug as string;
    const [status, setStatus] = useState<AssetStatus | ''>('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Asset | null>(null);
    const [viewing, setViewing] = useState<Asset | null>(null);

    const { data, isLoading, isError, refetch } = useAssets(orgSlug, {
        status: status || undefined, search: search || undefined, page, limit: ITEMS_PER_PAGE,
    });
    const createAsset = useCreateAsset(orgSlug);
    const updateAsset = useUpdateAsset(orgSlug);
    const deleteAsset = useDeleteAsset(orgSlug);
    const runDep = useRunDepreciation(orgSlug);

    const { canAny } = usePermissions();
    const canAdd = canAny([P.CATALOG_ADD, P.CATALOG_MANAGE]);
    const canChange = canAny([P.CATALOG_CHANGE, P.CATALOG_MANAGE]);
    const canDelete = canAny([P.CATALOG_DELETE, P.CATALOG_MANAGE]);

    const rows = data?.data ?? [];
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / ITEMS_PER_PAGE));
    useMemo(() => { setPage(1); }, [status, search]);

    function act(label: string, p: Promise<unknown>) {
        p.then(() => toast.success(label)).catch(() => toast.error(`Failed to ${label.toLowerCase()}`));
    }

    function handleSubmit(input: CreateAssetInput) {
        if (editing) {
            updateAsset.mutate({ id: editing.id, data: input }, {
                onSuccess: () => { toast.success('Asset updated'); closeDialog(); },
                onError: () => toast.error('Failed to update asset'),
            });
        } else {
            createAsset.mutate(input, {
                onSuccess: () => { toast.success('Asset created'); closeDialog(); },
                onError: () => toast.error('Failed to create asset'),
            });
        }
    }

    function closeDialog() { setDialogOpen(false); setEditing(null); }
    function openEdit(a: Asset) { setEditing(a); setDialogOpen(true); }
    function openNew() { setEditing(null); setDialogOpen(true); }

    function handleDelete(a: Asset) {
        if (!window.confirm(`Dispose/retire asset "${a.name}"?`)) return;
        act('Deleted', deleteAsset.mutateAsync(a.id));
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Boxes className="h-6 w-6" /> Fixed Assets</h1>
                    <p className="text-muted-foreground mt-1">Asset register, depreciation &amp; lifecycle</p>
                </div>
                <div className="flex gap-2">
                    <Link href={`/${orgSlug}/assets/analytics`}><Button variant="outline"><BarChart3 className="h-4 w-4 mr-2" /> Analytics</Button></Link>
                    <Link href={`/${orgSlug}/asset-categories`}><Button variant="outline"><FolderTree className="h-4 w-4 mr-2" /> Categories</Button></Link>
                    {canAdd && <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> New Asset</Button>}
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Input className="sm:max-w-xs" placeholder="Search tag, name, serial…" value={search} onChange={(e) => setSearch(e.target.value)} />
                        <select className="border border-border rounded-md px-3 py-2 text-sm bg-background"
                            value={status} onChange={(e) => setStatus(e.target.value as AssetStatus | '')}>
                            <option value="">All statuses</option>
                            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Tag</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Name</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Cost</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden lg:table-cell">Current Value</th>
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
                                            <p className="text-muted-foreground">Couldn&apos;t load assets</p>
                                            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
                                        </td>
                                    </tr>
                                )}
                                {!isLoading && !isError && rows.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <Boxes className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No assets yet</p>
                                        </td>
                                    </tr>
                                )}
                                {!isError && rows.map((a) => (
                                    <tr key={a.id} className="border-b border-border hover:bg-muted/20 cursor-pointer" onClick={() => setViewing(a)}>
                                        <td className="px-6 py-3 font-medium">{a.asset_tag}</td>
                                        <td className="px-6 py-3">{a.name}</td>
                                        <td className="px-6 py-3 text-right hidden md:table-cell">{money(a.purchase_cost)}</td>
                                        <td className="px-6 py-3 text-right hidden lg:table-cell">{money(a.current_value)}</td>
                                        <td className="px-6 py-3"><Badge variant={STATUS_VARIANT[a.status]}>{a.status}</Badge></td>
                                        <td className="px-6 py-3">
                                            <RowActions
                                                onView={() => setViewing(a)}
                                                onEdit={() => openEdit(a)}
                                                canEdit={canChange}
                                                onDelete={() => handleDelete(a)}
                                                canDelete={canDelete}
                                                deleteLabel="Dispose / retire"
                                                extra={canChange && a.status === 'active' && (
                                                    <Button variant="outline" size="sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); act('Depreciation run', runDep.mutateAsync(a.id)); }}>Depreciate</Button>
                                                )}
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

            {dialogOpen && (
                <AssetFormDialog
                    org={orgSlug}
                    asset={editing}
                    isPending={createAsset.isPending || updateAsset.isPending}
                    onSubmit={handleSubmit}
                    onClose={closeDialog}
                />
            )}

            <DetailDrawer
                open={!!viewing}
                onClose={() => setViewing(null)}
                title={viewing?.name ?? 'Asset'}
                subtitle={viewing?.asset_tag}
                badges={viewing && <Badge variant={STATUS_VARIANT[viewing.status]}>{viewing.status}</Badge>}
                fields={viewing ? [
                    { label: 'Asset Tag', value: viewing.asset_tag },
                    { label: 'Serial No.', value: viewing.serial_number, hideIfEmpty: true },
                    { label: 'Model', value: viewing.model, hideIfEmpty: true },
                    { label: 'Manufacturer', value: viewing.manufacturer, hideIfEmpty: true },
                    { label: 'Location', value: viewing.location, hideIfEmpty: true },
                    { label: 'Purchase cost', value: money(viewing.purchase_cost) },
                    { label: 'Current value', value: money(viewing.current_value) },
                    { label: 'Accumulated dep.', value: money(viewing.accumulated_depreciation) },
                    { label: 'Purchase date', value: viewing.purchase_date ? new Date(viewing.purchase_date).toLocaleDateString() : '—' },
                    { label: 'Notes', value: viewing.notes, full: true, hideIfEmpty: true },
                ] : []}
                actions={viewing && (
                    <>
                        <Button size="sm" onClick={() => router.push(`/${orgSlug}/assets/${viewing.id}`)}>Open full asset</Button>
                        {canChange && <Button variant="outline" size="sm" onClick={() => { openEdit(viewing); setViewing(null); }}>Edit</Button>}
                        {canChange && viewing.status === 'active' && (
                            <Button variant="outline" size="sm" onClick={() => act('Depreciation run', runDep.mutateAsync(viewing.id))}>Depreciate</Button>
                        )}
                        {canDelete && <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => { handleDelete(viewing); }}>Dispose</Button>}
                    </>
                )}
            />
        </div>
    );
}
