'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { InfoHint } from '@/components/ui/info-hint';
import { ItemSearchInput, type ItemResult } from '@/components/inventory/ItemSearchInput';
import type { ModifierGroup, ModifierGroupPayload } from '@/lib/api/modifiers';
import { Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { DECIMAL_STEP, parseDecimal } from '@/lib/utils';

interface OptionRow {
    name: string;
    /** Deduction SKU of a linked inventory item (accompaniment / add-on). */
    sku: string;
    /** Display helper for the linked item's name — never sent to the API. */
    linked_name: string;
    price_adjustment: string;
    is_default: boolean;
    is_active: boolean;
}

function emptyOption(): OptionRow {
    return { name: '', sku: '', linked_name: '', price_adjustment: '0', is_default: false, is_active: true };
}

interface Props {
    orgSlug: string;
    editing: ModifierGroup | null;
    isPending: boolean;
    onSubmit: (data: ModifierGroupPayload) => void;
    onClose: () => void;
}

export function ModifierGroupDialog({ orgSlug, editing, isPending, onSubmit, onClose }: Props) {
    const [itemId, setItemId] = useState(editing?.item_id ?? '');
    const [itemName, setItemName] = useState(editing?.item_name ?? '');
    const [itemSku, setItemSku] = useState(editing?.item_sku ?? '');
    const [formName, setFormName] = useState(editing?.name ?? '');
    const [formMinSelections, setFormMinSelections] = useState(String(editing?.min_selections ?? 0));
    const [formMaxSelections, setFormMaxSelections] = useState(String(editing?.max_selections ?? 1));
    const [formIsRequired, setFormIsRequired] = useState(editing?.is_required ?? false);
    const [options, setOptions] = useState<OptionRow[]>(
        editing?.options?.map((o) => ({
            name: o.name,
            sku: o.sku ?? '',
            linked_name: '',
            price_adjustment: String(o.price_adjustment),
            is_default: o.is_default,
            is_active: o.is_active,
        })) ?? []
    );

    function addOption() {
        setOptions((prev) => [...prev, emptyOption()]);
    }

    function removeOption(idx: number) {
        setOptions((prev) => prev.filter((_, i) => i !== idx));
    }

    function updateOption(idx: number, field: keyof OptionRow, value: string | boolean) {
        setOptions((prev) => {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], [field]: value };
            return updated;
        });
    }

    // Linking an existing item (e.g. the Ugali accompaniment) fills the option in one go:
    // name, deduction SKU and price adjustment — 0 when the item is a free (non-billable)
    // accompaniment, else its menu selling price. Everything stays editable afterwards.
    function linkOptionItem(idx: number, item: ItemResult) {
        setOptions((prev) => {
            const updated = [...prev];
            const o = updated[idx];
            updated[idx] = {
                ...o,
                name: o.name.trim() || item.name,
                sku: item.sku,
                linked_name: item.name,
                price_adjustment: String(item.non_billable ? 0 : (item.selling_price ?? 0)),
            };
            return updated;
        });
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formName.trim() || !itemId) return;

        const payload: ModifierGroupPayload = {
            item_id: itemId,
            name: formName.trim(),
            min_selections: Number(formMinSelections) || 0,
            max_selections: Number(formMaxSelections) || 1,
            is_required: formIsRequired,
            options: options
                .filter((o) => o.name.trim())
                .map((o, idx) => ({
                    name: o.name.trim(),
                    sku: o.sku.trim() || undefined,
                    price_adjustment: parseDecimal(o.price_adjustment),
                    is_default: o.is_default,
                    is_active: o.is_active,
                    display_order: idx + 1,
                })),
        };

        onSubmit(payload);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-50 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">
                                {editing ? 'Edit Modifier Group' : 'Add Modifier Group'}
                            </h2>
                            <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent transition-colors">
                                <X className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-4">
                                {/* Linked item — required */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">
                                        Linked Item *
                                        <span className="ml-1 text-xs text-muted-foreground font-normal">
                                            (which menu/GOODS item shows this modifier group)
                                        </span>
                                    </label>
                                    {editing ? (
                                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30 text-sm">
                                            <span className="font-medium">{itemName || itemId}</span>
                                            {itemSku && (
                                                <span className="text-xs text-muted-foreground font-mono">({itemSku})</span>
                                            )}
                                            <span className="text-xs text-muted-foreground">(cannot change after creation)</span>
                                        </div>
                                    ) : (
                                        <ItemSearchInput
                                            orgSlug={orgSlug}
                                            value={itemName}
                                            onSelect={(item) => {
                                                setItemId(item.id);
                                                setItemName(item.name);
                                                setItemSku(item.sku);
                                            }}
                                            placeholder="Search for a menu item or goods item..."
                                            fixedDropdown
                                        />
                                    )}
                                    {!itemId && !editing && (
                                        <p className="text-xs text-destructive">Select an item to link this modifier group to</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Group Name *</label>
                                    <Input
                                        placeholder="e.g. Choose your accompaniment"
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        required
                                    />
                                    <p className="text-xs text-muted-foreground">The question shown at the till.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Min Selections</label>
                                        <Input type="number" min="0" value={formMinSelections} onChange={(e) => setFormMinSelections(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Max Selections</label>
                                        <Input type="number" min="1" value={formMaxSelections} onChange={(e) => setFormMaxSelections(e.target.value)} />
                                    </div>
                                </div>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={formIsRequired} onChange={(e) => setFormIsRequired(e.target.checked)} className="rounded" />
                                    <span className="text-sm font-medium">Required selection</span>
                                </label>
                            </div>

                            <div className="border-t border-border pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-sm font-medium inline-flex items-center gap-1">Options
                                        <InfoHint title="Modifier options">
                                            Each option can link an existing inventory item (e.g. the Ugali accompaniment) —
                                            the name, deduction SKU and price adjustment prefill automatically: KES&nbsp;0 for
                                            free (non-billable) accompaniments, else the item&apos;s menu price. Selling the
                                            option deducts the linked item&apos;s stock (a linked recipe deducts its own
                                            ingredients). Options without a linked item are price-only choices.
                                        </InfoHint>
                                    </p>
                                    <Button type="button" variant="ghost" size="sm" onClick={addOption}>
                                        <Plus className="h-3 w-3 mr-1" />
                                        Add Option
                                    </Button>
                                </div>
                                {options.length === 0 && (
                                    <p className="text-xs text-muted-foreground text-center py-2">No options yet. Add options below.</p>
                                )}
                                <div className="space-y-2">
                                    {options.map((opt, idx) => (
                                        <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_96px_auto] gap-2 items-start p-2 rounded-lg border border-border/50">
                                            <div className="space-y-1">
                                                <label className="text-xs text-muted-foreground">Link item (optional)</label>
                                                <ItemSearchInput
                                                    orgSlug={orgSlug}
                                                    value={opt.linked_name || opt.sku}
                                                    placeholder="Search item…"
                                                    fixedDropdown
                                                    allowCreate={false}
                                                    enableScan={false}
                                                    onSelect={(item) => linkOptionItem(idx, item)}
                                                />
                                                {opt.sku && (
                                                    <p className="text-[10px] text-muted-foreground">Deducts <span className="font-mono">{opt.sku}</span></p>
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-muted-foreground">Name *</label>
                                                <Input
                                                    placeholder="e.g. Ugali White"
                                                    value={opt.name}
                                                    onChange={(e) => updateOption(idx, 'name', e.target.value)}
                                                    className="h-9 text-sm"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-muted-foreground">Price Adj.</label>
                                                <Input
                                                    type="number"
                                                    step={DECIMAL_STEP}
                                                    placeholder="0"
                                                    value={opt.price_adjustment}
                                                    onChange={(e) => updateOption(idx, 'price_adjustment', e.target.value)}
                                                    className="h-9 text-sm"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2 pt-6">
                                                <label className="flex items-center gap-1 cursor-pointer">
                                                    <input type="checkbox" checked={opt.is_default} onChange={(e) => updateOption(idx, 'is_default', e.target.checked)} className="rounded" />
                                                    <span className="text-xs text-muted-foreground">Default</span>
                                                </label>
                                                <button type="button" onClick={() => removeOption(idx)} className="p-1 rounded hover:bg-destructive/10 text-destructive">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                                    Cancel
                                </Button>
                                <Button type="submit" className="flex-1" disabled={isPending || (!editing && !itemId)}>
                                    {isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
