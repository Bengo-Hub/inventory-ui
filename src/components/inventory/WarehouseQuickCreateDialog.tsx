'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { apiErrorMessage } from '@/lib/api/error-message';
import { useCreateWarehouse } from '@/hooks/useWarehouses';
import type { Warehouse } from '@/lib/api/warehouses';
import { X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface Props {
  orgSlug: string;
  initialName?: string;
  onClose: () => void;
  onCreated: (wh: Warehouse) => void;
}

// Minimal inline warehouse create — name + code (auto-derived) — for create-and-link from any
// form with a warehouse picker. Full configuration stays on the Warehouses page.
export function WarehouseQuickCreateDialog({ orgSlug, initialName = '', onClose, onCreated }: Props) {
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const create = useCreateWarehouse(orgSlug);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name is required'); return; }
    const derivedCode = (code.trim() || name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 12));
    create.mutate(
      { name: name.trim(), code: derivedCode, address: address.trim() || undefined },
      {
        onSuccess: (wh) => { toast.success('Warehouse created'); onCreated(wh); },
        onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to create warehouse')),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[60] w-full max-w-md mx-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Warehouse</h2>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name *</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Store" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Code</label>
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Auto-generated if blank" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Address</label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
