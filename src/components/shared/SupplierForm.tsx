'use client';

/**
 * ⚠️ SHARED COMPONENT — kept byte-for-byte in sync with
 * `@bengo-hub/shared-ui-lib` → `src/components/suppliers/supplier-form.tsx`
 * (exported as `SupplierForm` from the root + the `./suppliers` subpath).
 *
 * It lives here too (a clearly-shared path) because the shared-ui-lib is consumed by a pinned
 * GitHub tag (package.json: `github:Bengo-Hub/shared-ui-lib#v0.1.23`) and bumping that tag is a
 * separate publish cycle. The lib copy is already built + committed on the
 * `feat/supplier-form` branch; to finish the extraction:
 *   1. merge shared-ui-lib `feat/supplier-form`, tag a new release (e.g. v0.1.24), push the tag;
 *   2. bump this app's dependency to `#v0.1.24` and run `pnpm install`;
 *   3. replace this file's exports with a re-export:
 *        export { SupplierForm, type SupplierFormProps, ... } from '@bengo-hub/shared-ui-lib/suppliers';
 *      then delete the inlined implementation below.
 *
 * Until then, app code imports from here so the build stays green and unblocked.
 */

import { useState, type ReactNode } from 'react';

/**
 * Supplier/vendor master shape. The supplier MASTER is owned by inventory-api
 * (`POST /inventory/suppliers`); treasury reaches it via an S2S proxy. This form is
 * intentionally dependency-light (only React + Tailwind classNames resolved by the host)
 * and props-driven so any consumer can pass its OWN create function — inventory-ui passes
 * its apiClient-backed create; treasury-ui can later pass an S2S create. It never imports a
 * concrete apiClient, so there are NO hard inventory-ui imports.
 */
export type SupplierPaymentMethod =
  | 'mpesa'
  | 'mpesa_b2b'
  | 'bank_transfer'
  | 'cash'
  | 'cheque'
  | '';

export interface SupplierFormValues {
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_number?: string;
  tax_pin?: string;
  notes?: string;
  payment_method_type?: SupplierPaymentMethod;
  mpesa_phone?: string;
  mpesa_business_name?: string;
  bank_account_number?: string;
  bank_name?: string;
  bank_branch?: string;
  auto_pay_enabled?: boolean;
  requires_invoice_before_payment?: boolean;
  payment_terms_days?: number;
  credit_limit?: number;
}

