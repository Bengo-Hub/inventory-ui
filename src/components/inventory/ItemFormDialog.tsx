'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { RecurrenceEditor, generateRecurrencePattern } from '@/components/inventory/RecurrenceEditor';
import { apiClient } from '@/lib/api/client';
import { type CreateItemInput, type Item, type RecurrenceConfig } from '@/lib/api/items';
import { useQuery } from '@tanstack/react-query';
import { Image as ImageIcon, Loader2, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Category {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  name: string;
  abbreviation: string;
}

interface TicketTier {
  name: string;
  price: number;
  capacity: number;
}

interface Props {
  orgSlug: string;
  item?: Item | null;
  defaultDate?: string;
  onClose: () => void;
  onSubmit: (data: CreateItemInput) => void;
  isPending: boolean;
}

const ITEM_TYPES = ['GOODS', 'SERVICE', 'RECIPE', 'INGREDIENT', 'VOUCHER', 'EQUIPMENT'] as const;

const inputCls =
  'w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none';
const selectCls = `${inputCls} appearance-none`;

function toLocalDatetimeValue(iso?: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 16); // "YYYY-MM-DDTHH:mm"
}

export function ItemFormDialog({ orgSlug, item, defaultDate, onClose, onSubmit, isPending }: Props) {
  const [name, setName] = useState(item?.name ?? '');
  const [sku, setSku] = useState(item?.sku ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [type, setType] = useState<string>(item?.type ?? 'GOODS');
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

  // Image
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Event fields
  const [eventStartAt, setEventStartAt] = useState(toLocalDatetimeValue(item?.event_start_at ?? defaultDate));
  const [eventEndAt, setEventEndAt] = useState(toLocalDatetimeValue(item?.event_end_at));
  const [eventVenue, setEventVenue] = useState(item?.event_venue ?? '');
  const [totalCapacity, setTotalCapacity] = useState(item?.total_capacity != null ? String(item.total_capacity) : '');

  // Ticket tiers (stored in metadata.ticket_tiers)
  const existingTiers: TicketTier[] = (item?.metadata?.ticket_tiers as TicketTier[]) ?? [];
  const [tiers, setTiers] = useState<TicketTier[]>(existingTiers);

  // Structured recurrence config
  const existingRc = item?.metadata?.recurrence_config as RecurrenceConfig | undefined;
  const [recurrenceConfig, setRecurrenceConfig] = useState<RecurrenceConfig | null>(
    (item?.metadata?.is_recurring && existingRc) ? existingRc : null
  );

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
      setImageUrl(item.image_url ?? '');
      setEventStartAt(toLocalDatetimeValue(item.event_start_at));
      setEventEndAt(toLocalDatetimeValue(item.event_end_at));
      setEventVenue(item.event_venue ?? '');
      setTotalCapacity(item.total_capacity != null ? String(item.total_capacity) : '');
      const trs = (item.metadata?.ticket_tiers as TicketTier[]) ?? [];
      setTiers(trs);
      const rc = item.metadata?.recurrence_config as RecurrenceConfig | undefined;
      setRecurrenceConfig((item.metadata?.is_recurring && rc) ? rc : null);
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

  async function handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2 MB');
      return;
    }
    setUploadingImage(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiClient.post<{ url: string }>('/api/v1/media/upload', form);
      setImageUrl(res.url);
    } finally {
      setUploadingImage(false);
    }
  }

  function addTier() {
    setTiers((prev) => [...prev, { name: '', price: 0, capacity: 0 }]);
  }

  function removeTier(i: number) {
    setTiers((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateTier(i: number, field: keyof TicketTier, value: string | number) {
    setTiers((prev) => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const metadata: Record<string, unknown> = {};
    if (type === 'SERVICE') {
      if (tiers.length > 0) metadata.ticket_tiers = tiers;
      if (recurrenceConfig) {
        metadata.is_recurring = true;
        metadata.recurrence_config = recurrenceConfig;
        metadata.recurrence_pattern = generateRecurrencePattern(recurrenceConfig);
      }
    }

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
      image_url: imageUrl || undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      total_capacity: totalCapacity ? parseInt(totalCapacity, 10) : undefined,
      event_start_at: eventStartAt ? new Date(eventStartAt).toISOString() : undefined,
      event_end_at: eventEndAt ? new Date(eventEndAt).toISOString() : undefined,
      event_venue: eventVenue.trim() || undefined,
    });
  }

  const isService = type === 'SERVICE';

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
              {/* Identity */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name *</label>
                  <Input placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">SKU</label>
                  <Input placeholder="Auto-generated if blank" value={sku} onChange={(e) => setSku(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type *</label>
                  <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
                    {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Barcode</label>
                  <Input placeholder="Barcode (optional)" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectCls}>
                    <option value="">No category</option>
                    {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Unit</label>
                  <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className={selectCls}>
                    <option value="">No unit</option>
                    {units?.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
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

              {/* Image */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Item Image</label>
                <div className="flex items-center gap-3">
                  {imageUrl ? (
                    <div className="relative h-16 w-16 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt="Item" className="h-16 w-16 rounded-lg object-cover border border-input" />
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded-lg border border-dashed border-input flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleImageFile(e.target.files[0]); }} />
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}>
                      {uploadingImage ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Uploading…</> : 'Upload Image'}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">JPEG or PNG · max 2 MB</p>
                  </div>
                </div>
              </div>

              {/* Cost Price */}
              {['GOODS', 'INGREDIENT', 'EQUIPMENT'].includes(type) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cost Price (KES)</label>
                  <Input type="number" min="0" step="0.01" placeholder="Unit cost from supplier" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Used for recipe costing and food cost variance reports</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reorder Level</label>
                  <Input type="number" min="0" placeholder="0" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reorder Quantity</label>
                  <Input type="number" min="0" placeholder="0" value={reorderQty} onChange={(e) => setReorderQty(e.target.value)} />
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={requiresAge} onChange={(e) => setRequiresAge(e.target.checked)} className="rounded" />
                  Requires Age Verification
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={isPerishable} onChange={(e) => setIsPerishable(e.target.checked)} className="rounded" />
                  Perishable
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={trackLots} onChange={(e) => setTrackLots(e.target.checked)} className="rounded" />
                  Track Lots
                </label>
              </div>

              {/* Event Details — SERVICE type only */}
              {isService && (
                <div className="space-y-4 border-t border-border pt-4">
                  <p className="text-sm font-semibold">Event Details</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Start Date &amp; Time</label>
                      <input
                        type="datetime-local"
                        value={eventStartAt}
                        onChange={(e) => setEventStartAt(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">End Date &amp; Time</label>
                      <input
                        type="datetime-local"
                        value={eventEndAt}
                        onChange={(e) => setEventEndAt(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Venue / Location</label>
                      <Input placeholder="e.g. Urban Loft Busia" value={eventVenue} onChange={(e) => setEventVenue(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Total Capacity (tickets)</label>
                      <Input type="number" min="0" placeholder="e.g. 100" value={totalCapacity} onChange={(e) => setTotalCapacity(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <RecurrenceEditor value={recurrenceConfig} onChange={setRecurrenceConfig} />
                  </div>

                  {/* Ticket tiers */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Ticket Tiers</label>
                      <button type="button" onClick={addTier} className="flex items-center gap-1 text-xs text-primary hover:underline">
                        <Plus className="h-3 w-3" /> Add Tier
                      </button>
                    </div>
                    {tiers.length === 0 && (
                      <p className="text-xs text-muted-foreground">No tiers — single-price event. Add tiers for General / VIP / VVIP pricing.</p>
                    )}
                    {tiers.map((tier, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                        <div className="space-y-1">
                          {i === 0 && <label className="text-xs text-muted-foreground">Name</label>}
                          <Input placeholder="e.g. VIP" value={tier.name} onChange={(e) => updateTier(i, 'name', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          {i === 0 && <label className="text-xs text-muted-foreground">Price (KES)</label>}
                          <Input type="number" min="0" placeholder="0" value={tier.price || ''} onChange={(e) => updateTier(i, 'price', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-1">
                          {i === 0 && <label className="text-xs text-muted-foreground">Capacity</label>}
                          <Input type="number" min="0" placeholder="0" value={tier.capacity || ''} onChange={(e) => updateTier(i, 'capacity', parseInt(e.target.value, 10) || 0)} />
                        </div>
                        <button type="button" onClick={() => removeTier(i)} className="pb-0.5 text-destructive hover:opacity-70">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
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
