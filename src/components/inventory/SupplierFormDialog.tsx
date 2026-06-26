'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { BankVerifyFields } from '@/components/inventory/BankVerifyFields';
import { type Supplier, type CreateSupplierInput, type PaymentMethodType } from '@/lib/api/suppliers';
import { X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';

interface Props {
    editing: Supplier | null;
    isPending: boolean;
    onSubmit: (data: CreateSupplierInput) => void;
    onClose: () => void;
}

const PAYMENT_METHODS: { value: PaymentMethodType; label: string }[] = [
    { value: '', label: 'Not configured' },
    { value: 'mpesa', label: 'M-Pesa (Mobile)' },
    { value: 'mpesa_b2b', label: 'M-Pesa B2B (Paybill)' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'cash', label: 'Cash' },
    { value: 'cheque', label: 'Cheque' },
];

export function SupplierFormDialog({ editing, isPending, onSubmit, onClose }: Props) {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [formName, setFormName] = useState(editing?.name ?? '');
    const [formContact, setFormContact] = useState(editing?.contact_person ?? '');
    const [formEmail, setFormEmail] = useState(editing?.email ?? '');
    const [formPhone, setFormPhone] = useState(editing?.phone ?? '');
    const [formAddress, setFormAddress] = useState(editing?.address ?? '');
    const [formNotes, setFormNotes] = useState(editing?.notes ?? '');
    const [formTaxNumber, setFormTaxNumber] = useState(editing?.tax_number ?? '');

    const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>(editing?.payment_method_type ?? '');
    const [mpesaPhone, setMpesaPhone] = useState(editing?.mpesa_phone ?? '');
    const [mpesaBusinessName, setMpesaBusinessName] = useState(editing?.mpesa_business_name ?? '');
    const [bankAccount, setBankAccount] = useState(editing?.bank_account_number ?? '');
    const [bankName, setBankName] = useState(editing?.bank_name ?? '');
    const [bankCode, setBankCode] = useState('');
    const [bankBranch, setBankBranch] = useState(editing?.bank_branch ?? '');
    const [taxPin, setTaxPin] = useState(editing?.tax_pin ?? '');
    const [autoPay, setAutoPay] = useState(editing?.auto_pay_enabled ?? false);
    const [requiresInvoice, setRequiresInvoice] = useState(editing?.requires_invoice_before_payment ?? false);
    const [paymentTerms, setPaymentTerms] = useState(String(editing?.payment_terms_days ?? ''));
    const [creditLimit, setCreditLimit] = useState(String(editing?.credit_limit ?? ''));

    const isMpesa = paymentMethod === 'mpesa' || paymentMethod === 'mpesa_b2b';
    const isBank = paymentMethod === 'bank_transfer';

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formName.trim()) return;

        onSubmit({
            name: formName.trim(),
            contact_person: formContact.trim() || undefined,
            email: formEmail.trim() || undefined,
            phone: formPhone.trim() || undefined,
            address: formAddress.trim() || undefined,
            notes: formNotes.trim() || undefined,
            tax_number: formTaxNumber.trim() || undefined,
            payment_method_type: paymentMethod || undefined,
            mpesa_phone: isMpesa ? mpesaPhone.trim() || undefined : undefined,
            mpesa_business_name: isMpesa ? mpesaBusinessName.trim() || undefined : undefined,
            bank_account_number: isBank ? bankAccount.trim() || undefined : undefined,
            bank_name: isBank ? bankName.trim() || undefined : undefined,
            bank_branch: isBank ? bankBranch.trim() || undefined : undefined,
            tax_pin: taxPin.trim() || undefined,
            auto_pay_enabled: autoPay || undefined,
            requires_invoice_before_payment: requiresInvoice || undefined,
            payment_terms_days: paymentTerms ? Number(paymentTerms) : undefined,
            credit_limit: creditLimit ? Number(creditLimit) : undefined,
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-50 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">
                                {editing ? 'Edit Supplier' : 'Add Supplier'}
                            </h2>
                            <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent transition-colors">
                                <X className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Basic Information</p>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Supplier Name *</label>
                                        <Input
                                            placeholder="e.g. Acme Supplies Ltd"
                                            value={formName}
                                            onChange={(e) => setFormName(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Contact Person</label>
                                        <Input
                                            placeholder="Full name"
                                            value={formContact}
                                            onChange={(e) => setFormContact(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Email</label>
                                            <Input type="email" placeholder="email@example.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Phone</label>
                                            <Input placeholder="+254 700 000000" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Tax Number (KRA PIN)</label>
                                            <Input placeholder="e.g. A000000000B" value={formTaxNumber} onChange={(e) => setFormTaxNumber(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Tax PIN</label>
                                            <Input placeholder="Tax PIN" value={taxPin} onChange={(e) => setTaxPin(e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Address</label>
                                        <Input placeholder="Physical or postal address" value={formAddress} onChange={(e) => setFormAddress(e.target.value)} />
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-border pt-5">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Payment Configuration</p>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Payment Method</label>
                                        <select
                                            value={paymentMethod}
                                            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodType)}
                                            className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                        >
                                            {PAYMENT_METHODS.map((m) => (
                                                <option key={m.value} value={m.value}>{m.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {isMpesa && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">M-Pesa Phone</label>
                                                <Input placeholder="254700000000" value={mpesaPhone} onChange={(e) => setMpesaPhone(e.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Business Name</label>
                                                <Input placeholder="Paybill business name" value={mpesaBusinessName} onChange={(e) => setMpesaBusinessName(e.target.value)} />
                                            </div>
                                        </div>
                                    )}

                                    {isBank && (
                                        <div className="space-y-4">
                                            {/* Verify the account against Paystack (auto-fills the account holder name). */}
                                            <BankVerifyFields
                                                orgSlug={orgSlug}
                                                bankName={bankName}
                                                bankCode={bankCode}
                                                accountNumber={bankAccount}
                                                onChange={(patch) => {
                                                    if (patch.bank_name !== undefined) setBankName(patch.bank_name);
                                                    if (patch.bank_code !== undefined) setBankCode(patch.bank_code);
                                                    if (patch.account_number !== undefined) setBankAccount(patch.account_number);
                                                }}
                                            />
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Branch (optional)</label>
                                                <Input placeholder="Branch name" value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} />
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Payment Terms (days)</label>
                                            <Input type="number" min="0" placeholder="e.g. 30" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Credit Limit (KES)</label>
                                            <Input type="number" min="0" placeholder="0" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
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
                                            <span className="text-sm">Enable Auto-Pay (automatically trigger payout on PO receipt)</span>
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

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Notes</label>
                                <textarea
                                    placeholder="Additional notes about this supplier..."
                                    value={formNotes}
                                    onChange={(e) => setFormNotes(e.target.value)}
                                    rows={2}
                                    className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none resize-none"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                                    Cancel
                                </Button>
                                <Button type="submit" className="flex-1" disabled={isPending}>
                                    {isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
