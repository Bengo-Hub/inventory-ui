'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { ModifierGroupDialog } from '@/components/inventory/ModifierGroupDialog';
import { useModifierGroups, useCreateModifierGroup, useUpdateModifierGroup, useDeleteModifierGroup } from '@/hooks/use-modifiers';
import type { ModifierGroup, ModifierGroupPayload } from '@/lib/api/modifiers';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildModifierColumns, ModifierOptionsPanel } from './modifier-columns';
import { Plus, Search } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';

function ConfirmDeleteDialog({
    groupName,
    onConfirm,
    onCancel,
    isPending,
}: {
    groupName: string;
    onConfirm: () => void;
    onCancel: () => void;
    isPending: boolean;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative z-50 bg-background rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4">
                <h3 className="font-semibold text-lg">Delete Modifier Group</h3>
                <p className="text-sm text-muted-foreground">
                    Are you sure you want to delete <span className="font-medium text-foreground">{groupName}</span>?
                    All options will be removed. This action cannot be undone.
                </p>
                <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isPending}>Cancel</Button>
                    <Button variant="destructive" className="flex-1" onClick={onConfirm} disabled={isPending}>
                        {isPending ? 'Deleting...' : 'Delete'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function ModifiersPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<ModifierGroup | null>(null);
    const [pendingDelete, setPendingDelete] = useState<ModifierGroup | null>(null);

    const { data, isLoading, isError, refetch } = useModifierGroups(orgSlug, { search: search || undefined, page, limit: pageSize });
    const createMutation = useCreateModifierGroup(orgSlug);
    const updateMutation = useUpdateModifierGroup(orgSlug);
    const deleteMutation = useDeleteModifierGroup(orgSlug);

    const mutation = editing ? updateMutation : createMutation;

    const paginatedItems = data?.data ?? [];
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

    useMemo(() => { setPage(1); }, [search, pageSize]);

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
                    onError: async (e) => { toast.error(await apiErrorMessage(e, 'Failed to update modifier group')); },
                },
            );
        } else {
            createMutation.mutate(payload, {
                onSuccess: () => { toast.success('Modifier group created'); closeDialog(); },
                onError: async (e) => { toast.error(await apiErrorMessage(e, 'Failed to create modifier group')); },
            });
        }
    }

    function confirmDelete(group: ModifierGroup) {
        setPendingDelete(group);
    }

    function executeDelete() {
        if (!pendingDelete) return;
        deleteMutation.mutate(pendingDelete.id, {
            onSuccess: () => { toast.success('Modifier group deleted'); setPendingDelete(null); },
            onError: async (e) => { toast.error(await apiErrorMessage(e, 'Failed to delete modifier group')); setPendingDelete(null); },
        });
    }

    const columns = useMemo(() => buildModifierColumns({ onEdit: openEdit, onDelete: confirmDelete }), []);

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Modifier Groups</h1>
                    <p className="text-muted-foreground mt-1">
                        Item-level customisation options shown to customers at point of sale (e.g. size, extras, add-ons)
                    </p>
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
                    <div className="px-2 pb-2">
                        <DataTable<ModifierGroup>
                            columns={columns}
                            rows={paginatedItems}
                            rowKey={(g) => g.id}
                            loading={isLoading}
                            loadingRows={8}
                            error={isError}
                            onRetry={() => refetch()}
                            renderExpanded={(group) => <ModifierOptionsPanel group={group} />}
                            emptyState={
                                <>
                                    <p className="text-muted-foreground">No modifier groups found</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Modifier groups link customisation options to a specific menu or goods item
                                    </p>
                                </>
                            }
                            storageKey="modifiers-col-prefs"
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
                <ModifierGroupDialog
                    orgSlug={orgSlug}
                    editing={editing}
                    isPending={mutation.isPending}
                    onSubmit={handleSubmit}
                    onClose={closeDialog}
                />
            )}

            {pendingDelete && (
                <ConfirmDeleteDialog
                    groupName={pendingDelete.name}
                    onConfirm={executeDelete}
                    onCancel={() => setPendingDelete(null)}
                    isPending={deleteMutation.isPending}
                />
            )}
        </div>
    );
}
