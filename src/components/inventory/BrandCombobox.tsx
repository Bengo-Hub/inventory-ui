'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { normalizeName } from '@/hooks/useDuplicateNameWarning';
import { useBrands, useCreateBrand, type Brand } from '@/hooks/useBrands';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';
import { SearchableCombobox } from '@bengo-hub/shared-ui-lib/combobox';

interface Props {
  orgSlug: string;
  /** Selected brand id (ItemBrand uuid). Empty string = no brand. */
  value: string;
  onChange: (brandId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Brand picker for the GOODS item form: the shared SearchableCombobox over the
 * tenant's ItemBrand master with a "+ New brand" footer opening an inline create
 * dialog. Emits the selected brand id (items reference a brand via brand_id).
 * Mirrors CategoryCombobox / the Category & Unit CreatableSelect pickers.
 */
export function BrandCombobox({ orgSlug, value, onChange, placeholder = 'Select a brand…', disabled }: Props) {
  const { data: brands } = useBrands(orgSlug);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <SearchableCombobox
        options={(brands ?? []).map((b) => ({
          value: b.id,
          label: b.name,
          hint: b.code || undefined,
        }))}
        value={value}
        onChange={(id) => onChange(id)}
        placeholder={placeholder}
        searchPlaceholder="Search brands…"
        emptyText="No matching brands."
        disabled={disabled}
        clearable
        footer={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-muted/60"
          >
            <Plus className="h-4 w-4" /> New brand
          </button>
        }
      />
      {addOpen && (
        <AddBrandDialog
          orgSlug={orgSlug}
          initialName=""
          brands={brands ?? []}
          onClose={() => setAddOpen(false)}
          onCreated={(brand) => { setAddOpen(false); onChange(brand.id); }}
        />
      )}
    </>
  );
}

// ── Inline create-brand dialog (mirrors AddCategoryDialog) ───────────────────────

export function AddBrandDialog({
  orgSlug, initialName, brands, onClose, onCreated,
}: {
  orgSlug:     string;
  initialName: string;
  brands:      { id: string; name: string }[];
  onClose:     () => void;
  onCreated:   (brand: Brand) => void;
}) {
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const createMut = useCreateBrand(orgSlug);

  // Case-insensitive duplicate guard using the already-loaded list — no round-trip.
  const normalizedName = normalizeName(name);
  const isDuplicate = normalizedName.length > 0 && brands.some((b) => normalizeName(b.name) === normalizedName);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (isDuplicate) {
      toast.error(`A brand named "${name.trim()}" already exists`);
      return;
    }
    createMut.mutate(
      { name: name.trim(), code: code.trim() || undefined, description: description.trim() || undefined },
      {
        onSuccess: (brand) => { toast.success('Brand created'); onCreated(brand); },
        onError: async (err) => toast.error(await apiErrorMessage(err, 'Failed to create brand')),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[61] mx-4 w-full max-w-lg">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Brand</h2>
              <button onClick={onClose} type="button" className="rounded-lg p-1 hover:bg-accent transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name *</label>
                  <Input placeholder="e.g. HP" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
                  {isDuplicate && (
                    <p className="text-xs text-destructive">A brand named &quot;{name.trim()}&quot; already exists.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Code</label>
                  <Input placeholder="Auto from name" value={code} onChange={(e) => setCode(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  placeholder="Optional description…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={createMut.isPending || isDuplicate}>
                  {createMut.isPending ? 'Saving…' : 'Create'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
