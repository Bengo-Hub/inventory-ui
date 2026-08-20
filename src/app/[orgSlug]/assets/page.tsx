'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { AssetFormDialog } from '@/components/inventory/AssetFormDialog';
import { DetailDrawer } from '@/components/inventory/DetailDrawer';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
    useAssets, useCreateAsset, useUpdateAsset, useDeleteAsset, useRunDepreciation,
} from '@/hooks/useAssets';
import { type Asset, type AssetStatus, type CreateAssetInput } from '@/lib/api/assets';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildAssetColumns, STATUS_VARIANT, money } from './asset-columns';
import { BarChart3, Boxes, FolderTree, Plus } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions, P } from '@/hooks/usePermissions';
import { apiErrorMessage } from '@/lib/api/error-message';

const STATUSES: AssetStatus[] = ['active', 'inactive', 'maintenance', 'disposed', 'lost', 'damaged', 'retired'];

export default function AssetsPage() {
    const params = useParams();
    const router = useRouter();
    const orgSlug = params?.orgSlug as string;
    const [status, setStatus] = useState<AssetStatus | ''>('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Asset | null>(null);
    const [viewing, setViewing] = useState<Asset | null>(null);
    const [disposeTarget, setDisposeTarget] = useState<Asset | null>(null);

    const { data, isLoading, isError, refetch } = useAssets(orgSlug, {
        status: status || undefined, search: search || undefined, page, limit: pageSize,
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
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));
    useMemo(() => { setPage(1); }, [status, search, pageSize]);

    function act(label: string, p: Promise<unknown>) {
        p.then(() => toast.success(label)).catch(async (e) => toast.error(await apiErrorMessage(e, `Failed to ${label.toLowerCase()}`)));
    }

    function handleSubmit(input: CreateAssetInput) {
        if (editing) {
            updateAsset.mutate({ id: editing.id, data: input }, {
                onSuccess: () => { toast.success('Asset updated'); closeDialog(); },
                onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to update asset')),
            });
        } else {
            createAsset.mutate(input, {
                onSuccess: () => { toast.success('Asset created'); closeDialog(); },
                onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to create asset')),
            });
        }
    }

    function closeDialog() { setDialogOpen(false); setEditing(null); }
    function openEdit(a: Asset) { setEditing(a); setDialogOpen(true); }
    function openNew() { setEditing(null); setDialogOpen(true); }

    function handleDelete(a: Asset) {
        setDisposeTarget(a);
    }

    function confirmDispose() {
        if (!disposeTarget) return;
        act('Deleted', deleteAsset.mutateAsync(disposeTarget.id));
        setDisposeTarget(null);
    }

    const columns = useMemo(
        () => buildAssetColumns({
            canChange,
            canDelete,
            onView: setViewing,
            onEdit: openEdit,
            onDelete: handleDelete,
            onDepreciate: (a) => act('Depreciation run', runDep.mutateAsync(a.id)),
        }),
        [canChange, canDelete, runDep],
    );

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
                    <div className="px-2 pb-2">
                        <DataTable<Asset>
                            columns={columns}
                            rows={rows}
                            rowKey={(a) => a.id}
                            loading={isLoading}
                            loadingRows={8}
                            error={isError}
                            onRetry={() => refetch()}
                            onRowClick={(a) => setViewing(a)}
                            emptyState={
                                <>
                                    <Boxes className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                    <p className="text-muted-foreground">No assets yet</p>
                                </>
                            }
                            storageKey="assets-col-prefs"
                            page={page}
                            totalPages={totalPages}
                            onPageChange={setPage}
                            total={data?.total}
                            pageSize={pageSize}
                            onPageSizeChange={setPageSize}
                        />
                    </div>
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

            <ConfirmDialog
                open={!!disposeTarget}
                title={`Dispose/retire asset "${disposeTarget?.name ?? ''}"?`}
                description="This cannot be undone."
                variant="danger"
                confirmLabel="Dispose"
                onConfirm={confirmDispose}
                onCancel={() => setDisposeTarget(null)}
            />
        </div>
    );
}
