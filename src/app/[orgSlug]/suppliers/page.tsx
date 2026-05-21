'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { apiClient } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, Search, Truck, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 20;

interface Supplier {
    id: string;
    name: string;
    contactName: string;
    email: string;
    phone: string;
    status: 'active' | 'inactive';
    itemsSupplied: number;
}

interface SupplierPayload {
    name: string;
    contactName: string;
    email: string;
    phone: string;
}

const STATUS_VARIANT: Record<string, 'success' | 'outline'> = {
    active: 'success',
    inactive: 'outline',
};

export default function SuppliersPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Supplier | null>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formContact, setFormContact] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formPhone, setFormPhone] = useState('');

    const { data: suppliers, isLoading } = useQuery<Supplier[]>({
        queryKey: ['suppliers', orgSlug, search],
        queryFn: () => {
            const p: Record<string, string> = {};
            if (search) p.search = search;
            return apiClient.get(`/api/v1/${orgSlug}/inventory/suppliers`, p);
        },
        placeholderData: [],
    });

    const mutation = useMutation({
        mutationFn: (payload: SupplierPayload) =>
            editing
                ? apiClient.put(`/api/v1/${orgSlug}/inventory/suppliers/${editing.id}`, payload)
                : apiClient.post(`/api/v1/${orgSlug}/inventory/suppliers`, payload),
        onSuccess: () => {
            toast.success(editing ? 'Supplier updated' : 'Supplier created');
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            closeDialog();
        },
        onError: () => {
            toast.error(editing ? 'Failed to update supplier' : 'Failed to create supplier');
        },
    });

    const totalPages = Math.max(1, Math.ceil((suppliers?.length ?? 0) / ITEMS_PER_PAGE));
    const paginatedItems = suppliers?.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE) ?? [];

    useMemo(() => { setPage(1); }, [search]);

    function openCreate() {
        setEditing(null);
        setFormName('');
        setFormContact('');
        setFormEmail('');
        setFormPhone('');
        setDialogOpen(true);
    }

    function openEdit(supplier: Supplier) {
        setEditing(supplier);
        setFormName(supplier.name);
        setFormContact(supplier.contactName);
        setFormEmail(supplier.email);
        setFormPhone(supplier.phone);
        setDialogOpen(true);
    }

    function closeDialog() {
        setDialogOpen(false);
        setEditing(null);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formName.trim()) {
            toast.error('Supplier name is required');
            return;
        }
        mutation.mutate({
            name: formName.trim(),
            contactName: formContact.trim(),
            email: formEmail.trim(),
            phone: formPhone.trim(),
        });
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
                    <p className="text-muted-foreground mt-1">Manage your inventory suppliers</p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Supplier
                </Button>
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
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Items</th>
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
                                ) : (suppliers?.length ?? 0) === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <Truck className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No suppliers found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map((supplier) => (
                                        <tr key={supplier.id} className="hover:bg-accent/30 transition-colors">
                                            <td className="px-6 py-4 font-medium">{supplier.name}</td>
                                            <td className="px-6 py-4 text-muted-foreground hidden md:table-cell">{supplier.contactName}</td>
                                            <td className="px-6 py-4 text-muted-foreground hidden lg:table-cell">{supplier.email}</td>
                                            <td className="px-6 py-4 text-muted-foreground hidden sm:table-cell">{supplier.phone}</td>
                                            <td className="px-6 py-4">
                                                <Badge variant={STATUS_VARIANT[supplier.status] ?? 'default'}>
                                                    {supplier.status}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right tabular-nums hidden sm:table-cell">
                                                <div className="flex items-center justify-end gap-1 text-muted-foreground">
                                                    <Package className="h-3 w-3" />
                                                    {supplier.itemsSupplied}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button variant="ghost" size="sm" onClick={() => openEdit(supplier)}>
                                                    Edit
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!isLoading && (suppliers?.length ?? 0) > 0 && (
                        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                    )}
                </CardContent>
            </Card>

            {/* Add/Edit Supplier Dialog */}
            {dialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeDialog} />
                    <div className="relative z-50 w-full max-w-lg mx-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold">
                                        {editing ? 'Edit Supplier' : 'Add Supplier'}
                                    </h2>
                                    <button onClick={closeDialog} className="p-1 rounded-lg hover:bg-accent transition-colors">
                                        <X className="h-5 w-5 text-muted-foreground" />
                                    </button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Supplier Name *</label>
                                        <Input
                                            placeholder="e.g. Acme Supplies Ltd"
                                            value={formName}
                                            onChange={(e) => setFormName(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Contact Person</label>
                                        <Input
                                            placeholder="Full name"
                                            value={formContact}
                                            onChange={(e) => setFormContact(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Email</label>
                                            <Input
                                                type="email"
                                                placeholder="email@example.com"
                                                value={formEmail}
                                                onChange={(e) => setFormEmail(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Phone</label>
                                            <Input
                                                placeholder="+254 700 000000"
                                                value={formPhone}
                                                onChange={(e) => setFormPhone(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <Button type="button" variant="outline" className="flex-1" onClick={closeDialog}>
                                            Cancel
                                        </Button>
                                        <Button type="submit" className="flex-1" disabled={mutation.isPending}>
                                            {mutation.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
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
