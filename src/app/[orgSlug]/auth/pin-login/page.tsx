'use client';

import { BrandedAuthShell } from '@/components/auth/branded-auth-shell';
import { IdleScreensaver } from '@/components/idle-screensaver';
import { apiErrorMessage } from '@/lib/api/error-message';
import { pinApi, type PinOutlet } from '@/lib/api/pin';
import { useAuthStore } from '@/store/auth';
import { useOutletStore } from '@/store/outlet';
import { Delete, Loader2, LogIn, Store } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

const PIN_LENGTH = 4;

function PinLoginContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const orgSlug = params?.orgSlug as string;
  const returnTo = searchParams?.get('returnTo') || undefined;

  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrateFromWebAuthn);
  const redirectToSSO = useAuthStore((s) => s.redirectToSSO);
  const setOutlet = useOutletStore((s) => s.setOutlet);

  const [outlets, setOutlets] = useState<PinOutlet[]>([]);
  const [outlet, setSelectedOutlet] = useState<PinOutlet | null>(null);
  const [step, setStep] = useState<'outlet' | 'pin'>('pin');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const forwarded = useRef(false);

  // Already authenticated → forward to the outlet gate (or returnTo).
  useEffect(() => {
    if (status === 'authenticated' && !forwarded.current) {
      forwarded.current = true;
      router.replace(returnTo || `/${orgSlug}`);
    }
  }, [status, orgSlug, returnTo, router]);

  // Load outlets; auto-select the sole outlet, else show the picker.
  useEffect(() => {
    let cancelled = false;
    pinApi.outlets(orgSlug).then((list) => {
      if (cancelled) return;
      setOutlets(list);
      if (list.length === 1) {
        setSelectedOutlet(list[0]);
        setStep('pin');
      } else if (list.length > 1) {
        setStep('outlet');
      } else {
        setStep('pin'); // no outlets configured → PIN without an outlet
      }
    }).catch(() => { /* PIN still works without an outlet list */ });
    return () => { cancelled = true; };
  }, [orgSlug]);

  const submitPin = useCallback(async (value: string) => {
    setSubmitting(true);
    setError('');
    try {
      const res = await pinApi.identify(orgSlug, value, outlet?.id);
      await hydrate({ accessToken: res.access_token, refreshToken: '', expiresIn: res.expires_in }, orgSlug);
      // Set the working outlet from the response (or the picked one).
      const oid = res.outlet_id ?? outlet?.id;
      if (oid) {
        setOutlet({
          id: oid,
          code: outlet?.code ?? '',
          name: res.outlet_name ?? outlet?.name ?? '',
          use_case: res.outlet_use_case ?? outlet?.use_case,
          is_hq: !!res.is_admin,
        });
      }
      router.replace(returnTo || `/${orgSlug}`);
    } catch (e) {
      setError(await apiErrorMessage(e, 'Incorrect PIN'));
      setPin('');
      setSubmitting(false);
    }
  }, [orgSlug, outlet, hydrate, setOutlet, router, returnTo]);

  function pushDigit(d: string) {
    if (submitting || pin.length >= PIN_LENGTH) return;
    const next = pin + d;
    setPin(next);
    if (next.length === PIN_LENGTH) void submitPin(next);
  }

  const startSSO = async () => {
    setSsoLoading(true);
    try {
      const dest = returnTo ? `${window.location.origin}${returnTo}` : `${window.location.origin}/${orgSlug}`;
      await redirectToSSO(orgSlug, dest);
    } catch { setSsoLoading(false); }
  };

  // ── Outlet picker step ──────────────────────────────────────────────────────
  if (step === 'outlet') {
    return (
      <BrandedAuthShell title="Choose your outlet" subtitle="Select where you're working, then enter your PIN">
        <div className="space-y-2">
          {outlets.map((o) => (
            <button
              key={o.id}
              onClick={() => { setSelectedOutlet(o); setStep('pin'); }}
              className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left hover:border-primary hover:bg-accent active:scale-[0.99] transition-all"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Store className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-foreground truncate">{o.name}</span>
                {o.is_default && <span className="text-xs text-muted-foreground">Default outlet</span>}
              </span>
            </button>
          ))}
          <button onClick={startSSO} className="w-full pt-2 text-center text-xs text-muted-foreground underline underline-offset-2">
            Sign in with your account (SSO) instead
          </button>
        </div>
      </BrandedAuthShell>
    );
  }

  // ── PIN entry step ──────────────────────────────────────────────────────────
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return (
    <>
      <IdleScreensaver />
      <BrandedAuthShell
        title="Enter your PIN"
        subtitle={outlet ? outlet.name : 'Access your warehouse & inventory workspace'}
        footer={
          <button onClick={startSSO} disabled={ssoLoading} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            {ssoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
            Sign in with your account (SSO)
          </button>
        }
      >
        <div className="space-y-6">
          {/* Masked dots */}
          <div className="flex items-center justify-center gap-3 h-8">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <span
                key={i}
                className={`h-3.5 w-3.5 rounded-full transition-all ${i < pin.length ? 'bg-primary scale-110' : 'bg-muted-foreground/25'}`}
              />
            ))}
          </div>

          {error && <p className="text-center text-sm text-destructive">{error}</p>}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-3">
            {keys.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => pushDigit(k)}
                disabled={submitting}
                className="h-16 rounded-2xl border border-border bg-card text-2xl font-bold text-foreground hover:bg-accent active:scale-95 transition-all disabled:opacity-50"
              >
                {k}
              </button>
            ))}
            {outlets.length > 1 ? (
              <button
                type="button"
                onClick={() => { setPin(''); setError(''); setStep('outlet'); }}
                className="h-16 rounded-2xl text-xs font-semibold text-muted-foreground hover:bg-accent active:scale-95 transition-all"
              >
                Change outlet
              </button>
            ) : <div />}
            <button
              type="button"
              onClick={() => pushDigit('0')}
              disabled={submitting}
              className="h-16 rounded-2xl border border-border bg-card text-2xl font-bold text-foreground hover:bg-accent active:scale-95 transition-all disabled:opacity-50"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => { setPin((p) => p.slice(0, -1)); setError(''); }}
              disabled={submitting || pin.length === 0}
              aria-label="Backspace"
              className="h-16 rounded-2xl flex items-center justify-center text-muted-foreground hover:bg-accent active:scale-95 transition-all disabled:opacity-40"
            >
              {submitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <Delete className="h-6 w-6" />}
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Ask an admin to set your PIN under Team if you don&apos;t have one yet.
          </p>
        </div>
      </BrandedAuthShell>
    </>
  );
}

export default function PinLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <PinLoginContent />
    </Suspense>
  );
}
