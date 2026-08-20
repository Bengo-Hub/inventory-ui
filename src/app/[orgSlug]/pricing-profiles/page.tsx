'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { DollarSign, Plus, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  useCreatePricingTier,
  useDeletePricingTier,
  useGenerateTierPricing,
  usePricingTiers,
  useUpdatePricingTier,
} from '@/hooks/usePricing';
import type { PricingTier } from '@/lib/api/pricing';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildPricingProfileColumns } from './pricing-profile-columns';
import { apiErrorMessage } from '@/lib/api/error-message';
import { DECIMAL_STEP, parseDecimal } from '@/lib/utils';

// PricingProfilesPage lets admins / store managers manage price tiers (e.g. Retail, Wholesale).
// Per-item prices for each profile are set from the product detail page.
export default function PricingProfilesPage() {
  const params = useParams();
  const orgSlug = params?.orgSlug as string;

  const { data: tiers, isLoading, isError, refetch } = usePricingTiers(orgSlug);
  const createTier = useCreatePricingTier(orgSlug);
  const updateTier = useUpdatePricingTier(orgSlug);
  const deleteTier = useDeletePricingTier(orgSlug);
  const generatePricing = useGenerateTierPricing(orgSlug);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PricingTier | null>(null);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);

  // Bulk price-generation dialog state.
  const [genTier, setGenTier] = useState<PricingTier | null>(null);
  const [genSource, setGenSource] = useState<'default_tier' | 'cost_margin'>('default_tier');
  const [genFactor, setGenFactor] = useState('0.9');
  const [genMargin, setGenMargin] = useState('20');
  const [genOverwrite, setGenOverwrite] = useState(false);

  function runGenerate() {
    if (!genTier) return;
    const body =
      genSource === 'default_tier'
        ? { source: 'default_tier' as const, factor: parseDecimal(genFactor), overwrite: genOverwrite }
        : { source: 'cost_margin' as const, margin_percent: parseDecimal(genMargin), overwrite: genOverwrite };
    generatePricing.mutate(
      { tierId: genTier.id, body },
      {
        onSuccess: (res) => {
          toast.success(`Generated ${res.generated} prices${res.skipped ? `, skipped ${res.skipped}` : ''}${res.clamped ? `, ${res.clamped} clamped to min/max` : ''}`);
          setGenTier(null);
        },
        onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to generate prices')),
      },
    );
  }

  const list = (tiers ?? []) as PricingTier[];
  const saving = createTier.isPending || updateTier.isPending;

  function openCreate() {
    setEditing(null);
    setFormName('');
    setFormCode('');
    setFormDescription('');
    setFormIsDefault(false);
    setDialogOpen(true);
  }

  function openEdit(t: PricingTier) {
    setEditing(t);
    setFormName(t.name);
    setFormCode(t.code ?? '');
    setFormDescription(t.description ?? '');
    setFormIsDefault(t.is_default);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Name is required');
      return;
    }
    const data = {
      name: formName.trim(),
      code: formCode.trim().toUpperCase(),
      description: formDescription.trim(),
      is_default: formIsDefault,
    };
    const cb = {
      onSuccess: () => {
        toast.success(editing ? 'Pricing profile updated' : 'Pricing profile created');
        closeDialog();
      },
      onError: async (e: unknown) => toast.error(await apiErrorMessage(e, editing ? 'Failed to update profile' : 'Failed to create profile')),
    };
    if (editing) updateTier.mutate({ id: editing.id, data }, cb);
    else createTier.mutate(data, cb);
  }

  function handleDelete(t: PricingTier) {
    if (!confirm(`Deactivate pricing profile "${t.name}"? Items priced on it fall back to the default profile.`)) return;
    deleteTier.mutate(t.id, {
      onSuccess: () => toast.success('Pricing profile deactivated'),
      onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to deactivate profile')),
    });
  }

  const columns = useMemo(
    () => buildPricingProfileColumns({
      isDeleting: deleteTier.isPending,
      onGenerate: (t) => { setGenTier(t); setGenSource(t.is_default ? 'cost_margin' : 'default_tier'); },
      onEdit: openEdit,
      onDelete: handleDelete,
    }),
    [deleteTier.isPending],
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pricing Profiles</h1>
          <p className="text-muted-foreground mt-1">
            Define price tiers (e.g. Retail, Wholesale). Set per-item prices for each profile from the product page.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Profile
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="px-2 pb-2">
            <DataTable<PricingTier>
              columns={columns}
              rows={list}
              rowKey={(t) => t.id}
              loading={isLoading}
              loadingRows={8}
              error={isError}
              onRetry={() => refetch()}
              emptyState={
                <>
                  <DollarSign className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No pricing profiles yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Add Retail / Wholesale profiles to price items per customer type</p>
                </>
              }
              storageKey="pricing-profiles-col-prefs"
            />
          </div>
        </CardContent>
      </Card>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeDialog} />
          <div className="relative z-50 w-full max-w-lg mx-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{editing ? 'Edit Pricing Profile' : 'Add Pricing Profile'}</h2>
                  <button onClick={closeDialog} className="p-1 rounded-lg hover:bg-accent transition-colors">
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Name *</label>
                      <Input placeholder="e.g. Wholesale" value={formName} onChange={(e) => setFormName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Code *</label>
                      <Input
                        placeholder="e.g. WHOLESALE"
                        value={formCode}
                        onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <textarea
                      placeholder="Optional description..."
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none resize-none"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={formIsDefault} onChange={(e) => setFormIsDefault(e.target.checked)} className="rounded" />
                    Default profile (used when no profile is selected at the till)
                  </label>
                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={closeDialog}>
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1" disabled={saving}>
                      {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Bulk price-generation dialog */}
      {genTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setGenTier(null)} />
          <div className="relative z-50 w-full max-w-lg mx-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Generate {genTier.name} prices</h2>
                  <button onClick={() => setGenTier(null)} className="p-1 rounded-lg hover:bg-accent transition-colors">
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Bulk-set every item&apos;s price for this profile. Generated prices are clamped to each item&apos;s min/max selling price.
                  </p>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Derive from</label>
                    <select
                      value={genSource}
                      onChange={(e) => setGenSource(e.target.value as 'default_tier' | 'cost_margin')}
                      className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                    >
                      <option value="default_tier">Default profile price × factor</option>
                      <option value="cost_margin">Cost price + margin</option>
                    </select>
                  </div>
                  {genSource === 'default_tier' ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Factor</label>
                      <Input type="number" min="0" step={DECIMAL_STEP} value={genFactor} onChange={(e) => setGenFactor(e.target.value)} />
                      <p className="text-xs text-muted-foreground">e.g. 0.9 = 10% below the default (Retail) price.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Margin (%)</label>
                      <Input type="number" min="0" max="99.9" step={DECIMAL_STEP} value={genMargin} onChange={(e) => setGenMargin(e.target.value)} />
                      <p className="text-xs text-muted-foreground">price = cost ÷ (1 − margin). Items without a cost price are skipped.</p>
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={genOverwrite} onChange={(e) => setGenOverwrite(e.target.checked)} className="rounded" />
                    Overwrite existing prices on this profile
                  </label>
                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setGenTier(null)}>Cancel</Button>
                    <Button type="button" className="flex-1" onClick={runGenerate} disabled={generatePricing.isPending}>
                      {generatePricing.isPending ? 'Generating...' : 'Generate'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
