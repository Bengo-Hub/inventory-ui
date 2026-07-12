'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { type Asset, type CreateAssetInput } from '@/lib/api/assets';
import { useAssetCategories } from '@/hooks/useAssets';
import { X } from 'lucide-react';
import { useState } from 'react';
import { DECIMAL_STEP, parseDecimal } from '@/lib/utils';

interface Props {
    org: string;
    asset?: Asset | null;
    isPending: boolean;
    onSubmit: (data: CreateAssetInput) => void;
    onClose: () => void;
}

const DEPRECIATION_METHODS = ['straight_line', 'declining_balance', 'none'];
const CONDITIONS = ['new', 'good', 'fair', 'poor'];

export function AssetFormDialog({ org, asset, isPending, onSubmit, onClose }: Props) {
    const { data: categories = [] } = useAssetCategories(org);
    const [assetTag, setAssetTag] = useState(asset?.asset_tag ?? '');
    const [name, setName] = useState(asset?.name ?? '');
    const [categoryId, setCategoryId] = useState(asset?.category_id ?? '');
    const [serialNumber, setSerialNumber] = useState(asset?.serial_number ?? '');
    const [manufacturer, setManufacturer] = useState(asset?.manufacturer ?? '');
    const [model, setModel] = useState(asset?.model ?? '');
    const [purchaseDate, setPurchaseDate] = useState(asset?.purchase_date ? asset.purchase_date.slice(0, 10) : '');
    const [purchaseCost, setPurchaseCost] = useState(asset?.purchase_cost != null ? String(asset.purchase_cost) : '');
    const [salvageValue, setSalvageValue] = useState(asset?.salvage_value != null ? String(asset.salvage_value) : '');
    const [depreciationRate, setDepreciationRate] = useState(asset?.depreciation_rate != null ? String(asset.depreciation_rate) : '');
    const [depreciationMethod, setDepreciationMethod] = useState(asset?.depreciation_method ?? 'straight_line');
    const [location, setLocation] = useState(asset?.location ?? '');
    const [condition, setCondition] = useState(asset?.condition ?? 'good');
    const [notes, setNotes] = useState(asset?.notes ?? '');

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!assetTag.trim() || !name.trim()) return;
        onSubmit({
            asset_tag: assetTag.trim(),
            name: name.trim(),
            category_id: categoryId || undefined,
            serial_number: serialNumber.trim() || undefined,
            manufacturer: manufacturer.trim() || undefined,
            model: model.trim() || undefined,
            purchase_date: purchaseDate ? new Date(purchaseDate).toISOString() : undefined,
            purchase_cost: purchaseCost ? parseDecimal(purchaseCost) : undefined,
            salvage_value: salvageValue ? parseDecimal(salvageValue) : undefined,
            depreciation_rate: depreciationRate ? parseDecimal(depreciationRate) : undefined,
            depreciation_method: depreciationMethod || undefined,
            location: location.trim() || undefined,
            condition: condition || undefined,
            notes: notes.trim() || undefined,
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">{asset ? 'Edit Asset' : 'New Asset'}</h2>
                        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className="space-y-1 block">
                                <span className="text-sm font-medium">Asset Tag *</span>
                                <Input value={assetTag} onChange={(e) => setAssetTag(e.target.value)} required />
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-sm font-medium">Name *</span>
                                <Input value={name} onChange={(e) => setName(e.target.value)} required />
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-sm font-medium">Category</span>
                                <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                                    value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value)}>
                                    <option value="">— None —</option>
                                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-sm font-medium">Serial Number</span>
                                <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-sm font-medium">Manufacturer</span>
                                <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-sm font-medium">Model</span>
                                <Input value={model} onChange={(e) => setModel(e.target.value)} />
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-sm font-medium">Purchase Date</span>
                                <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-sm font-medium">Purchase Cost</span>
                                <Input type="number" step={DECIMAL_STEP} value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} placeholder="0.00" />
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-sm font-medium">Salvage Value</span>
                                <Input type="number" step={DECIMAL_STEP} value={salvageValue} onChange={(e) => setSalvageValue(e.target.value)} placeholder="0.00" />
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-sm font-medium">Depreciation Rate (%)</span>
                                <Input type="number" step={DECIMAL_STEP} value={depreciationRate} onChange={(e) => setDepreciationRate(e.target.value)} placeholder="0.00" />
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-sm font-medium">Depreciation Method</span>
                                <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                                    value={depreciationMethod} onChange={(e) => setDepreciationMethod(e.target.value)}>
                                    {DEPRECIATION_METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                                </select>
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-sm font-medium">Condition</span>
                                <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                                    value={condition} onChange={(e) => setCondition(e.target.value)}>
                                    {CONDITIONS.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                                </select>
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-sm font-medium">Location</span>
                                <Input value={location} onChange={(e) => setLocation(e.target.value)} />
                            </label>
                        </div>
                        <label className="space-y-1 block">
                            <span className="text-sm font-medium">Notes</span>
                            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
                        </label>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                            <Button type="submit" disabled={isPending}>{isPending ? 'Saving…' : asset ? 'Save Changes' : 'Create Asset'}</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
