'use client';

import { useCallback, useEffect, useState } from 'react';

const SSO_BASE_URL = process.env.NEXT_PUBLIC_SSO_URL || 'https://sso.codevertexitsolutions.com';

export type BiometricState = 'idle' | 'registering' | 'authenticating' | 'success' | 'error' | 'unsupported';

export interface UseBiometricOptions {
  onAuthSuccess?: (result: { accessToken: string; refreshToken: string; expiresIn: number }) => void;
  onError?: (error: string) => void;
}

export function useBiometric(options: UseBiometricOptions = {}) {
  const [state, setState] = useState<BiometricState>('idle');
  const [isSupported, setIsSupported] = useState(false);
  const [hasRegisteredCredential, setHasRegisteredCredential] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      !!window.PublicKeyCredential &&
      typeof navigator.credentials?.create === 'function';
    setIsSupported(supported);
    if (supported) {
      setHasRegisteredCredential(localStorage.getItem('pwa_biometric_registered') === 'true');
    }
  }, []);

  const authenticate = useCallback(
    async (email: string, tenantSlug?: string) => {
      if (!isSupported) { setError('Biometric login not supported on this device'); setState('error'); return null; }
      setState('authenticating');
      setError(null);
      try {
        const beginRes = await fetch(`${SSO_BASE_URL}/api/v1/auth/webauthn/authenticate/begin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        if (!beginRes.ok) {
          const body = await beginRes.json().catch(() => ({}));
          if (beginRes.status === 404) throw new Error('No biometric credentials registered.');
          throw new Error(body.message || 'Failed to begin biometric login');
        }
        const sessionKey = beginRes.headers.get('X-WebAuthn-Session') ?? '';
        const assertionOptions = await beginRes.json();
        assertionOptions.publicKey.challenge = base64URLToBuffer(assertionOptions.publicKey.challenge);
        if (assertionOptions.publicKey.allowCredentials) {
          assertionOptions.publicKey.allowCredentials = assertionOptions.publicKey.allowCredentials.map(
            (c: { id: string; type: string }) => ({ ...c, id: base64URLToBuffer(c.id) })
          );
        }
        const assertion = await navigator.credentials.get(assertionOptions) as PublicKeyCredential;
        if (!assertion) throw new Error('Biometric authentication cancelled');
        const tenantParam = tenantSlug ? `?tenant=${encodeURIComponent(tenantSlug)}` : '';
        const finishRes = await fetch(`${SSO_BASE_URL}/api/v1/auth/webauthn/authenticate/finish${tenantParam}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-WebAuthn-Session': sessionKey },
          body: JSON.stringify(credentialToJSON(assertion)),
        });
        if (!finishRes.ok) {
          const body = await finishRes.json().catch(() => ({}));
          throw new Error(body.message || 'Biometric authentication failed');
        }
        const tokens = await finishRes.json();
        setState('success');
        options.onAuthSuccess?.(tokens);
        return tokens;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication failed';
        setError(message);
        setState('error');
        options.onError?.(message);
        return null;
      }
    },
    [isSupported, options]
  );

  const reset = useCallback(() => { setState('idle'); setError(null); }, []);

  return { isSupported, hasRegisteredCredential, state, error, isLoading: state === 'authenticating', authenticate, reset };
}

function base64URLToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buffer;
}

function bufferToBase64URL(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function credentialToJSON(credential: PublicKeyCredential): Record<string, unknown> {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64URL(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64URL(response.clientDataJSON),
      authenticatorData: bufferToBase64URL(response.authenticatorData),
      signature: bufferToBase64URL(response.signature),
      userHandle: response.userHandle ? bufferToBase64URL(response.userHandle) : null,
    },
  };
}
