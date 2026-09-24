import { formatCurrency } from '@bengo-hub/shared-ui-lib';
import type { Supplier } from '@/lib/api/suppliers';
import type { SelectOption } from '@/components/inventory/CreatableSelect';

/** Signed AP balance from treasury (positive = we owe the supplier), or null when treasury has
 *  no AP record for this supplier yet. */
export function supplierBalance(s: Pick<Supplier, 'balance_owed'>): number | null {
  if (s.balance_owed == null || s.balance_owed === '') return null;
  const n = parseFloat(s.balance_owed);
  return Number.isFinite(n) ? n : null;
}

/** "Owed KES 4,500" / "Credit KES 200" / "Owed KES 0", or undefined when unknown. */
export function supplierBalanceLabel(s: Pick<Supplier, 'balance_owed' | 'balance_currency'>): string | undefined {
  const n = supplierBalance(s);
  if (n == null) return undefined;
  const cur = s.balance_currency || 'KES';
  if (n < -0.0001) return `Credit ${formatCurrency(-n, cur)}`;
  return `Owed ${formatCurrency(Math.max(n, 0), cur)}`;
}

/** The one supplier → picker-option mapping used by every supplier picker, so the amount owed
 *  shows on every row whether it came from the prefetched page or a remote search. */
export function supplierOption(s: Supplier): SelectOption {
  const hint = [supplierBalanceLabel(s), s.contact_person || s.phone].filter(Boolean).join(' · ');
  return { id: s.id, name: s.name, hint: hint || undefined };
}
