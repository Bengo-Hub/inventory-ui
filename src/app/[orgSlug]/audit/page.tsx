'use client';

import { Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { useAuditLogs } from '@/hooks/useAudit';
import type { AuditLogEntry } from '@/lib/api/audit';
import { useAuthStore } from '@/store/auth';
import { userHasPermission } from '@/lib/auth/permissions';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildAuditColumns } from './audit-columns';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

const PAGE = 50;

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'stock.adjustment', label: 'Stock adjustments' },
  { value: 'stock.writeoff', label: 'Write-offs' },
  { value: 'stock.breakdown', label: 'Breakdowns' },
  { value: 'stock.count_approved', label: 'Count approvals' },
  { value: 'user.outlet_assign', label: 'Outlet assignments' },
];

const inputClass =
  'bg-accent/10 border border-border rounded-lg py-2 px-3 text-sm focus:ring-1 focus:ring-primary outline-none';

export default function AuditPage() {
  const params = useParams();
  const orgSlug = params?.orgSlug as string;
  const user = useAuthStore((s) => s.user);
  const canView = userHasPermission(user as any, ['inventory.audit.view']);

  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);

  const { data, isLoading, isFetching } = useAuditLogs(orgSlug, {
    action: action || undefined,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to).toISOString() : undefined,
    limit: PAGE,
    offset: page * PAGE,
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  const columns = useMemo(() => buildAuditColumns(), []);

  if (!canView) {
    return <div className="p-6 text-sm text-muted-foreground">You don&apos;t have permission to view the audit log.</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-black text-foreground">Audit Log</h1>
          <p className="text-sm text-muted-foreground">Sensitive inventory actions — adjustments, write-offs, breakdowns, count approvals, outlet assignments.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-center gap-2">
          <select className={inputClass} value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }}>
            {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <label className="text-xs text-muted-foreground">From</label>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} className="w-auto" />
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} className="w-auto" />
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <span className="ml-auto text-xs text-muted-foreground">{total} entries</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="px-2 pb-2">
            <DataTable<AuditLogEntry>
              columns={columns}
              rows={rows}
              rowKey={(e) => e.id}
              loading={isLoading}
              emptyText="No audit entries for these filters."
              storageKey="audit-col-prefs"
              page={page + 1}
              totalPages={Math.max(1, Math.ceil(total / PAGE))}
              onPageChange={(p) => setPage(p - 1)}
              total={total}
              pageSize={PAGE}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
