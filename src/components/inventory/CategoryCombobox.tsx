'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { useCategories } from '@/hooks/useCategories';
import { normalizeName } from '@/hooks/useDuplicateNameWarning';
import { categoriesApi, type Category } from '@/lib/api/categories';
import { useOutletStore } from '@/store/outlet';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';

interface Props {
  orgSlug:      string;
  value:        string;              // selected category name (composite API matches by name)
  onChange:     (name: string) => void;
  placeholder?: string;
}

/**
 * Rich category picker: searchable dropdown over existing categories with an
 * inline "+" action that opens the standard create-category form. Emits the
 * selected category name (the menu-item composite endpoint resolves/creates by name).
 */
export function CategoryCombobox({ orgSlug, value, onChange, placeholder = 'Select a category…' }: Props) {
  const { data: categories } = useCategories(orgSlug);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const list = categories ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.code ?? '').toLowerCase().includes(q),
    );
  }, [categories, query]);

  function select(name: string) {
    onChange(name);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 min-w-0" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <span className={`truncate ${value ? 'text-foreground' : 'text-muted-foreground'}`}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-xl">
            <div className="relative border-b border-border p-2">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search categories…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {value && (
                <button
                  type="button"
                  onClick={() => select('')}
                  className="w-full px-4 py-2 text-left text-xs text-muted-foreground hover:bg-accent"
                >
                  Clear selection
                </button>
              )}
              {filtered.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">No matching categories.</div>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => select(c.name)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span className="truncate">
                      {c.parent_name ? <span className="text-muted-foreground">{c.parent_name} › </span> : null}
                      {c.name}
                    </span>
                    {value === c.name && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={() => { setOpen(false); setAddOpen(true); }}
              className="flex w-full items-center gap-1.5 border-t border-border px-4 py-2.5 text-sm text-primary hover:bg-accent"
            >
              <Plus className="h-4 w-4" />
              {query.trim() ? `Create "${query.trim()}"` : 'New category'}
            </button>
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0"
        aria-label="Add category"
        onClick={() => setAddOpen(true)}
      >
        <Plus className="h-4 w-4" />
      </Button>

      {addOpen && (
        <AddCategoryDialog
          orgSlug={orgSlug}
          initialName={query.trim()}
          categories={categories ?? []}
          onClose={() => setAddOpen(false)}
          onCreated={(cat) => { setAddOpen(false); select(cat.name); }}
        />
      )}
    </div>
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
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                >
                  <option value="">None (root category)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
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
