'use client';

import { Badge, Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { DetailDrawer } from '@/components/inventory/DetailDrawer';
import { DocFormatMenu, type DocFormat } from '@/components/inventory/DocFormatMenu';
import { downloadBlob } from '@/components/inventory/ExportDialogs';
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker';
import { ReturnFormDialog } from '@/components/returns/ReturnFormDialog';
import { ReceiveBackDialog } from '@/components/returns/ReceiveBackDialog';
import { ReturnLinesTable } from '@/components/returns/ReturnLinesTable';
import { usePurchaseReturns, useApprovePurchaseReturn, useServiceSummary } from '@/hooks/usePurchaseReturns';
import { useSuppliers } from '@/hooks/useSuppliers';
import { type PurchaseReturn, type ReturnDestination, type ReturnPaymentStatus, type ServiceStatus } from '@/lib/api/purchase-returns';
import { approvalGateFromError } from '@/lib/api/approvals';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import {
  buildReturnsColumns, isOutForRepair, isOverdueOrder, returnDay, SERVICE_STATUS_LABEL, statusOf, STATUS_LABEL,
} from './returns-columns';
import { Plus, RotateCcw } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions, P } from '@/hooks/usePermissions';
import { apiErrorMessage } from '@/lib/api/error-message';
import { formatCalendarDay, localDateInput } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';
import { useOutletFilterStore } from '@/store/outlet-filter';

const filterSelect = 'border border-border rounded-md px-3 py-2 text-sm bg-background w-fit';

