'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { goodsReceiptsApi, type MatchResult } from '@/lib/api/goods-receipts';
import { useState } from 'react';
import { toast } from 'sonner';

interface Props {
    org: string;
    poId: string;
}

const matchVariant = (s: string): 'default' | 'success' | 'warning' | 'error' | 'outline' =>
    s === 'matched' ? 'success' : s === 'over_received' || s === 'under_received' ? 'warning' : 'error';

// 3-way match: ordered (PO) ↔ received (GRN) ↔ invoiced (entered by the user,
// since invoices are owned by treasury).
export function ThreeWayMatchPanel({ org, poId }: Props) {
    const [invQty, setInvQty] = useState('');
    const [invTotal, setInvTotal] = useState('');
    const [result, setResult] = useState<MatchResult | null>(null);
    const [loading, setLoading] = useState(false);

    async function run() {
        setLoading(true);
        try {
            const res = await goodsReceiptsApi.match(org, poId, invQty ? Number(invQty) : undefined, invTotal ? Number(invTotal) : undefined);
            setResult(res);
        } catch {
            toast.error('Failed to run 3-way match');
        } finally {
            setLoading(false);
        }
    }

    return (
        <Card>
            <CardHeader><h2 className="text-lg font-semibold">3-Way Match</h2></CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                    <label className="space-y-1">
                        <span className="text-xs text-muted-foreground">Invoiced qty (from supplier invoice)</span>
                        <Input type="number" min="0" className="w-44" value={invQty} onChange={(e) => setInvQty(e.target.value)} placeholder="optional" />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs text-muted-foreground">Invoice total</span>
                        <Input type="number" min="0" step="0.01" className="w-44" value={invTotal} onChange={(e) => setInvTotal(e.target.value)} placeholder="optional" />
                    </label>
                    <Button type="button" disabled={loading} onClick={run}>{loading ? 'Matching…' : 'Run match'}</Button>
                </div>

                {result && (
                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-4 text-sm">
                            <span>Ordered: <strong className="tabular-nums">{result.ordered_total}</strong></span>
                            <span>Received: <strong className="tabular-nums">{result.received_total}</strong></span>
                            <span>Invoiced: <strong className="tabular-nums">{result.invoiced_qty || '—'}</strong></span>
                            <span className="ml-auto">Result: <Badge variant={matchVariant(result.status)}>{result.status.replace(/_/g, ' ')}</Badge></span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30">
                                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Item</th>
                                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">Ordered</th>
                                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">Received</th>
                                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.lines.map((l) => (
                                        <tr key={l.item_id} className="border-b border-border">
                                            <td className="px-4 py-2 font-mono text-xs">{l.item_id.slice(0, 8)}</td>
                                            <td className="px-4 py-2 text-right tabular-nums">{l.ordered}</td>
                                            <td className="px-4 py-2 text-right tabular-nums">{l.received}</td>
                                            <td className="px-4 py-2"><Badge variant={matchVariant(l.status)}>{l.status.replace(/_/g, ' ')}</Badge></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
