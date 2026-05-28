'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { apiClient } from '@/lib/api/client';
import { type CreateItemInput, type Item } from '@/lib/api/items';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Category {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  name: string;
  abbreviation: string;
}

interface Props {
  orgSlug: string;
  item?: Item | null;
  onClose: () => void;
  onSubmit: (data: CreateItemInput) => void;
  isPending: boolean;
}

const ITEM_TYPES = ['GOODS', 'SERVICE', 'RECIPE', 'INGREDIENT', 'VOUCHER', 'EQUIPMENT'] as const;

export function ItemFormDialog({ orgSlug, item, onClose, onSubmit, isPending }: Props) {
  const [name, setName] = useState(item?.name ?? '');
  const [sku, setSku] = useState(item?.sku ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [type, setType] = useState(item?.type ?? 'GOODS');
  const [categoryId, setCategoryId] = useState(item?.category_id ?? '');
  const [unitId, setUnitId] = useState(item?.unit_id ?? '');
  const [barcode, setBarcode] = useState(item?.barcode ?? '');
  const [reorderLevel, setReorderLevel] = useState(String(item?.reorder_level ?? ''));
  const [reorderQty, setReorderQty] = useState(String(item?.reorder_quantity ?? ''));
  const [costPrice, setCostPrice] = useState(item?.cost_price != null ? String(item.cost_price) : '');
  const [requiresAge, setRequiresAge] = useState(item?.requires_age_verification ?? false);
  const [isPerishable, setIsPerishable] = useState(item?.is_perishable ?? false);
  const [trackLots, setTrackLots] = useState(item?.track_lots ?? false);
  const [isActive, setIsActive] = useState(item?.is_active !== false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setSku(item.sku);
      setDescription(item.description ?? '');
      setType(item.type);
      setCategoryId(item.category_id ?? '');
      setUnitId(item.unit_id ?? '');
      setBarcode(item.barcode ?? '');
      setReorderLevel(String(item.reorder_level ?? ''));
      setReorderQty(String(item.reorder_quantity ?? ''));
      setCostPrice(item.cost_price != null ? String(item.cost_price) : '');
      setRequiresAge(item.requires_age_verification);
      setIsPerishable(item.is_perishable);
      setTrackLots(item.track_lots);
      setIsActive(item.is_active !== false);
    }
  }, [item]);

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories', orgSlug],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Category[]; total: number } | Category[]>(`/api/v1/${orgSlug}/inventory/categories`);
      return Array.isArray(res) ? res : (res as { data: Category[] }).data ?? [];
    },
    placeholderData: [],
  });

  const { data: units } = useQuery<Unit[]>({
    queryKey: ['units', orgSlug],
    queryFn: () => apiClient.get<Unit[]>(`/api/v1/${orgSlug}/inventory/units`),
    placeholderData: [],
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      sku: sku.trim() || undefined,
      description: description.trim() || undefined,
      type,
      category_id: categoryId || undefined,
      unit_id: unitId || undefined,
      barcode: barcode.trim() || undefined,
      reorder_level: reorderLevel ? parseInt(reorderLevel, 10) : undefined,
      reorder_quantity: reorderQty ? parseInt(reorderQty, 10) : undefined,
      cost_price: costPrice !== '' ? parseFloat(costPrice) : undefined,
      requires_age_verification: requiresAge,
      is_perishable: isPerishable,
      track_lots: trackLots,
      is_active: isActive,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{item ? 'Edit Item' : 'New Item'}</h2>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name *</label>
                  <Input
                    placeholder="Item name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">SKU</label>
                  <Input
                    placeholder="Auto-generated if blank"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as typeof ITEM_TYPES[number])}
                    className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                  >
                    {ITEM_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Barcode</label>
                  <Input
                    placeholder="Barcode (optional)"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                  >
                    <option value="">No category</option>
                    {categories?.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Unit</label>
                  <select
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                  >
                    <option value="">No unit</option>
                    {units?.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  placeholder="Optional description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none resize-none"
                />
              </div>

              {['GOODS', 'INGREDIENT', 'EQUIPMENT'].includes(type) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cost Price (KES)</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Unit cost from supplier"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Used for recipe costing and food cost variance reports</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reorder Level</label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reorder Quantity</label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={reorderQty}
                    onChange={(e) => setReorderQty(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requiresAge}
                    onChange={(e) => setRequiresAge(e.target.checked)}
                    className="rounded"
                  />
                  Requires Age Verification
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPerishable}
                    onChange={(e) => setIsPerishable(e.target.checked)}
                    className="rounded"
                  />
                  Perishable
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trackLots}
                    onChange={(e) => setTrackLots(e.target.checked)}
                    className="rounded"
                  />
                  Track Lots
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={isPending}>
                  {isPending ? 'Saving...' : item ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
