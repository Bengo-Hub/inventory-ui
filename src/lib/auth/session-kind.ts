/** Issuer inventory-api stamps on PIN/terminal JWTs (terminal_jwt.go's terminalIssuer). */
const TERMINAL_ISSUER = 'inventory-terminal';

/**
 * True when the access token is a shared-desk PIN session rather than a personal SSO/biometric
 * account session. Only terminal sessions should be locked on idle: a personal session has no
 * "next staff member" to hand over to. Reads the unverified JWT payload — this is a UX decision,
 * not a security check (the API still validates every token).
 */
export function isTerminalSession(accessToken: string | null | undefined): boolean {
  if (!accessToken) return false;
  try {
    const part = accessToken.split('.')[1];
    if (!part) return false;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
    return (JSON.parse(json) as { iss?: string }).iss === TERMINAL_ISSUER;
  } catch {
    return false;
  }
}
