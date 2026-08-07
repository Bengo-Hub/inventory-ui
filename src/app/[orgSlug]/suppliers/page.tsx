'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { SupplierFormDialog } from '@/components/inventory/SupplierFormDialog';
import { useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier } from '@/hooks/useSuppliers';
import { type Supplier, type CreateSupplierInput } from '@/lib/api/suppliers';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildSupplierColumns } from './supplier-columns';
import { Plus, Search } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions, P } from '@/hooks/usePermissions';
import { apiErrorMessage } from '@/lib/api/error-message';

const ITEMS_PER_PAGE = 20;

export default function SuppliersPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Supplier | null>(null);

    const { data, isLoading, isError, refetch } = useSuppliers(orgSlug, { search: search || undefined, page, limit: ITEMS_PER_PAGE });
    const createSupplier = useCreateSupplier(orgSlug);
    const updateSupplier = useUpdateSupplier(orgSlug);
    const deleteSupplier = useDeleteSupplier(orgSlug);

    const { canAny } = usePermissions();
    const canAdd = canAny([P.SUPPLIERS_ADD, P.SUPPLIERS_MANAGE]);
    const canChange = canAny([P.SUPPLIERS_CHANGE, P.SUPPLIERS_MANAGE]);
    const canDelete = canAny([P.SUPPLIERS_DELETE, P.SUPPLIERS_MANAGE]);

    const isPending = createSupplier.isPending || updateSupplier.isPending;

    const paginatedItems = data?.data ?? [];
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / ITEMS_PER_PAGE));

    useMemo(() => { setPage(1); }, [search]);

    function openCreate() {
        setEditing(null);
        setDialogOpen(true);
    }

    function openEdit(supplier: Supplier) {
        setEditing(supplier);
        setDialogOpen(true);
    }

    function closeDialog() {
        setDialogOpen(false);
        setEditing(null);
    }

    function handleDelete(supplier: Supplier) {
        if (!confirm(`Delete supplier "${supplier.name}"? This cannot be undone.`)) return;
        deleteSupplier.mutate(supplier.id, {
            onSuccess: () => toast.success('Supplier deleted'),
            onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to delete supplier')),
        });
    }

    const columns = useMemo(
        () => buildSupplierColumns({
            canChange,
            canDelete,
            isDeleting: deleteSupplier.isPending,
            onEdit: openEdit,
            onDelete: handleDelete,
        }),
        [canChange, canDelete, deleteSupplier.isPending],
    );

    function handleSubmit(data: CreateSupplierInput) {
        if (editing) {
            updateSupplier.mutate({ id: editing.id, data }, {
                onSuccess: () => { toast.success('Supplier updated'); closeDialog(); },
                onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to update supplier')),
            });
        } else {
            createSupplier.mutate(data, {
                onSuccess: () => { toast.success('Supplier created'); closeDialog(); },
                onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to create supplier')),
            });
        }
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
                    <p className="text-muted-foreground mt-1">Manage your inventory suppliers</p>
                </div>
                {canAdd && (
                    <Button onClick={openCreate}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Supplier
                    </Button>
                )}
            </div>

            <Card>
                <CardHeader>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search suppliers..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="px-2 pb-2">
                        <DataTable<Supplier>
                            columns={columns}
                            rows={paginatedItems}
                            rowKey={(s) => s.id}
                            loading={isLoading}
                            error={isError}
                            onRetry={() => refetch()}
                            emptyText="No suppliers found"
                            storageKey="suppliers-col-prefs"
                            page={page}
                            totalPages={totalPages}
                            onPageChange={setPage}
                            total={data?.total}
                            pageSize={ITEMS_PER_PAGE}
                        />
                    </div>
                </CardContent>
            </Card>

            {dialogOpen && (
                <SupplierFormDialog
                    editing={editing}
                    isPending={isPending}
                    onSubmit={handleSubmit}
                    onClose={closeDialog}
                />
            )}
        </div>
    );
}
