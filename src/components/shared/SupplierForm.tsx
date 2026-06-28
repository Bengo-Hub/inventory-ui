'use client';

/**
 * Re-export of the shared SupplierForm now that it ships in
 * `@bengo-hub/shared-ui-lib` (v0.1.24+) at the `./suppliers` subpath.
 *
 * The implementation previously lived here as a byte-identical local copy while the lib
 * publish was pending; the extraction is now complete (lib tagged v0.1.24, this app's
 * dependency bumped). App code keeps importing from this path so call sites are unchanged —
 * this module is just a thin re-export of the canonical shared component.
 */
export {
  SupplierForm,
  type SupplierFormProps,
  type SupplierFormValues,
  type SupplierPaymentMethod,
  type CreatedSupplier,
  type SupplierBankFieldRenderArgs,
} from '@bengo-hub/shared-ui-lib/suppliers';
