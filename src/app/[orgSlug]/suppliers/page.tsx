'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { SupplierFormDialog } from '@/components/inventory/SupplierFormDialog';
import { useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier } from '@/hooks/useSuppliers';
import { type Supplier, type CreateSupplierInput } from '@/lib/api/suppliers';
import { AlertTriangle, Plus, Search, Trash2, Truck } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions, P } from '@/hooks/usePermissions';

const ITEMS_PER_PAGE = 20;

const PAYMENT_LABEL: Record<string, string> = {
    mpesa: 'M-Pesa',
    mpesa_b2b: 'M-Pesa B2B',
    bank_transfer: 'Bank Transfer',
    cash: 'Cash',
    cheque: 'Cheque',
};

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
            onError: () => toast.error('Failed to delete supplier'),
        });
    }

    function handleSubmit(data: CreateSupplierInput) {
        if (editing) {
            updateSupplier.mutate({ id: editing.id, data }, {
                onSuccess: () => { toast.success('Supplier updated'); closeDialog(); },
                onError: () => toast.error('Failed to update supplier'),
            });
        } else {
            createSupplier.mutate(data, {
                onSuccess: () => { toast.success('Supplier created'); closeDialog(); },
                onError: () => toast.error('Failed to create supplier'),
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
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Name</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Contact</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden lg:table-cell">Email</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Phone</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden xl:table-cell">Payment</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                                            Loading suppliers...
                                        </td>
                                    </tr>
                                ) : isError ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <AlertTriangle className="h-10 w-10 mx-auto text-destructive/60 mb-3" />
                                            <p className="text-muted-foreground">Couldn&apos;t load suppliers</p>
                                            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
                                        </td>
                                    </tr>
                                ) : (data?.total ?? 0) === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <Truck className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No suppliers found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map((supplier) => (
                                        <tr key={supplier.id} className="hover:bg-accent/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium">{supplier.name}</div>
                                                {supplier.auto_pay_enabled && (
                                                    <span className="text-xs text-emerald-600 dark:text-emerald-400">Auto-pay enabled</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground hidden md:table-cell">{supplier.contact_person ?? '—'}</td>
                                            <td className="px-6 py-4 text-muted-foreground hidden lg:table-cell">{supplier.email ?? '—'}</td>
                                            <td className="px-6 py-4 text-muted-foreground hidden sm:table-cell">{supplier.phone ?? '—'}</td>
                                            <td className="px-6 py-4 hidden xl:table-cell">
                                                {supplier.payment_method_type
                                                    ? <Badge variant="outline">{PAYMENT_LABEL[supplier.payment_method_type] ?? supplier.payment_method_type}</Badge>
                                                    : <span className="text-muted-foreground/40">—</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge variant={supplier.is_active ? 'success' : 'outline'}>
                                                    {supplier.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {canChange && (
                                                        <Button variant="ghost" size="sm" onClick={() => openEdit(supplier)}>
                                                            Edit
                                                        </Button>
                                                    )}
                                                    {canDelete && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-destructive hover:text-destructive"
                                                            title="Delete supplier"
                                                            aria-label="Delete supplier"
                                                            onClick={() => handleDelete(supplier)}
                                                            disabled={deleteSupplier.isPending}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!isLoading && (data?.total ?? 0) > 0 && (
                        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                    )}
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
