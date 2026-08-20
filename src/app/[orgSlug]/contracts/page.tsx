'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { useContracts, useCreateContract, useUpdateContract, useActivateContract, useTerminateContract } from '@/hooks/useContracts';
import { useSuppliers, useCreateSupplier, useSupplierSearch } from '@/hooks/useSuppliers';
import { CreatableSelect } from '@/components/inventory/CreatableSelect';
import { SupplierFormDialog } from '@/components/inventory/SupplierFormDialog';
import { DetailDrawer } from '@/components/inventory/DetailDrawer';
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildContractColumns, STATUS_VARIANT } from './contract-columns';
import { type Contract, type ContractStatus } from '@/lib/api/contracts';
import { FileSignature, Plus, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions, P } from '@/hooks/usePermissions';
import { apiErrorMessage } from '@/lib/api/error-message';
import { DECIMAL_STEP, parseDecimal } from '@/lib/utils';

const selectClass = 'w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none';

const toDateInput = (s?: string) => (s ? s.slice(0, 10) : '');

export default function ContractsPage() {
    const params = useParams();
    const org = params?.orgSlug as string;
    const [status, setStatus] = useState<ContractStatus | ''>('');
    const [range, setRange] = useState<DateRange>({ from: '', to: '' });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Contract | null>(null);
    const [viewing, setViewing] = useState<Contract | null>(null);
    const [addSupplierOpen, setAddSupplierOpen] = useState(false);

    const [supplierId, setSupplierId] = useState('');
    const [title, setTitle] = useState('');
    const [value, setValue] = useState('');
    const [projectId, setProjectId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [terms, setTerms] = useState('');

    const { data, isLoading, isError, refetch } = useContracts(org, { status: status || undefined, from: range.from || undefined, to: range.to || undefined, page, limit: pageSize });
    const create = useCreateContract(org);
    const update = useUpdateContract(org);
    const activate = useActivateContract(org);
    const terminate = useTerminateContract(org);
    const { data: suppliersPage } = useSuppliers(org);
    const suppliers = suppliersPage?.data ?? [];
    const searchSuppliers = useSupplierSearch(org);
    const createSupplier = useCreateSupplier(org);

    const { canAny } = usePermissions();
    const canAdd = canAny([P.PURCHASES_ADD, P.PURCHASES_MANAGE]);
    const canChange = canAny([P.PURCHASES_CHANGE, P.PURCHASES_MANAGE]);

    const rows = data?.data ?? [];
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));
    useMemo(() => { setPage(1); }, [status, range, pageSize]);

    const nameOf = (id?: string | null) => suppliers.find((s) => s.id === id)?.name ?? '—';
    const isPending = create.isPending || update.isPending;

    function openNew() {
        setEditing(null); setSupplierId(''); setTitle(''); setValue(''); setProjectId(''); setStartDate(''); setEndDate(''); setTerms('');
        setOpen(true);
    }
    function openEdit(c: Contract) {
        setEditing(c); setSupplierId(c.supplier_id); setTitle(c.title); setValue(String(c.value ?? ''));
        setProjectId(c.project_id ?? '');
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
            value: value ? parseDecimal(value) : undefined,
            project_id: projectId.trim() || undefined,
            start_date: startDate ? new Date(startDate).toISOString() : undefined,
            end_date: endDate ? new Date(endDate).toISOString() : undefined,
            terms: terms.trim() || undefined,
        };
        const done = () => { toast.success(editing ? 'Contract updated' : 'Contract created'); setOpen(false); };
        if (editing) update.mutate({ id: editing.id, data }, { onSuccess: done, onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to update')) });
        else create.mutate(data, { onSuccess: done, onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to create')) });
    }

    function doActivate(c: Contract) {
        activate.mutate(c.id, { onSuccess: () => toast.success('Contract activated'), onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed')) });
    }
    function doTerminate(c: Contract) {
        terminate.mutate(c.id, { onSuccess: () => toast.success('Contract terminated'), onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed')) });
    }

    const columns = useMemo(
        () => buildContractColumns({ nameOf, canChange, onView: setViewing, onEdit: openEdit, onActivate: doActivate, onTerminate: doTerminate }),
        [nameOf, canChange],
    );

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
                <CardHeader className="flex flex-row flex-wrap items-center gap-2">
                    <select className="border border-border rounded-md px-3 py-2 text-sm bg-background w-fit" value={status} onChange={(e) => setStatus(e.target.value as ContractStatus | '')}>
                        <option value="">All statuses</option>
                        {(['draft', 'active', 'expired', 'terminated'] as ContractStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <DateRangePicker value={range} onChange={setRange} className="w-56" />
                </CardHeader>
                <CardContent className="p-0">
                    <div className="px-2 pb-2">
                        <DataTable<Contract>
                            columns={columns}
                            rows={rows}
                            rowKey={(c) => c.id}
                            loading={isLoading}
                            loadingRows={8}
                            error={isError}
                            onRetry={() => refetch()}
                            onRowClick={(c) => setViewing(c)}
                            emptyState={
                                <>
                                    <FileSignature className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                    <p className="text-muted-foreground">No contracts yet</p>
                                </>
                            }
                            storageKey="contracts-col-prefs"
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
                                        <CreatableSelect
                                            value={supplierId}
                                            onChange={setSupplierId}
                                            options={suppliers.map((s) => ({ id: s.id, name: s.name }))}
                                            placeholder="— Select supplier —"
                                            required
                                            onAddClick={() => setAddSupplierOpen(true)}
                                            addLabel="Add supplier"
                                            onRemoteSearch={searchSuppliers}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Title *</label>
                                        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Annual supply agreement" required />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Value</label>
                                            <Input type="number" min="0" step={DECIMAL_STEP} value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.00" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Project (optional)</label>
                                            <Input value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="Project ID" />
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

            {addSupplierOpen && (
                <SupplierFormDialog
                    editing={null}
                    isPending={createSupplier.isPending}
                    onClose={() => setAddSupplierOpen(false)}
                    onSubmit={(data) => createSupplier.mutate(data, {
                        onSuccess: (s) => { toast.success('Supplier created'); setSupplierId(s.id); setAddSupplierOpen(false); },
                        onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to create supplier')),
                    })}
                />
            )}

            <DetailDrawer
                open={!!viewing}
                onClose={() => setViewing(null)}
                title={viewing?.title ?? 'Contract'}
                subtitle={viewing ? nameOf(viewing.supplier_id) : undefined}
                badges={viewing && <Badge variant={STATUS_VARIANT[viewing.status]}>{viewing.status}</Badge>}
                fields={viewing ? [
                    { label: 'Supplier', value: nameOf(viewing.supplier_id) },
                    { label: 'Value', value: viewing.value != null ? viewing.value.toLocaleString() : '—' },
                    { label: 'Start date', value: viewing.start_date ? new Date(viewing.start_date).toLocaleDateString() : '—' },
                    { label: 'End date', value: viewing.end_date ? new Date(viewing.end_date).toLocaleDateString() : '—' },
                    { label: 'Terms', value: viewing.terms, full: true, hideIfEmpty: true },
                ] : []}
                actions={viewing && (
                    <>
                        {canChange && <Button variant="outline" size="sm" onClick={() => { openEdit(viewing); setViewing(null); }}>Edit</Button>}
                        {canChange && viewing.status !== 'active' && viewing.status !== 'terminated' && (
                            <Button variant="outline" size="sm" onClick={() => activate.mutate(viewing.id, { onSuccess: () => { toast.success('Contract activated'); setViewing(null); }, onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed')) })}>Activate</Button>
                        )}
                        {canChange && viewing.status === 'active' && (
                            <Button variant="outline" size="sm" onClick={() => terminate.mutate(viewing.id, { onSuccess: () => { toast.success('Contract terminated'); setViewing(null); }, onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed')) })}>Terminate</Button>
                        )}
                    </>
                )}
            />
        </div>
    );
}
