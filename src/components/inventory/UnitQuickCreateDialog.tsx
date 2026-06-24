'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { useCreateUnit } from '@/hooks/useUnits';
import type { Unit } from '@/lib/api/units';
import { X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface Props {
  orgSlug: string;
  initialName?: string;
  onClose: () => void;
  onCreated: (unit: Unit) => void;
}

// Minimal inline unit-of-measure create (name + abbreviation) for create-and-link from item forms.
export function UnitQuickCreateDialog({ orgSlug, initialName = '', onClose, onCreated }: Props) {
  const [name, setName] = useState(initialName);
  const [abbreviation, setAbbreviation] = useState('');
  const create = useCreateUnit(orgSlug);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name is required'); return; }
    create.mutate(
      { name: name.trim(), abbreviation: (abbreviation.trim() || name.trim().slice(0, 4)).toLowerCase() },
      {
        onSuccess: (u) => { toast.success('Unit created'); onCreated(u); },
        onError: () => toast.error('Failed to create unit'),
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
              <h2 className="text-lg font-semibold">New Unit</h2>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name *</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kilogram" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Abbreviation</label>
                <Input value={abbreviation} onChange={(e) => setAbbreviation(e.target.value)} placeholder="e.g. kg (auto if blank)" />
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
