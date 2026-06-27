'use client';

import { BrandedAuthShell } from '@/components/auth/branded-auth-shell';
import { IdleScreensaver } from '@/components/idle-screensaver';
import { useAuthStore } from '@/store/auth';
import { Fingerprint, Loader2, LogIn } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

function LoginContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const orgSlug = params?.orgSlug as string;
  const returnTo = searchParams?.get('returnTo') || undefined;

  const status = useAuthStore((s) => s.status);
  const redirectToSSO = useAuthStore((s) => s.redirectToSSO);
  const [submitting, setSubmitting] = useState(false);
  const [lastEmail, setLastEmail] = useState<string | null>(null);
  const forwarded = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setLastEmail(localStorage.getItem('sso_last_email'));
    }
  }, []);

  // Already authenticated → forward to the outlet-selection gate (or returnTo).
  useEffect(() => {
    if (status === 'authenticated' && !forwarded.current) {
      forwarded.current = true;
      const next = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
      router.replace(`/${orgSlug}/auth/select-outlet${next}`);
    }
  }, [status, orgSlug, returnTo, router]);

  const startSSO = async () => {
    setSubmitting(true);
    try {
      const dest = returnTo
        ? `${window.location.origin}${returnTo}`
        : `${window.location.origin}/${orgSlug}`;
      await redirectToSSO(orgSlug, dest);
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <>
      <IdleScreensaver />
      <BrandedAuthShell
        title="Sign in"
        subtitle="Access your warehouse & inventory workspace"
        footer={
          <p className="text-xs text-muted-foreground">
            Staff sign in with their organization account, then choose the outlet they&apos;re
            working in.
          </p>
        }
      >
        <div className="space-y-4">
          <button
            type="button"
            onClick={startSSO}
            disabled={submitting || status === 'loading'}
            className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-primary text-primary-foreground py-3.5 text-sm font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-60"
          >
            {submitting || status === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {submitting || status === 'loading' ? 'Redirecting…' : 'Continue with Single Sign-On'}
          </button>

          {lastEmail && (
            <p className="text-center text-xs text-muted-foreground">
              Last signed in as <span className="font-semibold text-foreground">{lastEmail}</span>
            </p>
          )}

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70 justify-center pt-1">
            <Fingerprint className="h-3.5 w-3.5" />
            Biometric sign-in is available after your first SSO login on this device.
          </div>
        </div>
      </BrandedAuthShell>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
