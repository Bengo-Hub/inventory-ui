'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { ModifierGroupDialog } from '@/components/inventory/ModifierGroupDialog';
import { useModifierGroups, useCreateModifierGroup, useUpdateModifierGroup, useDeleteModifierGroup } from '@/hooks/use-modifiers';
import type { ModifierGroup, ModifierGroupPayload } from '@/lib/api/modifiers';
import { ChevronDown, ChevronRight, Layers, Plus, Search, Trash2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 20;

export default function ModifiersPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<ModifierGroup | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);


    const { data, isLoading } = useModifierGroups(orgSlug, { search: search || undefined, page, limit: ITEMS_PER_PAGE });
    const createMutation = useCreateModifierGroup(orgSlug);
    const updateMutation = useUpdateModifierGroup(orgSlug);
    const deleteMutation = useDeleteModifierGroup(orgSlug);

    const mutation = editing ? updateMutation : createMutation;

    const paginatedItems = data?.data ?? [];
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / ITEMS_PER_PAGE));

    useMemo(() => { setPage(1); }, [search]);

    function openCreate() {
        setEditing(null);
        setDialogOpen(true);
    }

    function openEdit(group: ModifierGroup) {
        setEditing(group);
        setDialogOpen(true);
    }

    function closeDialog() {
        setDialogOpen(false);
        setEditing(null);
    }

    function handleSubmit(payload: ModifierGroupPayload) {
        if (editing) {
            updateMutation.mutate(
                { id: editing.id, data: payload },
                {
                    onSuccess: () => { toast.success('Modifier group updated'); closeDialog(); },
                    onError: () => { toast.error('Failed to update modifier group'); },
                },
            );
        } else {
            createMutation.mutate(payload, {
                onSuccess: () => { toast.success('Modifier group created'); closeDialog(); },
                onError: () => { toast.error('Failed to create modifier group'); },
            });
        }
    }

    function handleDelete(group: ModifierGroup) {
        if (!confirm(`Delete modifier group "${group.name}"?`)) return;
        deleteMutation.mutate(group.id, {
            onSuccess: () => toast.success('Modifier group deleted'),
            onError: () => toast.error('Failed to delete modifier group'),
        });
    }

    function toggleExpand(id: string) {
        setExpandedId(expandedId === id ? null : id);
    }

    function formatCurrency(value: number) {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'KES' }).format(value);
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Modifier Groups</h1>
                    <p className="text-muted-foreground mt-1">Manage modifier groups and their options</p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Modifier Group
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search modifier groups..."
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
                                    <th className="w-10 px-3 py-3" />
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Name</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Min</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Max</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Required</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Options</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                                            Loading modifier groups...
                                        </td>
                                    </tr>
                                ) : (data?.total ?? 0) === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <Layers className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No modifier groups found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map((group) => (
                                        <>
                                            <tr key={group.id} className="hover:bg-accent/30 transition-colors">
                                                <td className="px-3 py-4">
                                                    <button
                                                        onClick={() => toggleExpand(group.id)}
                                                        className="p-1 rounded hover:bg-accent transition-colors"
                                                    >
                                                        {expandedId === group.id
                                                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                        }
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-medium">{group.display_name || group.name}</div>
                                                    {group.display_name && group.display_name !== group.name && (
                                                        <div className="text-xs text-muted-foreground">{group.name}</div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right tabular-nums hidden sm:table-cell">
                                                    {group.min_selections}
                                                </td>
                                                <td className="px-6 py-4 text-right tabular-nums hidden sm:table-cell">
                                                    {group.max_selections}
                                                </td>
                                                <td className="px-6 py-4 hidden md:table-cell">
                                                    <Badge variant={group.is_required ? 'warning' : 'outline'}>
                                                        {group.is_required ? 'Yes' : 'No'}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 text-right tabular-nums hidden sm:table-cell">
                                                    <Badge variant="outline">
                                                        {group.options?.length ?? 0}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button variant="ghost" size="sm" onClick={() => openEdit(group)}>
                                                            Edit
                                                        </Button>
                                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(group)}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {expandedId === group.id && group.options && group.options.length > 0 && (
                                                <tr key={`${group.id}-options`}>
                                                    <td colSpan={7} className="bg-accent/10 px-12 py-4">
                                                        <table className="w-full text-xs">
                                                            <thead>
                                                                <tr className="text-muted-foreground">
                                                                    <th className="text-left pb-2 font-medium">Option</th>
                                                                    <th className="text-right pb-2 font-medium">Price Adj.</th>
                                                                    <th className="text-center pb-2 font-medium">Default</th>
                                                                    <th className="text-center pb-2 font-medium">Active</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-border/50">
                                                                {group.options.map((opt, idx) => (
                                                                    <tr key={opt.id ?? idx}>
                                                                        <td className="py-2">{opt.display_name || opt.name}</td>
                                                                        <td className="py-2 text-right tabular-nums">
                                                                            {opt.price_adjustment !== 0
                                                                                ? formatCurrency(opt.price_adjustment)
                                                                                : '-'
                                                                            }
                                                                        </td>
                                                                        <td className="py-2 text-center">{opt.is_default ? 'Yes' : '-'}</td>
                                                                        <td className="py-2 text-center">{opt.is_active ? 'Yes' : 'No'}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
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
                <ModifierGroupDialog
                    editing={editing}
                    isPending={mutation.isPending}
                    onSubmit={handleSubmit}
                    onClose={closeDialog}
                />
            )}
        </div>
    );
}
