'use client';

import { Badge, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { useAuditLogs } from '@/hooks/useAudit';
import type { AuditLogEntry } from '@/lib/api/audit';
import { useAuthStore } from '@/store/auth';
import { userHasPermission } from '@/lib/auth/permissions';
import { ChevronLeft, ChevronRight, Loader2, ShieldCheck } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';

const PAGE = 50;

// Friendly labels + colour bands for the actions the audit log records.
const ACTION_META: Record<string, { label: string; cls: string }> = {
  'stock.adjustment': { label: 'Stock adjustment', cls: 'bg-blue-500/15 text-blue-500' },
  'stock.writeoff': { label: 'Write-off', cls: 'bg-red-500/15 text-red-500' },
  'stock.breakdown': { label: 'Breakdown', cls: 'bg-amber-500/15 text-amber-500' },
  'stock.count_approved': { label: 'Count approved', cls: 'bg-green-500/15 text-green-500' },
  'user.outlet_assign': { label: 'Outlet assigned', cls: 'bg-purple-500/15 text-purple-500' },
  'user.outlet_unassign': { label: 'Outlet removed', cls: 'bg-purple-500/15 text-purple-500' },
};

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
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : rows.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">No audit entries for these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-accent/5 text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="text-left px-4 py-3">When</th>
                    <th className="text-left px-4 py-3">Action</th>
                    <th className="text-left px-4 py-3">Entity</th>
                    <th className="text-right px-4 py-3">Amount</th>
                    <th className="text-left px-4 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((e: AuditLogEntry) => {
                    const meta = ACTION_META[e.action] ?? { label: e.action, cls: 'bg-muted text-muted-foreground' };
                    return (
                      <tr key={e.id} className="hover:bg-accent/5">
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</td>
                        <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span></td>
                        <td className="px-4 py-3 font-mono text-xs">{e.entity_id || '—'}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{e.amount != null ? e.amount.toLocaleString() : '—'}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{e.reason || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {total > PAGE && (
        <div className="flex items-center justify-center gap-3">
          <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-accent/10">
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <span className="text-xs text-muted-foreground">Page {page + 1} of {Math.ceil(total / PAGE)}</span>
          <button disabled={(page + 1) * PAGE >= total} onClick={() => setPage((p) => p + 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-accent/10">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
