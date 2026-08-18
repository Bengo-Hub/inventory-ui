'use client';

import { Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { RequisitionFormDialog } from '@/components/inventory/RequisitionFormDialog';
import {
    useRequisitions, useCreateRequisition, useSubmitRequisition,
    useReviewRequisition, useApproveRequisition, useRejectRequisition,
} from '@/hooks/useRequisitions';
import { type CreateRequisitionInput, type Requisition, type RequisitionStatus } from '@/lib/api/requisitions';
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildRequisitionColumns } from './requisition-columns';
import { DocFormatMenu, type DocFormat } from '@/components/inventory/DocFormatMenu';
import { downloadBlob } from '@/components/inventory/ExportDialogs';
import { ClipboardList, Plus } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions, P } from '@/hooks/usePermissions';
import { useCreateFromQuery } from '@/hooks/useCreateFromQuery';
import { apiErrorMessage } from '@/lib/api/error-message';
import { apiClient } from '@/lib/api/client';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';

const STATUSES: RequisitionStatus[] = ['draft', 'submitted', 'procurement_review', 'approved', 'rejected', 'ordered', 'completed'];

export default function RequisitionsPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [status, setStatus] = useState<RequisitionStatus | ''>('');
    const [range, setRange] = useState<DateRange>({ from: '', to: '' });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [dialogOpen, setDialogOpen] = useState(false);
    useCreateFromQuery(() => setDialogOpen(true)); // mobile quick-add → open New Requisition

    const { data, isLoading, isError, refetch } = useRequisitions(orgSlug, { status: status || undefined, from: range.from || undefined, to: range.to || undefined, page, limit: pageSize });
    const createReq = useCreateRequisition(orgSlug);
    const submitReq = useSubmitRequisition(orgSlug);
    const reviewReq = useReviewRequisition(orgSlug);
    const approveReq = useApproveRequisition(orgSlug);
    const rejectReq = useRejectRequisition(orgSlug);

    const { canAny } = usePermissions();
    const canAdd = canAny([P.PURCHASES_ADD, P.PURCHASES_MANAGE]);
    const canChange = canAny([P.PURCHASES_CHANGE, P.PURCHASES_MANAGE]);

    const rows = data?.data ?? [];
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));
    useMemo(() => { setPage(1); }, [status, range, pageSize]);

    function act(label: string, p: Promise<unknown>) {
        p.then(() => toast.success(label)).catch(async (e) => toast.error(await apiErrorMessage(e, `Failed to ${label.toLowerCase()}`)));
    }

    function handleSubmit(input: CreateRequisitionInput) {
        createReq.mutate(input, {
            onSuccess: () => { toast.success('Requisition created'); setDialogOpen(false); },
            onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to create requisition')),
        });
    }

    // Document preview (Print/Export) — same shared-ui-lib PDF previewer as Purchase Orders,
    // streaming inventory-api's GET /requisitions/{id}/pdf.
    const { openPreview, previewProps } = useDocumentPreview({ onError: (m: string) => toast.error(m) });
    function previewRequisition(r: Requisition, format: DocFormat = 'pdf') {
        const url = `/api/v1/${orgSlug}/inventory/requisitions/${r.id}/pdf`;
        if (format === 'pdf') {
            openPreview(() => apiClient.getBlob(url, { format }), { fileName: `${r.reference_number}.pdf`, title: r.reference_number });
            return;
        }
        apiClient.getBlob(url, { format })
            .then((blob) => downloadBlob(blob, `${r.reference_number}.${format}`))
            .catch(() => toast.error('Could not export requisition. Please try again.'));
    }

    function workflowActions(r: Requisition) {
        return (
            <div className="flex gap-2 justify-end">
                <DocFormatMenu label="Export" onSelect={(format) => previewRequisition(r, format)} />
                {canChange && r.status === 'draft' && <Button variant="outline" onClick={() => act('Submitted', submitReq.mutateAsync(r.id))}>Submit</Button>}
                {canChange && r.status === 'submitted' && <Button variant="outline" onClick={() => act('In review', reviewReq.mutateAsync(r.id))}>Review</Button>}
                {canChange && (r.status === 'submitted' || r.status === 'procurement_review') && (
                    <>
                        <Button onClick={() => act('Approved', approveReq.mutateAsync(r.id))}>Approve</Button>
                        <Button variant="outline" onClick={() => act('Rejected', rejectReq.mutateAsync(r.id))}>Reject</Button>
                    </>
                )}
            </div>
        );
    }

    const columns = useMemo(() => buildRequisitionColumns({ workflowActions }), [canChange]);

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
                <CardHeader className="flex flex-row flex-wrap items-center gap-2">
                    <select className="border border-border rounded-md px-3 py-2 text-sm bg-background"
                        value={status} onChange={(e) => setStatus(e.target.value as RequisitionStatus | '')}>
                        <option value="">All statuses</option>
                        {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                    </select>
                    <DateRangePicker value={range} onChange={setRange} className="w-56" />
                </CardHeader>
                <CardContent className="p-0">
                    <div className="px-2 pb-2">
                        <DataTable<Requisition>
                            columns={columns}
                            rows={rows}
                            rowKey={(r) => r.id}
                            loading={isLoading}
                            error={isError}
                            onRetry={() => refetch()}
                            emptyState={
                                <>
                                    <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                    <p className="text-muted-foreground">No requisitions yet</p>
                                </>
                            }
                            storageKey="requisitions-col-prefs"
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
                <RequisitionFormDialog isPending={createReq.isPending} onSubmit={handleSubmit} onClose={() => setDialogOpen(false)} />
            )}

            <PdfPreview {...previewProps} />
        </div>
    );
}
