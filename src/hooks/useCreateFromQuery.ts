'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Opens a page's create flow when the URL carries `?create=<value>` — used by the mobile
 * quick-add sheet to trigger a create dialog on the destination page. The param is stripped
 * once handled so a refresh or back-navigation doesn't reopen the dialog.
 *
 * Reads window.location.search (not useSearchParams) so pages need no extra Suspense boundary.
 *
 * @param open  callback that opens the create dialog
 * @param match value(s) that should trigger it; `true` matches any non-empty value
 */
export function useCreateFromQuery(open: () => void, match: string | string[] | true = true) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const v = params.get('create');
    if (!v) return;
    const ok = match === true ? true : Array.isArray(match) ? match.includes(v) : match === v;
    if (!ok) return;

    fired.current = true;
    open();

    params.delete('create');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // Run once on mount — quick-add navigations land as a fresh mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
