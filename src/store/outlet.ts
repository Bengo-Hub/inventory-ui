import { apiClient } from '@/lib/api/client';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface OutletInfo {
  id: string;
  code: string;
  name: string;
  use_case?: string;
  is_hq?: boolean;
  status?: string;
  default_warehouse_id?: string | null;
}

export const INVENTORY_SELECTED_OUTLET_KEY = 'inventory-selected-outlet-id';

interface OutletState {
  /** The outlet the user selected at login — their home context. */
  outlet: OutletInfo | null;
  /** HQ admin drill-down selection (overrides home outlet for queries). */
  selectedOutletId: string | null;

  setOutlet: (outlet: OutletInfo | null) => void;
  setSelectedOutletId: (id: string | null) => void;
  clearOutlet: () => void;
}

export const useOutletStore = create<OutletState>()(
  persist(
    (set, get) => ({
      outlet: null,
      selectedOutletId: null,

      setOutlet: (outlet) => {
        set({ outlet });
        if (outlet?.id) {
          localStorage.setItem(INVENTORY_SELECTED_OUTLET_KEY, outlet.id);
          const { selectedOutletId } = get();
          if (!selectedOutletId) apiClient.setOutletID(outlet.id);
        } else {
          localStorage.removeItem(INVENTORY_SELECTED_OUTLET_KEY);
          apiClient.setOutletID(null);
        }
      },

      setSelectedOutletId: (id) => {
        set({ selectedOutletId: id });
        if (id) {
          apiClient.setOutletID(id);
        } else {
          const { outlet } = get();
          apiClient.setOutletID(outlet?.id ?? null);
        }
      },

      clearOutlet: () => {
        set({ outlet: null, selectedOutletId: null });
        localStorage.removeItem(INVENTORY_SELECTED_OUTLET_KEY);
        apiClient.setOutletID(null);
      },
    }),
    {
      name: 'inventory-outlet-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ outlet: state.outlet }),
      onRehydrateStorage: () => (state) => {
        if (state?.outlet?.id) {
          apiClient.setOutletID(state.outlet.id);
        }
      },
    }
  )
);
