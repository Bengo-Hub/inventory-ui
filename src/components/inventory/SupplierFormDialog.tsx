'use client';

import { useState } from 'react';
import { Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { BankVerifyFields } from '@/components/inventory/BankVerifyFields';
import { DuplicateNameWarning } from '@/components/inventory/DuplicateNameWarning';
import { findDuplicateMatches } from '@/hooks/useDuplicateNameWarning';
import { useSuppliers } from '@/hooks/useSuppliers';
import { SupplierForm, type SupplierFormValues, type CreatedSupplier } from '@/components/shared/SupplierForm';
import { type Supplier, type CreateSupplierInput } from '@/lib/api/suppliers';
import { X } from 'lucide-react';
import { useParams } from 'next/navigation';

interface Props {
    editing: Supplier | null;
    isPending: boolean;
    onSubmit: (data: CreateSupplierInput) => void;
    onClose: () => void;
    /**
     * When given, "Use this instead" on the duplicate-warning panel picks the matched
     * supplier and closes (e.g. the item form's inline "+ Add new vendor" flow, which sets
     * it as the item's preferred supplier). Omitted on the standalone Suppliers page, where
     * there's nothing else to wire the pick to.
     */
    onSelectExisting?: (supplier: Supplier) => void;
}

// Thin dialog chrome around the shared, dependency-light SupplierForm. The form body is the
// SAME component reused by the item "+ Add new vendor" flow and (later) treasury-ui — no
// duplicate form. The inventory-specific Paystack account-verify widget is injected via the
// form's renderBankFields slot, keeping the shared form free of inventory imports.
export function SupplierFormDialog({ editing, isPending, onSubmit, onClose, onSelectExisting }: Props) {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;

    // Full-ish supplier list for the duplicate check below. Suppliers are a small,
    // tenant-scoped list (unlike items), so a generous page size effectively gets "all of them"
    // without needing a dedicated search endpoint.
    const { data: suppliersPage } = useSuppliers(orgSlug, { limit: 500 });

    // The shared SupplierForm (from @bengo-hub/shared-ui-lib) owns its own name field
    // internally and only hands back values on submit — it exposes no onChange hook to watch
    // keystrokes — so a LIVE inline warning like the Item/Menu Item forms isn't possible here.
    // Instead we intercept the first submit attempt: if a close/exact name match exists, hold
    // the values and show a confirmation panel instead of creating immediately. "Create anyway"
    // proceeds with the original submit; "Use this instead" (when wired) picks the match.
    const [pendingValues, setPendingValues] = useState<SupplierFormValues | null>(null);

    async function handleSubmit(values: SupplierFormValues): Promise<CreatedSupplier | void> {
        if (!editing) {
            const matches = findDuplicateMatches(suppliersPage?.data, values.name);
            if (matches.length > 0) {
                setPendingValues(values);
                return; // hold — wait for confirmation in the panel below
            }
        }
        onSubmit(values as CreateSupplierInput);
    }

    const pendingMatches = pendingValues ? findDuplicateMatches(suppliersPage?.data, pendingValues.name) : [];

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

            {pendingValues && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setPendingValues(null)} />
                    <div className="relative z-[70] w-full max-w-md mx-4">
                        <Card>
                            <CardHeader>
                                <h2 className="text-lg font-semibold">Possible duplicate supplier</h2>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <DuplicateNameWarning
                                    matches={pendingMatches}
                                    entityLabel="supplier"
                                    renderDetail={(s) => s.contact_person || s.phone || s.email}
                                    onUseExisting={onSelectExisting ? (s) => { onSelectExisting(s); setPendingValues(null); } : undefined}
                                />
                                <p className="text-xs text-muted-foreground">
                                    This is just a heads-up — legitimately similar supplier names can exist. You can still create it.
                                </p>
                                <div className="flex gap-3">
                                    <Button type="button" variant="outline" className="flex-1" onClick={() => setPendingValues(null)}>
                                        Go back
                                    </Button>
                                    <Button
                                        type="button"
                                        className="flex-1"
                                        onClick={() => {
                                            const values = pendingValues;
                                            setPendingValues(null);
                                            onSubmit(values as CreateSupplierInput);
                                        }}
                                    >
                                        Create anyway
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
