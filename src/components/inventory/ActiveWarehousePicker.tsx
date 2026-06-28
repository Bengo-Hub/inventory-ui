'use client';

import { CreatableSelect } from '@/components/inventory/CreatableSelect';
import { type UseActiveWarehouseResult } from '@/hooks/useActiveWarehouse';
import { AlertCircle } from 'lucide-react';

interface Props {
  /** The result of useActiveWarehouse(orgSlug). */
  active: UseActiveWarehouseResult;
  label?: string;
  required?: boolean;
  /** Opens an inline create-and-link warehouse dialog (optional). */
  onAddNew?: () => void;
  className?: string;
}

// Shared warehouse picker for WRITE forms. Defaults to the active outlet's warehouse and, when
// "All Outlets" is selected, shows an inline prompt requiring an explicit pick before submit.
// Pairs with useActiveWarehouse — callers gate submit on `active.unresolved`.
export function ActiveWarehousePicker({ active, label = 'Warehouse', required, onAddNew, className }: Props) {
  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <label className="text-sm font-medium">
        {label}
        {required ? ' *' : ''}
        {active.scopedOutletName && !active.mustPick && (
          <span className="text-muted-foreground font-normal"> · {active.scopedOutletName}</span>
        )}
      </label>
      <CreatableSelect
        value={active.warehouseId}
        onChange={active.setWarehouseId}
        options={active.options.map((w) => ({
          id: w.id,
          name: w.is_default ? `${w.name} (default)` : w.name,
        }))}
        placeholder={active.mustPick ? 'Select a warehouse…' : 'Select warehouse…'}
        required={required}
        onAddClick={onAddNew}
        addLabel="Add warehouse"
      />
      {active.unresolved ? (
        <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            “All Outlets” is selected. Choose the warehouse this entry posts to before submitting
            {active.scopedOutletName ? ` (defaulted to ${active.scopedOutletName}).` : '.'}
          </span>
        </p>
      ) : active.mustPick ? (
        <p className="text-xs text-muted-foreground">
          Posting to the selected warehouse. Change it if this entry belongs to another outlet.
        </p>
      ) : null}
    </div>
  );
}
