'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { useCategories } from '@/hooks/useCategories';
import { normalizeName } from '@/hooks/useDuplicateNameWarning';
import { categoriesApi, type Category } from '@/lib/api/categories';
import { useOutletStore } from '@/store/outlet';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';
import { SearchableCombobox } from '@bengo-hub/shared-ui-lib/combobox';

interface Props {
  orgSlug:      string;
  value:        string;              // selected category name (composite API matches by name)
  onChange:     (name: string) => void;
  placeholder?: string;
}

/**
 * Rich category picker: the shared SearchableCombobox over existing categories
 * with a "+ New category" footer opening the standard create-category form.
 * Emits the selected category NAME (the menu-item composite endpoint
 * resolves/creates by name; names are unique per tenant).
 */
export function CategoryCombobox({ orgSlug, value, onChange, placeholder = 'Select a category…' }: Props) {
  const { data: categories } = useCategories(orgSlug);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <SearchableCombobox
        options={(categories ?? []).map((c) => ({
          value: c.name,
          label: c.name,
          hint: c.code || undefined,
          description: c.parent_name ? `${c.parent_name} ›` : undefined,
        }))}
        value={value}
        onChange={(name) => onChange(name)}
        placeholder={placeholder}
        searchPlaceholder="Search categories…"
        emptyText="No matching categories."
        footer={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-muted/60"
          >
            <Plus className="h-4 w-4" /> New category
          </button>
        }
      />
      {addOpen && (
        <AddCategoryDialog
          orgSlug={orgSlug}
          initialName=""
          categories={categories ?? []}
          onClose={() => setAddOpen(false)}
          onCreated={(cat) => { setAddOpen(false); onChange(cat.name); }}
        />
      )}
    </>
  );
}

// ── Inline create-category dialog (mirrors the Categories page form) ─────────────

export function AddCategoryDialog({
  orgSlug, initialName, categories, onClose, onCreated,
}: {
  orgSlug:     string;
  initialName: string;
  // Only id/name are needed here (the parent picker + duplicate check) — a narrower
  // shape than the full Category lets callers pass a lighter-weight local list.
  categories:  { id: string; name: string }[];
  onClose:     () => void;
  onCreated:   (cat: Category) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState('');
  const [parentId, setParentId] = useState('');
  const [description, setDescription] = useState('');
  // Stamp the creating outlet's use_case so a hospitality category never pollutes
  // a pharmacy outlet's pickers. HQ (no outlet) creates universal categories.
  const outletUseCase = useOutletStore((st) => st.outlet?.use_case);

  // Real duplicate prevention (not just a soft warning) — case-insensitive, no
  // network round-trip since the category list is already loaded by the parent.
  const normalizedName = normalizeName(name);
  const isDuplicate = normalizedName.length > 0 && categories.some((c) => normalizeName(c.name) === normalizedName);

  const mutation = useMutation({
    mutationFn: () =>
      categoriesApi.create(orgSlug, {
        name: name.trim(),
        code: code.trim() || undefined,
        description: description.trim() || undefined,
        parent_id: parentId || null,
        use_cases: outletUseCase ? [outletUseCase] : undefined,
      }),
    onSuccess: (cat) => {
      toast.success('Category created');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      onCreated(cat);
    },
    onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to create category')),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (isDuplicate) {
      toast.error(`A category named "${name.trim()}" already exists`);
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[61] mx-4 w-full max-w-lg">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Category</h2>
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
                  <Input placeholder="e.g. Main Dishes" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
                  {isDuplicate && (
                    <p className="text-xs text-destructive">A category named &quot;{name.trim()}&quot; already exists.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Code</label>
                  <Input placeholder="e.g. MAIN" value={code} onChange={(e) => setCode(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Parent Category</label>
                <SearchableCombobox
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                  value={parentId}
                  onChange={(id) => setParentId(id)}
                  placeholder="None (root category)"
                  searchPlaceholder="Search categories…"
                />
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
                <Button type="submit" className="flex-1" disabled={mutation.isPending || isDuplicate}>
                  {mutation.isPending ? 'Saving…' : 'Create'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
