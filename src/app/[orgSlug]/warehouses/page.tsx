'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { DetailDrawer } from '@/components/inventory/DetailDrawer';
import { RowActions } from '@/components/inventory/RowActions';
import { useWarehouses, useCreateWarehouse, useUpdateWarehouse, useDeleteWarehouse } from '@/hooks/useWarehouses';
import { type Warehouse, type CreateWarehouseInput } from '@/lib/api/warehouses';
import { useOutletStore } from '@/store/outlet';
import { AlertTriangle, MapPin, Package, Pencil, Plus, Store, Trash2, Warehouse as WarehouseIcon, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';

export default function WarehousesPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const { outlet } = useOutletStore();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Warehouse | null>(null);

    const [formName, setFormName] = useState('');
    const [formCode, setFormCode] = useState('');
    const [formAddress, setFormAddress] = useState('');
    const [formIsDefault, setFormIsDefault] = useState(false);

    const { data: warehouses, isLoading, isError, refetch } = useWarehouses(orgSlug);
    const createWarehouse = useCreateWarehouse(orgSlug);
    const updateWarehouse = useUpdateWarehouse(orgSlug);
    const deleteWarehouse = useDeleteWarehouse(orgSlug);

    function openCreate() {
        setEditing(null);
        setFormName('');
        setFormCode('');
        setFormAddress('');
        setFormIsDefault(false);
        setDialogOpen(true);
    }

    function openEdit(wh: Warehouse) {
        setEditing(wh);
        setFormName(wh.name);
        setFormCode(wh.code);
        setFormAddress(wh.address ?? '');
        setFormIsDefault(wh.is_default);
        setDialogOpen(true);
    }

    function closeDialog() {
        setDialogOpen(false);
        setEditing(null);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formName.trim() || !formCode.trim()) {
            toast.error('Name and code are required');
            return;
        }
        const payload: CreateWarehouseInput = {
            name: formName.trim(),
            code: formCode.trim().toUpperCase(),
            address: formAddress.trim() || undefined,
            is_default: formIsDefault,
            outlet_id: outlet?.id,
        };

        if (editing) {
            updateWarehouse.mutate({ id: editing.id, data: payload }, {
                onSuccess: () => { toast.success('Warehouse updated'); closeDialog(); },
                onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to update warehouse')),
            });
        } else {
            createWarehouse.mutate(payload, {
                onSuccess: () => { toast.success('Warehouse created'); closeDialog(); },
                onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to create warehouse')),
            });
        }
    }

    function handleDelete(wh: Warehouse) {
        if (!confirm(`Delete warehouse "${wh.name}"? This cannot be undone.`)) return;
        deleteWarehouse.mutate(wh.id, {
            onSuccess: () => toast.success('Warehouse deleted'),
            onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to delete warehouse')),
        });
    }

    const isPending = createWarehouse.isPending || updateWarehouse.isPending;

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Warehouses</h1>
                    <p className="text-muted-foreground mt-1">Storage locations for your inventory</p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Warehouse
                </Button>
            </div>

            {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">Loading warehouses...</div>
            ) : isError ? (
                <Card>
                    <CardContent className="py-16 text-center">
                        <AlertTriangle className="h-12 w-12 mx-auto text-destructive/60 mb-4" />
                        <p className="text-muted-foreground">Couldn&apos;t load warehouses</p>
                        <Button variant="outline" className="mt-4" onClick={() => refetch()}>Retry</Button>
                    </CardContent>
                </Card>
            ) : (warehouses?.length ?? 0) === 0 ? (
                <Card>
                    <CardContent className="py-16 text-center">
                        <WarehouseIcon className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                        <p className="text-muted-foreground">No warehouses yet</p>
                        <Button className="mt-4" onClick={openCreate}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add your first warehouse
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {warehouses?.map((wh) => (
                        <Card key={wh.id}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                            <WarehouseIcon className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-semibold">{wh.name}</h3>
                                                {wh.is_default && (
                                                    <Badge variant="success" className="text-xs">Default</Badge>
                                                )}
                                            </div>
                                            <p className="text-xs font-mono text-muted-foreground">{wh.code}</p>
                                            {wh.outlet_id && outlet?.id === wh.outlet_id && (
                                                <div className="flex items-center gap-1 text-xs text-primary mt-0.5">
                                                    <Store className="h-3 w-3" />
                                                    {outlet.name}
                                                </div>
                                            )}
                                            {wh.address && (
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                                    <MapPin className="h-3 w-3" />
                                                    {wh.address}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <Badge variant={wh.is_active ? 'success' : 'outline'}>
                                        {wh.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Package className="h-4 w-4" />
                                        <span>{(wh.item_count ?? 0).toLocaleString()} items tracked</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Link href={`/${orgSlug}/warehouses/${wh.id}/locations`}>
                                            <Button variant="ghost" size="sm" aria-label="Manage locations">
                                                <MapPin className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                        <Button variant="ghost" size="sm" aria-label="Edit warehouse" onClick={() => openEdit(wh)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            aria-label="Delete warehouse"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => handleDelete(wh)}
                                            disabled={deleteWarehouse.isPending}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {dialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeDialog} />
                    <div className="relative z-50 w-full max-w-lg mx-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold">
                                        {editing ? 'Edit Warehouse' : 'New Warehouse'}
                                    </h2>
                                    <button onClick={closeDialog} className="p-1 rounded-lg hover:bg-accent transition-colors">
                                        <X className="h-5 w-5 text-muted-foreground" />
                                    </button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Name *</label>
                                            <Input
                                                placeholder="e.g. Main Warehouse"
                                                value={formName}
                                                onChange={(e) => setFormName(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Code *</label>
                                            <Input
                                                placeholder="e.g. WH-MAIN"
                                                value={formCode}
                                                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Address</label>
                                        <Input
                                            placeholder="Street address (optional)"
                                            value={formAddress}
                                            onChange={(e) => setFormAddress(e.target.value)}
                                        />
                                    </div>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formIsDefault}
                                            onChange={(e) => setFormIsDefault(e.target.checked)}
                                            className="rounded"
                                        />
                                        Set as default warehouse
                                    </label>
                                    <div className="flex gap-3 pt-2">
                                        <Button type="button" variant="outline" className="flex-1" onClick={closeDialog}>
                                            Cancel
                                        </Button>
                                        <Button type="submit" className="flex-1" disabled={isPending}>
                                            {isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
                                        </Button>
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