/** Minimal created-supplier shape the form needs back for onSuccess. */
export interface CreatedSupplier {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface SupplierBankFieldRenderArgs {
  bankName: string;
  bankCode: string;
  accountNumber: string;
  onChange: (patch: { bank_name?: string; bank_code?: string; account_number?: string }) => void;
}

export interface SupplierFormProps {
  /** Seed values (edit mode, or a prefilled name from an inline "+ Add new vendor" flow). */
  initialValues?: Partial<SupplierFormValues>;
  /** When true, the form is in edit mode (button label + heading copy). */
  isEdit?: boolean;
  /**
   * Async submit. Receives the cleaned payload; should create/update the supplier and resolve
   * with the persisted record. The form awaits this and surfaces a pending state + errors.
   * Consumers wire their own transport here (inventory apiClient, treasury S2S, …).
   */
  onSubmit: (values: SupplierFormValues) => Promise<CreatedSupplier | void>;
  /** Called with the created/updated supplier after onSubmit resolves successfully. */
  onSuccess?: (supplier: CreatedSupplier | void) => void;
  /** Called when the user cancels/closes (optional — caller owns the dialog chrome). */
  onCancel?: () => void;
  /** Optional async error surface (e.g. a toast). Defaults to inline message only. */
  onError?: (message: string) => void;
  /**
   * Optional render-prop for the bank fields, letting a consumer inject a richer widget
   * (e.g. inventory-ui's Paystack account-verify). When omitted, plain bank inputs render.
   */
  renderBankFields?: (args: SupplierBankFieldRenderArgs) => ReactNode;
  /** Hide the payment-configuration section entirely (e.g. lightweight vendor capture). */
  hidePaymentConfig?: boolean;
  /** Optional extra className on the root <form>. */
  className?: string;
  /** Submit button label override. */
  submitLabel?: string;
}

const PAYMENT_METHODS: { value: SupplierPaymentMethod; label: string }[] = [
  { value: '', label: 'Not configured' },
  { value: 'mpesa', label: 'M-Pesa (Mobile)' },
  { value: 'mpesa_b2b', label: 'M-Pesa B2B (Paybill)' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
];

const inputCls =
  'w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none';
const labelCls = 'text-sm font-medium';
const sectionLabelCls =
  'text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3';

export function SupplierForm({
  initialValues,
  isEdit = false,
  onSubmit,
  onSuccess,
  onCancel,
  onError,
  renderBankFields,
  hidePaymentConfig = false,
  className = '',
  submitLabel,
}: SupplierFormProps) {
  const iv = initialValues ?? {};
  const [name, setName] = useState(iv.name ?? '');
  const [contact, setContact] = useState(iv.contact_person ?? '');
  const [email, setEmail] = useState(iv.email ?? '');
  const [phone, setPhone] = useState(iv.phone ?? '');
  const [address, setAddress] = useState(iv.address ?? '');
  const [notes, setNotes] = useState(iv.notes ?? '');
  const [taxNumber, setTaxNumber] = useState(iv.tax_number ?? '');
  const [taxPin, setTaxPin] = useState(iv.tax_pin ?? '');

  const [paymentMethod, setPaymentMethod] = useState<SupplierPaymentMethod>(
    iv.payment_method_type ?? '',
  );
  const [mpesaPhone, setMpesaPhone] = useState(iv.mpesa_phone ?? '');
  const [mpesaBusinessName, setMpesaBusinessName] = useState(iv.mpesa_business_name ?? '');
  const [bankAccount, setBankAccount] = useState(iv.bank_account_number ?? '');
  const [bankName, setBankName] = useState(iv.bank_name ?? '');
  const [bankCode, setBankCode] = useState('');
  const [bankBranch, setBankBranch] = useState(iv.bank_branch ?? '');
  const [autoPay, setAutoPay] = useState(iv.auto_pay_enabled ?? false);
  const [requiresInvoice, setRequiresInvoice] = useState(
    iv.requires_invoice_before_payment ?? false,
  );
  const [paymentTerms, setPaymentTerms] = useState(
    iv.payment_terms_days != null ? String(iv.payment_terms_days) : '',
  );
  const [creditLimit, setCreditLimit] = useState(
    iv.credit_limit != null ? String(iv.credit_limit) : '',
  );

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMpesa = paymentMethod === 'mpesa' || paymentMethod === 'mpesa_b2b';
  const isBank = paymentMethod === 'bank_transfer';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Supplier name is required');
      return;
    }
    setError(null);
    setPending(true);
    const payload: SupplierFormValues = {
      name: name.trim(),
      contact_person: contact.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
      tax_number: taxNumber.trim() || undefined,
      tax_pin: taxPin.trim() || undefined,
      payment_method_type: hidePaymentConfig ? undefined : paymentMethod || undefined,
      mpesa_phone: !hidePaymentConfig && isMpesa ? mpesaPhone.trim() || undefined : undefined,
      mpesa_business_name:
        !hidePaymentConfig && isMpesa ? mpesaBusinessName.trim() || undefined : undefined,
      bank_account_number:
        !hidePaymentConfig && isBank ? bankAccount.trim() || undefined : undefined,
      bank_name: !hidePaymentConfig && isBank ? bankName.trim() || undefined : undefined,
      bank_branch: !hidePaymentConfig && isBank ? bankBranch.trim() || undefined : undefined,
      auto_pay_enabled: !hidePaymentConfig ? autoPay || undefined : undefined,
      requires_invoice_before_payment: !hidePaymentConfig ? requiresInvoice || undefined : undefined,
      payment_terms_days: !hidePaymentConfig && paymentTerms ? Number(paymentTerms) : undefined,
      credit_limit: !hidePaymentConfig && creditLimit ? Number(creditLimit) : undefined,
    };
    try {
      const created = await onSubmit(payload);
      onSuccess?.(created);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to save supplier. Please try again.';
      setError(msg);
      onError?.(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-5 ${className}`}>
      <div>
        <p className={sectionLabelCls}>Basic Information</p>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className={labelCls}>Supplier Name *</label>
            <input
              className={inputCls}
              placeholder="e.g. Acme Supplies Ltd"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className={labelCls}>Contact Person</label>
            <input
              className={inputCls}
              placeholder="Full name"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className={labelCls}>Email</label>
              <input
                className={inputCls}
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className={labelCls}>Phone</label>
              <input
                className={inputCls}
                placeholder="+254 700 000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className={labelCls}>Tax Number (KRA PIN)</label>
              <input
                className={inputCls}
                placeholder="e.g. A000000000B"
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className={labelCls}>Tax PIN</label>
              <input
                className={inputCls}
                placeholder="Tax PIN"
                value={taxPin}
                onChange={(e) => setTaxPin(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className={labelCls}>Address</label>
            <input
              className={inputCls}
              placeholder="Physical or postal address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
        </div>
      </div>

      {!hidePaymentConfig && (
        <div className="border-t border-border pt-5">
          <p className={sectionLabelCls}>Payment Configuration</p>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className={labelCls}>Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as SupplierPaymentMethod)}
                className={inputCls}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {isMpesa && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={labelCls}>M-Pesa Phone</label>
                  <input
                    className={inputCls}
                    placeholder="254700000000"
                    value={mpesaPhone}
                    onChange={(e) => setMpesaPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelCls}>Business Name</label>
                  <input
                    className={inputCls}
                    placeholder="Paybill business name"
                    value={mpesaBusinessName}
                    onChange={(e) => setMpesaBusinessName(e.target.value)}
                  />
                </div>
              </div>
            )}

            {isBank && (
              <div className="space-y-4">
                {renderBankFields ? (
                  renderBankFields({
                    bankName,
                    bankCode,
                    accountNumber: bankAccount,
                    onChange: (patch) => {
                      if (patch.bank_name !== undefined) setBankName(patch.bank_name);
                      if (patch.bank_code !== undefined) setBankCode(patch.bank_code);
                      if (patch.account_number !== undefined) setBankAccount(patch.account_number);
                    },
                  })
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={labelCls}>Bank Name</label>
                      <input
                        className={inputCls}
                        placeholder="Bank name"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className={labelCls}>Account Number</label>
                      <input
                        className={inputCls}
                        placeholder="Account number"
                        value={bankAccount}
                        onChange={(e) => setBankAccount(e.target.value)}
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <label className={labelCls}>Branch (optional)</label>
                  <input
                    className={inputCls}
                    placeholder="Branch name"
                    value={bankBranch}
                    onChange={(e) => setBankBranch(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={labelCls}>Payment Terms (days)</label>
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  placeholder="e.g. 30"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Credit Limit</label>
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  placeholder="0"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-1">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPay}
                  onChange={(e) => setAutoPay(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">
                  Enable Auto-Pay (automatically trigger payout on PO receipt)
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresInvoice}
                  onChange={(e) => setRequiresInvoice(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Requires Invoice Before Payment</span>
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className={labelCls}>Notes</label>
        <textarea
          placeholder="Additional notes about this supplier..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={`${inputCls} resize-none`}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {pending ? 'Saving...' : submitLabel ?? (isEdit ? 'Update' : 'Create')}
        </button>
      </div>
    </form>
  );
}
