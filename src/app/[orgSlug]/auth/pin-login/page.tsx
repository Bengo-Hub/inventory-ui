'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ExternalLink, KeyRound, Store, UserRound } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { apiErrorMessage } from '@/lib/api/error-message';
import { pinApi, type PinOutlet } from '@/lib/api/pin';
import { useAuthStore } from '@/store/auth';
import { useOutletStore } from '@/store/outlet';
import { useBranding } from '@/providers/branding-provider';
import { LoginHero } from '@/components/inventory/pin/LoginHero';
import { OutletCard } from '@/components/inventory/pin/OutletCard';
import { PinKeypad } from '@/components/inventory/pin/PinKeypad';
import { QwertyKeyboard } from '@/components/inventory/pin/QwertyKeyboard';

const PIN_LENGTH = 4; // numeric PINs auto-submit at 4; alphanumeric PINs submit via Enter/Login

/**
 * PIN login — the DEFAULT warehouse/desk landing, adapting the library PIN design (brand hero
 * band, outlet cards, masked passcode on the hero curve, numeric keypad + QWERTY). Flow: pick an
 * outlet (auto-selected when there's only one) → enter a PIN. PIN-first identify resolves the staff
 * member at that outlet (outlet scoping enforced server-side); the terminal JWT is used like SSO.
 */
