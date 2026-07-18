'use client';

import { Plus } from 'lucide-react';
import { SearchableCombobox } from '@bengo-hub/shared-ui-lib/combobox';

export interface SelectOption {
  id: string;
  name: string;
  /** Optional secondary text on the row (sku, abbreviation, type…). */
  hint?: string;
}

interface Props {
  value: string;
  onChange: (id: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Opens the parent-owned create dialog. When omitted, the add action is hidden. */
  onAddClick?: () => void;
  addLabel?: string;
}

// CreatableSelect is inventory-ui's entity picker: the shared SearchableCombobox
// (type-to-filter over the prefetched list) plus an "+ Add new" footer action that
// opens the parent-owned create dialog — each entity keeps its own form, this
// component only standardises the pick + add affordance. (Formerly a native
// <select>; the shared combobox replaced it so long category/unit/supplier lists
// are searchable everywhere.)
export function CreatableSelect({ value, onChange, options, placeholder = 'Select...', required, disabled, onAddClick, addLabel = 'Add new' }: Props) {
  return (
    <div className="relative">
      <SearchableCombobox
        options={options.map((o) => ({ value: o.id, label: o.name, hint: o.hint }))}
        value={value}
        onChange={(v) => onChange(v)}
        placeholder={placeholder}
        disabled={disabled}
        clearable={!required}
        footer={
          onAddClick ? (
            <button
              type="button"
              onClick={onAddClick}
              disabled={disabled}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-muted/60 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> {addLabel}
            </button>
          ) : undefined
        }
      />
      {/* Participates in native form validation the way the old <select required> did. */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={value}
          onChange={() => {}}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        />
      )}
    </div>
  );
}
