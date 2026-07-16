'use client';

import { etimsApi } from '@/lib/api/etims';
import { useQuery } from '@tanstack/react-query';

interface Props {
  orgSlug: string;
  /** KRA code-list type: ITEM_CLS, PKG_UNIT, QTY_UNIT. */
  codeType: string;
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  /** Server-side search (for the large ITEM_CLS list). */
  search?: string;
  className?: string;
}

const inputCls =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * EtimsCodeSelect — a select fed by the KRA eTIMS code lists (proxied from treasury).
 * When the list is empty (tenant hasn't synced KRA code lists yet) it degrades to a
 * free-text input with a hint, so the field is never a dead end.
 */
export function EtimsCodeSelect({ orgSlug, codeType, value, onChange, placeholder, search, className }: Props) {
  const { data: codes } = useQuery({
    queryKey: ['etims-codes', orgSlug, codeType, search ?? ''],
    queryFn: () => etimsApi.codeLists(orgSlug, codeType, search, 300),
    enabled: !!orgSlug,
    placeholderData: [],
    staleTime: 600_000,
  });

  const list = codes ?? [];
  if (list.length === 0) {
    return (
      <div className={className}>
        <input
          className={inputCls}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder={placeholder}
        />
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          Sync KRA code lists in Treasury (eTIMS Devices → Refresh Code Lists) to pick from the full list.
        </p>
      </div>
    );
  }

  // Keep an unknown current value selectable so an existing item never loses its code.
  const hasValue = value !== '' && list.some((c) => c.code === value);
  return (
    <select className={`${inputCls} ${className ?? ''}`} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder ?? 'None (use defaults)'}</option>
      {!hasValue && value !== '' && <option value={value}>{value} (current)</option>}
      {list.map((c) => (
        <option key={`${c.code_type}:${c.code}`} value={c.code}>
          {c.code} — {c.name}
        </option>
      ))}
    </select>
  );
}
