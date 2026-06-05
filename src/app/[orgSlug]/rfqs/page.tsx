'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { ItemSearchInput } from '@/components/inventory/ItemSearchInput';
import { useRFQs, useCreateRFQ } from '@/hooks/useRFQs';
import { useWarehouses } from '@/hooks/useWarehouses';
import { usePermissions, P } from '@/hooks/usePermissions';
import type { RFQStatus } from '@/lib/api/rfq';
import { FileQuestion, Minus, Plus, Search, X } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
    draft: 'outline',
    sent: 'default',
    closed: 'warning',
    awarded: 'success',
    cancelled: 'error',
};

interface LineDraft {
    itemId: string;
    itemName: string;
    quantity: string;
    uom: string;
}

export default function RFQListPage() {
    const params = useParams();
    const router = useRouter();
    const orgSlug = params?.orgSlug as string;
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);

    const [title, setTitle] = useState('');
    const [warehouseId, setWarehouseId] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [lines, setLines] = useState<LineDraft[]>([{ itemId: '', itemName: '', quantity: '1', uom: '' }]);

    const { data: rfqs, isLoading } = useRFQs(orgSlug);
    const { data: warehouses } = useWarehouses(orgSlug);
    const createRFQ = useCreateRFQ(orgSlug);

    const { canAny } = usePermissions();
    const canCreate = canAny([P.PURCHASES_ADD, P.PURCHASES_MANAGE, P.APPROVALS_MANAGE]);

    const filtered = search
        ? rfqs?.filter((r) =>
              r.rfq_number.toLowerCase().includes(search.toLowerCase()) ||
              (r.title ?? '').toLowerCase().includes(search.toLowerCase()),
          )
        : rfqs;

    function resetForm() {
        setTitle('');
        setWarehouseId('');
        setDueDate('');
        setLines([{ itemId: '', itemName: '', quantity: '1', uom: '' }]);
    }
    function addLine() {
        setLines([...lines, { itemId: '', itemName: '', quantity: '1', uom: '' }]);
    }
    function removeLine(idx: number) {
        setLines(lines.filter((_, i) => i !== idx));
    }
    function updateLine(idx: number, field: keyof LineDraft, value: string) {
        const next = [...lines];
        next[idx] = { ...next[idx], [field]: value };
        setLines(next);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const cleaned = lines
            .filter((l) => l.itemId || l.itemName)
            .map((l) => ({
                item_id: l.itemId || null,
                description: l.itemName,
                quantity: parseInt(l.quantity, 10) || 1,
                uom: l.uom || undefined,
            }));
        if (cleaned.length === 0) {
            toast.error('Add at least one line');
            return;
        }
        createRFQ.mutate(
            {
                title: title.trim() || undefined,
                warehouse_id: warehouseId || null,
                due_date: dueDate || null,
                lines: cleaned,
            },
            {
                onSuccess: (rfq) => {
                    toast.success('RFQ created');
                    setOpen(false);
                    resetForm();
                    router.push(`/${orgSlug}/rfqs/${rfq.id}`);
                },
                onError: () => toast.error('Failed to create RFQ'),
            },
        );
    }

    return (
        <>
            <div className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <FileQuestion className="h-6 w-6" /> Requests for Quotation
                        </h1>
                        <p className="text-muted-foreground mt-1">Source competitive supplier quotes before raising purchase orders</p>
                    </div>
                    {canCreate && (
                        <Button onClick={() => { resetForm(); setOpen(true); }}>
                            <Plus className="h-4 w-4 mr-2" /> New RFQ
                        </Button>
                    )}
                </div>

                <Card>
                    <CardHeader>
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search by RFQ number or title..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30">
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground">RFQ</th>
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground">Title</th>
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Created</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {isLoading ? (
                                        <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">Loading RFQs...</td></tr>
                                    ) : (filtered?.length ?? 0) === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center">
                                                <FileQuestion className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                                <p className="text-muted-foreground">No RFQs yet</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filtered?.map((rfq) => (
                                            <tr
                                                key={rfq.id}
                                                className="hover:bg-accent/30 transition-colors cursor-pointer"
                                                onClick={() => router.push(`/${orgSlug}/rfqs/${rfq.id}`)}
                                            >
                                                <td className="px-6 py-4 font-mono text-xs font-medium">{rfq.rfq_number}</td>
                                                <td className="px-6 py-4">{rfq.title || '—'}</td>
                                                <td className="px-6 py-4"><Badge variant={STATUS_VARIANT[rfq.status] ?? 'default'}>{rfq.status}</Badge></td>
                                                <td className="px-6 py-4 text-muted-foreground hidden md:table-cell">{new Date(rfq.created_at).toLocaleDateString()}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
                    <div className="relative z-50 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold">New RFQ</h2>
                                    <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-accent transition-colors">
                                        <X className="h-5 w-5 text-muted-foreground" />
                                    </button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Title</label>
                                            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q3 chemical supply" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Destination Warehouse</label>
                                            <select
                                                value={warehouseId}
                                                onChange={(e) => setWarehouseId(e.target.value)}
                                                className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                            >
                                                <option value="">Select warehouse (optional)...</option>
                                                {warehouses?.map((wh) => (
                                                    <option key={wh.id} value={wh.id}>{wh.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Quote Due Date</label>
                                        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium">Requested Items *</label>
                                            <Button type="button" variant="ghost" size="sm" onClick={addLine}><Plus className="h-3 w-3 mr-1" /> Add Line</Button>
                                        </div>
                                        {lines.map((line, idx) => (
                                            <div key={idx} className="space-y-2 p-3 rounded-lg border border-border">
                                                <ItemSearchInput
                                                    orgSlug={orgSlug}
                                                    value={line.itemName}
                                                    onSelect={(item) => {
                                                        const next = [...lines];
                                                        next[idx] = { ...next[idx], itemId: item.id, itemName: item.name };
                                                        setLines(next);
                                                    }}
                                                    placeholder="Search item (or type a description)..."
                                                />
                                                <div className="grid grid-cols-3 gap-2 items-end">
                                                    <div className="space-y-1">
                                                        <label className="text-xs text-muted-foreground">Qty</label>
                                                        <Input type="number" min="1" value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', e.target.value)} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-xs text-muted-foreground">UoM</label>
                                                        <Input value={line.uom} onChange={(e) => updateLine(idx, 'uom', e.target.value)} placeholder="kg, L, pcs" />
                                                    </div>
                                                    <div className="flex items-center pb-0.5">
                                                        {lines.length > 1 && (
                                                            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => removeLine(idx)}>
                                                                <Minus className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                                {!line.itemId && line.itemName && (
                                                    <p className="text-xs text-muted-foreground">Free-text line — won’t auto-create a PO line on award.</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
                                        <Button type="submit" className="flex-1" disabled={createRFQ.isPending}>
                                            {createRFQ.isPending ? 'Creating...' : 'Create RFQ'}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </>
    );
}
