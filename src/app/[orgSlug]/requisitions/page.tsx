'use client';

import { Badge, Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { RequisitionFormDialog } from '@/components/inventory/RequisitionFormDialog';
import {
    useRequisitions, useCreateRequisition, useSubmitRequisition,
    useReviewRequisition, useApproveRequisition, useRejectRequisition,
} from '@/hooks/useRequisitions';
import { type CreateRequisitionInput, type Requisition, type RequisitionStatus } from '@/lib/api/requisitions';
import { ClipboardList, Plus } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions, P } from '@/hooks/usePermissions';

const ITEMS_PER_PAGE = 20;

const STATUS_VARIANT: Record<RequisitionStatus, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
    draft: 'outline', submitted: 'warning', procurement_review: 'warning',
    approved: 'success', rejected: 'error', ordered: 'default', completed: 'success',
};

const STATUSES: RequisitionStatus[] = ['draft', 'submitted', 'procurement_review', 'approved', 'rejected', 'ordered', 'completed'];

export default function RequisitionsPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [status, setStatus] = useState<RequisitionStatus | ''>('');
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);

    const { data, isLoading } = useRequisitions(orgSlug, { status: status || undefined, page, limit: ITEMS_PER_PAGE });
    const createReq = useCreateRequisition(orgSlug);
    const submitReq = useSubmitRequisition(orgSlug);
    const reviewReq = useReviewRequisition(orgSlug);
    const approveReq = useApproveRequisition(orgSlug);
    const rejectReq = useRejectRequisition(orgSlug);

    const { canAny } = usePermissions();
    const canAdd = canAny([P.PURCHASES_ADD, P.PURCHASES_MANAGE]);
    const canChange = canAny([P.PURCHASES_CHANGE, P.PURCHASES_MANAGE]);

    const rows = data?.data ?? [];
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / ITEMS_PER_PAGE));
    useMemo(() => { setPage(1); }, [status]);

    function act(label: string, p: Promise<unknown>) {
        p.then(() => toast.success(label)).catch(() => toast.error(`Failed to ${label.toLowerCase()}`));
    }

    function handleSubmit(input: CreateRequisitionInput) {
        createReq.mutate(input, {
            onSuccess: () => { toast.success('Requisition created'); setDialogOpen(false); },
            onError: () => toast.error('Failed to create requisition'),
        });
    }

    function workflowActions(r: Requisition) {
        if (!canChange) return null;
        return (
            <div className="flex gap-2 justify-end">
                {r.status === 'draft' && <Button variant="outline" onClick={() => act('Submitted', submitReq.mutateAsync(r.id))}>Submit</Button>}
                {r.status === 'submitted' && <Button variant="outline" onClick={() => act('In review', reviewReq.mutateAsync(r.id))}>Review</Button>}
                {(r.status === 'submitted' || r.status === 'procurement_review') && (
                    <>
                        <Button onClick={() => act('Approved', approveReq.mutateAsync(r.id))}>Approve</Button>
                        <Button variant="outline" onClick={() => act('Rejected', rejectReq.mutateAsync(r.id))}>Reject</Button>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><ClipboardList className="h-6 w-6" /> Requisitions</h1>
                    <p className="text-muted-foreground mt-1">Internal purchase requests &amp; approval workflow</p>
                </div>
                {canAdd && <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Requisition</Button>}
            </div>

            <Card>
                <CardHeader>
                    <select className="border border-border rounded-md px-3 py-2 text-sm bg-background"
                        value={status} onChange={(e) => setStatus(e.target.value as RequisitionStatus | '')}>
                        <option value="">All statuses</option>
                        {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                    </select>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Reference</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Type</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden lg:table-cell">Purpose</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Priority</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading && <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">Loading…</td></tr>}
                                {!isLoading && rows.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No requisitions yet.</td></tr>}
                                {rows.map((r) => (
                                    <tr key={r.id} className="border-b border-border hover:bg-muted/20">
                                        <td className="px-6 py-3 font-medium">{r.reference_number}</td>
                                        <td className="px-6 py-3 hidden md:table-cell capitalize">{r.request_type.replace(/_/g, ' ')}</td>
                                        <td className="px-6 py-3 hidden lg:table-cell max-w-xs truncate">{r.purpose}</td>
                                        <td className="px-6 py-3 capitalize">{r.priority}</td>
                                        <td className="px-6 py-3"><Badge variant={STATUS_VARIANT[r.status]}>{r.status.replace(/_/g, ' ')}</Badge></td>
                                        <td className="px-6 py-3">{workflowActions(r)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {totalPages > 1 && <div className="p-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>}
                </CardContent>
            </Card>

            {dialogOpen && (
                <RequisitionFormDialog isPending={createReq.isPending} onSubmit={handleSubmit} onClose={() => setDialogOpen(false)} />
            )}
        </div>
    );
}
