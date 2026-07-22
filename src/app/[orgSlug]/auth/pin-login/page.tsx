'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { KeyRound, LayoutDashboard, Store } from 'lucide-react';
import {
  PinLoginLayout, PinLoginHeader, PinLoginBrandPanel, PasscodeField, PinKeypad, QwertyKeyboard,
  OutletCard, PinLoginSSOButton,
} from '@bengo-hub/shared-ui-lib/pin-login';
import { apiClient } from '@/lib/api/client';
import { apiErrorMessage } from '@/lib/api/error-message';
import { pinApi, type PinOutlet } from '@/lib/api/pin';
import { useAuthStore } from '@/store/auth';
import { useOutletStore } from '@/store/outlet';
import { useBranding } from '@/providers/branding-provider';
import { cn } from '@/lib/utils';

const PIN_LENGTH = 4; // numeric PINs auto-submit at 4; alphanumeric PINs submit via Enter/Login

const WORKFLOW_STEPS = [
  { icon: Store, label: 'Select outlet' },
  { icon: KeyRound, label: 'Enter PIN' },
  { icon: LayoutDashboard, label: 'Start work' },
];

/**
 * PIN login — the DEFAULT warehouse/desk landing, on the shared platform PIN-login shell
 * (@bengo-hub/shared-ui-lib/pin-login). Flow: pick an outlet (auto-selected when there's only
 * one) → enter a PIN. PIN-first identify resolves the staff member at that outlet (outlet scoping
 * enforced server-side); the terminal JWT is used like SSO.
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

  const tenantDisplayName = useMemo(() => (tenant as { orgName?: string })?.orgName ?? tenant?.name ?? 'Inventory', [tenant]);

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

  // ── Physical-keyboard support ──────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter') { e.preventDefault(); submitCurrent(); return; }
      if (e.key === 'Backspace') { e.preventDefault(); backspace(); return; }
      if (e.key === 'Escape') { clear(); return; }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const numericSoFar = pinDigits.every((c) => /^[0-9]$/.test(c));
        if (numericSoFar) handleDigit(e.key); else handleKey(e.key);
        return;
      }
      if (e.key.length === 1) { e.preventDefault(); handleKey(e.key); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const goSSO = () => redirectToSSO(orgSlug, returnTo ? `${window.location.origin}${returnTo}` : `${window.location.origin}/${orgSlug}`);

  const header = (
    <PinLoginHeader
      serviceName="Codevertex Inventory"
      tenantName={tenantDisplayName}
      outletName={outlet ? outlet.name : (outlets.length > 1 ? 'Select your outlet to sign in' : undefined)}
      isHQ={outlet?.is_default}
      showSwitchOutlet={!!outlet && outlets.length > 1}
      onSwitchOutlet={() => { setSelectedOutlet(null); setPinDigits([]); setError(false); }}
      isOnline
    />
  );
  const brandPanel = (
    <PinLoginBrandPanel tenantName={tenantDisplayName} tenantLogoUrl={tenant?.logoUrl} workflowSteps={WORKFLOW_STEPS} />
  );

  if (outlets.length > 1 && !outlet) {
    return (
      <PinLoginLayout
        header={header}
        brandPanel={brandPanel}
        card={
          <div className="flex-1 min-h-0 flex flex-col p-3 sm:p-6 overflow-y-auto">
            {loadingOutlets ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-muted/60 animate-pulse" />)}
              </div>
            ) : (
              <div className={outlets.length <= 2 ? 'grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'}>
                {outlets.map((o, i) => (
                  <OutletCard key={o.id} outlet={{ ...o, is_hq: o.is_default }} index={i} onSelect={() => { setSelectedOutlet(o); setError(false); }} />
                ))}
              </div>
            )}
            <div className="w-full max-w-xs mx-auto mt-6">
              <PinLoginSSOButton onClick={goSSO} />
            </div>
          </div>
        }
      />
    );
  }

  return (
    <PinLoginLayout
      header={header}
      brandPanel={brandPanel}
      card={
        <div className="flex-1 min-h-0 flex flex-col gap-3 p-3 sm:p-6">
          <PasscodeField
            value={pinDigits.join('')}
            error={error}
            shake={shake}
            onSubmit={submitCurrent}
            isSubmitting={submitting}
          />

          {/* ── SMALL SCREENS (< lg) ── */}
          <div className="flex-1 min-h-0 flex flex-col gap-4 lg:hidden overflow-y-auto">
            <PinLoginSSOButton onClick={goSSO} />
            <div className="flex flex-col gap-3 rounded-2xl bg-muted/40 border border-border p-2.5 sm:p-4">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                  {keyboard === 'numeric' ? 'Enter PIN' : 'Enter passcode'}
                </span>
              </div>
              {keyboard === 'numeric' ? (
                <div className="mx-auto w-full max-w-xs">
                  <PinKeypad onDigit={handleDigit} onBackspace={backspace} onClear={clear} onToggleQwerty={() => setKeyboard('qwerty')} disabled={submitting} isSubmitting={submitting} digitsLength={pinDigits.length} pinLength={PIN_LENGTH} />
                </div>
              ) : (
                <QwertyKeyboard onKey={handleKey} onBackspace={backspace} onEnter={submitCurrent} shift={shift} onToggleShift={() => setShift((s) => !s)} onToggleNumeric={() => setKeyboard('numeric')} disabled={submitting} />
              )}
            </div>
          </div>

          {/* ── LARGE SCREENS (lg+) — 3-zone ── */}
          <div className="hidden lg:flex flex-1 min-h-0 items-stretch gap-5">
            <div className="w-44 shrink-0 flex flex-col">
              <PinLoginSSOButton onClick={goSSO} tall />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-3 rounded-2xl bg-muted/40 border border-border p-4">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Enter passcode</span>
              </div>
              <QwertyKeyboard onKey={handleKey} onBackspace={backspace} onEnter={submitCurrent} shift={shift} onToggleShift={() => setShift((s) => !s)} disabled={submitting} showToggle={false} />
            </div>
            <div className="w-64 shrink-0 flex flex-col gap-3 rounded-2xl bg-muted/40 border border-border p-4">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Enter PIN</span>
              </div>
              <PinKeypad onDigit={handleDigit} onBackspace={backspace} onClear={clear} disabled={submitting} isSubmitting={submitting} digitsLength={pinDigits.length} pinLength={PIN_LENGTH} showToggle={false} />
            </div>
          </div>
          <p className="hidden lg:block text-center text-xs text-muted-foreground">Ask an admin to set your PIN under Team if you don&apos;t have one yet.</p>
        </div>
      }
    />
  );
}

export default function PinLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center bg-background"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <PinLoginContent />
    </Suspense>
  );
}
