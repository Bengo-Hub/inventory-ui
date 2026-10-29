'use client';

// Variants block of the item form and the "Variant of" notice shared with the item detail
// page. Whether the block shows at all is decided by the caller through
// CatalogScope.showVariants (lib/use-case-nomenclature.ts).

import { VariantMatrixEditor } from '@/components/inventory/VariantMatrixEditor';
import { useItemById, useItemVariants } from '@/hooks/useItems';
import { usePermissions, P } from '@/hooks/usePermissions';
import type { Item } from '@/lib/api/items';
import { axesFromMetadata, axesFromVariants, comboLabel } from '@/lib/inventory/variant-matrix';
import Link from 'next/link';

/** "Variant of <parent>" with a link, for an item that is itself a variant. */
export function VariantOfNotice({ orgSlug, item }: { orgSlug: string; item: Item }) {
  const { data: parent } = useItemById(orgSlug, item.variant_of);
  if (!item.variant_of) return null;
  const attrs = item.variant_attributes ?? {};
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
      Variant of{' '}
      <Link href={`/${orgSlug}/catalog/${item.variant_of}`} className="font-medium text-primary hover:underline">
        {parent?.name ?? 'the parent product'}
      </Link>
      {Object.keys(attrs).length > 0 && <span className="text-muted-foreground"> ({comboLabel(attrs)})</span>}
      <span className="block text-xs text-muted-foreground mt-0.5">
        Sizes and colours are managed on the parent product.
      </span>
    </div>
  );
}

/** Matrix editor for a parent (or plain) item; a new item is told to save first. Callers show
 *  VariantOfNotice instead for an item that is itself a variant. */
export function ItemVariantsSection({ orgSlug, item }: { orgSlug: string; item?: Item | null }) {
  const { can } = usePermissions();
  const { data: existing, isLoading, isError } = useItemVariants(orgSlug, item?.id);

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div>
        <h3 className="text-sm font-semibold">Sizes and colours</h3>
        <p className="text-xs text-muted-foreground">
          Sell this product in several sizes, colours or other options. Saved separately from the
          form above with its own Save button.
        </p>
      </div>
      {!item ? (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border px-3 py-2">
          Create the product first. Its sizes and colours can be added here when you edit it.
        </p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading variants...</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Could not load the variants of this product.</p>
      ) : (
        <VariantMatrixEditor
          key={item.id}
          orgSlug={orgSlug}
          parent={item}
          existing={existing ?? []}
          savedAxes={(() => {
            const fromMeta = axesFromMetadata(item.metadata);
            return Object.keys(fromMeta).length > 0 ? fromMeta : axesFromVariants(existing ?? []);
          })()}
          canEdit={can(P.VARIANTS_CHANGE)}
        />
      )}
    </div>
  );
}
