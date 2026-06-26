'use client';

/**
 * BankVerifyFields — bank dropdown + account number + Verify (auto-fills the account holder name)
 * backed by inventory-api's bank proxy → treasury S2S Paystack. Reuse on every bank form so
 * account numbers are verified before saving.
 */

import { Button, Input } from '@/components/ui/base';
import { banksApi, type BankOption } from '@/lib/api/banks';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface Props {
  orgSlug: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  onChange: (patch: { bank_name?: string; bank_code?: string; account_number?: string; account_name?: string }) => void;
  country?: string;
}

const selectClass = 'w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none';

export function BankVerifyFields({ orgSlug, bankName, bankCode, accountNumber, onChange, country = 'kenya' }: Props) {
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingBanks(true);
    banksApi
      .list(orgSlug, country)
      .then((res) => {
        if (cancelled) return;
        const arr = (res.banks as BankOption[]) ?? (res.data as BankOption[]) ?? [];
        setBanks(arr ?? []);
      })
      .catch(() => !cancelled && setBanks([]))
      .finally(() => !cancelled && setLoadingBanks(false));
    return () => {
      cancelled = true;
    };
  }, [orgSlug, country]);

  const selected = useMemo(() => banks.find((b) => b.code === bankCode), [banks, bankCode]);
  // Keep the chosen bank label in sync if the dropdown loads after a saved code.
  useEffect(() => {
    if (selected && selected.name !== bankName) onChange({ bank_name: selected.name });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  async function verify() {
    setNote(null);
    setVerified(false);
    setVerifying(true);
    try {
      const res = await banksApi.resolve(orgSlug, accountNumber, bankCode);
      const payload = (res.data as Record<string, unknown>) ?? res;
      if (payload?.resolvable === false || !payload?.account_name) {
        setNote((payload?.message as string) || 'Could not auto-verify — check the details.');
        return;
      }
      setAccountName(payload.account_name as string);
      setVerified(true);
      onChange({ account_name: payload.account_name as string });
    } catch {
      setNote('Verification failed — check the bank and account number.');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Bank</label>
        {loadingBanks ? (
          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading banks…
          </div>
        ) : (
          <select
            className={selectClass}
            value={bankCode}
            onChange={(e) => {
              const b = banks.find((x) => x.code === e.target.value);
              setVerified(false);
              setNote(null);
              onChange({ bank_code: e.target.value, bank_name: b?.name ?? '' });
            }}
          >
            <option value="">Select bank…</option>
            {banks.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Account Number</label>
        <div className="flex gap-2">
          <Input
            className="flex-1"
            placeholder="Bank account number"
            value={accountNumber}
            onChange={(e) => {
              setVerified(false);
              setNote(null);
              onChange({ account_number: e.target.value });
            }}
          />
          <Button type="button" variant="outline" disabled={!bankCode || !accountNumber || verifying} onClick={verify}>
            {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
          </Button>
        </div>
        {note && <p className="text-xs text-amber-600">{note}</p>}
        {verified && (
          <p className="flex items-center gap-1 text-xs font-medium text-green-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> {accountName}
          </p>
        )}
      </div>
    </div>
  );
}
