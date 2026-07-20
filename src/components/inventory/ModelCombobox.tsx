'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { normalizeName } from '@/hooks/useDuplicateNameWarning';
import { apiClient } from '@/lib/api/client';
import { type Item } from '@/lib/api/items';
import { useQuery } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { SearchableCombobox } from '@bengo-hub/shared-ui-lib/combobox';

interface Props {
  orgSlug: string;
  /** Selected model string (free text; items store model per-item, no master). */
  value: string;
  onChange: (model: string) => void;
  /** When set, model suggestions are narrowed to this brand's existing goods (brand-aware). */
  brandId?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Model picker for the GOODS item form: the shared SearchableCombobox over the models
 * already used on the tenant's goods (brand-aware — narrowed to the selected brand when
 * one is chosen) with a "+ New model" footer opening an inline create dialog. Models are
 * per-item free text (no Model master, so no new schema/migration) — creating one simply
 * selects the typed string. Mirrors BrandCombobox / the Category & Unit pickers.
 */
export function ModelCombobox({ orgSlug, value, onChange, brandId, placeholder = 'Select a model…', disabled }: Props) {
  const { data: models } = useItemModels(orgSlug, brandId);
  const [addOpen, setAddOpen] = useState(false);

  // Distinct suggestions plus the current value (so a free-typed / just-created model still
  // renders as the selected label even when it isn't among the tenant's existing goods).
  const options = Array.from(new Set([...(models ?? []), ...(value ? [value] : [])]))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .map((m) => ({ value: m, label: m }));

  return (
    <>
      <SearchableCombobox
        options={options}
        value={value}
        onChange={(m) => onChange(m)}
        placeholder={placeholder}
        searchPlaceholder="Search models…"
        emptyText="No matching models — add one below."
        disabled={disabled}
        clearable
        footer={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-muted/60"
          >
            <Plus className="h-4 w-4" /> New model
          </button>
        }
      />
      {addOpen && (
        <AddModelDialog
          initialName=""
          models={models ?? []}
          onClose={() => setAddOpen(false)}
          onCreated={(name) => { setAddOpen(false); onChange(name); }}
        />
      )}
    </>
  );
}

// Distinct model strings across the tenant's GOODS items — feeds the Model combobox. When a
// brand is selected the suggestions are narrowed to that brand's goods (a model belongs to a
// brand). There is no Model master, so this reuses the items list; free entry stays allowed.
export function useItemModels(orgSlug: string, brandId?: string) {
  return useQuery<string[]>({
    queryKey: ['item-models', orgSlug, brandId ?? 'all'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Item[] } | Item[]>(
        `/api/v1/${orgSlug}/inventory/items`,
        { type: 'GOODS', limit: 200 },
      );
      const rows = Array.isArray(res) ? res : (res as { data: Item[] }).data ?? [];
      const scoped = brandId ? rows.filter((i) => i.brand_id === brandId) : rows;
      return Array.from(new Set(scoped.map((i) => (i.model ?? '').trim()).filter(Boolean))).sort();
    },
    enabled: !!orgSlug,
    placeholderData: [],
    staleTime: 120_000,
  });
}

// ── Inline create-model dialog (mirrors AddBrandDialog) ──────────────────────────
// Models are per-item free text; "creating" one just picks the typed string for this item.

export function AddModelDialog({
  initialName, models, onClose, onCreated,
}: {
  initialName: string;
  models:      string[];
  onClose:     () => void;
  onCreated:   (name: string) => void;
}) {
  const [name, setName] = useState(initialName);

  // Case-insensitive duplicate hint against the already-loaded suggestions — a soft nudge, not
  // a hard block (picking the existing model is fine; free text is always allowed).
  const normalizedName = normalizeName(name);
  const isDuplicate = normalizedName.length > 0 && models.some((m) => normalizeName(m) === normalizedName);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Model is required');
      return;
    }
    onCreated(name.trim());
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[61] mx-4 w-full max-w-md">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Model</h2>
              <button onClick={onClose} type="button" className="rounded-lg p-1 hover:bg-accent transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Model *</label>
                <Input placeholder="e.g. HP 840 8/256" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
                {isDuplicate && (
                  <p className="text-xs text-muted-foreground">&quot;{name.trim()}&quot; is already used — you can reuse it.</p>
                )}
                <p className="text-xs text-muted-foreground">
                  The exact product variant. Units of the same model share brand, name and specs but each carry
                  their own serial number.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                <Button type="submit" className="flex-1">Use model</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
