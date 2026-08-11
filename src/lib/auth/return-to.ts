/**
 * Re-points a stored/query-carried `returnTo` path at the CURRENT tenant slug before it's ever
 * navigated to. `returnTo` values persist across steps of the login flow (sessionStorage across
 * the SSO hop, a `?returnTo=` query param passed callback → select-outlet → pin-login) and can
 * outlive the org context they were captured in — e.g. a stale bookmark or an earlier mistyped
 * slug baked into `returnTo` before the user landed on the correct tenant. Used verbatim, that
 * navigates the browser straight to the wrong tenant's path (404s, "unknown tenant" cascades).
 * Cross-origin values are dropped outright — never navigate to a return path outside this app.
 */
export function sanitizedReturnTo(raw: string | null | undefined, orgSlug: string): string | null {
  if (!raw) return null;
  try {
    const url = raw.startsWith('http') ? new URL(raw) : new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const segments = url.pathname.split('/');
    if (segments[1] && segments[1] !== orgSlug) segments[1] = orgSlug;
    return segments.join('/') + url.search + url.hash;
  } catch {
    return null;
  }
}
