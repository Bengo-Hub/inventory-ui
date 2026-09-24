'use client';

import { useSupplier } from '@/hooks/useSuppliers';
import { supplierBalance, supplierBalanceLabel } from '@/lib/supplier-balance';

/** One-line readout of what's currently owed to the picked supplier (from treasury AP), shown
 *  under a supplier picker. Renders nothing until a supplier is picked or when treasury has no
 *  AP record for it. */
export function SupplierBalanceNote({ orgSlug, supplierId }: { orgSlug: string; supplierId: string }) {
  const { data } = useSupplier(orgSlug, supplierId);
  if (!supplierId || !data) return null;
  const label = supplierBalanceLabel(data);
  if (!label) return null;
  const n = supplierBalance(data) ?? 0;
  const tone = n > 0.0001 ? 'text-amber-600' : n < -0.0001 ? 'text-emerald-600' : 'text-muted-foreground';
  return <p className={`text-xs font-medium ${tone}`}>Current balance with this supplier: {label}</p>;
}
