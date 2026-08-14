'use client';

// Shared item-row editor (search item → set quantity, add/remove rows) used by both the New
// Transfer dialog and the Edit Transfer dialog in page.tsx / edit-transfer-dialog.tsx — kept in
// one place so a draft's amended quantities go through the exact same picker/validation UX a
// brand-new transfer does.

import { Button, Input } from '@/components/ui/base';
import { ItemSearchInput } from '@/components/inventory/ItemSearchInput';
import { Plus, X } from 'lucide-react';
import { DECIMAL_STEP } from '@/lib/utils';

export interface TransferItemRow {
  itemId: string;
  itemName: string;
  quantity: string;
  availableQty?: number;
}

export interface TransferItemsEditorProps {
  orgSlug: string;
  /** Scopes the item search + "available in source warehouse" hint. */
  sourceWarehouseId: string;
  items: TransferItemRow[];
  onChange: (items: TransferItemRow[]) => void;
}

export function TransferItemsEditor({ orgSlug, sourceWarehouseId, items, onChange }: TransferItemsEditorProps) {
  function addItem() {
    onChange([...items, { itemId: '', itemName: '', quantity: '' }]);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: 'itemId' | 'itemName' | 'quantity', value: string) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">Items *</label>
          <p className="text-xs text-muted-foreground mt-0.5">Search and select items to transfer, then enter quantities</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={addItem}>
          <Plus className="h-3 w-3 mr-1" />
          Add Item
        </Button>
      </div>
      {items.map((item, idx) => (
        <div key={idx} className="space-y-1">
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <ItemSearchInput
                orgSlug={orgSlug}
                value={item.itemName}
                placeholder="Search item by name or SKU..."
                fixedDropdown
                warehouseId={sourceWarehouseId}
                onSelect={(found) => {
                  const updated = [...items];
                  updated[idx] = {
                    ...updated[idx],
                    itemId: found.id,
                    itemName: found.name,
                    availableQty: found.available,
                  };
                  onChange(updated);
                }}
              />
            </div>
            <div className="space-y-2 w-28 shrink-0">
              <label className="text-sm font-medium">Qty</label>
              <Input
                type="number"
                placeholder="0"
                min="0"
                step={DECIMAL_STEP}
                value={item.quantity}
                onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
              />
            </div>
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="p-1 rounded hover:bg-accent text-muted-foreground mt-7"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {item.availableQty !== undefined && (
            <p className="text-xs text-muted-foreground pl-1">
              Available in source warehouse: <span className="font-semibold text-foreground">{item.availableQty.toLocaleString()}</span>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