export default function PurchaseReturnsPage() {
    const params = useParams();
    const org = params?.orgSlug as string;
    const [kind, setKind] = useState<ReturnDestination | ''>('');
    const [status, setStatus] = useState('');
    const [overdueOnly, setOverdueOnly] = useState(false);
    const [range, setRange] = useState<DateRange>({ from: '', to: '' });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [open, setOpen] = useState(false);
    const [viewing, setViewing] = useState<PurchaseReturn | null>(null);
    const [receiving, setReceiving] = useState<PurchaseReturn | null>(null);

    // Reads follow the top-nav outlet drill-down, like every other list.
    const filterOutlet = useOutletFilterStore((s) => s.selectedOutlet);
    // The caller's local calendar day: decides what is overdue (the tenant is not on UTC).
    const today = localDateInput();

    // The status filter means a repair state on the repair tab and a credit state elsewhere.
    const isServiceTab = kind === 'service';
    const { data, isLoading, isError, refetch } = usePurchaseReturns(org, {
        destination: kind || undefined,
        payment_status: !isServiceTab && status ? (status as ReturnPaymentStatus) : undefined,
        service_status: isServiceTab && status ? status : undefined,
        overdue: isServiceTab && overdueOnly ? true : undefined,
        today,
        from: range.from || undefined, to: range.to || undefined,
        outlet_id: filterOutlet?.id, page, limit: pageSize,
    });
    const { data: summary } = useServiceSummary(org, { outlet_id: filterOutlet?.id, today });
    const approve = useApprovePurchaseReturn(org);
    const { data: suppliersPage } = useSuppliers(org);
    const suppliers = suppliersPage?.data ?? [];

    const { canAny } = usePermissions();
    const canAdd = canAny([P.PURCHASES_ADD, P.PURCHASES_MANAGE]);
    const canChange = canAny([P.PURCHASES_CHANGE, P.PURCHASES_MANAGE]);

    const rows = data?.data ?? [];
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));
    useEffect(() => { setPage(1); }, [kind, status, overdueOnly, range, pageSize, filterOutlet?.id]);
    useEffect(() => { setStatus(''); }, [kind]);

    const nameOf = (r: PurchaseReturn) => r.destination === 'service'
        ? r.service_provider || '—'
        : r.supplier_name || suppliers.find((s) => s.id === r.supplier_id)?.name || '—';

    function handleApprove(r: PurchaseReturn, after?: () => void) {
        approve.mutate(r.id, {
            onSuccess: (res) => {
                if (res.stock_warnings?.length) {
                    toast.warning(`Approved, but some items could not be taken out of stock: ${res.stock_warnings.join('; ')}`, { duration: 10000 });
                } else if (r.destination === 'service') {
                    toast.success(`${r.return_number}: ${r.item_count} item${r.item_count === 1 ? '' : 's'} taken out of stock and sent for repair`);
                } else {
                    toast.success(`${r.return_number} approved: ${r.item_count} item${r.item_count === 1 ? '' : 's'} taken out of stock and the supplier credited`);
                }
                after?.();
            },
            onError: async (err) => {
                const gate = approvalGateFromError(err);
                if (gate) {
                    toast.info(gate.state === 'rejected'
                        ? 'This return was rejected by an approver.'
                        : 'This return needs manager approval first; a request has been sent. Approve it again once it is signed off.', { duration: 6000 });
                    return;
                }
                toast.error(await apiErrorMessage(err, 'Failed to approve'));
            },
        });
    }

    // Document preview (Print/Export) — same shared-ui-lib PDF previewer as Purchase Orders,
    // streaming inventory-api's GET /purchase-returns/{id}/pdf (debit note for a supplier return,
    // service order for a repair).
    const { openPreview, previewProps } = useDocumentPreview({ onError: (m: string) => toast.error(m) });
    function previewReturn(r: PurchaseReturn, format: DocFormat = 'pdf') {
        const url = `/api/v1/${org}/inventory/purchase-returns/${r.id}/pdf`;
        if (format === 'pdf') {
            openPreview(() => apiClient.getBlob(url, { format }), { fileName: `${r.return_number}.pdf`, title: r.return_number });
            return;
        }
        apiClient.getBlob(url, { format })
            .then((blob) => downloadBlob(blob, `${r.return_number}.${format}`))
            .catch(() => toast.error('Could not export. Please try again.'));
    }

    const columns = useMemo(
        () => buildReturnsColumns({
            canChange,
            today,
            nameOf,
            onView: (r) => setViewing(r),
            onApprove: (r) => handleApprove(r),
            onReceive: (r) => setReceiving(r),
            onPrint: (r) => previewReturn(r),
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [canChange, suppliers, today],
    );

    const statusOptions: [string, string][] = isServiceTab
        ? (Object.keys(SERVICE_STATUS_LABEL) as ServiceStatus[]).map((s) => [s, SERVICE_STATUS_LABEL[s]])
        : [['pending', STATUS_LABEL.pending], ['paid', STATUS_LABEL.paid]];
    const showSummary = !!summary && summary.open_orders > 0;
    const viewingStatus = viewing ? statusOf(viewing) : null;

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><RotateCcw className="h-6 w-6" /> Purchase Returns</h1>
                    <p className="text-muted-foreground mt-1">
                        Goods sent back to suppliers, or sent for repair. A supplier return takes the items out of stock and credits the supplier. A repair order takes them out until they come back repaired.
                    </p>
                </div>
                {canAdd && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Return</Button>}
            </div>

            {showSummary && summary && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-border p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Out for repair</p>
                        <p className="text-2xl font-bold tabular-nums">{summary.units_outstanding.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">units in {summary.open_orders} order{summary.open_orders === 1 ? '' : 's'}</p>
                    </div>
                    <div className="rounded-xl border border-border p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cost value away</p>
                        <p className="text-2xl font-bold tabular-nums">{summary.cost_outstanding.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">not counted in stock value</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => { setKind('service'); setOverdueOnly(summary.overdue_orders > 0); }}
                        className={`rounded-xl border p-4 text-left transition-colors hover:bg-accent ${summary.overdue_orders > 0 ? 'border-red-300' : 'border-border'}`}
                    >
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Overdue</p>
                        <p className={`text-2xl font-bold tabular-nums ${summary.overdue_orders > 0 ? 'text-red-600' : ''}`}>{summary.overdue_orders.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{summary.overdue_units.toLocaleString()} units past the expected day</p>
                    </button>
                    <div className="rounded-xl border border-border p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Busiest provider</p>
                        <p className="text-lg font-semibold truncate" title={summary.providers[0]?.provider}>{summary.providers[0]?.provider ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{summary.providers[0] ? `${summary.providers[0].units.toLocaleString()} units out` : ''}</p>
                    </div>
                </div>
            )}

            <Card>
                <CardHeader className="flex flex-row flex-wrap items-center gap-2">
                    <select className={filterSelect} aria-label="Type" value={kind} onChange={(e) => { setKind(e.target.value as ReturnDestination | ''); setOverdueOnly(false); }}>
                        <option value="">All returns</option>
                        <option value="supplier">Supplier returns</option>
                        <option value="service">Sent for repair</option>
                    </select>
                    <select className={filterSelect} aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                        <option value="">All statuses</option>
                        {statusOptions.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                    </select>
                    {isServiceTab && (
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
                            Overdue only
                        </label>
                    )}
                    <DateRangePicker value={range} onChange={setRange} className="w-56" />
                </CardHeader>
                <CardContent className="p-0">
                    <div className="px-2 pb-2">
                        <DataTable<PurchaseReturn>
                            columns={columns}
                            rows={rows}
                            rowKey={(r) => r.id}
                            loading={isLoading}
                            loadingRows={8}
                            error={isError}
                            onRetry={() => refetch()}
                            onRowClick={(r) => setViewing(r)}
                            emptyText="No returns yet"
                            storageKey="purchase-returns-col-prefs-v2"
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

            <ReturnFormDialog
                org={org}
                open={open}
                onClose={() => setOpen(false)}
                providerSuggestions={summary?.providers.map((p) => p.provider).filter((p) => p !== 'Unspecified')}
            />
            <ReceiveBackDialog org={org} order={receiving} onClose={() => setReceiving(null)} />

            <DetailDrawer
                open={!!viewing}
                onClose={() => setViewing(null)}
                title={viewing?.return_number ?? 'Purchase Return'}
                subtitle={viewing ? nameOf(viewing) : undefined}
                badges={viewing && viewingStatus && (
                    <>
                        <Badge variant={viewingStatus.variant}>{viewingStatus.label}</Badge>
                        {isOverdueOrder(viewing, today) && <Badge variant="error">Overdue</Badge>}
                    </>
                )}
                width="lg"
                fields={viewing ? (viewing.destination === 'service' ? [
                    { label: 'Sent to', value: viewing.service_provider || '—' },
                    { label: 'Contact', value: viewing.service_contact, hideIfEmpty: true },
                    { label: 'Date sent', value: returnDay(viewing) },
                    { label: 'Expected back', value: viewing.expected_back_date ? formatCalendarDay(viewing.expected_back_date) : '—' },
                    { label: 'Location', value: viewing.warehouse_name || '—' },
                    { label: 'Cost value', value: viewing.return_amount.toLocaleString() },
                    { label: 'Still out', value: viewing.outstanding_quantity.toLocaleString() },
                    { label: 'Created by', value: viewing.added_by_name, hideIfEmpty: true },
                    { label: 'Fault', value: viewing.fault, full: true, hideIfEmpty: true },
                ] : [
                    { label: 'Supplier', value: nameOf(viewing) },
                    { label: 'Date returned', value: returnDay(viewing) },
                    { label: 'Location', value: viewing.warehouse_name || '—' },
                    { label: 'Amount', value: viewing.return_amount.toLocaleString() },
                    { label: 'Created by', value: viewing.added_by_name, hideIfEmpty: true },
                    { label: 'Reason', value: viewing.reason, full: true, hideIfEmpty: true },
                ]) : []}
                actions={viewing && (
                    <>
                        <DocFormatMenu label="Print / Export" onSelect={(format) => previewReturn(viewing, format)} />
                        {canChange && viewing.payment_status !== 'paid' && (
                            <Button size="sm" disabled={approve.isPending} onClick={() => handleApprove(viewing, () => setViewing(null))}>
                                {viewing.destination === 'service' ? 'Send out' : 'Approve'}
                            </Button>
                        )}
                        {canChange && isOutForRepair(viewing) && (
                            <Button size="sm" onClick={() => { setReceiving(viewing); setViewing(null); }}>Receive back</Button>
                        )}
                    </>
                )}
            >
                {viewing && <ReturnLinesTable order={viewing} />}
            </DetailDrawer>

            <PdfPreview {...previewProps} />
        </div>
    );
}