function PinLoginContent() {
  const orgSlug = useParams()?.orgSlug as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams?.get('returnTo') || undefined;
  const { tenant } = useBranding();
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrateFromWebAuthn);
  const redirectToSSO = useAuthStore((s) => s.redirectToSSO);
  const setOutlet = useOutletStore((s) => s.setOutlet);

  const [outlets, setOutlets] = useState<PinOutlet[]>([]);
  const [outlet, setSelectedOutlet] = useState<PinOutlet | null>(null);
  const [loadingOutlets, setLoadingOutlets] = useState(true);
  const [pinDigits, setPinDigits] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [keyboard, setKeyboard] = useState<'numeric' | 'qwerty'>('numeric');
  const [shift, setShift] = useState(false);
  const [forwarded, setForwarded] = useState(false);

  useEffect(() => {
    pinApi.outlets(orgSlug)
      .then((os) => { setOutlets(os); if (os.length === 1) setSelectedOutlet(os[0]); })
      .catch(() => setOutlets([]))
      .finally(() => setLoadingOutlets(false));
  }, [orgSlug]);

  // Already authenticated → forward.
  useEffect(() => {
    if (status === 'authenticated' && !forwarded) {
      setForwarded(true);
      router.replace(returnTo || `/${orgSlug}`);
    }
  }, [status, forwarded, orgSlug, returnTo, router]);

  const heading = useMemo(() => (tenant as { orgName?: string })?.orgName ?? tenant?.name ?? 'Inventory', [tenant]);
  const initials = ((tenant as { orgName?: string })?.orgName ?? tenant?.name ?? orgSlug ?? 'IN').slice(0, 2).toUpperCase();

  async function submitPin(pin: string) {
    if (submitting) return;
    setSubmitting(true);
    setError(false);
    try {
      const res = await pinApi.identify(orgSlug, pin, outlet?.id);
      await hydrate({ accessToken: res.access_token, refreshToken: '', expiresIn: res.expires_in }, orgSlug);
      const oid = res.outlet_id ?? outlet?.id;
      if (oid) {
        apiClient.setOutletID(oid);
        setOutlet({ id: oid, code: outlet?.code ?? '', name: res.outlet_name ?? outlet?.name ?? '', use_case: res.outlet_use_case ?? outlet?.use_case, is_hq: !!res.is_admin });
      }
      toast.success(`Welcome, ${res.name || 'staff'}`);
      router.replace(returnTo || `/${orgSlug}`);
    } catch (e) {
      setError(true);
      setShake(true);
      setTimeout(() => { setShake(false); setPinDigits([]); setSubmitting(false); }, 500);
      toast.error(await apiErrorMessage(e, 'Incorrect PIN for this outlet'));
    }
  }

  function handleDigit(d: string) {
    if (submitting) return;
    setError(false);
    const next = [...pinDigits, d].slice(0, PIN_LENGTH);
    setPinDigits(next);
    if (next.length === PIN_LENGTH) void submitPin(next.join(''));
  }
  function handleKey(char: string) { if (submitting) return; setError(false); setPinDigits((d) => [...d, char]); }
  function backspace() { setError(false); setPinDigits((d) => d.slice(0, -1)); }
  function clear() { setError(false); setPinDigits([]); }
  function submitCurrent() { if (pinDigits.length > 0) void submitPin(pinDigits.join('')); }

  const goSSO = () => redirectToSSO(orgSlug, returnTo ? `${window.location.origin}${returnTo}` : `${window.location.origin}/${orgSlug}`);

  return (
    <div className="relative min-h-dvh flex flex-col bg-background">
      <LoginHero
        eyebrow="Inventory System"
        heading={heading}
        subline={outlet ? outlet.name : (outlets.length > 1 ? 'Select your outlet to sign in' : 'Access your warehouse & inventory workspace')}
        logoUrl={tenant?.logoUrl}
        fallbackInitials={initials}
        isHQ={outlet?.is_default}
        showSwitchOutlet={!!outlet && outlets.length > 1}
        onSwitchOutlet={() => { setSelectedOutlet(null); setPinDigits([]); setError(false); }}
        passcode={outlet || outlets.length === 0 ? {
          length: pinDigits.length,
          error,
          shake,
          isSubmitting: submitting,
          onSubmit: () => pinDigits.length > 0 && submitPin(pinDigits.join('')),
        } : undefined}
      />

      <div className="relative z-10 flex-1 flex items-start justify-center px-4 sm:px-6 pt-4 pb-10 overflow-y-auto">
        {outlets.length > 1 && !outlet ? (
          // ── Outlet selection step ──
          <div className="w-full max-w-2xl">
            {loadingOutlets ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-muted/60 animate-pulse" />)}
              </div>
            ) : (
              <div className={outlets.length <= 2 ? 'grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'}>
                {outlets.map((o, i) => <OutletCard key={o.id} outlet={o} index={i} onSelect={() => { setSelectedOutlet(o); setError(false); }} />)}
              </div>
            )}
            <SSOLink onClick={goSSO} />
          </div>
        ) : (
          // ── PIN entry step ── responsive: single keyboard (<lg) · SSO-left / QWERTY-center / keypad-right (lg+)
          <>
            {/* SMALL SCREENS */}
            <div className="w-full max-w-md lg:hidden rounded-3xl bg-card border border-border shadow-xl shadow-black/5 p-5 sm:p-6">
              <div className="flex flex-col gap-4">
                <KbdLabel text={keyboard === 'numeric' ? 'Enter PIN' : 'Enter passcode'} />
                {keyboard === 'numeric' ? (
                  <PinKeypad onDigit={handleDigit} onBackspace={backspace} onClear={clear} onToggleQwerty={() => setKeyboard('qwerty')} disabled={submitting} isSubmitting={submitting} />
                ) : (
                  <QwertyKeyboard onKey={handleKey} onBackspace={backspace} onEnter={submitCurrent} shift={shift} onToggleShift={() => setShift((s) => !s)} onToggleNumeric={() => setKeyboard('numeric')} disabled={submitting} />
                )}
                <SSOLink onClick={goSSO} />
              </div>
            </div>

            {/* LARGE SCREENS — 3-zone */}
            <div className="hidden lg:flex w-full max-w-6xl rounded-3xl bg-card border border-border shadow-xl shadow-black/5 p-6 flex-col gap-4">
              <div className="flex items-stretch gap-5">
                <div className="w-44 shrink-0">
                  <button
                    onClick={goSSO}
                    className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-2xl py-5 text-white font-bold shadow-md ring-1 ring-inset ring-white/15 active:scale-[0.98] transition-all"
                    style={{ background: 'linear-gradient(160deg, hsl(var(--primary)) 0%, hsl(var(--primary-dark)) 100%)' }}
                  >
                    <span className="h-12 w-12 rounded-2xl bg-white/20 ring-1 ring-inset ring-white/25 flex items-center justify-center"><UserRound className="h-6 w-6" /></span>
                    <span className="text-sm">SSO Login</span>
                  </button>
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-3 rounded-2xl bg-accent/30 border border-border p-4">
                  <KbdLabel text="Enter passcode" />
                  <QwertyKeyboard onKey={handleKey} onBackspace={backspace} onEnter={submitCurrent} shift={shift} onToggleShift={() => setShift((s) => !s)} disabled={submitting} />
                </div>
                <div className="w-64 shrink-0 flex flex-col gap-3 rounded-2xl bg-accent/30 border border-border p-4">
                  <KbdLabel text="Enter PIN" />
                  <PinKeypad onDigit={handleDigit} onBackspace={backspace} onClear={clear} disabled={submitting} isSubmitting={submitting} />
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground">Ask an admin to set your PIN under Team if you don&apos;t have one yet.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SSOLink({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="mt-3 mx-auto flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
      <ExternalLink className="h-3.5 w-3.5" /> Sign in with your account (SSO)
    </button>
  );
}

function KbdLabel({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 text-muted-foreground">
      <KeyRound className="h-3.5 w-3.5" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">{text}</span>
    </div>
  );
}

export default function PinLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center bg-background"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <PinLoginContent />
    </Suspense>
  );
}
