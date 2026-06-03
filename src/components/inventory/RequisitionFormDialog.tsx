'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { type CreateRequisitionInput, type Priority, type RequestType, type RequisitionLine } from '@/lib/api/requisitions';
import { Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';

interface Props {
    isPending: boolean;
    onSubmit: (data: CreateRequisitionInput) => void;
    onClose: () => void;
}

const REQUEST_TYPES: { value: RequestType; label: string }[] = [
    { value: 'inventory', label: 'Inventory Item' },
    { value: 'external_item', label: 'External Item' },
    { value: 'service', label: 'Service' },
];
const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'critical'];

type LineDraft = { description: string; quantity: string; estimated_price: string };

export function RequisitionFormDialog({ isPending, onSubmit, onClose }: Props) {
    const [requestType, setRequestType] = useState<RequestType>('inventory');
    const [purpose, setPurpose] = useState('');
    const [priority, setPriority] = useState<Priority>('medium');
    const [requiredBy, setRequiredBy] = useState('');
    const [notes, setNotes] = useState('');
    const [lines, setLines] = useState<LineDraft[]>([{ description: '', quantity: '1', estimated_price: '' }]);

    function updateLine(i: number, patch: Partial<LineDraft>) {
        setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
    }
    function addLine() { setLines((ls) => [...ls, { description: '', quantity: '1', estimated_price: '' }]); }
    function removeLine(i: number) { setLines((ls) => ls.filter((_, idx) => idx !== i)); }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!purpose.trim()) return;
        const itemType: RequisitionLine['item_type'] = requestType === 'service' ? 'service' : requestType === 'external_item' ? 'external' : 'inventory';
        const mapped: RequisitionLine[] = lines
            .filter((l) => l.description.trim() || l.quantity)
            .map((l) => ({
                item_type: itemType,
                quantity: Number(l.quantity) || 1,
                description: l.description.trim() || undefined,
                estimated_price: l.estimated_price ? Number(l.estimated_price) : undefined,
            }));
        onSubmit({
            request_type: requestType,
            purpose: purpose.trim(),
            priority,
            required_by_date: requiredBy ? new Date(requiredBy).toISOString() : undefined,
            notes: notes.trim() || undefined,
            lines: mapped,
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">New Requisition</h2>
                        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className="space-y-1">
                                <span className="text-sm font-medium">Request Type</span>
                                <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                                    value={requestType} onChange={(e) => setRequestType(e.target.value as RequestType)}>
                                    {REQUEST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </label>
                            <label className="space-y-1">
                                <span className="text-sm font-medium">Priority</span>
                                <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                                    value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                                    {PRIORITIES.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
                                </select>
                            </label>
                        </div>
                        <label className="space-y-1 block">
                            <span className="text-sm font-medium">Purpose *</span>
                            <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Why is this needed?" required />
                        </label>
                        <label className="space-y-1 block">
                            <span className="text-sm font-medium">Required By</span>
                            <Input type="date" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} />
                        </label>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Line Items</span>
                                <Button type="button" variant="outline" onClick={addLine}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                            </div>
                            {lines.map((l, i) => (
                                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                                    <Input className="col-span-7" placeholder="Description" value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} />
                                    <Input className="col-span-2" type="number" placeholder="Qty" value={l.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} />
                                    <Input className="col-span-2" type="number" placeholder="Est. price" value={l.estimated_price} onChange={(e) => updateLine(i, { estimated_price: e.target.value })} />
                                    <button type="button" onClick={() => removeLine(i)} className="col-span-1 text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                                </div>
                            ))}
                        </div>

                        <label className="space-y-1 block">
                            <span className="text-sm font-medium">Notes</span>
                            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
                        </label>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                            <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create Requisition'}</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
