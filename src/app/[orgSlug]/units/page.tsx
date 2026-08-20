'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { apiClient } from '@/lib/api/client';
import { apiErrorMessage } from '@/lib/api/error-message';
import { useItems } from '@/hooks/useItems';
import { normalizeName } from '@/hooks/useDuplicateNameWarning';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildUnitColumns, TYPE_LABELS, type Unit } from './unit-columns';
import { Plus, Ruler, Search, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

interface UnitPayload {
    name: string;
    abbreviation: string;
    type: string;
}

function UnitDrawer({ unit, orgSlug, onClose }: { unit: Unit; orgSlug: string; onClose: () => void }) {
    const { data: itemsData } = useItems(orgSlug, { unit_id: unit.id, limit: 20 });
    const items = itemsData?.data ?? [];

    return (
        <Sheet open onClose={onClose} width="md">
            <SheetHeader>
                <SheetTitle>{unit.name}</SheetTitle>
                <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-5 w-5" />
                </button>
            </SheetHeader>
            <SheetContent>
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-1">
                            <p className="text-xs text-muted-foreground">Abbreviation</p>
                            <p className="text-xl font-bold font-mono text-primary">{unit.abbreviation || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-1">
                            <p className="text-xs text-muted-foreground">Type</p>
                            <p className="text-base font-semibold capitalize">{TYPE_LABELS[unit.type ?? ''] ?? (unit.type || '—')}</p>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold">Items Using This Unit</h3>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                {unit.item_count ?? items.length}
                            </span>
                        </div>
                        {items.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">No items linked to this unit</p>
                        ) : (
                            <div className="space-y-2">
                                {items.map((item) => (
                                    <div key={item.sku} className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/10">
                                        <div>
                                            <p className="text-sm font-medium">{item.name}</p>
                                            <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                                        </div>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                                            {item.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

export default function UnitsPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Unit | null>(null);
    const [viewUnit, setViewUnit] = useState<Unit | null>(null);

    const [formName, setFormName] = useState('');
    const [formAbbreviation, setFormAbbreviation] = useState('');
    const [formType, setFormType] = useState('');

    const { data: units, isLoading, isError, refetch } = useQuery<Unit[]>({
        queryKey: ['units', orgSlug, search],
        queryFn: () => {
            const p: Record<string, string> = {};
            if (search) p.search = search;
            return apiClient.get(`/api/v1/${orgSlug}/inventory/units`, p);
        },
        placeholderData: [],
    });

    // Unfiltered list for the duplicate-name/abbreviation check below — decoupled
    // from the search box above, which can be actively filtering when the dialog opens.
    const { data: allUnits } = useQuery<Unit[]>({
        queryKey: ['units', orgSlug],
        queryFn: () => apiClient.get(`/api/v1/${orgSlug}/inventory/units`),
        placeholderData: [],
    });
    const normalizedFormName = normalizeName(formName);
    const normalizedFormAbbr = normalizeName(formAbbreviation);
    const dupNameUnit = normalizedFormName.length > 0
        ? (allUnits ?? []).find((u) => (!editing || u.id !== editing.id) && normalizeName(u.name) === normalizedFormName)
        : undefined;
    const dupAbbrUnit = !dupNameUnit && normalizedFormAbbr.length > 0
        ? (allUnits ?? []).find((u) => (!editing || u.id !== editing.id) && normalizeName(u.abbreviation) === normalizedFormAbbr)
        : undefined;
    const unitDuplicateError = dupNameUnit
        ? `A unit named "${dupNameUnit.name}" already exists.`
        : dupAbbrUnit
            ? `Abbreviation "${dupAbbrUnit.abbreviation}" is already used by "${dupAbbrUnit.name}".`
            : null;

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
        onError: async (e) => {
            toast.error(await apiErrorMessage(e, editing ? 'Failed to update unit' : 'Failed to create unit'));
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

    const totalPages = Math.max(1, Math.ceil((units?.length ?? 0) / pageSize));
    const paginatedItems = units?.slice((page - 1) * pageSize, page * pageSize) ?? [];

    useMemo(() => { setPage(1); }, [search, pageSize]);

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
        if (unitDuplicateError) {
            toast.error(unitDuplicateError);
            return;
        }
        mutation.mutate({
            name: formName.trim(),
            abbreviation: formAbbreviation.trim(),
            type: formType.trim(),
        });
    }

    const columns = useMemo(
        () => buildUnitColumns({ isDeleting: deleteMutation.isPending, onView: setViewUnit, onEdit: openEdit, onDelete: handleDelete }),
        [deleteMutation.isPending],
    );

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
                    <div className="px-2 pb-2">
                        <DataTable<Unit>
                            columns={columns}
                            rows={paginatedItems}
                            rowKey={(u) => u.id}
                            loading={isLoading}
                            loadingRows={8}
                            error={isError}
                            onRetry={() => refetch()}
                            emptyState={
                                <>
                                    <Ruler className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                    <p className="text-muted-foreground">No units defined yet</p>
                                    <p className="text-xs text-muted-foreground/70 mt-1">Add units like kg, litre, piece to use in items and recipes</p>
                                </>
                            }
                            storageKey="units-col-prefs"
                            page={page}
                            totalPages={totalPages}
                            onPageChange={setPage}
                            total={units?.length}
                            pageSize={pageSize}
                            onPageSizeChange={setPageSize}
                        />
                    </div>
                </CardContent>
            </Card>

            {viewUnit && (
                <UnitDrawer unit={viewUnit} orgSlug={orgSlug} onClose={() => setViewUnit(null)} />
            )}

            {dialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeDialog} />
                    <div className="relative z-50 w-full max-w-lg mx-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold">{editing ? 'Edit Unit' : 'Add Unit'}</h2>
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
                                                onChange={(e) => setFormAbbreviation(e.target.value.toLowerCase())}
                                                required
                                            />
                                        </div>
                                    </div>
                                    {unitDuplicateError && <p className="text-xs text-destructive -mt-2">{unitDuplicateError}</p>}
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
                                        <Button type="submit" className="flex-1" disabled={mutation.isPending || !!unitDuplicateError}>
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
