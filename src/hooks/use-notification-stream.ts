'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

// Stream against the API host (matches REST), not the UI host.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://inventoryapi.codevertexafrica.com';

// stock_changed is pushed by inventory-api the instant a stock level changes (POS sale
// consumption, manual adjustment, stock-take) — see inventory-api's
// internal/modules/consumers/stock_notify_events.go. Payload is a thin invalidation nudge only.
export type NotificationStreamMessage =
  | { type: 'stock_changed'; payload: { tenant_id: string; item_id?: string; sku?: string } }
  | { type: 'ping' | 'pong'; payload?: { ts: number } };

interface UseNotificationStreamOptions {
  tenantID: string;
  onMessage?: (msg: NotificationStreamMessage) => void;
}

const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 30_000;
const PING_INTERVAL_MS = 25_000;

/**
 * Connects to inventory-api's real-time push WebSocket:
 *   GET /api/v1/{tenant}/inventory/notifications/stream?access_token={token}
 *
 * On stock_changed: invalidates the stock list query so a POS sale (or any other stock
 * mutation) shows up live instead of only on a manual page refresh. Falls back gracefully
 * (silently, with reconnect backoff) if the socket is unavailable — the existing 30s staleTime
 * polling-free reads still work, just without the live push.
 */
export function useNotificationStream({ tenantID, onMessage }: UseNotificationStreamOptions) {
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptRef = useRef(0);
  const unmountedRef = useRef(false);

  const connect = useCallback(() => {
    if (unmountedRef.current || !tenantID) return;
    if (typeof WebSocket === 'undefined') return;

    // https→wss, http→ws. Auth header can't be set on a browser WS, so the access token rides
    // as a query param (inventory-api promotes it server-side, same as pos-api's equivalent).
    const wsBase = API_BASE.replace(/^http/, 'ws');
    const params = new URLSearchParams();
    const token = apiClient.getAccessToken();
    if (token) params.set('access_token', token);
    const qs = params.toString();
    const url = `${wsBase}/api/v1/${tenantID}/inventory/notifications/stream${qs ? `?${qs}` : ''}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;
      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      let msg: NotificationStreamMessage;
      try {
        msg = JSON.parse(event.data as string) as NotificationStreamMessage;
      } catch {
        return;
      }

      if (msg.type === 'stock_changed') {
        qc.invalidateQueries({ queryKey: ['stock'] });
      }

      onMessage?.(msg);
    };

    ws.onerror = () => {
      // onclose handles reconnect
    };

    ws.onclose = () => {
      if (pingTimer.current) clearInterval(pingTimer.current);
      if (unmountedRef.current) return;
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** attemptRef.current, RECONNECT_MAX_MS);
      attemptRef.current += 1;
      reconnectTimer.current = setTimeout(connect, delay);
    };
  }, [tenantID, onMessage, qc]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (pingTimer.current) clearInterval(pingTimer.current);
      wsRef.current?.close(1000, 'component unmounted');
    };
  }, [connect]);
}
