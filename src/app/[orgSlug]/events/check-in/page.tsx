'use client';

import { Button, Card, CardContent } from '@/components/ui/base';
import { ticketsApi, type Ticket } from '@/lib/api/tickets';
import { useRedeemTicket } from '@/hooks/use-tickets';
import { CheckCircle2, Loader2, QrCode, Search, Ticket as TicketIcon, XCircle } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

const STATUS_STYLES: Record<string, string> = {
  issued: 'bg-green-500/10 text-green-700 dark:text-green-400',
  redeemed: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  cancelled: 'bg-muted text-muted-foreground',
  refunded: 'bg-muted text-muted-foreground',
  void: 'bg-red-500/10 text-red-700 dark:text-red-400',
};

export default function TicketCheckInPage() {
  const params = useParams();
  const orgSlug = params?.orgSlug as string;
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [looking, setLooking] = useState(false);
  const redeem = useRedeemTicket(orgSlug);

  async function lookup() {
    const c = code.trim();
    if (!c) return;
    setLooking(true);
    try {
      const t = await ticketsApi.getByCode(orgSlug, c);
      setTicket(t);
    } catch {
      setTicket(null);
      toast.error('Ticket not found');
    } finally {
      setLooking(false);
    }
  }

  async function checkIn() {
    const c = code.trim();
    if (!c) return;
    try {
      const t = await redeem.mutateAsync({ code: c });
      setTicket(t);
      toast.success('Checked in ✓');
    } catch (e) {
      // Surface the backend reason (already redeemed, expired, etc.) and refresh the ticket view.
      const msg = e instanceof Error ? e.message : 'Check-in failed';
      toast.error(msg.replace(/^.*REDEEM_FAILED[: ]*/i, '') || 'Check-in failed');
      try {
        setTicket(await ticketsApi.getByCode(orgSlug, c));
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <QrCode className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ticket Check-In</h1>
          <p className="text-sm text-muted-foreground">Scan or enter a ticket code to verify and check in.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ticket code</span>
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') checkIn(); }}
              placeholder="TKT-XXXXXXXX"
              className="mt-1.5 w-full px-3 py-3 rounded-xl border border-input bg-background text-base font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={lookup} disabled={looking || !code.trim()}>
              {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Look up</span>
            </Button>
            <Button className="flex-1" onClick={checkIn} disabled={redeem.isPending || !code.trim()}>
              {redeem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              <span className="ml-2">Check In</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {ticket && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TicketIcon className="h-5 w-5 text-muted-foreground" />
                <span className="font-mono font-bold text-foreground">{ticket.code}</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[ticket.status] ?? 'bg-muted text-muted-foreground'}`}>
                {ticket.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {ticket.tier_name && (<><span className="text-muted-foreground">Tier</span><span className="text-right font-medium">{ticket.tier_name}</span></>)}
              <span className="text-muted-foreground">Seats</span><span className="text-right font-medium">{ticket.quantity}</span>
              {ticket.buyer_name && (<><span className="text-muted-foreground">Buyer</span><span className="text-right font-medium">{ticket.buyer_name}</span></>)}
              {ticket.redeemed_at && (<><span className="text-muted-foreground">Redeemed</span><span className="text-right font-medium">{new Date(ticket.redeemed_at).toLocaleString()}</span></>)}
            </div>
            {ticket.status === 'redeemed' && (
              <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400 pt-1">
                <CheckCircle2 className="h-4 w-4" /> Valid — checked in.
              </div>
            )}
            {(ticket.status === 'cancelled' || ticket.status === 'void' || ticket.status === 'refunded') && (
              <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400 pt-1">
                <XCircle className="h-4 w-4" /> This ticket is {ticket.status} and cannot be used.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
