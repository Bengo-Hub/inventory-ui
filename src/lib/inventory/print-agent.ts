/**
 * Local print-agent client for direct USB label printing.
 *
 * inventory-ui doesn't run its own print-agent — it reuses the SAME loopback agent pos-ui already
 * talks to (`pos-service/pos-api/cmd/print-agent`, a small Windows-service companion the operator
 * runs on the till/terminal). The agent already exposes generic, CORS-open routes that aren't
 * POS-specific (`/health`, `/printers`, `/print`), so no agent-side change was needed to reuse it
 * here — see `inventory-api/docs/barcode-labels.md`'s "Direct USB printing" section and
 * `pos-service/pos-ui/src/lib/pos/printer-discovery.ts` for the original implementation this
 * mirrors (a minimal subset: no QZ Tray/WebUSB/Bluetooth/network-scan, none of which apply here).
 *
 * `/print` writes the given bytes straight through the Windows spooler in RAW datatype — this
 * bypasses GDI page-size/orientation negotiation entirely, which is what makes this the reliable
 * way to print TSPL/ZPL bytes correctly (vs. downloading a file and printing it via a viewer's
 * print dialog, which is what produced the rotated-label bug this feature fixes).
 */

const AGENT_PORT =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_PRINT_AGENT_PORT) || '9330';
export const AGENT_BASE = `http://127.0.0.1:${AGENT_PORT}`;

/** Is the local print-agent running on this machine? (UI hint before offering direct-print.) */
export async function agentAvailable(): Promise<boolean> {
  return (await getAgentInfo()).reachable;
}

export interface AgentInfo {
  reachable: boolean;
  version?: string;
}

/** Same loopback probe as agentAvailable(), but also surfaces the agent's version (from its
 *  /health response) for a "Agent running vX.Y.Z" status pill in Settings. */
export async function getAgentInfo(): Promise<AgentInfo> {
  if (typeof window === 'undefined') return { reachable: false };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${AGENT_BASE}/health`, { signal: ctrl.signal, mode: 'cors' });
    clearTimeout(t);
    if (!res.ok) return { reachable: false };
    const body = (await res.json().catch(() => ({}))) as { version?: string };
    return { reachable: true, version: body.version };
  } catch {
    return { reachable: false };
  }
}

/** List printers installed in Windows on this machine (via the agent's OS-spooler enumeration). */
export async function listLocalPrinters(): Promise<string[]> {
  if (typeof window === 'undefined') return [];
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${AGENT_BASE}/printers`, { signal: ctrl.signal, mode: 'cors' });
    clearTimeout(t);
    if (!res.ok) return [];
    const body = (await res.json()) as { printers?: string[] };
    return body.printers ?? [];
  } catch {
    return [];
  }
}

/** Send raw bytes (hex-encoded) to a locally-installed printer by name via the agent's OS-spooler
 *  RAW-datatype path. Returns true on success. */
export async function printRawToLocalName(name: string, hex: string): Promise<boolean> {
  try {
    const res = await fetch(`${AGENT_BASE}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, format: 'rawhex', data: hex }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Convert a Blob (e.g. the TSPL/ZPL bytes returned by barcodeApi.printLabels) to a hex string
 *  suitable for printRawToLocalName — byte-safe, unlike a naive UTF-8 string cast. */
export async function blobToHex(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}
