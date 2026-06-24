'use client';

import { Plus } from 'lucide-react';

export interface SelectOption {
  id: string;
  name: string;
}

interface Props {
  value: string;
  onChange: (id: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Opens the parent-owned create dialog. When omitted, the "+" button is hidden. */
  onAddClick?: () => void;
  addLabel?: string;
}

const selectCls =
  'w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none';

// CreatableSelect is a native <select> paired with an inline "+" button to create-and-link a
// missing option. The create dialog itself is owned by the parent (decoupled, like CategoryCombobox)
// so each entity keeps its own form; this component only standardises the select + add affordance.
export function CreatableSelect({ value, onChange, options, placeholder = 'Select...', required, disabled, onAddClick, addLabel = 'Add new' }: Props) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectCls}
        required={required}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      {onAddClick && (
        <button
          type="button"
          onClick={onAddClick}
          disabled={disabled}
          aria-label={addLabel}
          title={addLabel}
          className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-input text-primary hover:bg-accent disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
