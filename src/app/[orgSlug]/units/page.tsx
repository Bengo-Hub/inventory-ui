'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { apiClient } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Ruler, Search, Trash2, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 20;

interface Unit {
    id: string;
    name: string;
    abbreviation: string;
    type?: string;
    itemCount?: number;
    is_active?: boolean;
}

interface UnitPayload {
    name: string;
    abbreviation: string;
    type: string;
}

export default function UnitsPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Unit | null>(null);

    const [formName, setFormName] = useState('');
    const [formAbbreviation, setFormAbbreviation] = useState('');
    const [formType, setFormType] = useState('');

    const { data: units, isLoading } = useQuery<Unit[]>({
        queryKey: ['units', orgSlug, search],
        queryFn: () => {
            const p: Record<string, string> = {};
            if (search) p.search = search;
            return apiClient.get(`/api/v1/${orgSlug}/inventory/units`, p);
        },
        placeholderData: [],
    });

    const mutation = useMutation({
        mutationFn: (payload: UnitPayload) =>
            editing
                ? apiClient.put(`/api/v1/${orgSlug}/inventory/units/${editing.id}`, payload)
                : apiClient.post(`/api/v1/${orgSlug}/inventory/units`, payload),
        onSuccess: () => {
            toast.success(editing ? 'Unit updated' : 'Unit created');
            queryClient.invalidateQueries({ queryKey: ['units'] });
            closeDialog();
        },
        onError: () => {
            toast.error(editing ? 'Failed to update unit' : 'Failed to create unit');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiClient.delete(`/api/v1/${orgSlug}/inventory/units/${id}`),
        onSuccess: () => {
            toast.success('Unit deleted');
            queryClient.invalidateQueries({ queryKey: ['units'] });
        },
        onError: () => toast.error('Failed to delete unit'),
    });

    function handleDelete(unit: Unit) {
        if (!confirm(`Delete unit "${unit.name}"? This cannot be undone.`)) return;
        deleteMutation.mutate(unit.id);
    }

    const totalPages = Math.max(1, Math.ceil((units?.length ?? 0) / ITEMS_PER_PAGE));
    const paginatedItems = units?.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE) ?? [];

    useMemo(() => { setPage(1); }, [search]);

    function openCreate() {
        setEditing(null);
        setFormName('');
        setFormAbbreviation('');
        setFormType('');
        setDialogOpen(true);
    }

    function openEdit(unit: Unit) {
        setEditing(unit);
        setFormName(unit.name);
        setFormAbbreviation(unit.abbreviation);
        setFormType(unit.type ?? '');
        setDialogOpen(true);
    }

    function closeDialog() {
        setDialogOpen(false);
        setEditing(null);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formName.trim() || !formAbbreviation.trim()) {
            toast.error('Name and abbreviation are required');
            return;
        }
        mutation.mutate({
            name: formName.trim(),
            abbreviation: formAbbreviation.trim(),
            type: formType.trim(),
        });
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Units of Measure</h1>
                    <p className="text-muted-foreground mt-1">Define units used for items, recipes, and stock</p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Unit
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search units..."
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
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Abbreviation</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Type</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Used by Items</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                            Loading units...
                                        </td>
                                    </tr>
                                ) : (units?.length ?? 0) === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <Ruler className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No units defined yet</p>
                                            <p className="text-xs text-muted-foreground/70 mt-1">Add units like kg, litre, piece to use in items and recipes</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map((unit) => (
                                        <tr key={unit.id} className="hover:bg-accent/30 transition-colors">
                                            <td className="px-6 py-4 font-medium">{unit.name}</td>
                                            <td className="px-6 py-4 font-mono text-xs font-semibold text-primary">{unit.abbreviation}</td>
                                            <td className="px-6 py-4 text-muted-foreground hidden md:table-cell capitalize">
                                                {unit.type || <span className="text-muted-foreground/40">—</span>}
                                            </td>
                                            <td className="px-6 py-4 text-right tabular-nums hidden sm:table-cell">
                                                {(unit.itemCount ?? 0).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleDelete(unit)}
                                                    disabled={deleteMutation.isPending}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!isLoading && (units?.length ?? 0) > 0 && (
                        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                    )}
                </CardContent>
            </Card>

            {dialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeDialog} />
                    <div className="relative z-50 w-full max-w-lg mx-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold">Add Unit</h2>
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
                                                placeholder="e.g. Kilogram"
                                                value={formName}
                                                onChange={(e) => setFormName(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Abbreviation *</label>
                                            <Input
                                                placeholder="e.g. kg"
                                                value={formAbbreviation}
                                                onChange={(e) => setFormAbbreviation(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Type</label>
                                        <select
                                            value={formType}
                                            onChange={(e) => setFormType(e.target.value)}
                                            className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                        >
                                            <option value="">Select type...</option>
                                            <option value="weight">Weight</option>
                                            <option value="volume">Volume</option>
                                            <option value="count">Count</option>
                                            <option value="length">Length</option>
                                            <option value="area">Area</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <Button type="button" variant="outline" className="flex-1" onClick={closeDialog}>
                                            Cancel
                                        </Button>
                                        <Button type="submit" className="flex-1" disabled={mutation.isPending}>
                                            {mutation.isPending ? 'Saving...' : 'Create'}
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
