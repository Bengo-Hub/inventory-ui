'use client';

import { Button } from '@/components/ui/base';
import { useEventAvailability, useIssueTicket } from '@/hooks/use-tickets';
import { Loader2, Ticket, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';

interface SellTicketModalProps {
  orgSlug: string;
  eventId: string;
  eventName: string;
  onClose: () => void;
}

// Internal (staff) ticket sale: issue tickets for walk-in / phone / desk buyers directly,
// reusing the platform ticket issuance (oversell-guarded). Mirrors the public booking but staff-driven.
export function SellTicketModal({ orgSlug, eventId, eventName, onClose }: SellTicketModalProps) {
  const { data: availability, isLoading } = useEventAvailability(orgSlug, eventId);
  const issue = useIssueTicket(orgSlug);

  const tiers = availability?.tiers ?? [];
  const [tierId, setTierId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');

  const selectedTier = useMemo(() => tiers.find((t) => t.tier_id === tierId), [tiers, tierId]);
  // Default the tier selection once availability loads.
  if (tierId === '' && tiers.length > 0) {
    setTierId(tiers[0].tier_id);
  }

  const maxQty = selectedTier ? selectedTier.remaining : availability?.remaining ?? 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!buyerName.trim()) {
      toast.error('Buyer name is required');
      return;
    }
    if (quantity < 1) {
      toast.error('Quantity must be at least 1');
      return;
    }
    if (maxQty > 0 && quantity > maxQty) {
      toast.error(`Only ${maxQty} left for this tier`);
      return;
    }
    try {
      await issue.mutateAsync({
        event_item_id: eventId,
        tier_id: selectedTier?.tier_id,
        tier_name: selectedTier?.name,
        quantity,
        unit_price: selectedTier?.price ?? 0,
        buyer_name: buyerName.trim(),
        buyer_email: buyerEmail.trim() || undefined,
      });
      toast.success(`Issued ${quantity} ticket${quantity !== 1 ? 's' : ''}`);
      onClose();
    } catch (e) {
      toast.error(await apiErrorMessage(e, 'Failed to issue ticket (sold out or capacity exceeded?)'));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md sm:rounded-2xl rounded-t-2xl bg-card border border-border shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-bold flex items-center gap-2"><Ticket className="h-4 w-4" /> Sell Tickets — {eventName}</h2>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-full bg-muted flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : tiers.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">
            This event has no ticket tiers configured. Add tiers (metadata.ticket_tiers) to sell tickets.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tier</span>
              <select
                value={tierId}
                onChange={(e) => setTierId(e.target.value)}
                className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {tiers.map((t) => (
                  <option key={t.tier_id} value={t.tier_id} disabled={t.remaining <= 0}>
                    {t.name} — {t.price.toLocaleString()} ({t.remaining} left)
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quantity</span>
              <input
                type="number" min={1} max={maxQty || undefined}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Buyer name *</span>
                <input
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Jane Doe"
                  className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Buyer email</span>
                <input
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="jane@email.com"
                  className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>

            {selectedTier && (
              <p className="text-sm text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{(selectedTier.price * quantity).toLocaleString()}</span>
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={issue.isPending}>
                {issue.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Issue Tickets'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
