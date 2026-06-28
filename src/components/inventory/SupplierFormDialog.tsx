'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/base';
import { BankVerifyFields } from '@/components/inventory/BankVerifyFields';
import { SupplierForm, type SupplierFormValues, type CreatedSupplier } from '@/components/shared/SupplierForm';
import { type Supplier, type CreateSupplierInput } from '@/lib/api/suppliers';
import { X } from 'lucide-react';
import { useParams } from 'next/navigation';

interface Props {
    editing: Supplier | null;
    isPending: boolean;
    onSubmit: (data: CreateSupplierInput) => void;
    onClose: () => void;
}

// Thin dialog chrome around the shared, dependency-light SupplierForm. The form body is the
// SAME component reused by the item "+ Add new vendor" flow and (later) treasury-ui — no
// duplicate form. The inventory-specific Paystack account-verify widget is injected via the
// form's renderBankFields slot, keeping the shared form free of inventory imports.
export function SupplierFormDialog({ editing, isPending, onSubmit, onClose }: Props) {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;

    // Bridge the shared form's payload onto the page's existing onSubmit (which owns the
    // create/update mutation + toasts). We resolve immediately so the form's own pending state
    // stays in step with the page-level isPending the parent already tracks.
    async function handleSubmit(values: SupplierFormValues): Promise<CreatedSupplier | void> {
        onSubmit(values as CreateSupplierInput);
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
                        <SupplierForm
                            isEdit={!!editing}
                            initialValues={editing ?? undefined}
                            onSubmit={handleSubmit}
                            onCancel={onClose}
                            submitLabel={isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
                            renderBankFields={({ bankName, bankCode, accountNumber, onChange }) => (
                                <BankVerifyFields
                                    orgSlug={orgSlug}
                                    bankName={bankName}
                                    bankCode={bankCode}
                                    accountNumber={accountNumber}
                                    onChange={onChange}
                                />
                            )}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
