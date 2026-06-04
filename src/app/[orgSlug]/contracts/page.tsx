'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { useContracts, useCreateContract, useUpdateContract, useActivateContract, useTerminateContract } from '@/hooks/useContracts';
import { useSuppliers } from '@/hooks/useSuppliers';
import { type Contract, type ContractStatus } from '@/lib/api/contracts';
import { FileSignature, Plus, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions, P } from '@/hooks/usePermissions';

const ITEMS_PER_PAGE = 20;
const selectClass = 'w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none';

const STATUS_VARIANT: Record<ContractStatus, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
    draft: 'outline', active: 'success', expired: 'warning', terminated: 'error',
};

const toDateInput = (s?: string) => (s ? s.slice(0, 10) : '');

export default function ContractsPage() {
    const params = useParams();
    const org = params?.orgSlug as string;
    const [status, setStatus] = useState<ContractStatus | ''>('');
    const [page, setPage] = useState(1);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Contract | null>(null);

    const [supplierId, setSupplierId] = useState('');
    const [title, setTitle] = useState('');
    const [value, setValue] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [terms, setTerms] = useState('');

    const { data, isLoading } = useContracts(org, { status: status || undefined, page, limit: ITEMS_PER_PAGE });
    const create = useCreateContract(org);
    const update = useUpdateContract(org);
    const activate = useActivateContract(org);
    const terminate = useTerminateContract(org);
    const { data: suppliersPage } = useSuppliers(org);
    const suppliers = suppliersPage?.data ?? [];

    const { canAny } = usePermissions();
    const canAdd = canAny([P.PURCHASES_ADD, P.PURCHASES_MANAGE]);
    const canChange = canAny([P.PURCHASES_CHANGE, P.PURCHASES_MANAGE]);

    const rows = data?.data ?? [];
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / ITEMS_PER_PAGE));
    useMemo(() => { setPage(1); }, [status]);

    const nameOf = (id?: string | null) => suppliers.find((s) => s.id === id)?.name ?? '—';
    const isPending = create.isPending || update.isPending;

    function openNew() {
        setEditing(null); setSupplierId(''); setTitle(''); setValue(''); setStartDate(''); setEndDate(''); setTerms('');
        setOpen(true);
    }
    function openEdit(c: Contract) {
        setEditing(c); setSupplierId(c.supplier_id); setTitle(c.title); setValue(String(c.value ?? ''));
        setStartDate(toDateInput(c.start_date)); setEndDate(toDateInput(c.end_date)); setTerms(c.terms ?? '');
        setOpen(true);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!supplierId) { toast.error('Select a supplier'); return; }
        if (!title.trim()) { toast.error('Title is required'); return; }
        const data = {
            supplier_id: supplierId,
            title: title.trim(),
            value: value ? Number(value) : undefined,
            start_date: startDate ? new Date(startDate).toISOString() : undefined,
            end_date: endDate ? new Date(endDate).toISOString() : undefined,
            terms: terms.trim() || undefined,
        };
        const done = () => { toast.success(editing ? 'Contract updated' : 'Contract created'); setOpen(false); };
        if (editing) update.mutate({ id: editing.id, data }, { onSuccess: done, onError: () => toast.error('Failed to update') });
        else create.mutate(data, { onSuccess: done, onError: () => toast.error('Failed to create') });
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><FileSignature className="h-6 w-6" /> Supplier Contracts</h1>
                    <p className="text-muted-foreground mt-1">Agreements, terms &amp; lifecycle</p>
                </div>
                {canAdd && <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> New Contract</Button>}
            </div>

            <Card>
                <CardHeader>
                    <select className="border border-border rounded-md px-3 py-2 text-sm bg-background w-fit" value={status} onChange={(e) => setStatus(e.target.value as ContractStatus | '')}>
                        <option value="">All statuses</option>
                        {(['draft', 'active', 'expired', 'terminated'] as ContractStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Title</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Supplier</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Value</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden lg:table-cell">Period</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading && <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">Loading…</td></tr>}
                                {!isLoading && rows.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No contracts yet.</td></tr>}
                                {rows.map((c) => (
                                    <tr key={c.id} className="border-b border-border hover:bg-muted/20">
                                        <td className="px-6 py-3 font-medium">{c.title}</td>
                                        <td className="px-6 py-3 hidden md:table-cell">{nameOf(c.supplier_id)}</td>
                                        <td className="px-6 py-3 text-right tabular-nums">{c.value?.toLocaleString() ?? '—'}</td>
                                        <td className="px-6 py-3 hidden lg:table-cell text-muted-foreground">{new Date(c.start_date).toLocaleDateString()} – {new Date(c.end_date).toLocaleDateString()}</td>
                                        <td className="px-6 py-3"><Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge></td>
                                        <td className="px-6 py-3">
                                            <div className="flex gap-2 justify-end">
                                                {canChange && <Button variant="outline" size="sm" onClick={() => openEdit(c)}>Edit</Button>}
                                                {canChange && c.status !== 'active' && c.status !== 'terminated' && (
                                                    <Button variant="outline" size="sm" onClick={() => activate.mutate(c.id, { onSuccess: () => toast.success('Contract activated'), onError: () => toast.error('Failed') })}>Activate</Button>
                                                )}
                                                {canChange && c.status === 'active' && (
                                                    <Button variant="outline" size="sm" onClick={() => terminate.mutate(c.id, { onSuccess: () => toast.success('Contract terminated'), onError: () => toast.error('Failed') })}>Terminate</Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {totalPages > 1 && <div className="p-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>}
                </CardContent>
            </Card>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
                    <div className="relative z-50 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold">{editing ? 'Edit Contract' : 'New Contract'}</h2>
                                    <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-accent transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={submit} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Supplier *</label>
                                        <select className={selectClass} value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
                                            <option value="">— Select supplier —</option>
                                            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Title *</label>
                                        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Annual supply agreement" required />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Value</label>
                                            <Input type="number" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.00" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Start date</label>
                                            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">End date</label>
                                            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Terms</label>
                                        <textarea className={`${selectClass} resize-none`} rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Key terms / notes" />
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
                                        <Button type="submit" className="flex-1" disabled={isPending}>{isPending ? 'Saving…' : editing ? 'Update' : 'Create'}</Button>
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
