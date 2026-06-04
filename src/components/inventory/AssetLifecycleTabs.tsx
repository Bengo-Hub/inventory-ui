'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import {
    useAssetMaintenance, useCreateMaintenance, useCompleteMaintenance,
    useAssetTransfers, useCreateTransfer, useApproveTransfer, useCompleteTransfer,
    useAssetDisposals, useCreateDisposal, useCompleteDisposal,
    useAssetInsurance, useCreateInsurance,
    useAssetAudits, useCreateAudit, useCompleteAudit,
} from '@/hooks/useAssets';
import type {
    MaintenanceInput, TransferInput, DisposalInput, InsuranceInput, AuditInput,
} from '@/lib/api/assets';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const selectClass = 'w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none';
const textareaClass = `${selectClass} resize-none`;

const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString() : '—');
const money = (n?: number) => (n != null ? n.toLocaleString() : '—');

type Opt = { value: string; label: string };
const opts = (...vals: string[]): Opt[] => vals.map((v) => ({ value: v, label: v.replace(/_/g, ' ') }));

type FieldDef = { key: string; label: string; type: 'text' | 'number' | 'date' | 'select' | 'textarea'; options?: Opt[]; required?: boolean };

// Generic list + inline-add panel for a single asset lifecycle operation.
function OpTab<TRec extends { id: string; status?: string }>({
    label, items, isLoading, headers, renderRow, fields, onCreate, isCreating, onComplete, onApprove,
}: {
    label: string;
    items: TRec[] | undefined;
    isLoading: boolean;
    headers: string[];
    renderRow: (r: TRec) => React.ReactNode[];
    fields: FieldDef[];
    onCreate: (data: Record<string, string | number>, onDone: () => void) => void;
    isCreating: boolean;
    onComplete?: (id: string) => void;
    onApprove?: (id: string) => void;
}) {
    const [form, setForm] = useState<Record<string, string>>({});
    const [open, setOpen] = useState(false);
    const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));

    function submit(e: React.FormEvent) {
        e.preventDefault();
        for (const f of fields) if (f.required && !form[f.key]?.trim()) { toast.error(`${f.label} is required`); return; }
        const payload: Record<string, string | number> = {};
        for (const f of fields) {
            const v = form[f.key];
            if (v === undefined || v === '') continue;
            payload[f.key] = f.type === 'number' ? Number(v) : f.type === 'date' ? new Date(v).toISOString() : v;
        }
        onCreate(payload, () => { setForm({}); setOpen(false); });
    }

    const colSpan = headers.length + (onComplete || onApprove ? 1 : 0);

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button type="button" size="sm" variant={open ? 'outline' : undefined} onClick={() => setOpen((o) => !o)}>
                    {open ? 'Close' : <><Plus className="h-3 w-3 mr-1" /> Add {label}</>}
                </Button>
            </div>
            {open && (
                <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border border-border">
                    {fields.map((f) => (
                        <div key={f.key} className={`space-y-1 ${f.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
                            <label className="text-xs font-medium text-muted-foreground">{f.label}{f.required ? ' *' : ''}</label>
                            {f.type === 'select' ? (
                                <select className={selectClass} value={form[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}>
                                    <option value="">—</option>
                                    {f.options?.map((o) => <option key={o.value} value={o.value} className="capitalize">{o.label}</option>)}
                                </select>
                            ) : f.type === 'textarea' ? (
                                <textarea className={textareaClass} rows={2} value={form[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />
                            ) : (
                                <Input type={f.type} value={form[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />
                            )}
                        </div>
                    ))}
                    <div className="sm:col-span-2 flex justify-end">
                        <Button type="submit" size="sm" disabled={isCreating}>{isCreating ? 'Saving…' : 'Save'}</Button>
                    </div>
                </form>
            )}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/30">
                            {headers.map((h) => <th key={h} className="text-left px-4 py-2 font-medium text-muted-foreground">{h}</th>)}
                            {(onComplete || onApprove) && <th className="px-4 py-2" />}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && <tr><td colSpan={colSpan} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>}
                        {!isLoading && (items?.length ?? 0) === 0 && <tr><td colSpan={colSpan} className="px-4 py-6 text-center text-muted-foreground">None yet.</td></tr>}
                        {items?.map((r) => (
                            <tr key={r.id} className="border-b border-border">
                                {renderRow(r).map((cell, i) => <td key={i} className="px-4 py-2">{cell}</td>)}
                                {(onComplete || onApprove) && (
                                    <td className="px-4 py-2 text-right">
                                        <div className="flex gap-2 justify-end">
                                            {onApprove && r.status === 'pending' && (
                                                <Button type="button" size="sm" variant="outline" onClick={() => onApprove(r.id)}>Approve</Button>
                                            )}
                                            {onComplete && r.status && !['completed', 'cancelled', 'rejected'].includes(r.status) && !(onApprove && r.status === 'pending') && (
                                                <Button type="button" size="sm" variant="outline" onClick={() => onComplete(r.id)}>Complete</Button>
                                            )}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function MaintenanceTab({ org, assetId }: { org: string; assetId: string }) {
    const { data, isLoading } = useAssetMaintenance(org, assetId);
    const create = useCreateMaintenance(org, assetId);
    const complete = useCompleteMaintenance(org, assetId);
    return (
        <OpTab
            label="Maintenance" items={data} isLoading={isLoading}
            headers={['Type', 'Scheduled', 'Cost', 'Status']}
            renderRow={(r) => [<span key="t" className="capitalize">{r.maintenance_type ?? '—'}</span>, fmtDate(r.scheduled_date), money(r.cost), <Badge key="s">{r.status}</Badge>]}
            fields={[
                { key: 'maintenance_type', label: 'Type', type: 'select', options: opts('preventive', 'corrective', 'emergency', 'predictive', 'condition_based') },
                { key: 'priority', label: 'Priority', type: 'select', options: opts('low', 'medium', 'high', 'critical') },
                { key: 'scheduled_date', label: 'Scheduled date', type: 'date' },
                { key: 'next_maintenance_date', label: 'Next date', type: 'date' },
                { key: 'performed_by', label: 'Performed by', type: 'text' },
                { key: 'cost', label: 'Cost', type: 'number' },
                { key: 'description', label: 'Description', type: 'textarea' },
            ]}
            onCreate={(d, onDone) => create.mutate(d as unknown as MaintenanceInput, { onSuccess: () => { toast.success('Maintenance scheduled'); onDone(); }, onError: () => toast.error('Failed to schedule') })}
            isCreating={create.isPending}
            onComplete={(id) => complete.mutate(id, { onSuccess: () => toast.success('Maintenance completed'), onError: () => toast.error('Failed') })}
        />
    );
}

function TransferTab({ org, assetId }: { org: string; assetId: string }) {
    const { data, isLoading } = useAssetTransfers(org, assetId);
    const create = useCreateTransfer(org, assetId);
    const approve = useApproveTransfer(org, assetId);
    const complete = useCompleteTransfer(org, assetId);
    return (
        <OpTab
            label="Transfer" items={data} isLoading={isLoading}
            headers={['From', 'To', 'Date', 'Status']}
            renderRow={(r) => [r.from_location || '—', r.to_location || '—', fmtDate(r.transfer_date), <Badge key="s">{r.status}</Badge>]}
            fields={[
                { key: 'from_location', label: 'From location', type: 'text' },
                { key: 'to_location', label: 'To location', type: 'text', required: true },
                { key: 'reason', label: 'Reason', type: 'textarea' },
            ]}
            onCreate={(d, onDone) => create.mutate(d as unknown as TransferInput, { onSuccess: () => { toast.success('Transfer requested'); onDone(); }, onError: () => toast.error('Failed to request') })}
            isCreating={create.isPending}
            onApprove={(id) => approve.mutate(id, { onSuccess: () => toast.success('Transfer approved'), onError: () => toast.error('Failed to approve') })}
            onComplete={(id) => complete.mutate(id, { onSuccess: () => toast.success('Transfer completed — asset moved'), onError: () => toast.error('Failed') })}
        />
    );
}

function DisposalTab({ org, assetId }: { org: string; assetId: string }) {
    const { data, isLoading } = useAssetDisposals(org, assetId);
    const create = useCreateDisposal(org, assetId);
    const complete = useCompleteDisposal(org, assetId);
    return (
        <OpTab
            label="Disposal" items={data} isLoading={isLoading}
            headers={['Method', 'Value', 'Date', 'Status']}
            renderRow={(r) => [<span key="m" className="capitalize">{r.disposal_method ?? '—'}</span>, money(r.disposal_value), fmtDate(r.disposal_date), <Badge key="s">{r.status}</Badge>]}
            fields={[
                { key: 'disposal_method', label: 'Method', type: 'select', required: true, options: opts('sold', 'scrapped', 'donated', 'stolen', 'returned', 'recycled', 'destroyed') },
                { key: 'disposal_value', label: 'Disposal value', type: 'number' },
                { key: 'reason', label: 'Reason', type: 'textarea' },
            ]}
            onCreate={(d, onDone) => create.mutate(d as unknown as DisposalInput, { onSuccess: () => { toast.success('Disposal recorded'); onDone(); }, onError: () => toast.error('Failed to record') })}
            isCreating={create.isPending}
            onComplete={(id) => complete.mutate(id, { onSuccess: () => toast.success('Disposal completed — asset retired'), onError: () => toast.error('Failed') })}
        />
    );
}

function InsuranceTab({ org, assetId }: { org: string; assetId: string }) {
    const { data, isLoading } = useAssetInsurance(org, assetId);
    const create = useCreateInsurance(org, assetId);
    return (
        <OpTab
            label="Policy" items={data} isLoading={isLoading}
            headers={['Policy #', 'Provider', 'Coverage', 'Expires']}
            renderRow={(r) => [r.policy_number || '—', r.provider || '—', money(r.coverage_amount), fmtDate(r.end_date)]}
            fields={[
                { key: 'policy_number', label: 'Policy number', type: 'text', required: true },
                { key: 'provider', label: 'Provider', type: 'text' },
                { key: 'policy_type', label: 'Policy type', type: 'text' },
                { key: 'coverage_amount', label: 'Coverage amount', type: 'number' },
                { key: 'premium_amount', label: 'Premium amount', type: 'number' },
                { key: 'deductible', label: 'Deductible', type: 'number' },
                { key: 'start_date', label: 'Start date', type: 'date' },
                { key: 'end_date', label: 'End date', type: 'date' },
            ]}
            onCreate={(d, onDone) => create.mutate(d as unknown as InsuranceInput, { onSuccess: () => { toast.success('Policy added'); onDone(); }, onError: () => toast.error('Failed to add policy') })}
            isCreating={create.isPending}
        />
    );
}

function AuditTab({ org, assetId }: { org: string; assetId: string }) {
    const { data, isLoading } = useAssetAudits(org, assetId);
    const create = useCreateAudit(org, assetId);
    const complete = useCompleteAudit(org, assetId);
    return (
        <OpTab
            label="Audit" items={data} isLoading={isLoading}
            headers={['Date', 'Location', 'Condition', 'Status']}
            renderRow={(r) => [fmtDate(r.audit_date), r.location_verified || '—', r.condition_verified || '—', <Badge key="s">{r.status}</Badge>]}
            fields={[
                { key: 'location_verified', label: 'Location verified', type: 'text' },
                { key: 'condition_verified', label: 'Condition verified', type: 'text' },
                { key: 'discrepancies', label: 'Discrepancies', type: 'textarea' },
                { key: 'recommendations', label: 'Recommendations', type: 'textarea' },
            ]}
            onCreate={(d, onDone) => create.mutate(d as unknown as AuditInput, { onSuccess: () => { toast.success('Audit started'); onDone(); }, onError: () => toast.error('Failed to start audit') })}
            isCreating={create.isPending}
            onComplete={(id) => complete.mutate(id, { onSuccess: () => toast.success('Audit completed'), onError: () => toast.error('Failed') })}
        />
    );
}

const TABS = [
    { key: 'maintenance', label: 'Maintenance' },
    { key: 'transfers', label: 'Transfers' },
    { key: 'disposals', label: 'Disposals' },
    { key: 'insurance', label: 'Insurance' },
    { key: 'audits', label: 'Audits' },
] as const;

export function AssetLifecycleTabs({ org, assetId }: { org: string; assetId: string }) {
    const [tab, setTab] = useState<string>('maintenance');
    return (
        <Card>
            <CardHeader>
                <div className="flex flex-wrap gap-2">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </CardHeader>
            <CardContent>
                {tab === 'maintenance' && <MaintenanceTab org={org} assetId={assetId} />}
                {tab === 'transfers' && <TransferTab org={org} assetId={assetId} />}
                {tab === 'disposals' && <DisposalTab org={org} assetId={assetId} />}
                {tab === 'insurance' && <InsuranceTab org={org} assetId={assetId} />}
                {tab === 'audits' && <AuditTab org={org} assetId={assetId} />}
            </CardContent>
        </Card>
    );
}
