'use client';

import { Badge, Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import {
    useApprovalRequests,
    useApproveRequest,
    useRejectRequest,
} from '@/hooks/useApprovals';
import { APPROVAL_MODULE_LABELS, type ApprovalRequest, type ApprovalRequestStatus } from '@/lib/api/approvals';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildApprovalColumns, STATUS_VARIANT } from './approval-columns';
import { CheckCircle2, ClipboardList, ShieldCheck, X, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

const ROLE_LABEL: Record<string, string> = {
    inventory_admin: 'Inventory Admin',
    warehouse_manager: 'Warehouse Manager',
    stock_clerk: 'Stock Clerk',
    viewer: 'Viewer',
};

const MODULE_LABEL: Record<string, string> = APPROVAL_MODULE_LABELS;

function roleLabel(code: string) {
    return ROLE_LABEL[code] ?? code;
}

type Tab = 'inbox' | 'pending' | 'all';

export default function ApprovalsInboxPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [tab, setTab] = useState<Tab>('inbox');
    const [selected, setSelected] = useState<ApprovalRequest | null>(null);
    const [comment, setComment] = useState('');

    const listParams =
        tab === 'inbox'
            ? { inbox: true }
            : tab === 'pending'
            ? { status: 'pending' as ApprovalRequestStatus }
            : {};
    const { data: requests, isLoading, isError, refetch } = useApprovalRequests(orgSlug, listParams);

    const approve = useApproveRequest(orgSlug);
    const reject = useRejectRequest(orgSlug);
    const isActing = approve.isPending || reject.isPending;

    function closeDetail() {
        setSelected(null);
        setComment('');
    }

    function handleApprove(req: ApprovalRequest) {
        approve.mutate(
            { id: req.id, comment: comment.trim() || undefined },
            {
                onSuccess: () => {
                    toast.success('Step approved');
                    closeDetail();
                },
                onError: (e: unknown) => toast.error(errMsg(e, 'Failed to approve')),
            },
        );
    }

    function handleReject(req: ApprovalRequest) {
        reject.mutate(
            { id: req.id, comment: comment.trim() || undefined },
            {
                onSuccess: () => {
                    toast.success('Request rejected');
                    closeDetail();
                },
                onError: (e: unknown) => toast.error(errMsg(e, 'Failed to reject')),
            },
        );
    }

    const rows = requests ?? [];

    const columns = useMemo(
        () => buildApprovalColumns({ moduleLabel: (m) => MODULE_LABEL[m] ?? m, roleLabel }),
        [],
    );

    return (
        <>
            <div className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <ShieldCheck className="h-6 w-6" /> Approvals
                        </h1>
                        <p className="text-muted-foreground mt-1">Review and sign off on approvals across procurement, manufacturing, assets &amp; stock</p>
                    </div>
                    <Link href={`/${orgSlug}/approvals/rules`}>
                        <Button variant="outline"><ClipboardList className="h-4 w-4 mr-2" /> Approval Rules</Button>
                    </Link>
                </div>

                <div className="flex gap-2">
                    {([
                        ['inbox', 'My Inbox'],
                        ['pending', 'All Pending'],
                        ['all', 'All'],
                    ] as [Tab, string][]).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            className={
                                'px-4 py-2 rounded-lg text-sm font-medium transition-colors ' +
                                (tab === key ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:bg-muted')
                            }
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <Card>
                    <CardContent className="p-0">
                        <div className="px-2 pb-2">
                            <DataTable<ApprovalRequest>
                                columns={columns}
                                rows={rows}
                                rowKey={(req) => req.id}
                                loading={isLoading}
                                error={isError}
                                onRetry={() => refetch()}
                                onRowClick={(req) => { setSelected(req); setComment(''); }}
                                emptyText={tab === 'inbox' ? 'Nothing awaiting your approval' : 'No approval requests'}
                                storageKey="approvals-col-prefs"
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeDetail} />
                    <div className="relative z-50 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold">{selected.object_reference || 'Approval Request'}</h2>
                                        <p className="text-sm text-muted-foreground">
                                            {MODULE_LABEL[selected.module] ?? selected.module} · {selected.amount.toLocaleString()}
                                        </p>
                                    </div>
                                    <button onClick={closeDetail} className="p-1 rounded-lg hover:bg-accent transition-colors">
                                        <X className="h-5 w-5 text-muted-foreground" />
                                    </button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Step trail */}
                                <ol className="space-y-2">
                                    {(selected.actions ?? []).map((a) => {
                                        const isCurrent = selected.status === 'pending' && a.sequence === selected.current_sequence;
                                        return (
                                            <li
                                                key={a.id}
                                                className={
                                                    'flex items-start gap-3 p-3 rounded-lg border ' +
                                                    (isCurrent ? 'border-primary/40 bg-primary/5' : 'border-border')
                                                }
                                            >
                                                <div className="mt-0.5">
                                                    {a.status === 'approved' ? (
                                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                    ) : a.status === 'rejected' ? (
                                                        <XCircle className="h-4 w-4 text-rose-500" />
                                                    ) : (
                                                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-muted-foreground/40 text-[10px]">{a.sequence}</span>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium">{a.name || `Step ${a.sequence}`}</p>
                                                    <p className="text-xs text-muted-foreground">{roleLabel(a.approver_role)}</p>
                                                    {a.comment && <p className="text-xs italic mt-1">“{a.comment}”</p>}
                                                </div>
                                                <Badge variant={STATUS_VARIANT[a.status] ?? 'outline'} className="shrink-0">{a.status}</Badge>
                                            </li>
                                        );
                                    })}
                                </ol>

                                {selected.status === 'pending' ? (
                                    <>
                                        <textarea
                                            placeholder="Optional comment..."
                                            value={comment}
                                            onChange={(e) => setComment(e.target.value)}
                                            rows={2}
                                            className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none resize-none"
                                        />
                                        <div className="flex gap-3">
                                            <Button
                                                variant="outline"
                                                className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                                                disabled={isActing}
                                                onClick={() => handleReject(selected)}
                                            >
                                                <XCircle className="h-4 w-4 mr-2" /> Reject
                                            </Button>
                                            <Button className="flex-1" disabled={isActing} onClick={() => handleApprove(selected)}>
                                                <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground text-center">
                                            You can only approve a step your role is assigned to.
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-sm text-center text-muted-foreground">
                                        This request is <span className="font-medium">{selected.status}</span>.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </>
    );
}

function errMsg(e: unknown, fallback: string): string {
    const resp = (e as { response?: { data?: { message?: string } } })?.response;
    return resp?.data?.message || fallback;
}
