'use client';

import { Button, Card, CardContent } from '@/components/ui/base';
import { QrScanner } from '@/components/events/QrScanner';
import { ticketsApi, type Ticket } from '@/lib/api/tickets';
import { useRedeemTicket } from '@/hooks/use-tickets';
import { Camera, CheckCircle2, Keyboard, Loader2, QrCode, Search, Ticket as TicketIcon, XCircle } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';

const STATUS_STYLES: Record<string, string> = {
  issued: 'bg-green-500/10 text-green-700 dark:text-green-400',
  redeemed: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  cancelled: 'bg-muted text-muted-foreground',
  refunded: 'bg-muted text-muted-foreground',
  void: 'bg-red-500/10 text-red-700 dark:text-red-400',
};

// extractCode accepts a raw ticket code or a check-in URL (…?code=TKT-…) and returns the code.
function extractCode(text: string): string {
  try {
    const u = new URL(text);
    const c = u.searchParams.get('code');
    if (c) return c.trim().toUpperCase();
  } catch {
    /* not a URL — treat as a raw code */
  }
  return text.trim().toUpperCase();
}

export default function TicketCheckInPage() {
  const params = useParams();
  const orgSlug = params?.orgSlug as string;
  const [mode, setMode] = useState<'scan' | 'manual'>('manual');
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [looking, setLooking] = useState(false);
  const redeem = useRedeemTicket(orgSlug);

  const lookup = async (raw?: string) => {
    const c = (raw ?? code).trim().toUpperCase();
    if (!c) return;
    setLooking(true);
    try {
      const t = await ticketsApi.getByCode(orgSlug, c);
      setTicket(t);
    } catch (e) {
      setTicket(null);
      toast.error(await apiErrorMessage(e, 'Ticket not found'));
    } finally {
      setLooking(false);
    }
  };

  const checkIn = async (raw?: string) => {
    const c = (raw ?? code).trim().toUpperCase();
    if (!c) return;
    try {
      const t = await redeem.mutateAsync({ code: c });
      setTicket(t);
      toast.success('Checked in ✓');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Check-in failed';
      toast.error(msg.replace(/^.*REDEEM_FAILED[: ]*/i, '') || 'Check-in failed');
      try {
        setTicket(await ticketsApi.getByCode(orgSlug, c));
      } catch {
        /* ignore */
      }
    }
  };

  // Deep link from the QR verify URL (…/events/check-in?code=TKT-…) — auto-look up on load.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const c = new URLSearchParams(window.location.search).get('code');
    if (c) {
      const norm = c.trim().toUpperCase();
      setCode(norm);
      void lookup(norm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleScan(text: string) {
    const c = extractCode(text);
    setCode(c);
    setMode('manual');
    void lookup(c);
  }

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <QrCode className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Ticket Check-In</h1>
          <p className="text-sm text-muted-foreground">Scan a ticket QR or enter the code to verify and check in.</p>
        </div>
      </div>

      {/* Scan / Enter toggle */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-muted/50 border border-border">
        <button
          type="button"
          onClick={() => setMode('scan')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${mode === 'scan' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
        >
          <Camera className="h-4 w-4" /> Scan QR
        </button>
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${mode === 'manual' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
        >
          <Keyboard className="h-4 w-4" /> Enter code
        </button>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-5 space-y-4">
          {mode === 'scan' ? (
            <QrScanner onScan={handleScan} />
          ) : (
            <>
              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ticket code</span>
                <input
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') checkIn(); }}
                  placeholder="TKT-XXXXXXXX"
                  inputMode="text"
                  className="mt-1.5 w-full px-3 py-3 rounded-xl border border-input bg-background text-base font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => lookup()} disabled={looking || !code.trim()}>
                  {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="ml-2">Look up</span>
                </Button>
                <Button className="flex-1" onClick={() => checkIn()} disabled={redeem.isPending || !code.trim()}>
                  {redeem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  <span className="ml-2">Check In</span>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {ticket && (
        <Card>
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <TicketIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="font-mono font-bold text-foreground truncate">{ticket.code}</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize shrink-0 ${STATUS_STYLES[ticket.status] ?? 'bg-muted text-muted-foreground'}`}>
                {ticket.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {ticket.tier_name && (<><span className="text-muted-foreground">Tier</span><span className="text-right font-medium">{ticket.tier_name}</span></>)}
              <span className="text-muted-foreground">Seats</span><span className="text-right font-medium">{ticket.quantity}</span>
              {ticket.buyer_name && (<><span className="text-muted-foreground">Buyer</span><span className="text-right font-medium truncate">{ticket.buyer_name}</span></>)}
              {ticket.redeemed_at && (<><span className="text-muted-foreground">Redeemed</span><span className="text-right font-medium">{new Date(ticket.redeemed_at).toLocaleString()}</span></>)}
            </div>
            {ticket.status === 'issued' && (
              <Button className="w-full" onClick={() => checkIn(ticket.code)} disabled={redeem.isPending}>
                {redeem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                <span className="ml-2">Confirm Check-In</span>
              </Button>
            )}
            {ticket.status === 'redeemed' && (
              <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400 pt-1">
                <CheckCircle2 className="h-4 w-4" /> Valid — already checked in.
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
